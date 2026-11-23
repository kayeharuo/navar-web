import { C, F, M } from '../editorConstants';

const headers = ['beacon_id','beacon_code','label','assignment','floor','assigned_node','major','minor','tx_power','location','battery_brand','battery_installed','date_installed','last_maintenance'];
const cell = { padding: '9px 13px', fontSize: 11, fontFamily: F, color: '#475569', verticalAlign: 'top' };
const mono = { ...cell, fontFamily: M, whiteSpace: 'nowrap' };
const dash = '—';

export function BeaconDataTable({ beacons, nodes, major }) {
 const rows = beacons.map(beacon => {
  const node = nodes.find(n => String(n.id) === String(beacon.nodeId) || (n.dbId != null && `db${n.dbId}` === String(beacon.nodeId)));
  const status = beacon.nodeId == null || beacon.nodeId === '' ? 'Unassigned' : node ? 'Assigned' : 'Missing node';
  return { beacon, node, status };
 });
 return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
  <div style={{ flexShrink: 0, padding: '13px 18px', background: C.blueL, borderBottom: `1px solid ${C.blueM}`, fontFamily: F, fontSize: 11, color: '#526887', lineHeight: 1.7 }}>
   <strong style={{ color: C.blue }}>Current editor beacon setup</strong>
   <div>{rows.filter(r => r.status === 'Assigned').length} assigned · {rows.filter(r => r.status === 'Unassigned').length} unassigned · {rows.filter(r => r.status === 'Missing node').length} missing node</div>
   <div>Includes staged changes and restored snapshots. Save &amp; Validate applies this setup to the database.</div>
  </div>
  <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>
  <table style={{ width: '100%', minWidth: 1450, borderCollapse: 'collapse' }}>
   <thead><tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>{headers.map(header => <th key={header} scope="col" style={{ padding: '9px 13px', fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: M, textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{header}</th>)}</tr></thead>
   <tbody>
    {!rows.length && <tr><td colSpan={headers.length} style={{ ...cell, padding: 28, textAlign: 'center', color: C.muted }}>No beacons in the current editor layout.</td></tr>}
    {rows.map(({ beacon: b, node, status }, index) => {
     const tone = status === 'Assigned' ? { color: '#15803d', background: C.greenL, border: C.greenM } : status === 'Missing node' ? { color: '#b45309', background: C.goldL, border: C.goldM } : { color: C.sub, background: C.dim, border: C.border };
     return <tr key={b.clientId} style={{ borderBottom: `1px solid ${C.line}`, background: index % 2 ? '#f8fafc' : C.white }}>
      <td style={mono}>{b.dbId ?? `Unsaved (${b.clientId})`}</td>
      <td style={{ ...mono, color: C.blue, fontWeight: 700 }}>{b.beaconCode || dash}</td>
      <td style={{ ...cell, fontSize: 12, fontWeight: 600, color: C.txt }}>{b.label || dash}</td>
      <td style={cell}><span style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 4, border: `1px solid ${tone.border}`, background: tone.background, color: tone.color, fontSize: 10, fontFamily: M, fontWeight: 700 }}>{status}</span></td>
      <td style={mono}>{node?.floor || dash}</td>
      <td style={cell}>{node ? <><div style={{ color: C.txt, fontWeight: 600 }}>{node.label || node.id}</div><div style={{ font: `10px ${M}`, color: C.muted }}>{node.dbId ?? `Unsaved (${node.id})`}</div></> : <span style={{ color: status === 'Missing node' ? '#b45309' : C.muted }}>{status === 'Missing node' ? `Missing (${b.nodeId})` : dash}</span>}</td>
      <td style={mono}>{major ?? dash}</td>
      <td style={mono}>{b.minor ?? dash}</td>
      <td style={mono}>{b.txPower != null ? `${b.txPower} dBm` : dash}</td>
      <td style={{ ...cell, minWidth: 150 }}>{b.location || dash}</td>
      <td style={cell}>{b.batteryBrand || dash}</td>
      <td style={mono}>{b.batteryInstallDate || dash}</td>
      <td style={mono}>{b.dateInstalled || dash}</td>
      <td style={mono}>{b.lastMaintenanceDate || dash}</td>
     </tr>;
    })}
   </tbody>
  </table>
  </div>
 </div>;
}
