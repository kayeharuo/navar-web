import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { apiRequest } from '../../config/api'
import { useRealtimeRefresh } from '../../config/realtime'
import FlowDiagrams from './FlowDiagrams'

const FILTERS = ['All', 'Submitted', 'For Revision', 'Approved']
const date = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '?'
const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
const variants = { Submitted: 'submitted', 'For Revision': 'for-revision', Approved: 'approved',  }

export default function StallApplicationsTable({ applications, onApplicationsChange, onReviewApp }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [cardIndex, setCardIndex] = useState(0)
  const reload = useCallback(async () => {
    try {
      onApplicationsChange(await apiRequest('/api/stall-applications'))
      setError('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [onApplicationsChange])
  useEffect(() => {
    reload()
    const timer = setInterval(reload, 10000)
    return () => clearInterval(timer)
  }, [reload])
  useRealtimeRefresh(p => {
    if (['stall_application', 'ar_development', 'contract_payment_request'].includes(p.table)) reload()
  })
  const apps = (applications || []).map(app => app.applicationStatus === 'Completed' ? { ...app, applicationStatus: 'Approved' } : app).filter(app => FILTERS.includes(app.applicationStatus))
  const rows = apps.filter(a => (filter === 'All' || a.applicationStatus === filter) && `${a.mallName} ${a.city}`.toLowerCase().includes(search.toLowerCase()))
  const count = status => status === 'All' ? apps.length : apps.filter(a => a.applicationStatus === status).length
  const badge = app => <span className={`app-status-badge app-status-badge--${variants[app.applicationStatus] || 'default'}`}>{app.applicationStatus}</span>
  const review = app => <button className="app-mgmt-review-btn" onClick={e => { e.stopPropagation(); onReviewApp(app) }}>Review</button>
  const index = Math.min(cardIndex, Math.max(0, rows.length - 1))
  const card = rows[index]

  return <>
    {error && <div role="alert" className="app-mgmt-callout app-mgmt-callout--error">{error} <button onClick={reload}>Retry</button></div>}
    <FlowDiagrams stall />
    <div className="app-mgmt-toolbar">
      <div className="app-mgmt-filters">
        {FILTERS.map(status => <button key={status} aria-pressed={filter === status} className={`app-mgmt-filter-btn ${filter === status ? 'app-mgmt-filter-btn--active' : ''}`} onClick={() => { setFilter(status); setCardIndex(0) }}>
          {status}<span className={`app-mgmt-filter-count ${filter === status ? 'app-mgmt-filter-count--active' : ''}`}>{count(status)}</span>
        </button>)}
      </div>
      <div className="app-mgmt-search-wrap">
        <Search size={20} color="#979797" aria-hidden="true" />
        <input className="app-mgmt-search-input" placeholder="Search" aria-label="Search stall applications" value={search} onChange={e => { setSearch(e.target.value); setCardIndex(0) }} />
      </div>
    </div>
    <div className="app-mgmt-table-wrap">
      <div className="app-mgmt-table-scroll">
        <table className="app-mgmt-table">
          <thead><tr><th>MALL NAME</th><th>CITY</th><th>NO. OF STALLS</th><th>APPLICATION FEE</th><th>APPLICATION</th><th>SUBMITTED</th><th>LAST UPDATED</th><th>ACTION</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="app-mgmt-table-empty app-mgmt-table-loading"><span className="table-loading"><span className="table-loading-spinner" />Loading stall applications...</span></td></tr> : rows.map(app => <tr key={app.id} className={app.applicationStatus === 'Approved' ? 'row--approved' : ''} onClick={() => onReviewApp(app)}>
              <td><div className="app-mgmt-mall-name">{app.mallName}</div></td><td>{app.city}</td><td>{app.submittedStalls}</td><td>{money(app.fee)}</td><td>{badge(app)}</td><td>{date(app.submittedDate)}</td><td>{date(app.lastUpdated)}</td><td>{review(app)}</td>
            </tr>)}
            {!loading && !rows.length && <tr><td colSpan={8} className="app-mgmt-table-empty" style={{ textAlign: 'center', color: '#9B9C9C', padding: 32, fontFamily: 'Poppins' }}>No stall applications found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <div className="workflow-mobile-cards">
      {loading ? <p>Loading stall applications...</p> : !card ? <p>No stall applications found.</p> : <>
        <article><h3>{card.mallName}</h3><p>{card.city}</p><p>{badge(card)}</p><p>{card.submittedStalls} stalls ? {money(card.fee)}</p>{review(card)}</article>
        <nav aria-label="Stall application cards"><button disabled={index === 0} onClick={() => setCardIndex(index - 1)}>Previous</button><span>{index + 1} / {rows.length}</span><button disabled={index === rows.length - 1} onClick={() => setCardIndex(index + 1)}>Next</button></nav>
      </>}
    </div>
    <p className="app-mgmt-hint">Click any row to view full details.</p>
  </>
}
