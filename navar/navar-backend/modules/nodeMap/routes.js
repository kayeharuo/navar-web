'use strict'

const { signedImageUrl } = require('../storage/imageStorage')
const { buildNodeMap } = require('./validation')

const saveBody = {
	type: 'object',
	required: ['baseRevision', 'nodes', 'edges', 'calibrations'],
	properties: {
		baseRevision: { type: 'integer', minimum: 0 },
		finalize: { type: 'boolean' },
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
		supabase.from('mall').select('mall_id, mall_name').eq('mall_id', mallId).single(),
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
	app.get('/api/ar-developments/:id/node-map', { schema: { params: idParams } }, async (request, reply) => {
		try {
			const context = await loadMapContext(app.supabase, request.params.id)
			if (!context) return reply.code(404).send({ message: 'AR development not found.' })
			const floorIds = context.floors.map(floor => floor.floor_id)

			const [nodes, edges, calibrations, units, stalls] = await Promise.all([
				floorIds.length ? app.supabase.from('node').select('*').eq('ar_development_id', request.params.id).in('floor_id', floorIds).order('node_id') : { data: [], error: null },
				app.supabase.from('edge').select('*').eq('ar_development_id', request.params.id).order('edge_id'),
				app.supabase.from('floor_calibration').select('*').eq('ar_development_id', request.params.id),
				floorIds.length ? app.supabase.from('unit').select('unit_id, unit_label, floor_id, store_id').in('floor_id', floorIds).not('store_id', 'is', null).order('unit_label') : { data: [], error: null },
				app.supabase.from('store').select('store_id, store_name, store_type, store_status').eq('mall_id', context.application.mall_id).eq('store_type', 'stall').order('store_name'),
			])
			for (const result of [nodes, edges, calibrations, units, stalls]) if (result.error) throw result.error

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
					const storagePath = file.data?.app_floor_plan_storage_path || file.data?.app_floor_plan_image
					if (storagePath) imageUrl = await signedImageUrl(app.supabase, storagePath, 4 * 60 * 60)
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
				arDevelopmentId: context.development.ar_development_id,
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
						isAccessible: node.node_is_accessible,
						unitId: node.unit_id,
						storeId: node.store_id,
						crossFloorDbId: node.node_cross_floor_link_id,
					}
				}).filter(node => node.pixelX != null && node.pixelY != null),
				edges: (edges.data || [])
					.filter(edge => !edge.edge_is_cross_floor && nodeIds.has(edge.start_node_id) && nodeIds.has(edge.end_node_id))
					.map(edge => ({ dbId: edge.edge_id, fromDbId: edge.start_node_id, toDbId: edge.end_node_id, pathType: edge.edge_path_type, distance: edge.edge_distance })),
				units: (units.data || []).map(unit => ({
					unitId: unit.unit_id,
					unitLabel: unit.unit_label,
					floorId: unit.floor_id,
					storeId: unit.store_id,
					storeName: storeById.get(unit.store_id)?.store_name || '',
				})),
				stalls: (stalls.data || []).map(store => ({ storeId: store.store_id, storeName: store.store_name })),
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

			const floorIds = context.floors.map(floor => floor.floor_id)
			const [existing, units, stores] = await Promise.all([
				floorIds.length ? app.supabase.from('node').select('node_id').eq('ar_development_id', request.params.id).in('floor_id', floorIds) : { data: [], error: null },
				floorIds.length ? app.supabase.from('unit').select('unit_id, unit_label, floor_id, store_id').in('floor_id', floorIds) : { data: [], error: null },
				app.supabase.from('store').select('store_id, store_type').eq('mall_id', context.application.mall_id),
			])
			for (const result of [existing, units, stores]) if (result.error) throw result.error

			const built = buildNodeMap(request.body, {
				floorIds: new Set(floorIds),
				floorLabels: new Map(context.floors.map(floor => [floor.floor_id, floor.floor_label || `Floor ${floor.floor_num}`])),
				existingNodeIds: new Set((existing.data || []).map(row => row.node_id)),
				units: new Map((units.data || []).map(row => [row.unit_id, row])),
				stores: new Map((stores.data || []).map(row => [row.store_id, row])),
			})
			if (built.errors.length) return reply.code(422).send({ message: built.errors[0], errors: built.errors, warnings: built.warnings })

			const saved = await app.supabase.rpc('save_node_map', {
				p_ar_development_id: context.development.ar_development_id,
				p_base_revision: request.body.baseRevision,
				p_payload: { floor_ids: floorIds, ...built.payload },
			})
			if (saved.error) {
				if (saved.error.code === 'NM409') return reply.code(409).send({ message: saved.error.message, code: 'revision_conflict' })
				if (saved.error.code === 'NM422') return reply.code(422).send({ message: saved.error.message, errors: [saved.error.message], warnings: built.warnings })
				if (saved.error.code === 'NM404') return reply.code(404).send({ message: 'AR development not found.' })
				throw saved.error
			}

			const audit = await app.supabase.from('audit_log').insert({
				audit_log_module: 'node_map',
				audit_log_action: request.body.finalize ? 'node_map_final_save' : 'node_map_draft_save',
				audit_log_details: `AR development ${context.development.ar_development_id}: ${built.payload.nodes.length} nodes, ${built.payload.edges.length} edges`,
				audit_log_performed_at: new Date().toISOString(),
				audit_log_performed_by: request.admin.id,
				mall_id: context.application.mall_id,
			})
			if (audit.error) request.log.error({ code: audit.error.code }, 'Node map audit write failed')

			return {
				revision: saved.data.revision,
				// editor client id -> database id, so editing can continue without a reload
				nodeIds: saved.data.node_ids,
				savedAt: new Date().toISOString(),
				warnings: built.warnings,
			}
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Node map save failed')
			return reply.code(500).send({ message: 'Unable to save the map.' })
		}
	})
}
