import StatCard from './StatCard'
import '../../styles/dashboard/dashboard.css'

export default function ARDevelopmentStatus() {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#A855F7' }} />
          <span className="dash-card-label">AR Development Status</span>
        </div>
        <button className="dash-view-all">View All →</button>
      </div>

      <div className="dash-stat-grid">
        <StatCard value="0" label="Pending"              color="#94A3B8" />
        <StatCard value="1" label="Node Mapping"         color="#3B82F6" />
        <StatCard value="3" label="Navigation Testing"   color="#A855F7" />
        <StatCard value="2" label="Ready for Activation" color="#A855F7" />
        <StatCard value="6" label="Live"                 color="#22C55E" />
        <StatCard value="1" label="Unpublished"          color="#EF4444" highlight />
      </div>
    </div>
  )
}