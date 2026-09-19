import { useLocation, useNavigate } from 'react-router-dom'
import SubscriptionTiersTab from './SubscriptionTiersTab'
import BeaconConfigTab from './BeaconConfigTab'

const TABS = ['Subscription Tiers', 'Beacon config']

export default function SystemSettingsTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = location.pathname.endsWith('/beacon-config') ? 'Beacon config' : 'Subscription Tiers'

  return (
    <div className="settings-content">
      {/* Page header */}
      <div className="settings-header">
        <h1 className="settings-title">System Settings</h1>
        <p className="settings-subtitle">Global configuration for the NavAR platform.</p>
      </div>

      {/* Tab navigation */}
      <div className="settings-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => navigate(tab === 'Beacon config' ? '/system-settings/beacon-config' : '/system-settings')}
            className={`settings-tab-btn${activeTab === tab ? ' settings-tab-btn--active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-card">
        {activeTab === 'Subscription Tiers' && <SubscriptionTiersTab />}
        {activeTab === 'Beacon config' && <BeaconConfigTab />}
      </div>
    </div>
  )
}
