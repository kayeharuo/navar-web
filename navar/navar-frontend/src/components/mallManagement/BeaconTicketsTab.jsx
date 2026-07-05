import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import '../../styles/mallManagement/beaconTickets.css'

const STATUS_FILTERS = ['All', 'Faulty', 'Investigating', 'Under Maintenance', 'Resolved']

const initialTickets = [
  {
    id: 1,
    beaconCode: 'BCN-0041',
    mall: 'SM City Cebu',
    floor: 'Floor 2',
    location: 'Near Food Court entrance',
    status: 'faulty',
    timeAgo: '2h ago',
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 10:14 AM',
        action: 'Marked as faulty',
        source: 'mall report',
        by: 'SM City Cebu mall admin',
        note: 'Navigation feels off near the Zara area. Customers are being misdirected.',
      },
    ],
  },
  {
    id: 2,
    beaconCode: 'BCN-0056',
    mall: 'Ayala Center Cebu',
    floor: 'Floor 2',
    location: 'Near entrance elevator',
    status: 'investigating',
    timeAgo: '1d ago',
    timeline: [
      {
        id: 1,
        date: 'Mar 31, 2026 · 8:00 AM',
        action: 'Marked as faulty',
        source: 'system',
        by: 'NavAR System',
        note: 'Signal drop detected on beacon BCN-0056. Threshold exceeded for 15 minutes.',
      },
      {
        id: 2,
        date: 'Mar 31, 2026 · 11:30 AM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Checking hardware — may need firmware update.',
      },
    ],
  },
  {
    id: 3,
    beaconCode: 'BCN-0074',
    mall: 'Ayala Center Cebu',
    floor: 'Floor 1',
    location: 'Main lobby pillar',
    status: 'resolved',
    timeAgo: '3d ago',
    timeline: [
      {
        id: 1,
        date: 'Mar 29, 2026 · 9:00 AM',
        action: 'Marked as faulty',
        source: 'mall report',
        by: 'Ayala Center Cebu mall admin',
        note: 'Beacon appears to be offline. AR directions not working for customers.',
      },
      {
        id: 2,
        date: 'Mar 29, 2026 · 1:00 PM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Battery may have drained. Will coordinate with mall maintenance.',
      },
      {
        id: 3,
        date: 'Mar 30, 2026 · 9:00 AM',
        action: 'Marked as resolved',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Battery replaced. Beacon is back online and functioning normally.',
      },
    ],
  },
  {
    id: 4,
    beaconCode: 'BCN-0012',
    mall: 'SM Seaside City Cebu',
    floor: 'Ground Floor',
    location: 'Zara Entrance',
    status: 'investigating',
    timeAgo: '4h ago',
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 7:00 AM',
        action: 'Marked as faulty',
        source: 'system',
        by: 'NavAR System',
        note: 'Beacon signal intermittent.',
      },
      {
        id: 2,
        date: 'Apr 1, 2026 · 8:00 AM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Possible interference from nearby hardware.',
      },
    ],
  },
  {
    id: 5,
    beaconCode: 'BCN-0031',
    mall: 'Parkmall',
    floor: 'Ground Floor',
    location: 'Food court area',
    status: 'faulty',
    timeAgo: '6h ago',
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 4:00 AM',
        action: 'Marked as faulty',
        source: 'system',
        by: 'NavAR System',
        note: 'Automated health check failed. No signal response.',
      },
    ],
  },
  {
    id: 6,
    beaconCode: 'BCN-0089',
    mall: 'Robinsons Galleria Cebu',
    floor: 'Floor 3',
    location: 'Near Cinemas',
    status: 'investigating',
    timeAgo: '2d ago',
    timeline: [
      {
        id: 1,
        date: 'Mar 30, 2026 · 10:00 AM',
        action: 'Marked as faulty',
        source: 'mall report',
        by: 'Robinsons Galleria Cebu mall admin',
        note: 'Customers reporting wrong directions near cinema entrance.',
      },
      {
        id: 2,
        date: 'Mar 30, 2026 · 2:00 PM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Checking physical placement. May have been moved.',
      },
    ],
  },
  {
    id: 7,
    beaconCode: 'BCN-0102',
    mall: 'SM Seaside City Cebu',
    floor: '2nd Floor',
    location: 'Starbucks Entrance',
    status: 'resolved',
    timeAgo: '5d ago',
    timeline: [
      {
        id: 1,
        date: 'Mar 27, 2026 · 9:00 AM',
        action: 'Marked as faulty',
        source: 'system',
        by: 'NavAR System',
        note: 'Dropped off the network.',
      },
      {
        id: 2,
        date: 'Mar 27, 2026 · 3:00 PM',
        action: 'Marked as resolved',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Power cycle resolved the connectivity issue.',
      },
    ],
  },
]

const STATUS_CONFIG = {
  faulty:       { label: 'faulty',            color: '#EC5252', bg: '#FFF2F2', dotBg: '#FFF2F2', icon: '!' },
  investigating:{ label: 'investigating',      color: '#FF9233', bg: '#FFF8F1', dotBg: '#FFF8F1', icon: '!' },
  maintenance:  { label: 'under maintenance', color: '#5B5BFF', bg: '#F0F0FF', dotBg: '#F0F0FF', icon: '!' },
  resolved:     { label: 'resolved',          color: '#016630', bg: '#E1FFEC', dotBg: '#E1FFEC', icon: '✓' },
}

const SOURCE_COLORS = {
  'mall report': { bg: '#FFF3E0', color: '#E65100' },
  system:        { bg: '#E3F2FD', color: '#0D47A1' },
  admin:         { bg: '#F3E5F5', color: '#6A1B9A' },
}

function StatusIcon({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.faulty
  return (
    <div className={`bkt-status-icon bkt-status-icon--${status}`}>
      {status === 'resolved' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5"/>
          <path d="M5 9.5l3 3 5-6" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : status === 'investigating' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5"/>
          <text x="9" y="13.5" textAnchor="middle" fontSize="11" fill={cfg.color} fontWeight="700">!</text>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5"/>
          <text x="9" y="13.5" textAnchor="middle" fontSize="11" fill={cfg.color} fontWeight="700">!</text>
        </svg>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.faulty
  return (
    <span className="bkt-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}` }}>
      {cfg.label}
    </span>
  )
}

function TicketItem({ ticket, isSelected, onClick }) {
  return (
    <button
      className={`bkt-item${isSelected ? ' bkt-item--active' : ''}`}
      onClick={onClick}
    >
      <div className="bkt-item-icon-wrap">
        <StatusIcon status={ticket.status} />
      </div>
      <div className="bkt-item-info">
        <p className="bkt-item-code">{ticket.beaconCode}</p>
        <p className="bkt-item-sub">{ticket.mall} · {ticket.floor}</p>
      </div>
      <div className="bkt-item-right">
        <StatusBadge status={ticket.status} />
        <span className="bkt-item-time">{ticket.timeAgo}</span>
      </div>
    </button>
  )
}

function TimelineDot({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: '#979797', bg: '#F1F1F1' }
  return <div className="bkt-tl-dot" style={{ borderColor: cfg.color, background: cfg.bg }} />
}

function getTimelineStatus(action) {
  if (action.toLowerCase().includes('resolved')) return 'resolved'
  if (action.toLowerCase().includes('investigating') || action.toLowerCase().includes('reopen')) return 'investigating'
  return 'faulty'
}

function TicketDetailPanel({ ticket, onClose, onAction }) {
  const canInvestigate = ticket.status === 'faulty' || ticket.status === 'resolved'
  const canMaintenance = ticket.status === 'investigating'
  const canResolve = ticket.status === 'investigating' || ticket.status === 'maintenance'

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div className="bkt-overlay" onClick={onClose}>
      <div className="bkt-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="bkt-detail-header">
          <h2 className="bkt-detail-title">{ticket.beaconCode}</h2>
          <button className="bkt-detail-close" onClick={onClose}>X</button>
        </div>
        <div className="bkt-detail-divider" />

        <div className="bkt-detail-body">
          <div className="bkt-detail-section">
            <span className="bkt-detail-label">STATUS</span>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="bkt-detail-section">
            <span className="bkt-detail-label">MALL</span>
            <span className="bkt-detail-value">{ticket.mall}</span>
          </div>
          <div className="bkt-detail-section">
            <span className="bkt-detail-label">FLOOR · LOCATION</span>
            <span className="bkt-detail-value">{ticket.floor} · {ticket.location}</span>
          </div>

          {ticket.assignedTo && (
            <div className="bkt-detail-section">
              <span className="bkt-detail-label">ASSIGNED TO</span>
              <span className="bkt-detail-value">{ticket.assignedTo}</span>
            </div>
          )}

          {ticket.assignedBy && (
            <div className="bkt-detail-section">
              <span className="bkt-detail-label">ASSIGNED BY</span>
              <span className="bkt-detail-value">{ticket.assignedBy}</span>
            </div>
          )}

          <div className="bkt-detail-divider" />

          <div className="bkt-detail-section">
            <span className="bkt-detail-label">ACTIVITY</span>
          </div>

          <div className="bkt-timeline">
            {ticket.timeline.map((entry, idx) => {
              const dotStatus = getTimelineStatus(entry.action)
              const srcCfg = SOURCE_COLORS[entry.source] || { bg: '#F1F1F1', color: '#4E4E4E' }
              return (
                <div key={entry.id} className="bkt-tl-entry">
                  <div className="bkt-tl-left">
                    <TimelineDot status={dotStatus} />
                    {idx < ticket.timeline.length - 1 && <div className="bkt-tl-line" />}
                  </div>
                  <div className="bkt-tl-content">
                    <p className="bkt-tl-date">{entry.date}</p>
                    <div className="bkt-tl-action-row">
                      <strong className="bkt-tl-action">{entry.action}</strong>
                      <span
                        className="bkt-tl-source"
                        style={{ background: srcCfg.bg, color: srcCfg.color }}
                      >
                        {entry.source}
                      </span>
                    </div>
                    <p className="bkt-tl-by">{entry.by}</p>
                    {entry.note && (
                      <div className="bkt-tl-note">{entry.note}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bkt-detail-footer">
          {canInvestigate && (
            <button
              className="bkt-action-btn bkt-action-btn--investigate"
              onClick={() => onAction('investigating')}
            >
              Mark as Investigating
            </button>
          )}
          {canMaintenance && (
            <button
              className="bkt-action-btn bkt-action-btn--maintenance"
              onClick={() => onAction('maintenance')}
            >
              Mark as Under Maintenance
            </button>
          )}
          {canResolve && (
            <button
              className="bkt-action-btn bkt-action-btn--resolve"
              onClick={() => onAction('resolved')}
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionModal({ type, onCancel, onConfirm }) {
  const [assignedTo, setAssignedTo] = useState('')
  const [assignedToErr, setAssignedToErr] = useState('')
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const isReopen = type === 'investigating-reopen'
  const effectiveType = isReopen ? 'investigating' : type
  const teamMembers = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams']

  const title = isReopen
    ? 'Reopen ticket as investigating?'
    : effectiveType === 'investigating'
    ? 'Mark ticket as investigating?'
    : effectiveType === 'maintenance'
    ? 'Mark ticket as under maintenance?'
    : 'Mark ticket as resolved?'

  const showAssignmentFields = effectiveType === 'investigating'
  const placeholder = isReopen
    ? 'Notes... — Why are you reopening this ticket?'
    : effectiveType === 'investigating'
    ? 'Notes... — What are you investigating?'
    : effectiveType === 'maintenance'
    ? 'Notes... — Maintenance details...'
    : 'Notes... — What was done to resolve this?'

  function handleConfirm() {
    if (showAssignmentFields) {
      if (!assignedTo) { setAssignedToErr('Please select who to assign.'); return }
      setAssignedToErr('')
    }
    onConfirm(note.trim(), effectiveType, assignedTo)
  }

  return (
    <div className="bkt-modal-overlay" onClick={onCancel}>
      <div className="bkt-modal" onClick={e => e.stopPropagation()}>
        <h3 className="bkt-modal-title">{title}</h3>
        {showAssignmentFields && (
          <>
            <div className="bkt-modal-field">
              <label className="bkt-modal-label">ASSIGN TO <span className="bkt-modal-label-required">*</span></label>
              <select
                className={`bkt-modal-select${assignedToErr ? ' bkt-modal-select--error' : ''}`}
                value={assignedTo}
                onChange={e => { setAssignedTo(e.target.value); setAssignedToErr('') }}
              >
                <option value="">-- Select team member --</option>
                {teamMembers.map(member => <option key={member} value={member}>{member}</option>)}
              </select>
              {assignedToErr && <p className="bkt-modal-error">{assignedToErr}</p>}
            </div>
          </>
        )}
        <div className="bkt-modal-field">
          <label className="bkt-modal-label">NOTES</label>
          <textarea
            className="bkt-modal-textarea"
            placeholder={placeholder}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            autoFocus
          />
        </div>
        <div className="bkt-modal-actions">
          <button className="bkt-modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="bkt-modal-confirm"
            onClick={handleConfirm}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}

let nextTicketId = initialTickets.length + 1

export default function BeaconTicketsTab() {
  const [tickets, setTickets] = useState(initialTickets)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [actionModal, setActionModal] = useState(null)

  const selectedTicket = tickets.find(t => t.id === selectedId) || null

  const filtered = tickets.filter(t => {
    const matchFilter = statusFilter === 'All' || t.status === statusFilter.toLowerCase()
    const matchSearch = !search ||
      t.beaconCode.toLowerCase().includes(search.toLowerCase()) ||
      t.mall.toLowerCase().includes(search.toLowerCase()) ||
      t.floor.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    faulty: tickets.filter(t => t.status === 'faulty').length,
    investigating: tickets.filter(t => t.status === 'investigating').length,
    maintenance: tickets.filter(t => t.status === 'maintenance').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: tickets.length,
  }

  function handleAction(type) {
    if (!selectedTicket) return
    const isReopen = type === 'investigating' && selectedTicket.status === 'resolved'
    setActionModal(isReopen ? 'investigating-reopen' : type)
  }

  function handleConfirmAction(note, effectiveType, assignedTo) {
    if (!selectedTicket) return
    const now = new Date()
    const dateStr = now.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })

    const isReopen = actionModal === 'investigating-reopen'

    const actionLabel = isReopen
      ? 'Reopened — Marked as investigating'
      : effectiveType === 'investigating'
      ? 'Marked as investigating'
      : effectiveType === 'maintenance'
      ? 'Marked as under maintenance'
      : 'Marked as resolved'

    const newEntry = {
      id: Date.now(),
      date: dateStr,
      action: actionLabel,
      source: 'admin',
      by: 'NavAR Admin',
      note: note || null,
    }

    const updatedTicket = {
      ...selectedTicket,
      status: effectiveType,
      timeline: [...selectedTicket.timeline, newEntry],
      timeAgo: 'just now',
    }

    if (effectiveType === 'investigating' && assignedTo) {
      updatedTicket.assignedTo = assignedTo
      updatedTicket.assignedBy = 'NavAR Admin'
    }

    setTickets(prev => prev.map(t =>
      t.id === selectedTicket.id ? updatedTicket : t
    ))
    setActionModal(null)
  }

  return (
    <div className="bkt-wrap">
      <h2 className="bkt-heading">Beacon Tickets</h2>

      {/* Summary cards */}
      <div className="bkt-stat-grid">
        <div className="bkt-stat-card">
          <span className="bkt-stat-num bkt-stat-num--faulty">{counts.faulty}</span>
          <span className="bkt-stat-label">Faulty</span>
        </div>
        <div className="bkt-stat-card">
          <span className="bkt-stat-num bkt-stat-num--investigating">{counts.investigating}</span>
          <span className="bkt-stat-label">Investigating</span>
        </div>
        <div className="bkt-stat-card">
          <span className="bkt-stat-num bkt-stat-num--maintenance">{counts.maintenance}</span>
          <span className="bkt-stat-label">Under Maintenance</span>
        </div>
        <div className="bkt-stat-card">
          <span className="bkt-stat-num bkt-stat-num--resolved">{counts.resolved}</span>
          <span className="bkt-stat-label">Resolved</span>
        </div>
        <div className="bkt-stat-card">
          <span className="bkt-stat-num">{counts.total}</span>
          <span className="bkt-stat-label">Total</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bkt-filter-bar">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`bkt-filter-btn${statusFilter === f ? ' bkt-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bkt-search-wrap">
        <Search size={14} className="bkt-search-icon" />
        <input
          className="bkt-search-input"
          type="text"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Ticket list */}
      <div className="bkt-list">
        {filtered.length === 0 ? (
          <p className="bkt-empty">No tickets found.</p>
        ) : filtered.map(ticket => (
          <TicketItem
            key={ticket.id}
            ticket={ticket}
            isSelected={selectedId === ticket.id}
            onClick={() => setSelectedId(ticket.id)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedId(null)}
          onAction={handleAction}
        />
      )}

      {/* Action confirmation modal */}
      {actionModal && (
        <ActionModal
          type={actionModal}
          onCancel={() => setActionModal(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  )
}
