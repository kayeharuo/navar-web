import { useState } from 'react';
import { ArrowRight, Battery, Info, MapPin, Pencil, Plus, Radio, Search, Unlink } from 'lucide-react';
import AddBeaconModal from '../../mallManagement/AddBeaconModal';
import { EditorDialog } from './EditorDialog';
import '../../../styles/mallManagement/mallModal.css';

export function EditorBeacons({ beacons, nodes, floorMeta, projectId, mallName, major, locked, onChange, onClose }) {
 const [editing, setEditing] = useState(null);
 const [search, setSearch] = useState('');
 const [filter, setFilter] = useState('All');
 const allNodes = Object.values(nodes).flat();
 const state = b => b.nodeId ? allNodes.some(n => n.id === b.nodeId) ? 'Assigned' : 'Missing node' : 'Unassigned';
 const visible = beacons.filter(b => (filter === 'All' || state(b) === filter) && `${b.label} ${b.beaconCode} ${b.location}`.toLowerCase().includes(search.toLowerCase()));
 const assigned = beacons.filter(b => state(b) === 'Assigned').length;
 const missing = beacons.filter(b => state(b) === 'Missing node').length;
 const mall = {
  name: mallName, majorBeacons: major,
  arVersions: [{ id: Number(projectId), name: 'This AR map' }],
  floorDetails: Object.entries(floorMeta).map(([label, f]) => ({ id: f.floorId, floorNo: String(f.floorNum), label })),
  nodes: allNodes.map(n => ({ nodeId: n.id, versionId: Number(projectId), floorId: floorMeta[n.floor]?.floorId, label: n.label })),
  beacons: beacons.map(b => ({ ...b, id: b.clientId, nodeConfig: b.nodeId ? [{ versionId: Number(projectId), nodeId: b.nodeId }] : [] })),
 };
 const initial = editing?.clientId ? { ...editing, id: editing.clientId,
  nodeConfig: editing.nodeId ? [{ versionId: Number(projectId), nodeId: editing.nodeId }] : [],
  batteryHistory: [{ id: 'current', batteryId: 'Current battery', brand: editing.batteryBrand, installDate: editing.batteryInstallDate, status: 'current' }],
 } : null;
 return <>
  <EditorDialog wide title="Map beacons" subtitle="Manage beacon details and node assignments for this map." icon={Radio} nested={Boolean(editing)} onClose={onClose} footer={<><span className="ne-footer-hint"><Info size={14} /> Save a snapshot, then Save &amp; Validate to apply changes.</span><button className="ne-button ne-button--secondary" onClick={onClose}>Back to editor</button></>}>
   <div className="ne-beacon-summary"><div><span>Total beacons</span><strong>{beacons.length}</strong></div><div><span>Assigned to nodes</span><strong>{assigned}</strong></div><div className={missing ? 'has-warning' : ''}><span>Missing nodes</span><strong>{missing}</strong></div></div>
   <div className="ne-notice ne-notice--info"><Info size={17} /><div><strong>Changes stay in this editor until applied</strong><p>Save a snapshot to keep this setup. Save &amp; Validate updates Mall Management. Beacon details are shared; assignments belong to this AR version.</p></div></div>
   <div className="ne-beacon-toolbar"><label className="ne-search"><Search size={16} /><input aria-label="Search map beacons" placeholder="Search name, code or location" value={search} onChange={e => setSearch(e.target.value)} /></label>{!locked && <button className="ne-button ne-button--primary" onClick={() => setEditing({})}><Plus size={16} /> Add beacon</button>}</div>
   <div className="ne-filter-tabs" aria-label="Filter map beacons">{['All','Assigned','Unassigned','Missing node'].map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{value}<span>{value === 'All' ? beacons.length : beacons.filter(b => state(b) === value).length}</span></button>)}</div>
   {!visible.length && <div className="ne-empty-state"><span><Radio size={25} strokeWidth={1.5} /></span><h3>{beacons.length ? 'No matching beacons' : 'No beacons in this map yet'}</h3><p>{beacons.length ? 'Try another search or filter.' : 'Add a beacon, then choose the node where it belongs.'}</p>{!beacons.length && !locked && <button className="ne-button ne-button--primary" onClick={() => setEditing({})}><Plus size={15} /> Add your first beacon</button>}</div>}
   <div className="ne-beacon-list">{visible.map(b => { const node = allNodes.find(n => n.id === b.nodeId); const status = state(b); return <article className="ne-beacon-card" key={b.clientId}>
    <div className="ne-beacon-card-heading"><span className="ne-snapshot-row-icon"><Radio size={18} /></span><div><h3>{b.label}</h3><span className="ne-beacon-code">{b.beaconCode}</span></div><span className={`ne-badge${status === 'Assigned' ? ' ne-badge--green' : status === 'Missing node' ? ' ne-badge--amber' : ''}`}>{status}</span></div>
    <div className={`ne-beacon-assignment${status === 'Missing node' ? ' has-warning' : ''}`}><MapPin size={16} /><div><span>Assigned node</span><strong>{node ? <>{node.floor}<ArrowRight size={12} />{node.label || node.id}<span>#{node.dbId ?? node.id}</span></> : b.nodeId ? 'Node deleted · reassign or clear this link' : 'No node assigned'}</strong></div></div>
    <div className="ne-beacon-details"><span>Minor <strong>{b.minor}</strong></span><span>TX power <strong>{b.txPower} dBm</strong></span><span><Battery size={14} /> <strong>{b.batteryBrand || 'No battery details'}</strong></span></div>
    {b.location && <p className="ne-beacon-location">{b.location}</p>}
    {!locked && <div className="ne-beacon-actions"><button className="ne-button ne-button--secondary ne-button--small" onClick={() => setEditing(b)}><Pencil size={14} /> Edit details &amp; assignment</button>{b.nodeId && <button className="ne-button ne-button--ghost ne-button--small" onClick={() => onChange(beacons.map(r => r.clientId === b.clientId ? { ...r, nodeId: null } : r))}><Unlink size={14} /> Clear assignment</button>}</div>}
   </article>; })}</div>
  </EditorDialog>
  {editing && <div className="editor-beacon-form"><AddBeaconModal editorMode mall={mall} initialData={initial} isEdit={Boolean(initial)} onClose={() => setEditing(null)} onSave={data => {
   const updated = { clientId: editing.clientId || crypto.randomUUID(), dbId: editing.dbId,
    beaconCode: data.beaconCode, label: data.label, location: data.location, minor: data.minor, txPower: data.txPower,
    dateInstalled: data.dateInstalled, lastMaintenanceDate: data.lastMaintenanceDate || data.dateInstalled,
    batteryBrand: data.batteryBrand, batteryInstallDate: data.batteryInstallDate,
    nodeId: data.nodeConfig[0]?.nodeId || null,
   };
   onChange(initial ? beacons.map(b => b.clientId === updated.clientId ? updated : b) : [...beacons, updated]); setEditing(null);
  }} /></div>}
 </>;
}
