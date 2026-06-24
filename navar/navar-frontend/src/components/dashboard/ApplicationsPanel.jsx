import StatCard from './StatCard'
import '../../styles/dashboard/dashboard.css'

const pipeline = [
  { label: 'Draft',        count: 1,  barColor: '#93C5FD', dotColor: '#94A3B8' },
  { label: 'Submitted',    count: 2,  barColor: '#3B82F6', dotColor: '#3B82F6' },
  { label: 'For Revision', count: 1,  barColor: '#FB923C', dotColor: '#FB923C' },
  { label: 'Approved',     count: 13, barColor: '#22C55E', dotColor: '#22C55E' },
]
const MAX = 13

export default function ApplicationsPanel() {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#3B82F6' }} />
          <span className="dash-card-label">Applications</span>
        </div>
        <button className="dash-view-all">View All →</button>
      </div>

      <div className="dash-stat-grid">
        <StatCard value="2" label="Submitted For Review"                       color="#3B82F6" />
        <StatCard value="1" label="Requested Revision — Waiting for response"  color="#F97316" />
      </div>

      <div>
        <p className="dash-section-label">Pipeline Breakdown</p>
        <div className="dash-pipeline">
          {pipeline.map(({ label, count, barColor, dotColor }) => (
            <div key={label} className="dash-pipeline-row">
              <span className="dash-pipeline-dot" style={{ backgroundColor: dotColor }} />
              <span className="dash-pipeline-label">{label}</span>
              <span className="dash-pipeline-count">{String(count).padStart(2, '0')}</span>
              <div className="dash-pipeline-track">
                <div
                  className="dash-pipeline-fill"
                  style={{ width: `${Math.round((count / MAX) * 100)}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}