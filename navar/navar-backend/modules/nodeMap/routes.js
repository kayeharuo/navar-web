'use strict'

const { floorPlanImageUrl } = require('../storage/imageStorage')
const { buildNodeMap } = require('./validation')
const { loadBeacons, canonicalContent, validateBeacons, findMatchingSnapshot } = require('./beacons')

const saveBody = {
	type: 'object',
	required: ['baseRevision', 'nodes', 'edges', 'calibrations'],
	properties: {
		baseRevision: { type: 'integer', minimum: 0 },
		finalize: { type: 'boolean' },
        snapshotId: { type: 'integer', minimum: 1 },
        baseBeaconRevision: { type: 'integer', minimum: 0 },
        confirmAssignmentRemoval: { type: 'boolean' },
        beacons: { type: 'array', maxItems: 5000, items: { type: 'object' } },
        transitionGroups: { type: 'array', maxItems: 5000, items: { type: 'object' } },
		nodes: { type: 'array', maxItems: 5000, items: { type: 'object' } },
		edges: { type: 'array', maxItems: 15000, items: { type: 'object' } },
		calibrations: { type: 'array', maxItems: 100, items: { type: 'object' } },
	},
	additionalProperties: false,
}
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }

// Loads everything the validator and the editor need for one AR development.
async function loadMapContext(supabase, arDevelopmentId) {
	const development = await supabase.from('ar_development')
		.select('ar_development_id, application_id, ar_development_status, ar_development_map_revision, ar_development_updated_at')
		.eq('ar_development_id', arDevelopmentId).maybeSingle()
	if (development.error) throw development.error
	if (!development.data) return null

	const application = await supabase.from('application').select('application_id, mall_id, application_version').eq('application_id', development.data.application_id).single()
	if (application.error) throw application.error
	const mallId = application.data.mall_id

	const [mall, floors, plans] = await Promise.all([
		supabase.from('mall').select('mall_id, mall_name, mall_beacon_revision').eq('mall_id', mallId).single(),
		supabase.from('floor').select('floor_id, floor_num, floor_label').eq('mall_id', mallId).order('floor_num').order('floor_id'),
		supabase.from('application_floor_plan').select('app_floor_plan_id, floor_id, app_floor_plan_reference_line, app_floor_plan_meter_length, app_floor_plan_file_name, app_floor_plan_created_at')
			.eq('application_id', development.data.application_id).order('app_floor_plan_id', { ascending: false }),
	])
	if (mall.error) throw mall.error
	if (floors.error) throw floors.error
	if (plans.error) throw plans.error

	// One plan per floor: the most recently uploaded one.
	const planByFloor = new Map()
	for (const plan of plans.data || []) if (!planByFloor.has(plan.floor_id)) planByFloor.set(plan.floor_id, plan)
	const planFloors = (floors.data || []).filter(floor => planByFloor.has(floor.floor_id))

	return { development: development.data, application: application.data, mall: mall.data, floors: planFloors, planByFloor }
}

function revisionConflict(reply) {
	return reply.code(409).send({ message: 'The map was changed by someone else. Reload to get the latest version.', code: 'revision_conflict' })
}

module.exports = function registerNodeMapRoutes(app) {
	app.post('/api/ar-developments/:id/node-map/snapshots/match', { bodyLimit: 8 * 1024 * 1024, schema: { params: idParams, body: saveBody } }, async (request, reply) => {
		const context = await loadMapContext(app.supabase, request.params.id)
		if (!context) return reply.code(404).send({ message: 'AR development not found.' })
		return { match: await findMatchingSnapshot(app.supabase, request.params.id, request.body), revision: context.development.ar_development_map_revision, beaconRevision: context.mall.mall_beacon_revision }
	})
	app.get('/api/ar-developments/:id/node-map/snapshots', { schema: { params: idParams } }, async (request, reply) => {
		const context = await loadMapContext(app.supabase, request.params.id)
		if (!context) return reply.code(404).send({ message: 'AR development not found.' })
		const result = await app.supabase.from('node_map_snapshot').select('snapshot_id,name,created_at').eq('ar_development_id', request.params.id).order('snapshot_id', { ascending: false })
		if (result.error) throw result.error
		return result.data
	})
	app.get('/api/ar-developments/:id/node-map/snapshots/:snapshotId', async (request, reply) => {
		const result = await app.supabase.from('node_map_snapshot').select('*').eq('ar_development_id', request.params.id).eq('snapshot_id', request.params.snapshotId).maybeSingle()
		if (result.error) throw result.error
		if (!result.data) return reply.code(404).send({ message: 'Snapshot not found for this AR version.' })
		const identities = await app.supabase.from('node_map_editor_identity').select('node_ids,beacon_ids').eq('ar_development_id', request.params.id).maybeSingle()
		if (identities.error) throw identities.error
		return { ...result.data, identities: identities.data || { node_ids: {}, beacon_ids: {} } }
	})
	app.post('/api/ar-developments/:id/node-map/snapshots', {
		bodyLimit: 8 * 1024 * 1024,
		schema: { params: idParams, body: { type: 'object', required: ['name', 'payload'], additionalProperties: false, properties: {
			name: { type: 'string', minLength: 1, maxLength: 100 }, payload: { type: 'object', required: ['nodes', 'edges', 'calibration', 'groups', 'floorIds'] },
		} } },
	}, async (request, reply) => {
		const context = await loadMapContext(app.supabase, request.params.id)
		if (!context) return reply.code(404).send({ message: 'AR development not found.' })
		if (context.development.ar_development_status !== 'node_mapping') return reply.code(409).send({ message: 'Snapshots can only be created during Node Mapping.' })
		if (!request.body.name.trim()) return reply.code(400).send({ message: 'Enter a snapshot name.' })
		const body = request.body.payload.saveBody
		if (!body || !Array.isArray(body.beacons) || !Array.isArray(body.nodes)) return reply.code(422).send({ message: 'Save a snapshot containing map and beacon data.' })
		const errors = validateBeacons(body.beacons, body.nodes)
		if (errors.length) return reply.code(422).send({ message: errors[0], errors })
		const existing = await findMatchingSnapshot(app.supabase, request.params.id, body)
		if (existing) return { snapshot_id: existing.id, name: existing.name, existing: true }
		const result = await app.supabase.from('node_map_snapshot').insert({ ar_development_id: request.params.id, name: request.body.name.trim(), payload: request.body.payload, created_by: request.admin.id }).select('snapshot_id,name,created_at').single()
		if (result.error) throw result.error
		return reply.code(201).send(result.data)
	})
	app.get('/api/ar-developments/:id/node-map', { schema: { params: idParams } }, async (request, reply) => {
		try {
			const context = await loadMapContext(app.supabase, request.params.id)
			if (!context) return reply.code(404).send({ message: 'AR development not found.' })
			const floorIds = context.floors.map(floor => floor.floor_id)
			const beaconState = await loadBeacons(app.supabase, context.application.mall_id, request.params.id)

			const [nodes, edges, calibrations, units, stalls, transitionGroups] = await Promise.all([
				floorIds.length ? app.supabase.from('node').select('*').eq('ar_development_id', request.params.id).in('floor_id', floorIds).order('node_id') : { data: [], error: null },
				app.supabase.from('edge').select('*').eq('ar_development_id', request.params.id).order('edge_id'),
				app.supabase.from('floor_calibration').select('*').eq('ar_development_id', request.params.id),
				floorIds.length ? app.supabase.from('unit').select('unit_id, unit_label, floor_id, store_id').in('floor_id', floorIds).not('store_id', 'is', null).order('unit_label') : { data: [], error: null },
				app.supabase.from('store').select('store_id, store_name, store_type, store_status, onboarding_floor_id').eq('mall_id', context.application.mall_id).eq('store_type', 'stall').order('store_name'),
                app.supabase.from('transition_group').select('transition_group_id, transition_group_name, transition_group_type').eq('ar_development_id', request.params.id).order('transition_group_name'),
			])
			for (const result of [nodes, edges, calibrations, units, stalls, transitionGroups]) if (result.error) throw result.error

			const storeIds = [...new Set((units.data || []).map(unit => unit.store_id))]
			const stores = storeIds.length ? await app.supabase.from('store').select('store_id, store_name, store_status').in('store_id', storeIds) : { data: [], error: null }
			if (stores.error) throw stores.error
			const storeById = new Map((stores.data || []).map(store => [store.store_id, store]))

			const calibrationByFloor = new Map((calibrations.data || []).map(row => [row.floor_id, row]))
			const floors = []
			for (const floor of context.floors) {
				const plan = context.planByFloor.get(floor.floor_id)
				let imageUrl = null
				try {
					const file = await app.supabase.from('application_floor_plan').select('app_floor_plan_storage_path, app_floor_plan_image').eq('app_floor_plan_id', plan.app_floor_plan_id).single()
					if(file.error)throw file.error
          if(file.data)imageUrl=await floorPlanImageUrl(app.supabase,file.data,4*60*60)
				} catch (error) {
					request.log.error({ code: error.code, message: error.message, floorId: floor.floor_id }, 'Floor plan URL failed')
				}
				const saved = calibrationByFloor.get(floor.floor_id)
				floors.push({
					floorId: floor.floor_id,
					floorNum: floor.floor_num,
					label: floor.floor_label,
					floorPlanId: plan.app_floor_plan_id,
					imageUrl,
					// What the mall admin typed on the application. The two pixel points must still be clicked in the editor.
					submittedReference: { label: plan.app_floor_plan_reference_line || '', meters: plan.app_floor_plan_meter_length || null },
					calibration: saved ? {
						refStart: { x: saved.calibration_ref_start_x, y: saved.calibration_ref_start_y },
						refEnd: { x: saved.calibration_ref_end_x, y: saved.calibration_ref_end_y },
						meters: saved.calibration_real_meters,
						pixelsPerMeter: saved.calibration_pixel_per_meter,
						pathLossExponent: saved.calibration_path_loss_exponent,
						refLine: saved.calibration_ref_label || '',
					} : null,
				})
			}

			const pixelsPerMeterByFloor = new Map(floors.map(floor => [floor.floorId, floor.calibration?.pixelsPerMeter || null]))
			const nodeRows = nodes.data || []
			const nodeIds = new Set(nodeRows.map(node => node.node_id))
			return {
				transitionGroups: (transitionGroups.data || []).map(g => ({ id: g.transition_group_id, name: g.transition_group_name, type: g.transition_group_type })),
                arDevelopmentId: context.development.ar_development_id,
                beaconState,
				mallId: context.mall.mall_id,
				mallName: context.mall.mall_name,
				status: context.development.ar_development_status,
				revision: context.development.ar_development_map_revision,
				floors,
				nodes: nodeRows.map(node => {
					const ppm = pixelsPerMeterByFloor.get(node.floor_id)
					// Nodes created before pixel positions were stored are rebuilt from meters when the floor is calibrated.
					return {
						dbId: node.node_id,
						floorId: node.floor_id,
						type: node.node_type,
						label: node.node_label || '',
						pixelX: node.node_pixel_x ?? (ppm ? node.node_x_coordinate * ppm : null),
						pixelY: node.node_pixel_y ?? (ppm ? node.node_y_coordinate * ppm : null),
						xMeters: node.node_x_coordinate,
						yMeters: node.node_y_coordinate,
                        isEmergency: node.node_is_emergency,
						unitId: node.unit_id,
						storeId: node.store_id,
						isActive: node.node_is_active!==false,
						transitionGroupId: node.transition_group_id,
					}
				}).filter(node => node.pixelX != null && node.pixelY != null),
				edges: (edges.data || [])
					.filter(edge => nodeIds.has(edge.start_node_id) && nodeIds.has(edge.end_node_id))
					.map(edge => ({ dbId: edge.edge_id, fromDbId: edge.start_node_id, toDbId: edge.end_node_id, pathType: edge.edge_path_type, direction: edge.edge_direction, distance: edge.edge_distance })),
				units: (units.data || []).map(unit => ({
					unitId: unit.unit_id,
					unitLabel: unit.unit_label,
					floorId: unit.floor_id,
					storeId: unit.store_id,
					storeName: storeById.get(unit.store_id)?.store_name || '',
				})),
				stalls: (stalls.data || []).map(store => ({ storeId: store.store_id, storeName: store.store_name, floorId:store.onboarding_floor_id })),
			}
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Node map load failed')
			return reply.code(500).send({ message: 'Unable to load the map.' })
		}
	})

	app.put('/api/ar-developments/:id/node-map', { bodyLimit: 8 * 1024 * 1024, schema: { params: idParams, body: saveBody } }, async (request, reply) => {
		try {
			const context = await loadMapContext(app.supabase, request.params.id)
			if (!context) return reply.code(404).send({ message: 'AR development not found.' })
			if (String(context.development.ar_development_status).toLowerCase() !== 'node_mapping') {
				return reply.code(409).send({ message: 'The map can only be edited while the AR development is in Node Mapping.' })
			}
			if (context.development.ar_development_map_revision !== request.body.baseRevision) return revisionConflict(reply)
			if (!request.body.finalize || !request.body.snapshotId || !Array.isArray(request.body.beacons) || request.body.baseBeaconRevision == null) return reply.code(422).send({ message: 'Save the current map and beacons as a snapshot, then use Save & Validate.' })
			const snapshot = await app.supabase.from('node_map_snapshot').select('payload').eq('ar_development_id', request.params.id).eq('snapshot_id', request.body.snapshotId).maybeSingle()
			if (snapshot.error) throw snapshot.error
			if (!snapshot.data?.payload?.saveBody || canonicalContent(snapshot.data.payload.saveBody) !== canonicalContent(request.body)) return reply.code(422).send({ message: 'The map or beacons differ from the saved snapshot. Save a new snapshot first.' })
			const beaconErrors = validateBeacons(request.body.beacons, request.body.nodes)
			if (beaconErrors.length) return reply.code(422).send({ message: beaconErrors[0], errors: beaconErrors })

			const floorIds = context.floors.map(floor => floor.floor_id)
			const [existing, units, stores] = await Promise.all([
				floorIds.length ? app.supabase.from('node').select('node_id').eq('ar_development_id', request.params.id).in('floor_id', floorIds) : { data: [], error: null },
				floorIds.length ? app.supabase.from('unit').select('unit_id, unit_label, floor_id, store_id').in('floor_id', floorIds) : { data: [], error: null },
				app.supabase.from('store').select('store_id, store_type, onboarding_floor_id').eq('mall_id', context.application.mall_id),
			])
			for (const result of [existing, units, stores]) if (result.error) throw result.error

			const built = buildNodeMap(request.body, {
				floorIds: new Set(floorIds),
				floorNumbers: new Map(context.floors.map(floor => [floor.floor_id, floor.floor_num])),
                floorLabels: new Map(context.floors.map(floor => [floor.floor_id, floor.floor_label || `Floor ${floor.floor_num}`])),
				existingNodeIds: new Set((existing.data || []).map(row => row.node_id)),
				units: new Map((units.data || []).map(row => [row.unit_id, row])),
				stores: new Map((stores.data || []).map(row => [row.store_id, row])),
			})
			if (built.errors.length) return reply.code(422).send({ message: built.errors[0], errors: built.errors, warnings: built.warnings })

			const saved = await app.supabase.rpc('apply_node_map_snapshot', {
				p_ar_development_id: context.development.ar_development_id,
				p_base_revision: request.body.baseRevision,
				p_payload: { floor_ids: floorIds, ...built.payload },
                p_beacons: request.body.beacons,
                p_beacon_revision: request.body.baseBeaconRevision,
                p_snapshot_id: request.body.snapshotId,
                p_confirm_removal: Boolean(request.body.confirmAssignmentRemoval),
                p_actor: request.admin.id,
			})
			if (saved.error) {
				if (saved.error.code === 'NM409') return reply.code(409).send({ message: saved.error.message, code: 'revision_conflict' })
				if (saved.error.code === 'NM422') return reply.code(422).send({ message: saved.error.message, errors: [saved.error.message], warnings: built.warnings })
				if (saved.error.code === 'NM404') return reply.code(404).send({ message: 'AR development not found.' })
				throw saved.error
			}

			return {
				revision: saved.data.revision,
				// editor client id -> database id, so editing can continue without a reload
				nodeIds: saved.data.node_ids,
                beaconIds: saved.data.beacon_ids,
                beaconRevision: saved.data.beacon_revision,
				edgeIds: saved.data.edge_ids,
				savedAt: new Date().toISOString(),
				warnings: built.warnings,
			}
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Node map save failed')
			return reply.code(500).send({ message: 'Unable to save the map.' })
		}
	})
}
