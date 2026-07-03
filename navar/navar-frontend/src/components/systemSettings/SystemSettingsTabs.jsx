import { useState } from 'react'
import SubscriptionTiersTab from './SubscriptionTiersTab'
import BeaconConfigTab from './BeaconConfigTab'

const TABS = ['Subscription Tiers', 'Beacon config']

export default function SystemSettingsTabs() {
  const [activeTab, setActiveTab] = useState('Subscription Tiers')

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
            onClick={() => setActiveTab(tab)}
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
