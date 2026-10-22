import { Link } from 'react-router-dom'
import useDashboardData from './useDashboardData'
import StatCard from './StatCard'
import '../../styles/dashboard/dashboard.css'

export default function ARDevelopmentStatus() {
  const { data: projects, loading, error } = useDashboardData('/api/ar-developments')
  const counts = projects.reduce((result, project) => {
    result[project.arStatus] = (result[project.arStatus] || 0) + 1
    return result
  }, {})
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#A855F7' }} />
          <span className="dash-card-label">AR Development Status</span>
        </div>
        <Link className="dash-view-all" to="/ar-development">View All &rarr;</Link>
      </div>

      {loading ? <p role="status">Loading AR development...</p> : error ? <p role="alert">{error}</p> : <div className="dash-stat-grid">
        <StatCard value={counts['Pending'] || 0} label="Pending"              color="#94A3B8" />
        <StatCard value={counts['Node Mapping'] || 0} label="Node Mapping"         color="#3B82F6" />
        <StatCard value={counts['Testing'] || 0} label="Navigation Testing"   color="#A855F7" />
        <StatCard value={counts['Ready'] || 0} label="Ready for Activation" color="#A855F7" />
        <StatCard value={counts['Live'] || 0} label="Live"                 color="#22C55E" />
        <StatCard value={counts['Unpublished'] || 0} label="Unpublished"          color="#EF4444" highlight />
        <StatCard value={counts['On Hold'] || 0} label="On Hold" color="#F97316" />
      </div>}
    </div>
  )
}