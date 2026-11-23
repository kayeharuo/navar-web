import useDashboardData from '../components/dashboard/useDashboardData'
import AlertBanner from '../components/dashboard/AlertBanner'
import AgreementSummary from '../components/dashboard/AgreementSummary'
import ApplicationsPanel from '../components/dashboard/ApplicationsPanel'
import ARDevelopmentStatus from '../components/dashboard/ARDevelopmentStatus'
import MallTable from '../components/dashboard/MallTable'
import ARUsageStats from '../components/dashboard/ARUsageStats'
import RecentActivity from '../components/dashboard/RecentActivity'
import '../styles/dashboard/dashboardLayout.css'

export default function Dashboard() {
  const {data:alerts,error} = useDashboardData('/api/subscriptions/alerts')
  return (
    <div className="dash-page">
      <AlertBanner alerts={alerts} />
      {error && <p className="mall-field-error">{error}</p>}

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