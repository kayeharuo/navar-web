'use strict'
const { canonicalContent } = require('./snapshotContent')

// Only these editable fields belong to a map snapshot. Tickets and battery history
// remain operational records; the current battery's details may be edited here.
async function loadBeacons(db, mallId, arId) {
 const [mall, beacons, assignments] = await Promise.all([
  db.from('mall').select('mall_beacon_major,mall_beacon_revision').eq('mall_id', mallId).single(),
  db.from('beacon').select('*').eq('mall_id', mallId).order('beacon_id'),
  db.from('beacon_node_assignment').select('beacon_id,node_id').eq('ar_development_id', arId),
 ])
 for (const result of [mall, beacons, assignments]) if (result.error) throw result.error
 const ids = beacons.data.map(b => b.beacon_id)
 const batteries = ids.length ? await db.from('battery').select('*').in('beacon_id', ids).eq('battery_status', 'current') : { data: [] }
 if (batteries.error) throw batteries.error
 return {
  revision: mall.data.mall_beacon_revision, major: mall.data.mall_beacon_major,
  beacons: beacons.data.map(b => {
   const battery = batteries.data.find(r => r.beacon_id === b.beacon_id)
   const assignment = assignments.data.find(r => r.beacon_id === b.beacon_id)
   return { clientId: `beacon-${b.beacon_id}`, dbId: b.beacon_id, beaconCode: b.beacon_code,
    label: b.beacon_label, location: b.beacon_location, minor: b.beacon_minor, txPower: b.beacon_tx_power,
    dateInstalled: b.beacon_installed_at?.slice(0,10), lastMaintenanceDate: b.beacon_maintained_at?.slice(0,10),
    batteryBrand: battery?.battery_brand || '', batteryInstallDate: battery?.battery_installed_at?.slice(0,10) || '',
    nodeId: assignment ? `db${assignment.node_id}` : null,
   }
  }),
 }
}

function validateBeacons(beacons, nodes) {
 const errors = [], assigned = new Set(), ids = new Set(), minors = new Set(), codes = new Set()
 const nodeIds = new Set(nodes.map(n => n.clientId))
 for (const b of beacons) {
  if (!b.clientId || ids.has(b.clientId)) errors.push('Beacon identifiers must be unique.')
  ids.add(b.clientId)
  if (!b.label?.trim() || !b.beaconCode?.trim() || !b.batteryBrand?.trim()) errors.push('Beacon code, label and battery brand are required.')
  if (codes.has(b.beaconCode)) errors.push('Beacon codes must be unique.')
  codes.add(b.beaconCode)
  if (!Number.isInteger(b.minor) || b.minor < 0 || b.minor > 65535 || minors.has(b.minor)) errors.push('Beacon minors must be unique integers from 0 to 65535.')
  minors.add(b.minor)
  if (!Number.isInteger(b.txPower) || b.txPower < -127 || b.txPower > 20) errors.push('TX power must be an integer from -127 to 20.')
  if (![b.dateInstalled,b.batteryInstallDate,b.lastMaintenanceDate].every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)))) errors.push('Valid installation, battery and maintenance dates are required.')
  if (b.nodeId && (!nodeIds.has(b.nodeId) || assigned.has(b.nodeId))) errors.push(`Beacon ${b.label}: choose an existing, unassigned node or clear its assignment.`)
  if (b.nodeId) assigned.add(b.nodeId)
 }
 return [...new Set(errors)]
}
async function findMatchingSnapshot(db, arId, body) {
 const fingerprint = canonicalContent(body)
 for (let offset=0; ; offset+=100) {
  const result = await db.from('node_map_snapshot').select('snapshot_id,name,saved_map:payload->saveBody')
   .eq('ar_development_id', arId).order('snapshot_id', { ascending: false }).range(offset,offset+99)
  if (result.error) throw result.error
  const match = result.data.find(row => row.saved_map && Array.isArray(row.saved_map.beacons) && canonicalContent(row.saved_map) === fingerprint)
  if (match) return { id: match.snapshot_id, name: match.name }
  if (result.data.length < 100) return null
 }
}
module.exports = { loadBeacons, canonicalContent, validateBeacons, findMatchingSnapshot }
