import { Link } from 'react-router-dom'
import useDashboardData from './useDashboardData'
import StatCard from './StatCard'
import '../../styles/dashboard/dashboard.css'

const pipeline = [
  { label: 'Draft',          barColor: '#93C5FD', dotColor: '#94A3B8' },
  { label: 'Submitted',      barColor: '#3B82F6', dotColor: '#3B82F6' },
  { label: 'For Revision',   barColor: '#FB923C', dotColor: '#FB923C' },
  { label: 'Approved',      barColor: '#22C55E', dotColor: '#22C55E' },
]

export default function ApplicationsPanel() {
  const { data: applications, loading, error } = useDashboardData('/api/applications')
  const counts = applications.reduce((result, app) => {
    result[app.applicationStatus] = (result[app.applicationStatus] || 0) + 1
    return result
  }, {})
  const rows = [...pipeline, ...Object.keys(counts).filter(label => !pipeline.some(row => row.label === label)).map(label => ({ label, barColor: '#94A3B8', dotColor: '#94A3B8' }))].map(row => ({ ...row, count: counts[row.label] || 0 }))
  const max = Math.max(1, ...rows.map(row => row.count))
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#3B82F6' }} />
          <span className="dash-card-label">Applications</span>
        </div>
        <Link className="dash-view-all" to="/application-management">View All &rarr;</Link>
      </div>

      {loading ? <p role="status">Loading applications...</p> : error ? <p role="alert">{error}</p> : <>
      <div className="dash-stat-grid">
        <StatCard value={counts.Submitted || 0} label="Submitted For Review"                       color="#3B82F6" />
        <StatCard value={counts['For Revision'] || 0} label="Requested Revision — Waiting for response"  color="#F97316" />
      </div>

      <div>
        <p className="dash-section-label">Pipeline Breakdown</p>
        <div className="dash-pipeline">
          {rows.map(({ label, count, barColor, dotColor }) => (
            <div key={label} className="dash-pipeline-row">
              <span className="dash-pipeline-dot" style={{ backgroundColor: dotColor }} />
              <span className="dash-pipeline-label">{label}</span>
              <span className="dash-pipeline-count">{String(count).padStart(2, '0')}</span>
              <div className="dash-pipeline-track">
                <div
                  className="dash-pipeline-fill"
                  style={{ width: `${Math.round((count / max) * 100)}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>}
    </div>
  )
}