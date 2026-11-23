async function loadBeaconContext(supabase, mallId, beaconIds = []) {
	const versionsResult = await supabase.from('ar_development')
		.select('ar_development_id, ar_development_version, application!inner(mall_id)')
		.eq('application.mall_id', mallId).order('ar_development_version')
	if (versionsResult.error) throw versionsResult.error
	const versions = (versionsResult.data || []).map(row => ({ id: row.ar_development_id, name: `Version ${row.ar_development_version}` }))
	const [nodesResult, assignmentsResult] = await Promise.all([
		versions.length ? supabase.from('node').select('node_id, node_label, ar_development_id, floor_id, node_is_active').in('ar_development_id', versions.map(v => v.id)) : { data: [] },
		beaconIds.length ? supabase.from('beacon_node_assignment').select('beacon_id, node_id, ar_development_id').in('beacon_id', beaconIds) : { data: [] },
	])
	if (nodesResult.error) throw nodesResult.error
	if (assignmentsResult.error) throw assignmentsResult.error
	return { versions, nodes: (nodesResult.data || []).map(row => ({ nodeId: row.node_id, label: row.node_label, versionId: row.ar_development_id, floorId: row.floor_id,isActive:row.node_is_active!==false })), assignments: assignmentsResult.data || [] }
}

function validateNodeConfig(config, context) {
	if (!Array.isArray(config)) throw new Error('Node assignments must be a list.')
	const seen = new Set()
	return config.map(item => {
		const versionId = Number(item?.versionId), nodeId = Number(item?.nodeId)
		if (!Number.isSafeInteger(versionId) || !Number.isSafeInteger(nodeId) || versionId <= 0 || nodeId <= 0) throw new Error('Choose a valid version and node.')
		if (seen.has(versionId)) throw new Error('Only one node can be linked to a beacon in each AR version.')
		seen.add(versionId)
		if (!context.versions.some(v => v.id === versionId) || !context.nodes.some(n => n.nodeId === nodeId && n.versionId === versionId)) throw new Error('The selected node must belong to this mall and AR version.')
		return { versionId, nodeId }
	})
}

module.exports = { loadBeaconContext, validateNodeConfig }
