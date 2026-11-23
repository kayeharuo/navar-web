import { Archive, ArrowDownToLine, ArrowRight, Check, Clock3, Info, Layers, LoaderCircle, Save, ShieldAlert } from 'lucide-react';
import { EditorDialog } from './EditorDialog';

export function MapSnapshots({ items, name, onNameChange, selected, needsSnapshot, busy, error, locked, restoreTarget, restoreCheck = { status: 'idle', match: null }, onSelectRestore, onSave, onRestore, onClose }) {
 const date = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
 const checking = restoreCheck.status === 'idle' || restoreCheck.status === 'checking';
 const matched = restoreCheck.status === 'matched' && restoreCheck.match;
 return <EditorDialog title="Map snapshots" subtitle="Keep named copies of your map and beacon setup." icon={Layers} busy={busy} onClose={onClose} footer={<>
  <span className="ne-footer-hint"><Info size={14} /> Snapshots stay unchanged when you keep editing.</span>
  <button className="ne-button ne-button--secondary" disabled={busy} onClick={onClose}>Back to editor</button>
 </>}>
  <div className="ne-snapshot-flow" aria-label="Map save workflow"><span><span>1</span> Edit map &amp; beacons</span><ArrowRight size={13} /><span className="is-current"><span>2</span> Save snapshot</span><ArrowRight size={13} /><span><span>3</span> Save &amp; Validate</span></div>
  {needsSnapshot && <div className="ne-notice ne-notice--warning" role="status"><ShieldAlert size={18} /><div><strong>Save your changes first</strong><p>Your map or beacons have changed. Give this layout a name before using Save &amp; Validate.</p></div></div>}
  {error && <div className="ne-notice ne-notice--error" role="alert"><ShieldAlert size={18} /><div>{error}</div></div>}
  {restoreTarget ? <div className="ne-restore-card">
   <span className="ne-section-label">Restore snapshot</span>
   <h3>{restoreTarget.name}</h3>
   <p>This will replace the map and beacons currently in your editor. The database changes only after Save &amp; Validate.</p>
   {checking && <div className="ne-inline-loading" role="status"><LoaderCircle className="ne-spin" size={17} /> Checking your current edits against saved snapshots…</div>}
   {matched && <div className="ne-notice ne-notice--success" role="status"><Check size={18} /><div><strong>Current edits already saved</strong><p>Your map and beacons match <strong>{restoreCheck.match.name}</strong>. You can restore without naming or creating another snapshot.</p></div></div>}
   {restoreCheck.status === 'error' && <div className="ne-notice ne-notice--error" role="alert"><ShieldAlert size={18} /><div><strong>Could not check for a saved copy</strong><p>{restoreCheck.error}</p><button className="ne-button ne-button--secondary ne-button--small" disabled={busy} onClick={() => onSelectRestore({ ...restoreTarget })}>Check again</button></div></div>}
   {!locked && restoreCheck.status === 'different' && <div className="ne-field"><label htmlFor="ne-snapshot-name">Preserve your current edits</label><input id="ne-snapshot-name" value={name} maxLength={100} disabled={busy} onChange={e => onNameChange(e.target.value)} placeholder="Name the current layout before restoring" /><span>No matching snapshot was found. Save a separate copy of your current work before restoring.</span></div>}
   <div className="ne-restore-actions"><button className="ne-button ne-button--primary" disabled={busy || checking || restoreCheck.status === 'error' || (!matched && !name.trim())} onClick={() => onRestore(true)}>{matched ? <ArrowDownToLine size={15} /> : <Save size={15} />} {matched ? 'Reuse saved copy & restore' : 'Save current & restore'}</button>
    {!matched && <button className="ne-button ne-button--danger" disabled={busy} onClick={() => onRestore(false)}>Discard current edits &amp; restore</button>}
    <button className="ne-button ne-button--ghost" disabled={busy} onClick={() => onSelectRestore(null)}>Cancel</button></div>
  </div> : <>
   {!locked && <form className="ne-snapshot-create" onSubmit={e => { e.preventDefault(); if (!busy && name.trim()) onSave(); }}>
    <div className="ne-section-heading"><span className="ne-section-label">Save current layout</span><span className="ne-badge">Map + beacons</span></div>
    <div className="ne-field"><label htmlFor="ne-snapshot-name">Snapshot name</label><div className="ne-input-action"><input id="ne-snapshot-name" autoComplete="off" value={name} maxLength={100} disabled={busy} onChange={e => onNameChange(e.target.value)} placeholder="e.g. Ground floor · entrance layout" /><button type="submit" className="ne-button ne-button--primary" disabled={busy || !name.trim()}>{busy ? <LoaderCircle className="ne-spin" size={15} /> : <Save size={15} />} Save snapshot</button></div><span>Includes all floors, paths, calibration and beacon assignments.</span></div>
   </form>}
   {selected && <div className="ne-selected-snapshot"><Check size={16} /><div><span>Last saved or restored</span><strong>{selected.name}</strong></div><span className="ne-badge ne-badge--green">Saved copy</span></div>}
   <div className="ne-section-heading"><h3>Saved snapshots <span className="ne-count">{items.length}</span></h3><span className="ne-section-meta">Newest first</span></div>
   {busy && <div className="ne-inline-loading" role="status"><LoaderCircle className="ne-spin" size={17} /> Working on your snapshots…</div>}
   {!busy && !items.length && <div className="ne-empty-state"><span><Archive size={25} strokeWidth={1.5} /></span><h3>No snapshots yet</h3><p>{locked ? 'No snapshots were saved for this AR version.' : 'Name your current layout above to save your first copy.'}</p></div>}
   <div className="ne-snapshot-list">{items.map(item => <article key={item.snapshot_id} className={`ne-snapshot-row${String(selected?.id) === String(item.snapshot_id) ? ' is-selected' : ''}`}>
    <span className="ne-snapshot-row-icon"><Layers size={18} /></span><div className="ne-snapshot-row-info"><strong>{item.name}</strong><span><Clock3 size={12} /> {date(item.created_at)}</span></div>
    {!locked && <button className="ne-button ne-button--secondary ne-button--small" disabled={busy} onClick={() => onSelectRestore(item)}><ArrowDownToLine size={14} /> Restore</button>}
   </article>)}</div>
   <div className="ne-notice ne-notice--info"><Info size={17} /><div><strong>Restoring is a preview</strong><p>Restore a copy to the editor, review it, then use Save &amp; Validate to apply it to the mall.</p></div></div>
  </>}
 </EditorDialog>;
}
