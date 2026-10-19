'use strict'

const { NODE_TYPES, PATH_TYPES, FLOOR_CHANGE_COST_M } = require('./nodeTypes')

const MAX_NODES = 5000
const MAX_EDGES = 15000
const MAX_PIXEL = 100000
const MIN_REFERENCE_PIXELS = 10
const MIN_PIXELS_PER_METER = 0.1
const MAX_PIXELS_PER_METER = 1000
// NavAR Complete Workflow 1.4: corridor nodes every 5 to 8 meters for BLE coverage.
const LONG_EDGE_WARNING_M = 10
const SHORT_REFERENCE_WARNING_PX = 200

const round3 = value => Math.round(value * 1000) / 1000
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value)
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)

// context: { floorIds:Set, floorLabels:Map, existingNodeIds:Set,
//            units:Map(unit_id -> row), stores:Map(store_id -> row) }
// Turns what the editor sent into the exact rows the database function stores.
// Nothing the browser computed is trusted: meters, distances and flags are derived here.
function buildNodeMap(body, context) {
	const errors = []
	const warnings = []
	const fail = message => { if (errors.length < 25) errors.push(message) }
	const floorLabel = id => context.floorLabels.get(id) || `floor ${id}`

	const nodesIn = Array.isArray(body.nodes) ? body.nodes : []
	const edgesIn = Array.isArray(body.edges) ? body.edges : []
	const calibrationsIn = Array.isArray(body.calibrations) ? body.calibrations : []

	if (nodesIn.length > MAX_NODES) fail(`A map can have at most ${MAX_NODES} nodes.`)
	if (edgesIn.length > MAX_EDGES) fail(`A map can have at most ${MAX_EDGES} edges.`)
	if (errors.length) return { errors, warnings, payload: null }

	// ---- Calibration: pixels per meter is computed here from the two clicked points. ----
	const calibrationByFloor = new Map()
	for (const item of calibrationsIn) {
		if (!context.floorIds.has(item.floorId)) { fail('A calibration belongs to a floor that is not part of this application.'); continue }
		if (calibrationByFloor.has(item.floorId)) { fail(`${floorLabel(item.floorId)} has more than one calibration.`); continue }
		const points = [item.refStart?.x, item.refStart?.y, item.refEnd?.x, item.refEnd?.y]
		if (!points.every(isFiniteNumber)) { fail(`${floorLabel(item.floorId)}: the scale reference points are invalid.`); continue }
		const pixelLength = Math.hypot(item.refEnd.x - item.refStart.x, item.refEnd.y - item.refStart.y)
		if (pixelLength < MIN_REFERENCE_PIXELS) { fail(`${floorLabel(item.floorId)}: the scale reference line is too short. Draw it between two far-apart points.`); continue }
		if (!(item.meters > 0)) { fail(`${floorLabel(item.floorId)}: the real-world length must be greater than 0.`); continue }
		if (!(item.pathLossExponent >= 1 && item.pathLossExponent <= 6)) { fail(`${floorLabel(item.floorId)}: the path loss exponent must be between 1 and 6.`); continue }
		const pixelsPerMeter = pixelLength / item.meters
		if (pixelsPerMeter < MIN_PIXELS_PER_METER || pixelsPerMeter > MAX_PIXELS_PER_METER) {
			fail(`${floorLabel(item.floorId)}: the scale (${pixelsPerMeter.toFixed(2)} px/m) is not realistic. Check the reference length.`)
			continue
		}
		if (pixelLength < SHORT_REFERENCE_WARNING_PX) {
			warnings.push({ code: 'short_reference', message: `${floorLabel(item.floorId)}: the scale reference is only ${Math.round(pixelLength)} px long. A short line magnifies click errors; use the longest known distance on the plan.` })
		}
		calibrationByFloor.set(item.floorId, { ...item, pixelsPerMeter })
	}

	// ---- Nodes ----
	const nodeByClientId = new Map()
	const usedDbIds = new Set()
	const reportedUncalibrated = new Set()
	for (const item of nodesIn) {
		if (nodeByClientId.has(item.clientId)) { fail(`Node id "${item.clientId}" is duplicated.`); continue }
		const label = String(item.label || '').trim()
		const type = NODE_TYPES[item.type]
		const where = `Node "${label || item.clientId}"`
		if (!context.floorIds.has(item.floorId)) { fail(`${where} is on a floor that is not part of this application.`); continue }
		if (!type) { fail(`${where} has an unknown type.`); continue }
		if (!label || label.length > 100) { fail(`A ${item.type} node on ${floorLabel(item.floorId)} needs a label of 1 to 100 characters.`); continue }
		if (!isFiniteNumber(item.pixelX) || !isFiniteNumber(item.pixelY) || item.pixelX < 0 || item.pixelY < 0 || item.pixelX > MAX_PIXEL || item.pixelY > MAX_PIXEL) {
			fail(`${where} has an invalid position.`)
			continue
		}
		if (item.dbId != null) {
			if (!context.existingNodeIds.has(item.dbId)) { fail(`${where} does not exist in this mall any more. Reload the editor.`); continue }
			if (usedDbIds.has(item.dbId)) { fail(`${where} is listed twice.`); continue }
			usedDbIds.add(item.dbId)
		}

		let storeId = null
		let unitId = null
		if (item.type === 'STORE_ENTRANCE') {
			const unit = context.units.get(item.unitId)
			if (!unit) { fail(`${where} must be linked to a store unit.`); continue }
			if (unit.floor_id !== item.floorId) { fail(`${where} is linked to a unit on a different floor.`); continue }
			if (!unit.store_id) { fail(`${where} is linked to unit ${unit.unit_label}, which has no store.`); continue }
			unitId = unit.unit_id
			storeId = unit.store_id
		} else if (item.type === 'STALL') {
			const store = context.stores.get(item.storeId)
			if (!store || store.store_type !== 'stall') { fail(`${where} must be linked to a stall store.`); continue }
			storeId = store.store_id
		} else if (item.unitId != null || item.storeId != null) {
			fail(`${where} is a ${type.group.toLowerCase()} node and cannot be linked to a store.`)
			continue
		}

		const calibration = calibrationByFloor.get(item.floorId)
		if (!calibration) {
			if (!reportedUncalibrated.has(item.floorId)) {
				reportedUncalibrated.add(item.floorId)
				fail(`${floorLabel(item.floorId)} has nodes but no scale. Use Set Scale on that floor, then save again.`)
			}
			continue
		}

		nodeByClientId.set(item.clientId, {
			client_id: item.clientId,
			node_id: item.dbId ?? null,
			floor_id: item.floorId,
			type: item.type,
			label,
			pixel_x: item.pixelX,
			pixel_y: item.pixelY,
			// Meters, same origin and axes as the image (y grows down). Millimeter precision.
			x: round3(item.pixelX / calibration.pixelsPerMeter),
			y: round3(item.pixelY / calibration.pixelsPerMeter),
			is_accessible: type.isPwdType || item.isAccessible === true,
			is_store_entrance: item.type === 'STORE_ENTRANCE',
			store_id: storeId,
			unit_id: unitId,
			cross_floor_client_id: item.crossFloorClientId ?? null,
		})
	}
	if (errors.length) return { errors, warnings, payload: null }

	// ---- Cross-floor links ----
	for (const node of nodeByClientId.values()) {
		const cfg = NODE_TYPES[node.type]
		const where = `Node "${node.label}" (${floorLabel(node.floor_id)})`
		if (!cfg.isFloorTransition) {
			if (node.cross_floor_client_id) fail(`${where} is not a floor transition and cannot have a cross-floor link.`)
			continue
		}
		if (!node.cross_floor_client_id) {
			if (body.finalize) fail(`${where}: the ${node.type.toLowerCase()} is not linked to its counterpart on another floor.`)
			continue
		}
		const target = nodeByClientId.get(node.cross_floor_client_id)
		if (!target) { fail(`${where}: the linked node does not exist.`); continue }
		if (target.floor_id === node.floor_id) { fail(`${where}: a cross-floor link must point to a different floor.`); continue }
		if (target.type !== node.type) fail(`${where}: a ${node.type.toLowerCase()} must link to another ${node.type.toLowerCase()}, not a ${target.type.toLowerCase()}.`)
	}
	if (errors.length) return { errors, warnings, payload: null }

	// Links are stored in both directions so Unity can read either end. A one-way link is
	// completed here; a node that two different nodes point at is a mapping mistake.
	for (const node of [...nodeByClientId.values()]) {
		if (!node.cross_floor_client_id) continue
		const target = nodeByClientId.get(node.cross_floor_client_id)
		if (!target.cross_floor_client_id) { target.cross_floor_client_id = node.client_id; continue }
		if (target.cross_floor_client_id !== node.client_id) {
			fail(`Node "${target.label}" (${floorLabel(target.floor_id)}) is linked from "${node.label}" but is itself linked to a different node. Each ${target.type.toLowerCase()} links to exactly one counterpart.`)
		}
	}

	// ---- Same-floor edges. Distance is recomputed from the meter coordinates. ----
	const edges = []
	const seenPairs = new Set()
	for (const item of edgesIn) {
		const from = nodeByClientId.get(item.fromClientId)
		const to = nodeByClientId.get(item.toClientId)
		if (!from || !to) { fail('An edge connects a node that does not exist.'); continue }
		if (from === to) { fail(`Node "${from.label}" is connected to itself.`); continue }
		if (from.floor_id !== to.floor_id) { fail(`The edge "${from.label}" - "${to.label}" crosses floors. Use a cross-floor link on a stairs, escalator, elevator or ramp instead.`); continue }
		if (!PATH_TYPES.includes(item.pathType)) { fail(`The edge "${from.label}" - "${to.label}" has an unknown path type.`); continue }
		const key = pairKey(from.client_id, to.client_id)
		if (seenPairs.has(key)) { fail(`"${from.label}" and "${to.label}" are connected more than once.`); continue }
		seenPairs.add(key)

		const distance = round3(Math.hypot(to.x - from.x, to.y - from.y))
		// Only staircase edges are inaccessible (NavAR Complete Workflow 1.5).
		const blocked = NODE_TYPES[from.type].blocksAccessibleRoute || NODE_TYPES[to.type].blocksAccessibleRoute
		edges.push({ from_client_id: from.client_id, to_client_id: to.client_id, distance, path_type: item.pathType, is_accessible: !blocked, is_cross_floor: false })
		if (distance > LONG_EDGE_WARNING_M) {
			warnings.push({ code: 'long_edge', message: `The edge "${from.label}" - "${to.label}" on ${floorLabel(from.floor_id)} is ${distance.toFixed(1)} m long. Add corridor nodes every 5 to 8 m so BLE coverage stays continuous.` })
		}
	}

	// ---- Cross-floor edges are generated from the links, one per pair. ----
	const crossPairs = new Set()
	for (const node of nodeByClientId.values()) {
		if (!node.cross_floor_client_id) continue
		const target = nodeByClientId.get(node.cross_floor_client_id)
		if (!target || target.floor_id === node.floor_id || target.type !== node.type) continue
		const key = pairKey(node.client_id, target.client_id)
		if (crossPairs.has(key)) continue
		crossPairs.add(key)
		const cfg = NODE_TYPES[node.type]
		edges.push({
			from_client_id: node.client_id,
			to_client_id: target.client_id,
			distance: FLOOR_CHANGE_COST_M[node.type] ?? 10,
			path_type: cfg.isPwdType ? 'accessible' : 'normal',
			is_accessible: !cfg.blocksAccessibleRoute,
			is_cross_floor: true,
		})
	}
	if (errors.length) return { errors, warnings, payload: null }

	// ---- Graph health (warnings only, never blocks a draft save) ----
	const parent = new Map([...nodeByClientId.keys()].map(id => [id, id]))
	const find = id => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id) } return id }
	const degree = new Map()
	for (const edge of edges) {
		degree.set(edge.from_client_id, (degree.get(edge.from_client_id) || 0) + 1)
		degree.set(edge.to_client_id, (degree.get(edge.to_client_id) || 0) + 1)
		parent.set(find(edge.from_client_id), find(edge.to_client_id))
	}
	const isolated = [...nodeByClientId.values()].filter(node => !degree.get(node.client_id))
	for (const node of isolated.slice(0, 10)) {
		warnings.push({ code: 'isolated_node', message: `"${node.label}" on ${floorLabel(node.floor_id)} is not connected to any edge, so navigation can never reach it.` })
	}
	if (isolated.length > 10) warnings.push({ code: 'isolated_node', message: `${isolated.length - 10} more nodes are not connected to any edge.` })
	const groups = new Set([...nodeByClientId.keys()].filter(id => degree.get(id)).map(find))
	if (groups.size > 1) {
		warnings.push({ code: 'disconnected_graph', message: `The map is split into ${groups.size} separate groups of connected nodes. A route can only be found inside one group.` })
	}

	const calibrations = [...calibrationByFloor.entries()].map(([floorId, value]) => ({
		floor_id: floorId,
		ref_start_x: value.refStart.x,
		ref_start_y: value.refStart.y,
		ref_end_x: value.refEnd.x,
		ref_end_y: value.refEnd.y,
		real_meters: value.meters,
		pixels_per_meter: value.pixelsPerMeter,
		path_loss_exponent: value.pathLossExponent,
		ref_label: String(value.refLine || '').trim().slice(0, 200) || null,
	}))

	return { errors, warnings, payload: { calibrations, nodes: [...nodeByClientId.values()], edges } }
}

module.exports = { buildNodeMap }
