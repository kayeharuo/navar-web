import '../../styles/dashboard/dashboard.css'

export default function StatCard({ value, label, color = '#1F2937', highlight = false }) {
  return (
    <div className={`dash-stat-cell${highlight ? ' dash-stat-cell--highlight' : ''}`}>
      <span className="dash-stat-value" style={{ color }}>
        {value}
      </span>
      <span className="dash-stat-sublabel">{label}</span>
    </div>
  )
}