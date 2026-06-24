import '../../styles/dashboard/dashboard.css'

const activities = [
  { label: 'Requested Revision', mall: 'Pacific Mall Cebu', user: 'Mark T.', time: 'Yesterday', dotColor: '#FB923C' },
  { label: 'Requested Revision', mall: 'Pacific Mall Cebu', user: 'Mark T.', time: 'Yesterday', dotColor: '#FB923C' },
  { label: 'Requested Revision', mall: 'Pacific Mall Cebu', user: 'Mark T.', time: 'Yesterday', dotColor: '#FACC15' },
  { label: 'Requested Revision', mall: 'Pacific Mall Cebu', user: 'Mark T.', time: 'Yesterday', dotColor: '#60A5FA' },
]

export default function RecentActivity() {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#FACC15' }} />
          <span className="dash-card-label">Recent Activity</span>
        </div>
        <button className="dash-view-all">Audit →</button>
      </div>

      <div className="dash-activity-list">
        {activities.map((item, i) => (
          <div key={i} className="dash-activity-item">
            <span className="dash-activity-dot" style={{ backgroundColor: item.dotColor }} />
            <div>
              <p className="dash-activity-title">{item.label}</p>
              <p className="dash-activity-meta">{item.mall}</p>
              <p className="dash-activity-meta">{item.user} · {item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}