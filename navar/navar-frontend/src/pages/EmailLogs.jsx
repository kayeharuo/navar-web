import { useState, useMemo } from 'react'
import '../styles/emailLogs/emailLogs.css'

const INIT_LOGS = [
  {
    id: 1,
    timestamp: 'March 14, 2026, 2:00 PM',
    recipient: 'admin@ayalachbc.ph',
    mall: 'Ayala Malls Central Block',
    type: 'Suspension Lifted',
    triggeredBy: 'System',
    status: 'sent',
    body: 'Your suspension has been lifted. Service is restored.',
  },
  {
    id: 2,
    timestamp: 'March 6, 2026, 8:00 AM',
    recipient: 'admin@pacificmall.ph',
    mall: 'Pacific Mall Cebu',
    type: 'Contract Expiry Reminder',
    triggeredBy: 'System (automated)',
    status: 'sent',
    body: 'Your contract is expiring soon. Please renew to avoid service interruption.',
  },
  {
    id: 3,
    timestamp: 'November 20, 2025, 8:00 AM',
    recipient: 'jdelacruz@smseaside.ph',
    mall: 'SM Seaside City Cebu',
    type: 'Map Ready for Confirmation',
    triggeredBy: 'System',
    status: 'sent',
    body: 'Your AR map is ready for review and confirmation before going live.',
  },
  {
    id: 4,
    timestamp: 'October 15, 2025, 3:30 PM',
    recipient: 'admin@robinsons.ph',
    mall: 'Robinsons Galleria Cebu',
    type: 'Welcome / Account Created',
    triggeredBy: 'Lorenzo Reyes',
    status: 'sent',
    body: 'Your account has been created. Click the link to set up your password.',
  },
  {
    id: 5,
    timestamp: 'September 28, 2025, 11:15 AM',
    recipient: 'ltan@pacificmall.ph',
    mall: 'Pacific Mall Cebu',
    type: 'Password Reset',
    triggeredBy: 'Admin',
    status: 'failed',
    body: 'Password reset link has been generated.',
    failReason: '550: User not found on recipient server. Please verify the email address.',
  },
  {
    id: 6,
    timestamp: 'September 10, 2025, 9:00 AM',
    recipient: 'admin@smcity.ph',
    mall: 'SM City Cebu',
    type: 'Grace Period Notice',
    triggeredBy: 'System (automated)',
    status: 'sent',
    body: 'Your grace period has started. Settlement required within 30 days.',
  },
  {
    id: 7,
    timestamp: 'August 22, 2025, 2:45 PM',
    recipient: 'info@gaisano.ph',
    mall: 'Gaisano Grand Liloan',
    type: 'Application — Approved',
    triggeredBy: 'Bea Delicious',
    status: 'sent',
    body: 'Congratulations! Your application has been approved.',
  },
  {
    id: 8,
    timestamp: 'August 5, 2025, 10:30 AM',
    recipient: 'admin@ayala.ph',
    mall: 'Ayala Center Cebu',
    type: 'Suspension Notice',
    triggeredBy: 'System (automated)',
    status: 'sent',
    body: 'Your service has been suspended due to non-payment.',
  },
  {
    id: 9,
    timestamp: 'July 18, 2025, 4:20 PM',
    recipient: 'billing@parkmall.ph',
    mall: 'Parkmall Mandaue',
    type: 'Payment Confirmed',
    triggeredBy: 'System',
    status: 'sent',
    body: 'Payment received and confirmed. Thank you.',
  },
  {
    id: 10,
    timestamp: 'July 1, 2025, 8:00 AM',
    recipient: 'lim@navar.ph',
    mall: 'Internal',
    type: 'AR Map Went Live',
    triggeredBy: 'System (automated)',
    status: 'pending',
    body: 'AR map deployment completed successfully.',
  },
]

const EMAIL_TYPES = [
  'All Email Types',
  'Welcome / Account Created',
  'Password Reset',
  'Application — Revision Requested',
  'Application — Approved',
  'Map Ready for Confirmation',
  'Contract Expiry Reminder',
  'Grace Period Notice',
  'Suspension Notice',
  'Suspension Lifted',
  'Payment Confirmed',
  'AR Map Went Live',
]

const STATUS_OPTIONS = ['All Statuses', 'Delivered', 'Failed', 'Pending']

function StatusBadge({ status }) {
  return (
    <span className={`email-status-badge email-status-badge--${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
      <path d="M22.67 21.55L17.73 16.61C19.16 14.89 19.88 12.69 19.72 10.45C19.57 8.22 18.56 6.13 16.91 4.62C15.26 3.11 13.09 2.3 10.85 2.35C8.61 2.4 6.48 3.31 4.9 4.9C3.31 6.48 2.4 8.61 2.35 10.85C2.3 13.09 3.11 15.26 4.62 16.91C6.13 18.56 8.22 19.57 10.45 19.72C12.69 19.88 14.89 19.16 16.61 17.73L21.55 22.67C21.72 22.85 21.92 22.9 22.11 22.9C22.31 22.9 22.5 22.85 22.67 22.67C22.85 22.5 22.9 22.31 22.9 22.11C22.9 21.92 22.85 21.73 22.67 21.55ZM3.95 11.06C3.95 7.16 7.16 3.95 11.06 3.95C14.95 3.95 18.16 7.16 18.16 11.06C18.16 14.95 14.95 18.16 11.06 18.16C7.16 18.16 3.95 14.95 3.95 11.06Z" fill="#979797"/>
    </svg>
  )
}

function DetailModal({ log, onResend, onClose }) {
  const [resent, setResent] = useState(false)

  function handleResend() {
    onResend(log.id)
    setResent(true)
  }

  const isFailed = log.status === 'failed' && !resent

  return (
    <div className="email-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="email-detail-modal">
        <div className="email-detail-top">
          <div>
            <h2 className="email-detail-title">{log.type}</h2>
            <StatusBadge status={resent ? 'sent' : log.status} />
          </div>
          <button className="email-detail-x" onClick={onClose}>X</button>
        </div>

        <div className="email-detail-divider" />

        <div className="email-detail-body">
          <div className="email-detail-row">
            <span className="email-detail-label">When</span>
            <span className="email-detail-value">{log.timestamp}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Recipient</span>
            <span className="email-detail-value">{log.recipient}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Mall</span>
            <span className="email-detail-value">{log.mall}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Type</span>
            <span className="email-detail-value">{log.type}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Triggered By</span>
            <span className="email-detail-value">{log.triggeredBy}</span>
          </div>

          {isFailed && log.failReason && (
            <div className="email-detail-section">
              <p className="email-detail-section-label">Failure Reason</p>
              <div className="email-detail-text-box email-detail-text-box--error">{log.failReason}</div>
            </div>
          )}

          <div className="email-detail-section">
            <p className="email-detail-section-label">Email Content</p>
            <div className="email-detail-text-box">{log.body}</div>
          </div>

          {resent && (
            <div className="email-resent-notice">
              ✓ Email successfully resent to {log.recipient}
            </div>
          )}
        </div>

        <div className="email-detail-divider" />

        <div className="email-detail-footer">
          {isFailed && (
            <button className="email-modal-resend-btn" onClick={handleResend}>
              Resend Email
            </button>
          )}
          <button className="email-modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function EmailLogs() {
  const [logs, setLogs] = useState(INIT_LOGS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [typeFilter, setTypeFilter] = useState('All Email Types')
  const [selected, setSelected] = useState(null)

  const statusMap = { 'Delivered': 'sent', 'Failed': 'failed', 'Pending': 'pending' }
  const statusToDisplay = statusFilter === 'All Statuses' ? null : statusMap[statusFilter]

  const totalSent = logs.filter(l => l.status === 'sent').length
  const totalFailed = logs.filter(l => l.status === 'failed').length
  const totalPending = logs.filter(l => l.status === 'pending').length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(l => {
      const matchSearch = !q ||
        l.timestamp.toLowerCase().includes(q) ||
        l.recipient.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q) ||
        l.triggeredBy.toLowerCase().includes(q)
      const matchStatus = !statusToDisplay || l.status === statusToDisplay
      const matchType = typeFilter === 'All Email Types' || l.type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [logs, search, statusFilter, typeFilter, statusToDisplay])

  function handleResend(id) {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'sent' } : l))
  }

  return (
    <div className="email-page">
      <div className="email-header">
        <h1 className="email-title">Email Logs</h1>
        <p className="email-subtitle">Record of all emails sent through the system, both admin-triggered and automated.</p>
      </div>

      <div className="email-stats">
        <div className="email-stat-card email-stat-card--blue">
          <div className="email-stat-num">{logs.length}</div>
          <div className="email-stat-label">Total Sent</div>
        </div>
        <div className="email-stat-card email-stat-card--green">
          <div className="email-stat-num">{totalSent}</div>
          <div className="email-stat-label">Delivered</div>
        </div>
        <div className="email-stat-card email-stat-card--red">
          <div className="email-stat-num">{totalFailed}</div>
          <div className="email-stat-label">Failed</div>
        </div>
        <div className="email-stat-card email-stat-card--orange">
          <div className="email-stat-num">{totalPending}</div>
          <div className="email-stat-label">Pending</div>
        </div>
      </div>

      <div className="email-toolbar">
        <div className="email-search-wrap">
          <SearchIcon />
          <input
            className="email-search-input"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="email-filters">
          <select className="email-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="email-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="email-result-count">{filtered.length} results</span>
        </div>
      </div>

      <div className="email-table-wrap">
        <div className="email-table-scroll">
          <table className="email-table">
            <thead>
              <tr>
                <th>EMAIL TYPE</th>
                <th>MALL</th>
                <th>RECIPIENT</th>
                <th>SENT AT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr className="email-empty-row"><td colSpan={5}>No email logs found.</td></tr>
              )}
              {filtered.map(log => (
                <tr key={log.id} className="email-table-row" onClick={() => setSelected(log)}>
                  <td>{log.type}</td>
                  <td>{log.mall}</td>
                  <td>{log.recipient}</td>
                  <td>{log.timestamp}</td>
                  <td>
                    <div className="email-actions-cell">
                      <StatusBadge status={log.status} />
                      {log.status === 'failed' && (
                        <button
                          className="email-resend-btn"
                          onClick={e => { e.stopPropagation(); handleResend(log.id) }}
                        >
                          Resend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="email-hint">Click any row to view full details. Failed emails can be resent.</p>
      </div>

      {selected && (
        <DetailModal
          log={logs.find(l => l.id === selected.id) || selected}
          onResend={handleResend}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
