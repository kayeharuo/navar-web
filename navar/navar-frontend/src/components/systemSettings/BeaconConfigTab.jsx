import { useState } from 'react'
import { AlertTriangle, Circle, Building2, MapPin } from 'lucide-react'

const PROXIMITY_UUID = 'F7826DA6-4FA2-4E98-8024-BC5B71E0893E'

const IDENTIFIER_CARDS = [
  {
    key: 'uuid',
    icon: Circle,
    label: 'UUID',
    scope: 'SYSTEM-WIDE',
    desc: 'Identifies all NavAR beacons across every mall in the network. Shared by every deployed unit and hardcoded into the mobile app.',
  },
  {
    key: 'major',
    icon: Building2,
    label: 'Major',
    scope: 'PER MALL',
    desc: 'Identifies which mall the beacon belongs to. Each mall is assigned its own unique Major value when it goes live.',
  },
  {
    key: 'minor',
    icon: MapPin,
    label: 'Minor',
    scope: 'PER UNIT',
    desc: 'Identifies the specific beacon within the mall — e.g. a store entrance, junction, or floor transition node.',
  },
]

export default function BeaconConfigTab() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PROXIMITY_UUID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // clipboard unavailable, ignore
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">iBeacon System UUID</h2>
        <p className="settings-panel-desc">
          The proximity UUID shared by every iBeacon hardware unit deployed across the entire NavAR network. This value is static and cannot be changed without redeploying all beacon hardware and updating the mobile app.
        </p>
      </div>

      <div className="settings-warning-banner">
        <AlertTriangle size={16} className="settings-warning-icon" />
        <span>This UUID is hardcoded into the NavAR mobile app and every physical beacon. Changing it requires a coordinated firmware + app update across all deployed units.</span>
      </div>

      <div className="beacon-uuid-box">
        <div>
          <p className="beacon-uuid-label">Proximity UUID</p>
          <p className="beacon-uuid-value">{PROXIMITY_UUID}</p>
        </div>
        <button className="beacon-copy-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy UUID'}
        </button>
      </div>

      <div className="settings-panel-header settings-panel-header--spaced">
        <h2 className="settings-panel-title settings-panel-title--sm">iBeacon Identifier Structure</h2>
        <p className="settings-panel-desc">How UUID, Major, and Minor are used within the NavAR system.</p>
      </div>

      <div className="beacon-structure-grid">
        {IDENTIFIER_CARDS.map(card => {
          const Icon = card.icon
          return (
            <div key={card.key} className={`beacon-structure-card beacon-structure-card--${card.key}`}>
              <div className="beacon-structure-card-head">
                <Icon size={16} className="beacon-structure-icon" />
                <span className="beacon-structure-label">{card.label}</span>
              </div>
              <p className="beacon-structure-scope">{card.scope}</p>
              <p className="beacon-structure-desc">{card.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
