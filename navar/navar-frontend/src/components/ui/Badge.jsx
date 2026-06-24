import '../../styles/dashboard/dashboard.css'

export default function Badge({ label, variant = 'default' }) {
  return (
    <span className={`dash-badge dash-badge--${variant}`}>
      {label}
    </span>
  )
}