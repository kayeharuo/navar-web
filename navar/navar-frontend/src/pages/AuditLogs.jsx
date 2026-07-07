import { useState, useEffect, useMemo } from 'react'
import '../styles/auditLogs/auditLogs.css'

const MODULE_COLORS = {
  'Subscription Management': { bg: '#DBEAFE', color: '#1D4ED8' },
  'Application Management': { bg: '#EDE9FE', color: '#7C3AED' },
  'Account Management':     { bg: '#D1FAE5', color: '#065F46' },
  'Mall Management':        { bg: '#FEF3C7', color: '#92400E' },
  'AR Development':         { bg: '#F0FDF4', color: '#15803D' },
}

const LOGS = [
  {
    id: 1,
    timestamp: 'March 14, 2026 at 9:02 AM',
    admin: 'Juan dela Cruz',
    module: 'Subscription Management',
    action: 'Suspended Mall',
    target: 'Parkmall Cebu',
    details: 'Reason: Non-Payment. Grace period ended Feb 22, 2026. Reinstatement fee: ₱18,000.',
  },
  {
    id: 2,
    timestamp: 'March 13, 2026 at 2:30 PM',
    admin: 'Bea Delicious',
    module: 'Application Management',
    action: 'Requested revision',
    target: 'SM City Consolacion Cebu',
    details: 'Note: Floor plan for Level 2 is missing. Please resubmit.',
  },
  {
    id: 3,
    timestamp: 'February 20, 2026 at 8:05 AM',
    admin: 'System (automated)',
    module: 'Subscription Management',
    action: 'Entered grace period',
    target: 'Robinsons Galleria Cebu',
    details: 'Subscription expired Feb 20, 2026. 30-day grace period active until Mar 22, 2026.',
  },
  {
    id: 4,
    timestamp: 'February 15, 2026 at 11:20 AM',
    admin: 'Lorenzo Reyes',
    module: 'Account Management',
    action: 'Deactivated account',
    target: 'tlim@navar.ph',
    details: 'Account access revoked due to role reassignment.',
  },
  {
    id: 5,
    timestamp: 'February 12, 2026 at 3:45 PM',
    admin: 'Dianne Aquino',
    module: 'Application Management',
    action: 'Approved application',
    target: 'Ayala Center Cebu',
    details: 'Application #APP-2026-045 approved. Mall tenant onboarding has been initiated.',
  },
  {
    id: 6,
    timestamp: 'February 10, 2026 at 9:00 AM',
    admin: 'System (automated)',
    module: 'Subscription Management',
    action: 'Payment reminder sent',
    target: 'Gaisano Grand Liloan',
    details: 'Automated payment reminder sent for overdue invoice #INV-2026-012.',
  },
  {
    id: 7,
    timestamp: 'January 28, 2026 at 2:00 PM',
    admin: 'Juan dela Cruz',
    module: 'Mall Management',
    action: 'Updated floor count',
    target: 'SM Seaside City Cebu',
    details: 'Floor count updated from 4 to 5. Beacon reassignment may be required for the new floor.',
  },
  {
    id: 8,
    timestamp: 'January 22, 2026 at 10:15 AM',
    admin: 'Lorenzo Reyes',
    module: 'Account Management',
    action: 'Created account',
    target: 'mvillanueva@navar.ph',
    details: 'New Super Admin account created. Magic link sent.',
  },
  {
    id: 9,
    timestamp: 'January 18, 2026 at 4:30 PM',
    admin: 'Dianne Aquino',
    module: 'Application Management',
    action: 'Rejected application',
    target: 'Pacific Mall Cebu',
    details: 'Application rejected due to incomplete business permit documentation.',
  },
  {
    id: 10,
    timestamp: 'January 10, 2026 at 8:00 AM',
    admin: 'System (automated)',
    module: 'Subscription Management',
    action: 'Subscription renewed',
    target: 'SM City Cebu',
    details: 'Annual subscription auto-renewed for SM City Cebu. Next renewal: January 10, 2027.',
  },
]

const ALL_MODULES = ['All Modules', ...new Set(LOGS.map(l => l.module))]
const ALL_ADMINS = ['All Admins', ...new Set(LOGS.map(l => l.admin))]

const THIS_WEEK_COUNT = 8
const SYSTEM_COUNT = LOGS.filter(l => l.admin === 'System (automated)').length
const ADMINS_ACTIVE = new Set(LOGS.filter(l => l.admin !== 'System (automated)').map(l => l.admin)).size

function ModuleBadge({ module }) {
  const c = MODULE_COLORS[module] || { bg: '#F3F4F6', color: '#374151' }
  return (
    <span className="audit-module-badge" style={{ background: c.bg, color: c.color }}>
      {module}
    </span>
  )
}

function DetailModal({ log, onClose }) {
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div className="audit-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="audit-detail-modal">
        <div className="audit-detail-top">
          <div>
            <h2 className="audit-detail-title">{log.action}</h2>
            <ModuleBadge module={log.module} />
          </div>
          <button className="audit-detail-x" onClick={onClose}>X</button>
        </div>

        <div className="audit-detail-divider" />

        <div className="audit-detail-body">
          <div className="audit-detail-row">
            <span className="audit-detail-label">When</span>
            <span className="audit-detail-value">{log.timestamp}</span>
          </div>
          <div className="audit-detail-row">
            <span className="audit-detail-label">Admin</span>
            <span className="audit-detail-value">{log.admin}</span>
          </div>
          <div className="audit-detail-row">
            <span className="audit-detail-label">Module</span>
            <span className="audit-detail-value">{log.module}</span>
          </div>
          <div className="audit-detail-row">
            <span className="audit-detail-label">Target</span>
            <span className="audit-detail-value">{log.target}</span>
          </div>

          <div className="audit-detail-section">
            <p className="audit-detail-section-label">Details</p>
            <div className="audit-detail-text-box">{log.details}</div>
          </div>
        </div>

        <div className="audit-detail-divider" />

        <div className="audit-detail-footer">
          <button className="audit-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function AuditLogs() {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All Modules')
  const [adminFilter, setAdminFilter] = useState('All Admins')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return LOGS.filter(l => {
      const matchSearch = !q ||
        l.timestamp.toLowerCase().includes(q) ||
        l.admin.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      const matchModule = moduleFilter === 'All Modules' || l.module === moduleFilter
      const matchAdmin = adminFilter === 'All Admins' || l.admin === adminFilter
      return matchSearch && matchModule && matchAdmin
    })
  }, [search, moduleFilter, adminFilter])

  return (
    <div className="audit-page">
      <div className="audit-header">
        <h1 className="audit-title">Audit Logs</h1>
        <p className="audit-subtitle">Record of all actions performed by super admins across the system.</p>
      </div>

      <div className="audit-stats">
        <div className="audit-stat-card audit-stat-card--blue">
          <div className="audit-stat-num">{LOGS.length}</div>
          <div className="audit-stat-label">Total Actions</div>
        </div>
        <div className="audit-stat-card audit-stat-card--green">
          <div className="audit-stat-num">{THIS_WEEK_COUNT}</div>
          <div className="audit-stat-label">This Week</div>
        </div>
        <div className="audit-stat-card audit-stat-card--orange">
          <div className="audit-stat-num">{ADMINS_ACTIVE}</div>
          <div className="audit-stat-label">Admins Active</div>
        </div>
        <div className="audit-stat-card audit-stat-card--purple">
          <div className="audit-stat-num">{SYSTEM_COUNT}</div>
          <div className="audit-stat-label">System Actions</div>
        </div>
      </div>

      <div className="audit-toolbar">
        <div className="audit-search-wrap">
          <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
            <path d="M22.67 21.55L17.73 16.61C19.16 14.89 19.88 12.69 19.72 10.45C19.57 8.22 18.56 6.13 16.91 4.62C15.26 3.11 13.09 2.3 10.85 2.35C8.61 2.4 6.48 3.31 4.9 4.9C3.31 6.48 2.4 8.61 2.35 10.85C2.3 13.09 3.11 15.26 4.62 16.91C6.13 18.56 8.22 19.57 10.45 19.72C12.69 19.88 14.89 19.16 16.61 17.73L21.55 22.67C21.72 22.85 21.92 22.9 22.11 22.9C22.31 22.9 22.5 22.85 22.67 22.67C22.85 22.5 22.9 22.31 22.9 22.11C22.9 21.92 22.85 21.73 22.67 21.55ZM3.95 11.06C3.95 7.16 7.16 3.95 11.06 3.95C14.95 3.95 18.16 7.16 18.16 11.06C18.16 14.95 14.95 18.16 11.06 18.16C7.16 18.16 3.95 14.95 3.95 11.06Z" fill="#979797"/>
          </svg>
          <input
            className="audit-search-input"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="audit-filters">
          <select className="audit-filter-select" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
            {ALL_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="audit-filter-select" value={adminFilter} onChange={e => setAdminFilter(e.target.value)}>
            {ALL_ADMINS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="audit-result-count">{filtered.length} results</span>
        </div>
      </div>

      <div className="audit-table-wrap">
        <div className="audit-table-scroll">
          <table className="audit-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>ADMIN</th>
                <th>MODULE</th>
                <th>ACTION</th>
                <th>TARGET</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr className="audit-empty-row"><td colSpan={5}>No logs found.</td></tr>
              )}
              {filtered.map(log => (
                <tr key={log.id} className="audit-table-row" onClick={() => setSelected(log)}>
                  <td>{log.timestamp}</td>
                  <td>{log.admin}</td>
                  <td><ModuleBadge module={log.module} /></td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="audit-hint">Click any row to view full details.</p>
      </div>

      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
