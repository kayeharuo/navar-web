import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import '../../styles/mallManagement/generalTickets.css'

const STATUS_FILTERS = ['All', 'Open', 'Investigating', 'Taking Action', 'Resolved']

const CATEGORIES = [
  'Account / access issue',
  'Billing / wallet issue',
  'App bug report',
  'Analytics / dashboard issue',
  'Map accuracy feedback',
  'Event / promo support request',
  'Training / onboarding request',
  'Contract / renewal inquiry',
  'Other',
]

const initialTickets = [
  {
    id: 1,
    ticketId: 'GEN-0001',
    mall: 'SM City Cebu',
    category: 'Account / access issue',
    status: 'open',
    timeAgo: '2h ago',
    assignedTo: null,
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 10:14 AM',
        action: 'Ticket Created',
        source: 'user',
        by: 'Customer Support',
        note: 'User unable to log in to account. Reset password not working.',
      },
    ],
  },
  {
    id: 2,
    ticketId: 'GEN-0002',
    mall: 'Ayala Center Cebu',
    category: 'Billing / wallet issue',
    status: 'investigating',
    timeAgo: '1d ago',
    assignedTo: 'John Doe',
    timeline: [
      {
        id: 1,
        date: 'Mar 31, 2026 · 8:00 AM',
        action: 'Ticket Created',
        source: 'user',
        by: 'Customer Support',
        note: 'Wallet charge appears twice for one transaction.',
      },
      {
        id: 2,
        date: 'Mar 31, 2026 · 11:30 AM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Checking payment transaction logs.',
      },
    ],
  },
  {
    id: 3,
    ticketId: 'GEN-0003',
    mall: 'Ayala Center Cebu',
    category: 'App bug report',
    status: 'resolved',
    timeAgo: '3d ago',
    assignedTo: 'Jane Smith',
    timeline: [
      {
        id: 1,
        date: 'Mar 29, 2026 · 9:00 AM',
        action: 'Ticket Created',
        source: 'user',
        by: 'Customer Support',
        note: 'App crashes when opening map on floor 3.',
      },
      {
        id: 2,
        date: 'Mar 29, 2026 · 1:00 PM',
        action: 'Marked as investigating',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Reproducing issue in test environment.',
      },
      {
        id: 3,
        date: 'Mar 30, 2026 · 9:00 AM',
        action: 'Marked as resolved',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Bug fix deployed in v2.1.0 release.',
      },
    ],
  },
  {
    id: 4,
    ticketId: 'GEN-0004',
    mall: 'SM Seaside City Cebu',
    category: 'Analytics / dashboard issue',
    status: 'taking-action',
    timeAgo: '4h ago',
    assignedTo: 'Mike Johnson',
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 7:00 AM',
        action: 'Ticket Created',
        source: 'user',
        by: 'Customer Support',
        note: 'Dashboard metrics showing incorrect visitor count.',
      },
      {
        id: 2,
        date: 'Apr 1, 2026 · 8:00 AM',
        action: 'Marked as taking-action',
        source: 'admin',
        by: 'NavAR Admin',
        note: 'Implementing analytics recalculation script.',
      },
    ],
  },
  {
    id: 5,
    ticketId: 'GEN-0005',
    mall: 'Parkmall',
    category: 'Map accuracy feedback',
    status: 'open',
    timeAgo: '6h ago',
    assignedTo: null,
    timeline: [
      {
        id: 1,
        date: 'Apr 1, 2026 · 4:00 AM',
        action: 'Ticket Created',
        source: 'user',
        by: 'Customer Support',
        note: 'Store location on map is 50 meters off from actual location.',
      },
    ],
  },
]

const STATUS_CONFIG = {
  open:         { label: 'open',           color: '#155DFC', bg: '#EFF6FF', dotBg: '#EFF6FF', icon: '◆' },
  investigating:{ label: 'investigating',  color: '#FF9233', bg: '#FFF8F1', dotBg: '#FFF8F1', icon: '!' },
  'taking-action':{ label: 'taking action',  color: '#5B5BFF', bg: '#F0F0FF', dotBg: '#F0F0FF', icon: '⚙' },
  resolved:     { label: 'resolved',       color: '#016630', bg: '#E1FFEC', dotBg: '#E1FFEC', icon: '✓' },
}

const SOURCE_COLORS = {
  'user':       { bg: '#F0F0FF', color: '#5B5BFF' },
  'admin':      { bg: '#F3E5F5', color: '#6A1B9A' },
}

function StatusIcon({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open
  return (
    <div className={`gt-status-icon gt-status-icon--${status}`}>
      {status === 'resolved' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5"/>
          <path d="M5 9.5l3 3 5-6" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5"/>
          <text x="9" y="13.5" textAnchor="middle" fontSize="10" fill={cfg.color} fontWeight="700">{cfg.icon}</text>
        </svg>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open
  return (
    <span className="gt-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}` }}>
      {cfg.label}
    </span>
  )
}

function TicketItem({ ticket, isSelected, onClick }) {
  return (
    <button
      className={`gt-item${isSelected ? ' gt-item--active' : ''}`}
      onClick={onClick}
    >
      <div className="gt-item-icon-wrap">
        <StatusIcon status={ticket.status} />
      </div>
      <div className="gt-item-info">
        <p className="gt-item-code">{ticket.ticketId}</p>
        <p className="gt-item-sub">{ticket.mall} · {ticket.category}</p>
      </div>
      <div className="gt-item-right">
        <StatusBadge status={ticket.status} />
        <span className="gt-item-time">{ticket.timeAgo}</span>
      </div>
    </button>
  )
}

function TimelineDot({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: '#979797', bg: '#F1F1F1' }
  return <div className="gt-tl-dot" style={{ borderColor: cfg.color, background: cfg.bg }} />
}

function getTimelineStatus(action) {
  if (action.toLowerCase().includes('resolved')) return 'resolved'
  if (action.toLowerCase().includes('taking') || action.toLowerCase().includes('action')) return 'taking-action'
  if (action.toLowerCase().includes('investigating')) return 'investigating'
  return 'open'
}

function TicketDetailPanel({ ticket, onClose, onAction }) {
  const canInvestigate = ticket.status === 'open'
  const canTakeAction = ticket.status === 'investigating'
  const canResolve = ticket.status === 'taking-action' || ticket.status === 'investigating'

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div className="gt-overlay" onClick={onClose}>
      <div className="gt-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="gt-detail-header">
          <h2 className="gt-detail-title">{ticket.ticketId}</h2>
          <button className="gt-detail-close" onClick={onClose}>X</button>
        </div>
        <div className="gt-detail-divider" />

        <div className="gt-detail-body">
          <div className="gt-detail-section">
            <span className="gt-detail-label">STATUS</span>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="gt-detail-section">
            <span className="gt-detail-label">MALL</span>
            <span className="gt-detail-value">{ticket.mall}</span>
          </div>
          <div className="gt-detail-section">
            <span className="gt-detail-label">CATEGORY</span>
            <span className="gt-detail-value">{ticket.category}</span>
          </div>

          {ticket.assignedTo && (
            <div className="gt-detail-section">
              <span className="gt-detail-label">ASSIGNED TO</span>
              <span className="gt-detail-value">{ticket.assignedTo}</span>
            </div>
          )}

          <div className="gt-detail-divider" />

          <div className="gt-detail-section">
            <span className="gt-detail-label">ACTIVITY</span>
          </div>

          <div className="gt-timeline">
            {[...ticket.timeline].reverse().map((entry, idx) => {
              const dotStatus = getTimelineStatus(entry.action)
              const srcCfg = SOURCE_COLORS[entry.source] || { bg: '#F1F1F1', color: '#4E4E4E' }
              return (
                <div key={entry.id} className="gt-tl-entry">
                  <div className="gt-tl-left">
                    <TimelineDot status={dotStatus} />
                    {idx < ticket.timeline.length - 1 && <div className="gt-tl-line" />}
                  </div>
                  <div className="gt-tl-content">
                    <p className="gt-tl-date">{entry.date}</p>
                    <div className="gt-tl-action-row">
                      <strong className="gt-tl-action">{entry.action}</strong>
                      <span
                        className="gt-tl-source"
                        style={{ background: srcCfg.bg, color: srcCfg.color }}
                      >
                        {entry.source}
                      </span>
                    </div>
                    <p className="gt-tl-by">{entry.by}</p>
                    {entry.note && (
                      <div className="gt-tl-note">{entry.note}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="gt-detail-footer">
          {canInvestigate && (
            <button
              className="gt-action-btn gt-action-btn--investigate"
              onClick={() => onAction('investigating')}
            >
              Mark as Investigating
            </button>
          )}
          {canTakeAction && (
            <button
              className="gt-action-btn gt-action-btn--action"
              onClick={() => onAction('taking-action')}
            >
              Mark as Taking Action
            </button>
          )}
          {canResolve && (
            <button
              className="gt-action-btn gt-action-btn--resolve"
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

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const teamMembers = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams']

  const title = type === 'investigating'
    ? 'Mark ticket as investigating?'
    : type === 'taking-action'
    ? 'Mark ticket as taking action?'
    : 'Mark ticket as resolved?'

  const showAssignmentFields = type === 'investigating'
  const placeholder = type === 'investigating'
    ? 'Notes... — What are you investigating?'
    : type === 'taking-action'
    ? 'Notes... — What action are you taking?'
    : 'Notes... — How was this resolved?'

  function handleConfirm() {
    if (showAssignmentFields) {
      if (!assignedTo) { setAssignedToErr('Please select who to assign.'); return }
      setAssignedToErr('')
    }
    onConfirm(note.trim(), type, assignedTo)
  }

  return (
    <div className="gt-modal-overlay" onClick={onCancel}>
      <div className="gt-modal" onClick={e => e.stopPropagation()}>
        <h3 className="gt-modal-title">{title}</h3>
        {showAssignmentFields && (
          <div className="gt-modal-field">
            <label className="gt-modal-label">ASSIGN TO <span className="gt-modal-label-required">*</span></label>
            <select
              className={`gt-modal-select${assignedToErr ? ' gt-modal-select--error' : ''}`}
              value={assignedTo}
              onChange={e => { setAssignedTo(e.target.value); setAssignedToErr('') }}
            >
              <option value="">-- Select team member --</option>
              {teamMembers.map(member => <option key={member} value={member}>{member}</option>)}
            </select>
            {assignedToErr && <p className="gt-modal-error">{assignedToErr}</p>}
          </div>
        )}
        <div className="gt-modal-field">
          <label className="gt-modal-label">NOTES</label>
          <textarea
            className="gt-modal-textarea"
            placeholder={placeholder}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            autoFocus
          />
        </div>
        <div className="gt-modal-actions">
          <button className="gt-modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="gt-modal-confirm"
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

export default function GeneralTicketsTab() {
  const [tickets, setTickets] = useState(initialTickets)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [actionModal, setActionModal] = useState(null)

  const selectedTicket = tickets.find(t => t.id === selectedId) || null

  const filtered = tickets.filter(t => {
    const matchFilter = statusFilter === 'All' || t.status === statusFilter.toLowerCase()
    const matchSearch = !search ||
      t.ticketId.toLowerCase().includes(search.toLowerCase()) ||
      t.mall.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    open: tickets.filter(t => t.status === 'open').length,
    investigating: tickets.filter(t => t.status === 'investigating').length,
    'taking-action': tickets.filter(t => t.status === 'taking-action').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: tickets.length,
  }

  function handleAction(type) {
    if (!selectedTicket) return
    setActionModal(type)
  }

  function handleConfirmAction(note, effectiveType, assignedTo) {
    if (!selectedTicket) return
    const now = new Date()
    const dateStr = now.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })

    const actionLabel = effectiveType === 'investigating'
      ? 'Marked as investigating'
      : effectiveType === 'taking-action'
      ? 'Marked as taking action'
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
    }

    setTickets(prev => prev.map(t =>
      t.id === selectedTicket.id ? updatedTicket : t
    ))
    setActionModal(null)
  }

  return (
    <div className="gt-wrap">
      <h2 className="gt-heading">General Tickets</h2>

      {/* Summary cards */}
      <div className="gt-stat-grid">
        <div className="gt-stat-card">
          <span className="gt-stat-num gt-stat-num--open">{counts.open}</span>
          <span className="gt-stat-label">Open</span>
        </div>
        <div className="gt-stat-card">
          <span className="gt-stat-num gt-stat-num--investigating">{counts.investigating}</span>
          <span className="gt-stat-label">Investigating</span>
        </div>
        <div className="gt-stat-card">
          <span className="gt-stat-num gt-stat-num--action">{counts['taking-action']}</span>
          <span className="gt-stat-label">Taking Action</span>
        </div>
        <div className="gt-stat-card">
          <span className="gt-stat-num gt-stat-num--resolved">{counts.resolved}</span>
          <span className="gt-stat-label">Resolved</span>
        </div>
        <div className="gt-stat-card">
          <span className="gt-stat-num">{counts.total}</span>
          <span className="gt-stat-label">Total</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="gt-filter-bar">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`gt-filter-btn${statusFilter === f ? ' gt-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="gt-search-wrap">
        <Search size={14} className="gt-search-icon" />
        <input
          className="gt-search-input"
          type="text"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Ticket list */}
      <div className="gt-list">
        {filtered.length === 0 ? (
          <p className="gt-empty">No tickets found.</p>
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
