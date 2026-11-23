'use strict'
// Compare editable map content, independent of generated editor/database IDs.
function canonicalContent(body) {
 const sort = value => {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toFixed(8));
  if (Array.isArray(value)) return value.map(sort).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,sort(value[k])]));
  return value;
 };
 const key = value => JSON.stringify(sort(value));
 const groups = new Map((body.transitionGroups || []).map(g => [String(g.id), { name: g.name?.trim() || '', type: g.type }]));
 const nodes = (body.nodes || []).map(n => ({
  floorId: n.floorId, type: n.type, label: n.label?.trim() || '', pixelX: n.pixelX, pixelY: n.pixelY,
  isEmergency: Boolean(n.isEmergency), unitId: n.unitId ?? null, storeId: n.storeId ?? null,
  group: n.transitionGroupId ? groups.get(String(n.transitionGroupId)) ?? { missingGroup: String(n.transitionGroupId) } : null,
 }));
 const nodeCounts = new Map();
 for (const n of nodes) nodeCounts.set(key(n), (nodeCounts.get(key(n)) || 0) + 1);
 const nodeKey = new Map((body.nodes || []).map((n,i) => {
  const descriptor = key(nodes[i]);
  // Coincident, otherwise identical nodes still have distinct graph identities.
  const identity = nodeCounts.get(descriptor) > 1 ? `:${n.dbId ?? n.clientId}` : '';
  return [String(n.clientId), descriptor + identity];
 }));
 const reference = id => id == null ? null : nodeKey.get(String(id)) ?? `missing:${id}`;
 const edges = (body.edges || []).map(e => {
  let from = reference(e.fromClientId), to = reference(e.toClientId), direction = e.direction || 'both';
  if (direction === 'reverse') { [from,to] = [to,from]; direction = 'forward'; }
  if (direction === 'both' && from > to) [from,to] = [to,from];
  return { from, to, direction, pathType: e.pathType || 'normal' };
 });
 const date = value => value ? String(value).slice(0,10) : null;
 const beacons = (body.beacons || []).map(b => ({
  beaconCode: b.beaconCode, label: b.label, location: b.location || '', minor: b.minor, txPower: b.txPower,
  dateInstalled: date(b.dateInstalled), lastMaintenanceDate: date(b.lastMaintenanceDate),
  batteryBrand: b.batteryBrand, batteryInstallDate: date(b.batteryInstallDate), node: reference(b.nodeId),
 }));
 const calibrations = (body.calibrations || []).map(c => ({
  floorId: c.floorId, refStart: c.refStart, refEnd: c.refEnd, meters: c.meters,
  pathLossExponent: c.pathLossExponent ?? null, refLine: c.refLine?.trim() || '',
 }));
 return key({ nodes, edges, calibrations, transitionGroups: [...groups.values()], beacons });
}

module.exports = { canonicalContent }
