import { useState, useEffect } from 'react'
import { X, Plus, Search, TriangleAlert } from 'lucide-react'
import AddBeaconModal from './AddBeaconModal'

// Placeholder UUID — will be replaced by real value from backend
const SYSTEM_UUID = 'F7826DA6-4FA2-4E98-8024-BC5B71E0893E'

const STATUS_FILTERS = ['All', 'Placed', 'Faulty']

let nextBeaconId = 1000

// ─── Status badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`bcn-status-badge bcn-status-badge--${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Faulty modal ──────────────────────────────────────────
function FaultyModal({ onCancel, onConfirm }) {
  const [issue, setIssue] = useState('')
  const [issueErr, setIssueErr] = useState('')
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const issueOptions = [
    'No Signal / Not broadcasting',
    'Battery dead',
    'Weak / Inconsistent signal',
    'Physical damage',
    'Missing / Stolen',
    'Calibration drift',
    'Interference suspended',
    'Other',
  ]

  function handleConfirm() {
    const errors = {}
    if (!issue) { errors.issue = 'Please select an issue.' }
    if (!note.trim()) { errors.note = 'Please enter notes.' }
    if (Object.keys(errors).length) { setIssueErr(errors.issue || ''); setNoteErr(errors.note || ''); return }
    onConfirm(issue, note.trim())
  }

  return (
    <>
      <div className="modal-overlay" />
      <div className="bcn-status-modal" role="dialog">
        <svg width="66" height="59" viewBox="0 0 66 59" fill="none" className="bcn-modal-icon">
          <path d="M37.461 2.60086L65.1339 50.6535C67.0735 54.039 64.5676 58.2188 60.5745 58.2188H5.22873C1.23569 58.2188 -1.27025 54.039 0.669318 50.6535L28.3422 2.60086C30.3356-0.866953 35.4677-0.866953 37.461 2.60086Z" stroke="#D51D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M32.9023 35.4375V22.7812" stroke="#D51D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="32.9023" cy="46.8281" r="3.797" fill="#D51D1D"/>
        </svg>
        <h3 className="bcn-modal-title">Set this Beacon Faulty?</h3>
        <p className="bcn-modal-desc">This beacon will not be recognized by NavAR until it's reactivated.</p>
        <div className="bcn-modal-field">
          <label className="bcn-modal-label">ISSUE <span className="bcn-modal-label-required">*</span></label>
          <select
            className={`bcn-modal-select${issueErr ? ' bcn-modal-select--error' : ''}`}
            value={issue}
            onChange={e => { setIssue(e.target.value); setIssueErr('') }}
          >
            <option value="">-- Select an issue --</option>
            {issueOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {issueErr && <p className="mall-field-error">{issueErr}</p>}
        </div>
        <div className="bcn-modal-field">
          <label className="bcn-modal-label">NOTES <span className="bcn-modal-label-required">*</span></label>
          <textarea
            className={`bcn-modal-notes${noteErr ? ' bcn-modal-notes--error' : ''}`}
            placeholder="Notes..."
            value={note}
            onChange={e => { setNote(e.target.value); setNoteErr('') }}
            rows={5}
          />
          {noteErr && <p className="mall-field-error">{noteErr}</p>}
        </div>
        <div className="bcn-modal-actions">
          <button className="bcn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="bcn-modal-yes bcn-modal-yes--faulty" onClick={handleConfirm}>Yes</button>
        </div>
      </div>
    </>
  )
}


// ─── Reactivate modal ──────────────────────────────────────
function ReactivateModal({ onCancel, onConfirm }) {
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  return (
    <>
      <div className="modal-overlay" />
      <div className="bcn-status-modal" role="dialog">
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none" className="bcn-modal-icon">
          <path d="M35.6612 17.7138C35.8384 17.8909 35.979 18.1011 36.075 18.3325C36.1709 18.5639 36.2203 18.812 36.2203 19.0625C36.2203 19.313 36.1709 19.5611 36.075 19.7925C35.979 20.0239 35.8384 20.2341 35.6612 20.4112L22.3174 33.7549C22.1404 33.9322 21.9302 34.0728 21.6987 34.1687C21.4673 34.2646 21.2193 34.314 20.9688 34.314C20.7183 34.314 20.4702 34.2646 20.2388 34.1687C20.0074 34.0728 19.7971 33.9322 19.6201 33.7549L13.9013 28.0362C13.5436 27.6785 13.3427 27.1933 13.3427 26.6875C13.3427 26.1817 13.5436 25.6965 13.9013 25.3388C14.259 24.9811 14.7442 24.7802 15.25 24.7802C15.7559 24.7802 16.241 24.9811 16.5987 25.3388L20.9688 29.7113L32.9638 17.7138C33.1409 17.5366 33.3511 17.396 33.5825 17.3001C33.8139 17.2041 34.062 17.1548 34.3125 17.1548C34.563 17.1548 34.8111 17.2041 35.0425 17.3001C35.2739 17.396 35.4841 17.5366 35.6612 17.7138ZM49.5625 24.7812C49.5625 29.6825 48.1091 34.4737 45.3861 38.549C42.6631 42.6242 38.7928 45.8005 34.2646 47.6761C29.7365 49.5518 24.7538 50.0425 19.9467 49.0863C15.1396 48.1301 10.724 45.77 7.25827 42.3042C3.79255 38.8385 1.43237 34.4229 0.476176 29.6158C-0.480014 24.8087 0.0107373 19.8261 1.88637 15.2979C3.76201 10.7697 6.93828 6.89939 11.0135 4.17639C15.0888 1.45339 19.88 0 24.7813 0C31.3515 0.00693832 37.6507 2.62004 42.2966 7.26592C46.9425 11.9118 49.5556 18.211 49.5625 24.7812ZM45.75 24.7812C45.75 20.634 44.5202 16.5799 42.2161 13.1316C39.9121 9.68334 36.6372 6.99573 32.8057 5.40865C28.9741 3.82158 24.758 3.40632 20.6905 4.21541C16.6229 5.02449 12.8866 7.02157 9.95412 9.95411C7.02158 12.8866 5.0245 16.6229 4.21542 20.6905C3.40634 24.758 3.82159 28.9741 5.40866 32.8056C6.99574 36.6372 9.68335 39.9121 13.1316 42.2161C16.5799 44.5202 20.634 45.75 24.7813 45.75C30.3406 45.7437 35.6704 43.5325 39.6014 39.6014C43.5325 35.6704 45.7437 30.3406 45.75 24.7812Z" fill="#16A34A"/>
        </svg>
        <h3 className="bcn-modal-title">Are you sure you want to reactivate this Beacon?</h3>
        <div className="bcn-modal-actions">
          <button className="bcn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="bcn-modal-yes bcn-modal-yes--reactivate" onClick={onConfirm}>Reactivate</button>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ────────────────────────────────────────
export default function BeaconManager({ mall, onClose, onSave }) {
  const [beacons, setBeacons] = useState(mall.beacons ? [...mall.beacons] : [])
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery]   = useState('')

  const [showAdd, setShowAdd]         = useState(false)
  const [editingBeacon, setEditing]   = useState(null)
  const [faultyTarget, setFaulty]     = useState(null)
  const [reactTarget, setReact]       = useState(null)

  function handleAddSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setBeacons(prev => [...prev, {
      id:         nextBeaconId++,
      ...data,
      status:     'placed',
      faultyNote: '',
      dateAdded:  now,
    }])
    setShowAdd(false)
  }

  function handleEditSave(data) {
    setBeacons(prev => prev.map(b =>
      b.id === editingBeacon.id ? { ...b, ...data } : b
    ))
    setEditing(null)
  }

  function handleSetFaulty(issue, note) {
    setBeacons(prev => prev.map(b =>
      b.id === faultyTarget.id ? { ...b, status: 'faulty', faultyIssue: issue, faultyNote: note } : b
    ))
    setFaulty(null)
  }

  function handleReactivate() {
    setBeacons(prev => prev.map(b =>
      b.id === reactTarget.id ? { ...b, status: 'placed', faultyNote: '' } : b
    ))
    setReact(null)
  }

  function handleClose() {
    onSave(beacons)
    onClose()
  }

  const filteredBeacons = beacons.filter(b => {
    const matchStatus = statusFilter === 'All' || b.status === statusFilter.toLowerCase()
    const matchSearch = !searchQuery ||
      b.beaconCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.label.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = {
    all:    beacons.length,
    placed: beacons.filter(b => b.status === 'placed').length,
    faulty: beacons.filter(b => b.status === 'faulty').length,
  }

  return (
    <>
      <div className="stores-page">
        {/* Header */}
        <div className="stores-page-header">
          <div className="stores-page-header-info">
            <h1 className="stores-page-title">Beacon Manager</h1>
            <p className="bcn-uuid-line">
              <span className="bcn-uuid-label">SYSTEM UUID — STATIC · READ ONLY - </span>
              <span className="bcn-uuid-value">{SYSTEM_UUID}</span>
            </p>
            <p className="bcn-uuid-hint">
              Shared by all malls · Major identifies the mall · Minor identifies the unit
            </p>
          </div>
          <button className="stores-page-close" onClick={handleClose} title="Back to malls">X</button>
        </div>

        {/* Filters + Add Beacon */}
        <div className="stores-page-toolbar">
          <div className="stores-category-filters">
            {STATUS_FILTERS.map(f => {
              const key = f.toLowerCase()
              const count = key === 'all' ? counts.all : counts[key] || 0
              const isActive = statusFilter === f
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`stores-cat-btn${isActive ? ' stores-cat-btn--all-active' : ''}`}
                >
                  {f === 'All' ? `All (${counts.all})` : f}
                </button>
              )
            })}
          </div>
          <button className="stores-add-btn" onClick={() => setShowAdd(true)}>
            <Plus size={14} strokeWidth={2.5} />
            Add Beacon
          </button>
        </div>

        {/* Search */}
        <div className="stores-search-wrap">
          <Search size={16} className="stores-search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="stores-search-input"
          />
        </div>

        {/* Table */}
        <div className="stores-table-container">
          <div className="stores-table-scroll">
            <table className="stores-table">
              <thead>
                <tr>
                  <th>BEACON CODE</th>
                  <th>FLOOR</th>
                  <th>LOCATION</th>
                  <th>LABEL</th>
                  <th>MAJOR</th>
                  <th>MINOR</th>
                  <th>TX POWER(dBm)</th>
                  <th>NODES</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeacons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="stores-empty">No beacons found.</td>
                  </tr>
                ) : filteredBeacons.map(b => (
                  <tr key={b.id} className="stores-table-row">
                    <td className="stores-td-name">{b.beaconCode}</td>
                    <td>{b.floorLabel || b.floorNo}</td>
                    <td>{b.location || '—'}</td>
                    <td>{b.label}</td>
                    <td>{b.major}</td>
                    <td>{b.minor}</td>
                    <td>{b.txPower}</td>
                    <td>{b.nodeConfigDisplay || '—'}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>
                      <div className="stores-action-row">
                        {b.status === 'placed' ? (
                          <button className="stores-action-btn bcn-btn--faulty" onClick={() => setFaulty(b)}>
                            Faulty
                          </button>
                        ) : (
                          <>
                            <button className="stores-action-btn bcn-btn--reactivate" onClick={() => setReact(b)}>
                              Reactivate
                            </button>
                            <button className="stores-action-btn stores-action-btn--edit" onClick={() => setEditing(b)}>
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Beacon Modal */}
      {showAdd && (
        <AddBeaconModal
          mall={mall}
          onClose={() => setShowAdd(false)}
          onSave={handleAddSave}
        />
      )}

      {/* Edit Beacon Modal */}
      {editingBeacon && (
        <AddBeaconModal
          mall={mall}
          initialData={editingBeacon}
          onClose={() => setEditing(null)}
          onSave={handleEditSave}
          isEdit
        />
      )}

      {/* Faulty Modal */}
      {faultyTarget && (
        <FaultyModal
          onCancel={() => setFaulty(null)}
          onConfirm={handleSetFaulty}
        />
      )}

      {/* Reactivate Modal */}
      {reactTarget && (
        <ReactivateModal
          onCancel={() => setReact(null)}
          onConfirm={handleReactivate}
        />
      )}
    </>
  )
}
