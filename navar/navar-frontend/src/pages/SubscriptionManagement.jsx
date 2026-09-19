import SubscriptionsTable from '../components/subscriptionManagement/SubscriptionsTable'
import '../styles/subscriptionManagement/subscriptionManagement.css'
import '../styles/subscriptionManagement/subscriptionManagementLayout.css'
import '../styles/subscriptionManagement/subscriptionModal.css'

export default function SubscriptionManagement() {
  return (
    <div className="sub-mgmt-page">
      <SubscriptionsTable />
    </div>
  )
}
