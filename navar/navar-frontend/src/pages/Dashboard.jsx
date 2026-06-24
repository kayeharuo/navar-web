import AlertBanner from '../components/dashboard/AlertBanner'
import AgreementSummary from '../components/dashboard/AgreementSummary'
import ApplicationsPanel from '../components/dashboard/ApplicationsPanel'
import ARDevelopmentStatus from '../components/dashboard/ARDevelopmentStatus'
import MallTable from '../components/dashboard/MallTable'
import ARUsageStats from '../components/dashboard/ARUsageStats'
import RecentActivity from '../components/dashboard/RecentActivity'
import '../styles/dashboard/dashboardLayout.css'

const alerts = [
  {
    type: 'error',
    title: 'Parkmall is suspended.',
    message: 'AR navigation is offline. Awaiting reinstatement contact.',
  },
  {
    type: 'warning',
    title: 'Ayala Center Cebu — grace period.',
    message: '27 days overdue. AR still active. Contact mall to arrange payment.',
  },
]

export default function Dashboard() {
  return (
    <div className="dash-page">
      <AlertBanner alerts={alerts} />

      <div className="dash-top-grid">
        <AgreementSummary />
        <ApplicationsPanel />
        <ARDevelopmentStatus />
      </div>

      <div className="dash-bottom-grid">
        <MallTable />
        <div className="dash-right-col">
          <ARUsageStats />
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}