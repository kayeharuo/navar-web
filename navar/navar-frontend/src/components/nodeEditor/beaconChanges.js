const nodeKey = (id, nodes, dbIds) => {
 if (id == null) return null;
 const node = nodes.find(n => String(n.id) === String(id));
 const databaseId = node?.dbId ?? dbIds?.get(id);
 if (databaseId != null) return `db${databaseId}`;
 return String(id);
};

export function planNodeDeletion(snapshot, floor, ids, dbIds = new Map()) {
 const selected = new Set(ids.map(String));
 const removed = (snapshot.nodes[floor] || []).filter(n => selected.has(String(n.id)));
 const allNodes = Object.values(snapshot.nodes).flat();
 const keys = new Set(removed.map(n => nodeKey(n.id, allNodes, dbIds)));
 const affected = (snapshot.beacons || []).filter(b => b.nodeId && keys.has(nodeKey(b.nodeId, allNodes, dbIds))).map(b => ({
  ...b, removedNode: removed.find(n => nodeKey(n.id, allNodes, dbIds) === nodeKey(b.nodeId, allNodes, dbIds)),
 }));
 const beaconIds = new Set(affected.map(b => b.clientId));
 return {
  removed, affected,
  snapshot: {
   ...snapshot,
   nodes: Object.fromEntries(Object.entries(snapshot.nodes).map(([label, list]) => [label, list.filter(n => label !== floor || !selected.has(String(n.id))).map(n => removed.some(r => r.id === n.cross_floor_link) ? { ...n, cross_floor_link: null } : n)])),
   edges: Object.fromEntries(Object.entries(snapshot.edges).map(([label, list]) => [label, list.filter(e => !removed.some(n => n.id === e.from || n.id === e.to))])),
   beacons: (snapshot.beacons || []).map(b => beaconIds.has(b.clientId) ? { ...b, nodeId: null } : b),
  },
 };
}

export function findBeaconAssignmentChanges(applied, current, nodes, dbIds = new Map(), beaconDbIds = new Map()) {
 const allNodes = Object.values(nodes).flat();
 const beaconKey = b => String(beaconDbIds.get(b.clientId) ?? b.dbId ?? b.clientId);
 return applied.filter(b => {
  if (!b.nodeId) return false;
  const next = current.find(candidate => beaconKey(candidate) === beaconKey(b));
  return nodeKey(b.nodeId, allNodes, dbIds) !== nodeKey(next?.nodeId, allNodes, dbIds);
 });
}

export function getBeaconAssignmentIssues(beacons, nodes, dbIds = new Map()) {
 const allNodes = Object.values(nodes).flat();
 const valid = new Set(allNodes.map(n => nodeKey(n.id, allNodes, dbIds)));
 return {
  unassigned: beacons.filter(b => b.nodeId == null || b.nodeId === ''),
  missing: beacons.filter(b => b.nodeId != null && b.nodeId !== '' && !valid.has(nodeKey(b.nodeId, allNodes, dbIds))),
 };
}
