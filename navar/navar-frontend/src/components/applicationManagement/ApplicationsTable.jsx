import { useState, useEffect } from 'react'
import FlowDiagrams from './FlowDiagrams'
import { apiRequest } from '../../config/api'

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <path d="M12.25 21C17.0825 21 21 17.0825 21 12.25C21 7.41751 17.0825 3.5 12.25 3.5C7.41751 3.5 3.5 7.41751 3.5 12.25C3.5 17.0825 7.41751 21 12.25 21Z" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.4375 18.4373L24.5002 24.5" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const STATUS_FILTERS = ['All', 'Submitted', 'For Revision', 'Approved', 'Draft']

// eslint-disable-next-line no-unused-vars
export default function ApplicationsTable({ applications, onApplicationsChange, onReviewApp }) {
  const [apps, setApps] = useState(applications || [])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadApplications() {
      try {
        const data = await apiRequest('/api/applications')
        if (!cancelled) {
          setApps(data)
          onApplicationsChange(data)
          setLoadError('')
        }
      } catch (error) {
        console.error('Application Management request failed:', error)
        if (!cancelled) setLoadError(error.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadApplications()
    return () => { cancelled = true }
  }, [onApplicationsChange])

  useEffect(() => {
    if (applications) setApps(applications)
  }, [applications])

  function getFilterCount(filter) {
    if (filter === 'All') return apps.length
    return apps.filter(a => a.applicationStatus === filter).length
  }

  function getAppStatusVariant(status) {
    const map = { 'Submitted': 'submitted', 'For Revision': 'for-revision', 'Approved': 'approved', 'Draft': 'draft' }
    return map[status] || 'default'
  }

  function getArStatusVariant(status) {
    const map = { 'Live': 'live', 'Testing': 'testing', 'Ready': 'ready', 'Node Mapping': 'node-mapping', 'Pending': 'pending', 'Unpublished': 'for-revision' }
    return map[status] || 'default'
  }

  const filtered = apps.filter(app => {
    const matchesFilter = activeFilter === 'All' || app.applicationStatus === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || app.mallName.toLowerCase().includes(q) || app.city.toLowerCase().includes(q) || app.adminName.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const sorted = [
    ...filtered.filter(a => a.applicationStatus !== 'Approved'),
    ...filtered.filter(a => a.applicationStatus === 'Approved'),
  ]

  const pendingCount = apps.filter(a => a.applicationStatus === 'Submitted' || a.applicationStatus === 'For Revision').length

  return (
    <>
      {loadError && (
        <div className="app-mgmt-callout app-mgmt-callout--error" role="alert">
          {loadError}
        </div>
      )}
      {/* Pending count message */}
      {pendingCount > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p className="app-mgmt-subtitle" style={{ margin: 0 }}>
            <span className="app-mgmt-subtitle-alert">{pendingCount} submissions awaiting review.</span>
          </p>
        </div>
      )}

      {/* Flow diagrams */}
      <FlowDiagrams />

      {/* Toolbar */}
      <div className="app-mgmt-toolbar">
        <div className="app-mgmt-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`app-mgmt-filter-btn ${activeFilter === f ? 'app-mgmt-filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              <span className={`app-mgmt-filter-count ${activeFilter === f ? 'app-mgmt-filter-count--active' : ''}`}>
                {getFilterCount(f)}
              </span>
            </button>
          ))}
        </div>
        <div className="app-mgmt-search-wrap">
          <SearchIcon />
          <input
            className="app-mgmt-search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="app-mgmt-table-wrap">
        <div className="app-mgmt-table-scroll">
          <table className="app-mgmt-table">
            <thead>
              <tr>
                <th>MALL NAME</th>
                <th>CITY</th>
                <th>ADMIN</th>
                <th>VERSION</th>
                <th>NO. OF FLOORS</th>
                <th>AGREEMENT</th>
                <th>APPLICATION</th>
                <th>AR DEVELOPMENT</th>
                <th>SUBMITTED</th>
                <th>LAST UPDATED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="app-mgmt-table-empty app-mgmt-table-loading">
                    <span className="table-loading"><span className="table-loading-spinner" />Loading applications...</span>
                  </td>
                </tr>
              ) : sorted.map(app => (
                <tr
                  key={app.id}
                  className={app.applicationStatus === 'Approved' ? 'row--approved' : ''}
                  onClick={() => !app.draft && onReviewApp(app)}
                >
                  <td>
                    <div className="app-mgmt-mall-name">{app.mallName}</div>
                  </td>
                  <td>{app.city}</td>
                  <td>
                    <div className="app-mgmt-admin-name">{app.adminName}</div>
                    <div className="app-mgmt-admin-email">{app.adminEmail}</div>
                  </td>
                  <td>{app.version}</td>
                  <td>{app.floors}</td>
                  <td>{app.agreement}</td>
                  <td>
                    <span className={`app-status-badge app-status-badge--${getAppStatusVariant(app.applicationStatus)}`}>
                      {app.applicationStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`app-status-badge app-status-badge--${getArStatusVariant(app.arDevelopment)}`}>
                      {app.arDevelopment}
                    </span>
                  </td>
                  <td>{app.submittedDate}</td>
                  <td>{app.lastUpdated}</td>
                  <td>
                    <button
                      className="app-mgmt-review-btn"
                      disabled={app.draft}
                      onClick={e => { e.stopPropagation(); if (!app.draft) onReviewApp(app) }}
                    >
                      {app.draft ? 'Not submitted' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: '#9B9C9C', padding: '32px', fontFamily: 'Poppins' }}>
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="app-mgmt-hint">Click any row to view full details.</p>
    </>
  )
}
