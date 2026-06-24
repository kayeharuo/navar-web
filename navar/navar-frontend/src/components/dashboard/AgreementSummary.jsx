import { CheckCircle } from 'lucide-react'
import StatCard from './StatCard'
import '../../styles/dashboard/dashboard.css'

export default function AgreementSummary() {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#22C55E' }} />
          <span className="dash-card-label">Agreement Summary</span>
        </div>
        <button className="dash-view-all">View All →</button>
      </div>

      <div className="dash-stat-grid">
        <StatCard value="10" label="Setup"        color="#22C55E" />
        <StatCard value="5"  label="Active"       color="#22C55E" />
        <StatCard value="1"  label="Grace Period" color="#F97316" />
        <StatCard value="1"  label="Suspended"    color="#EF4444" highlight />
      </div>

      <div>
        <p className="dash-section-label">Expiring Within 60 Days</p>
        <div className="dash-expiry-row">
          <CheckCircle size={14} strokeWidth={2} style={{ color: '#22C55E', flexShrink: 0 }} />
          All contracts are healthy.
        </div>
      </div>
    </div>
  )
}