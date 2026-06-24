import '../../styles/dashboard/dashboard.css'

const topMalls = [
  { rank: 1, name: 'SM Seaside City Cebu', sessions: 8420 },
  { rank: 2, name: 'Ayala Center Cebu',    sessions: 6130 },
  { rank: 3, name: 'SM City North Cebu',   sessions: 4810 },
]
const MAX = 8420

export default function ARUsageStats() {
  return (
    <div className="dash-card">
      <div className="dash-card-title">
        <span className="dash-card-accent" style={{ backgroundColor: '#F97316' }} />
        <span className="dash-card-label">AR Usage Stats</span>
      </div>

      <div className="dash-usage-big-grid">
        <div>
          <p className="dash-usage-big-number">22,570</p>
          <p className="dash-usage-sublabel">total sessions</p>
        </div>
        <div>
          <p className="dash-usage-big-number">5</p>
          <p className="dash-usage-sublabel">live maps</p>
        </div>
      </div>

      <div>
        <p className="dash-section-label">Top Malls</p>
        <div className="dash-top-malls">
          {topMalls.map(({ rank, name, sessions }) => (
            <div key={rank} className="dash-top-mall-row">
              <div className="dash-top-mall-info">
                <span className="dash-top-mall-name">
                  <span className="dash-top-mall-rank">#{rank} </span>{name}
                </span>
                <span className="dash-top-mall-count">{sessions.toLocaleString()}</span>
              </div>
              <div className="dash-bar-track">
                <div
                  className="dash-bar-fill"
                  style={{ width: `${Math.round((sessions / MAX) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}