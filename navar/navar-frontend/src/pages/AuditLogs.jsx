import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../config/api'
import '../styles/auditLogs/auditLogs.css'

const MODULE_COLORS = {
  'Subscription Management': { bg: '#DBEAFE', color: '#1D4ED8' }, 'Application Management': { bg: '#EDE9FE', color: '#7C3AED' },
  'Account Management': { bg: '#D1FAE5', color: '#065F46' }, 'Mall Management': { bg: '#FEF3C7', color: '#92400E' }, 'AR Development': { bg: '#F0FDF4', color: '#15803D' },
}

function ModuleBadge({ module }) { const colors = MODULE_COLORS[module] || { bg: '#F3F4F6', color: '#374151' }; return <span className="audit-module-badge" style={{ background: colors.bg, color: colors.color }}>{module}</span> }
function formatTimestamp(value) { return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

function DetailModal({ log, onClose }) {
  useEffect(() => { const close = event => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  return <div className="audit-modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}><div className="audit-detail-modal">
    <div className="audit-detail-top"><div><h2 className="audit-detail-title">{log.action}</h2><ModuleBadge module={log.module} /></div><button className="audit-detail-x" onClick={onClose}>X</button></div><div className="audit-detail-divider" />
    <div className="audit-detail-body">{[['When', formatTimestamp(log.timestamp)], ['Admin', log.admin], ['Module', log.module], ['Target', log.target]].map(([label, value]) => <div className="audit-detail-row" key={label}><span className="audit-detail-label">{label}</span><span className="audit-detail-value">{value}</span></div>)}<div className="audit-detail-section"><p className="audit-detail-section-label">Details</p><div className="audit-detail-text-box">{log.details || 'No additional details recorded.'}</div></div></div>
    <div className="audit-detail-divider" /><div className="audit-detail-footer"><button className="audit-close-btn" onClick={onClose}>Close</button></div>
  </div></div>
}

export default function AuditLogs() {
  const pageSize = 10
  const [logs, setLogs] = useState([]), [total, setTotal] = useState(0), [stats, setStats] = useState({ thisWeek: 0, adminsActive: 0, systemActions: 0 }), [page, setPage] = useState(1), [search, setSearch] = useState(''), [moduleFilter, setModuleFilter] = useState('All Modules'), [adminFilter, setAdminFilter] = useState('All Admins'), [selected, setSelected] = useState(null), [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; setLoading(true); setError(''); apiRequest(`/api/audit-logs?page=${page}&pageSize=${pageSize}`).then(result => { if (active) { setLogs(result.items); setTotal(result.total); setStats(result.stats) } }).catch(error => { if (active) { setError(error.message); setLogs([]); setTotal(0); setStats({ thisWeek: 0, adminsActive: 0, systemActions: 0 }) } }).finally(() => active && setLoading(false)); return () => { active = false } }, [page])
  const modules = useMemo(() => ['All Modules', ...new Set(logs.map(log => log.module))], [logs]), admins = useMemo(() => ['All Admins', ...new Set(logs.map(log => log.admin))], [logs])
  const filtered = useMemo(() => logs.filter(log => { const query = search.trim().toLowerCase(); return (!query || [log.timestamp, log.admin, log.module, log.action, log.target, log.details].some(value => String(value || '').toLowerCase().includes(query))) && (moduleFilter === 'All Modules' || log.module === moduleFilter) && (adminFilter === 'All Admins' || log.admin === adminFilter) }), [logs, search, moduleFilter, adminFilter])
  const [error,setError] = useState('')
  return <div className="audit-page"><div className="audit-header"><h1 className="audit-title">Audit Logs</h1><p className="audit-subtitle">Record of all actions performed by super admins across the system.</p></div>
    <div className="audit-stats">{[['blue', total, 'Total Actions'], ['green', stats.thisWeek, 'This Week'], ['orange', stats.adminsActive, 'Admins Active'], ['purple', stats.systemActions, 'System Actions']].map(([color, value, label]) => <div className={`audit-stat-card audit-stat-card--${color}`} key={label}><div className="audit-stat-num">{value}</div><div className="audit-stat-label">{label}</div></div>)}</div>
    <div className="audit-toolbar"><div className="audit-search-wrap"><input className="audit-search-input" placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="audit-filters"><select className="audit-filter-select" value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}>{modules.map(module => <option key={module}>{module}</option>)}</select><select className="audit-filter-select" value={adminFilter} onChange={event => setAdminFilter(event.target.value)}>{admins.map(admin => <option key={admin}>{admin}</option>)}</select><span className="audit-result-count">{filtered.length} results</span></div></div>
    {error && <p role="alert" className="audit-hint">{error}</p>}<div className="audit-table-wrap"><div className="audit-table-scroll"><table className="audit-table"><thead><tr><th>TIMESTAMP</th><th>ADMIN</th><th>MODULE</th><th>ACTION</th><th>TARGET</th></tr></thead><tbody>{loading && <tr className="audit-empty-row"><td colSpan={5}><LoadingSpinner label="Loading Audit Logs..." showLabel /></td></tr>}{!loading && filtered.length === 0 && <tr className="audit-empty-row"><td colSpan={5}>{error ? 'Unable to load audit logs.' : 'No logs found.'}</td></tr>}{!loading && filtered.map(log => <tr key={log.id} className="audit-table-row" onClick={() => setSelected(log)}><td>{formatTimestamp(log.timestamp)}</td><td>{log.admin}</td><td><ModuleBadge module={log.module} /></td><td>{log.action}</td><td>{log.target}</td></tr>)}</tbody></table></div><div className="audit-detail-footer"><button className="audit-close-btn" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><p className="audit-hint">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</p><button className="audit-close-btn" disabled={loading || page * pageSize >= total} onClick={() => setPage(value => value + 1)}>Next</button></div><p className="audit-hint">Showing up to 10 records per page. Click any row to view full details.</p></div>{selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
  </div>
}
