import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../config/api'
import '../../styles/dashboard/dashboard.css'

const MODULE_COLORS = {
  'Mall Management': '#FACC15',
  'Application Management': '#A78BFA',
  'AR Development': '#4ADE80',
  'Account Management': '#60A5FA',
  'Subscription Management': '#38BDF8',
}

function relativeTime(value) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecentActivity() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiRequest('/api/audit-logs?page=1&pageSize=10')
      .then(result => active && setActivities((result.items || []).slice(0, 4)))
      .catch(() => active && setActivities([]))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#FACC15' }} />
          <span className="dash-card-label">Recent Activity</span>
        </div>
        <button className="dash-view-all" onClick={() => navigate('/audit-logs')}>Audit →</button>
      </div>

      <div className="dash-activity-list">
        {loading && <p className="dash-activity-meta">Loading recent activity...</p>}
        {!loading && activities.length === 0 && <p className="dash-activity-meta">No recent audit activity.</p>}
        {activities.map(item => (
          <div key={item.id} className="dash-activity-item">
            <span className="dash-activity-dot" style={{ backgroundColor: MODULE_COLORS[item.module] || '#94A3B8' }} />
            <div>
              <p className="dash-activity-title">{item.action}</p>
              <p className="dash-activity-meta">{item.target}</p>
              <p className="dash-activity-meta">{item.admin} · {relativeTime(item.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
