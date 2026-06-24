import { AlertTriangle } from 'lucide-react'
import '../../styles/dashboard/dashboard.css'

export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null

  const iconColor = { error: '#EF4444', warning: '#F59E0B' }

  return (
    <div className="dash-alert-scroll">
      {alerts.map((alert, i) => (
        <div key={i} className={`dash-alert dash-alert--${alert.type}`}>
          <AlertTriangle
            size={15}
            strokeWidth={2}
            style={{ color: iconColor[alert.type], flexShrink: 0, marginTop: '2px' }}
          />
          <p className="dash-alert-text">
            <span className="dash-alert-title">{alert.title}</span>{' '}{alert.message}
          </p>
        </div>
      ))}
    </div>
  )
}