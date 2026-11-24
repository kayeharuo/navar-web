import { CheckCircle } from 'lucide-react'
import StatCard from './StatCard'
import { Link } from 'react-router-dom'
import useDashboardData from './useDashboardData'
import '../../styles/dashboard/dashboard.css'

export default function AgreementSummary() {
  const {data,loading,error}=useDashboardData('/api/subscriptions')
  const malls=data.malls||[]
  const count=status=>loading?'…':error?'—':malls.filter(m=>m.status===status).length
  const now=new Date(data.asOf||'')
  const expiring=malls.filter(m=>m.status==='Active'&&m.subscriptionEnd&&new Date(m.subscriptionEnd)>=new Date(new Date(now).setHours(0,0,0,0))&&new Date(m.subscriptionEnd)-now<=60*86400000)
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#22C55E' }} />
          <span className="dash-card-label">Agreement Summary</span>
        </div>
        <Link className="dash-view-all" to="/subscription-management">View All</Link>
      </div>

      <div className="dash-stat-grid">
        <StatCard value={count('Onboarding')} label="Onboarding" color="#22C55E" />
        <StatCard value={count('Active')} label="Active" color="#22C55E" />
        <StatCard value={count('Grace Period')} label="Grace Period" color="#F97316" />
        <StatCard value={count('Suspended')} label="Suspended" color="#EF4444" highlight />
      </div>

      <div>
        <p className="dash-section-label">Expiring Within 60 Days</p>
        <div className="dash-expiry-row">
          <CheckCircle size={14} strokeWidth={2} style={{ color: '#22C55E', flexShrink: 0 }} />
          {error || (loading?'Loading subscriptions…':expiring.length?expiring.map(m=>m.name).join(', '):'No active subscriptions expire within 60 days.')}
        </div>
      </div>
    </div>
  )
}
