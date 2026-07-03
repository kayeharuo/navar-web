import { useState } from 'react'
import { Search, BellRing, X } from 'lucide-react'
import SubscriptionInfoPanel from './SubscriptionInfoPanel'
import SuspendModal from './SuspendModal'
import LiftSuspensionModal from './LiftSuspensionModal'

const TIERS = {
  Basic:    { annualFee: 60000,  onboardingFee: 187500,  gracePeriodDays: 15, reinstatementRate: 20 },
  Standard: { annualFee: 150000, onboardingFee: 594600,  gracePeriodDays: 30, reinstatementRate: 15 },
  Premium:  { annualFee: 350000, onboardingFee: 1585000, gracePeriodDays: 45, reinstatementRate: 10 },
}

const STATUS_FILTERS = ['All', 'Active', 'Grace Period', 'Suspended', 'Setup']

const initialMalls = [
  {
    id: 1,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    tier: 'Premium',
    status: 'Active',
    wallet: 245000,
    subscriptionStart: 'June 1, 2025',
    subscriptionEnd: 'June 1, 2026',
    daysLeftLabel: '74 days left',
    suspension: null,
    tierHistory: [
      { version: 'v2', tier: 'Premium', start: 'June 1, 2025', end: 'June 1, 2026', fee: 350000, note: 'Upgraded from Basic at renewal' },
      { version: 'v1', tier: 'Basic', start: 'June 1, 2024', end: 'June 1, 2025', fee: 60000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'June 1, 2025', type: 'Annual Subscription Fee', amount: 350000, status: 'Paid' },
      { date: 'May 20, 2025', type: 'Onboarding Fee (Tier Upgrade)', amount: 187500, status: 'Paid' },
      { date: 'June 1, 2024', type: 'Onboarding Fee', amount: 187500, status: 'Paid' },
    ],
    suspensionHistory: [],
  },
  {
    id: 2,
    name: 'Pacific Mall Cebu',
    city: 'Mandaue City',
    tier: 'Basic',
    status: 'Active',
    wallet: 60000,
    subscriptionStart: 'March 20, 2025',
    subscriptionEnd: 'March 20, 2026',
    daysLeftLabel: '15 days left',
    suspension: null,
    tierHistory: [
      { version: 'v1', tier: 'Basic', start: 'March 20, 2025', end: 'March 20, 2026', fee: 60000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'March 20, 2025', type: 'Annual Subscription Fee', amount: 60000, status: 'Paid' },
      { date: 'Feb 1, 2025', type: 'Onboarding Fee', amount: 187500, status: 'Paid' },
    ],
    suspensionHistory: [],
  },
  {
    id: 3,
    name: 'Gaisano Grand Fiesta Mall',
    city: 'Cebu City',
    tier: 'Standard',
    status: 'Active',
    wallet: 150000,
    subscriptionStart: 'April 15, 2025',
    subscriptionEnd: 'April 15, 2026',
    daysLeftLabel: '180 days left',
    suspension: null,
    tierHistory: [
      { version: 'v1', tier: 'Standard', start: 'April 15, 2025', end: 'April 15, 2026', fee: 150000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'April 15, 2025', type: 'Annual Subscription Fee', amount: 150000, status: 'Paid' },
      { date: 'March 2, 2025', type: 'Onboarding Fee', amount: 594600, status: 'Paid' },
    ],
    suspensionHistory: [],
  },
  {
    id: 4,
    name: 'Ayala Center Cebu',
    city: 'Cebu City',
    tier: 'Basic',
    status: 'Grace Period',
    wallet: 30000,
    subscriptionStart: 'Feb 22, 2025',
    subscriptionEnd: 'Feb 22, 2026',
    daysLeftLabel: '8 days left in grace period',
    suspension: null,
    tierHistory: [
      { version: 'v1', tier: 'Basic', start: 'Feb 22, 2025', end: 'Feb 22, 2026', fee: 60000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'Feb 22, 2025', type: 'Annual Subscription Fee', amount: 60000, status: 'Paid' },
      { date: 'March 10, 2026', type: 'Annual Renewal Fee', amount: 60000, status: 'Awaiting verification' },
    ],
    suspensionHistory: [],
  },
  {
    id: 5,
    name: 'Robinsons Galleria Cebu',
    city: 'Cebu City',
    tier: 'Premium',
    status: 'Grace Period',
    wallet: 200000,
    subscriptionStart: 'March 4, 2025',
    subscriptionEnd: 'March 4, 2026',
    daysLeftLabel: '20 days left in grace period',
    suspension: null,
    tierHistory: [
      { version: 'v1', tier: 'Premium', start: 'March 4, 2025', end: 'March 4, 2026', fee: 350000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'March 4, 2025', type: 'Annual Subscription Fee', amount: 350000, status: 'Paid' },
      { date: 'March 8, 2026', type: 'Annual Renewal Fee', amount: 350000, status: 'Awaiting verification' },
    ],
    suspensionHistory: [],
  },
  {
    id: 6,
    name: 'Parkmall Cebu',
    city: 'Mandaue City',
    tier: 'Basic',
    status: 'Suspended',
    wallet: 20000,
    subscriptionStart: 'Jan 23, 2025',
    subscriptionEnd: 'Jan 23, 2026',
    daysLeftLabel: '26 days suspended',
    suspension: { reason: 'Non-Payment', date: 'Feb 7, 2026', notes: '', penalty: 0 },
    tierHistory: [
      { version: 'v1', tier: 'Basic', start: 'Jan 23, 2025', end: 'Jan 23, 2026', fee: 60000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'Jan 23, 2025', type: 'Annual Subscription Fee', amount: 60000, status: 'Paid' },
    ],
    suspensionHistory: [
      { reason: 'Non-Payment', dateStart: 'Feb 7, 2026', dateEnd: null, notes: 'Grace period ended with no payment.', resolution: null },
    ],
  },
  {
    id: 7,
    name: 'Pier One Mall',
    city: 'Cebu City',
    tier: 'Standard',
    status: 'Suspended',
    wallet: 90000,
    subscriptionStart: 'May 10, 2025',
    subscriptionEnd: 'May 10, 2026',
    daysLeftLabel: '12 days suspended',
    suspension: { reason: 'Breach of Contract', date: 'Jan 30, 2026', notes: 'Unauthorized resale of beacon hardware to a third party.', penalty: 50000 },
    tierHistory: [
      { version: 'v1', tier: 'Standard', start: 'May 10, 2025', end: 'May 10, 2026', fee: 150000, note: 'Initial subscription' },
    ],
    paymentHistory: [
      { date: 'May 10, 2025', type: 'Annual Subscription Fee', amount: 150000, status: 'Paid' },
    ],
    suspensionHistory: [
      { reason: 'Breach of Contract', dateStart: 'Jan 30, 2026', dateEnd: null, notes: 'Unauthorized resale of beacon hardware to a third party.', resolution: null },
    ],
  },
  {
    id: 8,
    name: 'SM City Consolacion Cebu',
    city: 'Consolacion, Cebu',
    tier: 'Standard',
    status: 'Setup',
    wallet: 0,
    subscriptionStart: null,
    subscriptionEnd: null,
    daysLeftLabel: 'Not started yet',
    suspension: null,
    tierHistory: [],
    paymentHistory: [
      { date: 'Jan 12, 2025', type: 'Onboarding Fee', amount: 594600, status: 'Paid' },
    ],
    suspensionHistory: [],
  },
]

const initialNotifications = [
  { id: 1, text: 'Expiring ≤15 days — reach out to arrange renewal: Pacific Mall Cebu' },
  { id: 2, text: '2 payment notifications awaiting verification — Ayala Center Cebu, Robinsons Galleria Cebu' },
  { id: 3, text: '2 suspended — AR offline: Parkmall Cebu, Pier One Mall' },
  { id: 4, text: '2 in grace period (AR still running): Ayala Center Cebu, Robinsons Galleria Cebu' },
]

function statusVariant(status) {
  const map = { Active: 'active', 'Grace Period': 'grace', Suspended: 'suspended', Setup: 'setup' }
  return map[status] || 'default'
}

function tierVariant(tier) {
  const map = { Basic: 'basic', Standard: 'standard', Premium: 'premium' }
  return map[tier] || 'basic'
}

function formatPeso(amount) {
  return `₱${amount.toLocaleString('en-US')}.00`
}

export default function SubscriptionsTable() {
  const [malls, setMalls] = useState(initialMalls)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMall, setViewMall] = useState(null)
  const [suspendMall, setSuspendMall] = useState(null)
  const [liftMall, setLiftMall] = useState(null)

  function dismissNotification(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function clearAllNotifications() {
    setNotifications([])
  }

  function counts() {
    return {
      All: malls.length,
      Active: malls.filter(m => m.status === 'Active').length,
      'Grace Period': malls.filter(m => m.status === 'Grace Period').length,
      Suspended: malls.filter(m => m.status === 'Suspended').length,
      Setup: malls.filter(m => m.status === 'Setup').length,
    }
  }
  const filterCounts = counts()

  const filteredMalls = malls.filter(mall => {
    const matchesFilter = activeFilter === 'All' || mall.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || mall.name.toLowerCase().includes(q) || mall.city.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  function handleSuspendConfirm(mall, { reason, notes, penalty }) {
    const now = 'Today'
    setMalls(prev => prev.map(m => m.id === mall.id ? {
      ...m,
      status: 'Suspended',
      suspension: { reason, date: now, notes, penalty: penalty || 0 },
      daysLeftLabel: '0 days suspended',
      suspensionHistory: [
        { reason, dateStart: now, dateEnd: null, notes, resolution: null },
        ...m.suspensionHistory,
      ],
    } : m))
    setSuspendMall(null)
    setViewMall(null)
  }

  function handleLiftConfirm(mall) {
    const now = 'Today'
    const reason = mall.suspension?.reason
    const tierInfo = TIERS[mall.tier]
    const reinstateAmount = reason === 'Operational'
      ? 0
      : tierInfo.annualFee + (mall.suspension?.penalty || 0)

    setMalls(prev => prev.map(m => {
      if (m.id !== mall.id) return m
      const closedHistory = m.suspensionHistory.map((s, i) =>
        i === 0 ? { ...s, dateEnd: now, resolution: reason === 'Operational' ? 'Lifted — no fee (operational pause)' : `Lifted after payment of ${formatPeso(reinstateAmount)}` } : s
      )
      return {
        ...m,
        status: 'Active',
        suspension: null,
        daysLeftLabel: `${tierInfo.gracePeriodDays * 6} days left`,
        paymentHistory: reason === 'Operational' ? m.paymentHistory : [
          { date: now, type: 'Reinstatement Payment', amount: reinstateAmount, status: 'Paid' },
          ...m.paymentHistory,
        ],
        suspensionHistory: closedHistory,
      }
    }))
    setLiftMall(null)
    setViewMall(null)
  }

  return (
    <div className="sub-mgmt-content">
      {/* Header */}
      <div className="sub-mgmt-header">
        <h1 className="sub-mgmt-title">Subscription Management</h1>
        <p className="sub-mgmt-subtitle">Subscriptions are set automatically when AR goes Live. Manage renewals, grace periods, and suspensions here.</p>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="sub-mgmt-notif-wrap">
          <div className="sub-mgmt-notif-list">
            {notifications.map(n => (
              <div key={n.id} className="sub-mgmt-notif">
                <BellRing size={16} className="sub-mgmt-notif-icon" />
                <span className="sub-mgmt-notif-text">{n.text}</span>
                <button
                  className="sub-mgmt-notif-dismiss"
                  onClick={() => dismissNotification(n.id)}
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="sub-mgmt-notif-clear" onClick={clearAllNotifications}>
            Clear All
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="sub-mgmt-stats">
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--blue">
          <div className="sub-mgmt-stat-num">{filterCounts.All}</div>
          <div className="sub-mgmt-stat-label">Total Malls</div>
        </div>
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--green">
          <div className="sub-mgmt-stat-num">{filterCounts.Active}</div>
          <div className="sub-mgmt-stat-label">Active</div>
        </div>
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--orange">
          <div className="sub-mgmt-stat-num">{filterCounts['Grace Period']}</div>
          <div className="sub-mgmt-stat-label">Grace Period</div>
        </div>
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--red">
          <div className="sub-mgmt-stat-num">{filterCounts.Suspended}</div>
          <div className="sub-mgmt-stat-label">Suspended</div>
        </div>
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--navy">
          <div className="sub-mgmt-stat-num">{filterCounts.Setup}</div>
          <div className="sub-mgmt-stat-label">Setup</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sub-mgmt-toolbar">
        <div className="sub-mgmt-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`sub-mgmt-filter-btn${activeFilter === f ? ' sub-mgmt-filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              <span className={`sub-mgmt-filter-count${activeFilter === f ? ' sub-mgmt-filter-count--active' : ''}`}>
                {filterCounts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="sub-mgmt-search-wrap">
          <Search size={16} className="sub-mgmt-search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="sub-mgmt-search-input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="sub-mgmt-table-wrap">
        <div className="sub-mgmt-table-scroll">
          <table className="sub-mgmt-table">
            <thead>
              <tr>
                <th>Mall</th>
                <th>Tier</th>
                <th>Onboarding Fee</th>
                <th>Annual Fee</th>
                <th>Wallet</th>
                <th>Subscription Start</th>
                <th>Subscription End</th>
                <th>Status</th>
                <th>Days Left</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMalls.map(mall => (
                <tr key={mall.id} className="sub-mgmt-table-row" onClick={() => setViewMall(mall)}>
                  <td className="sub-mgmt-mall-name">{mall.name}</td>
                  <td><span className={`sub-tier-badge sub-tier-badge--${tierVariant(mall.tier)}`}>{mall.tier}</span></td>
                  <td>{formatPeso(TIERS[mall.tier].onboardingFee)}</td>
                  <td>{formatPeso(TIERS[mall.tier].annualFee)}</td>
                  <td>{formatPeso(mall.wallet)}</td>
                  <td>{mall.subscriptionStart || '—'}</td>
                  <td>{mall.subscriptionEnd || '—'}</td>
                  <td><span className={`sub-status-badge sub-status-badge--${statusVariant(mall.status)}`}>{mall.status}</span></td>
                  <td className="sub-mgmt-days-cell">{mall.daysLeftLabel}</td>
                  <td>
                    <div className="sub-mgmt-action-buttons">
                      <button
                        className="sub-mgmt-view-btn"
                        onClick={e => { e.stopPropagation(); setViewMall(mall) }}
                      >
                        View
                      </button>
                      {mall.status !== 'Setup' && mall.status !== 'Suspended' && (
                        <button
                          className="sub-mgmt-action-btn sub-mgmt-action-btn--suspend"
                          onClick={e => { e.stopPropagation(); setSuspendMall(mall) }}
                        >
                          Suspend
                        </button>
                      )}
                      {mall.status === 'Suspended' && mall.suspension?.reason !== 'Non-Payment' && (
                        <button
                          className="sub-mgmt-action-btn sub-mgmt-action-btn--lift"
                          onClick={e => { e.stopPropagation(); setLiftMall(mall) }}
                        >
                          Lift
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMalls.length === 0 && (
                <tr><td colSpan={10} className="sub-mgmt-empty">No malls found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="sub-mgmt-hint">Click any row to view full details.</p>

      {/* View panel */}
      {viewMall && (
        <SubscriptionInfoPanel
          mall={viewMall}
          tierInfo={TIERS[viewMall.tier]}
          onClose={() => setViewMall(null)}
          onSuspend={() => setSuspendMall(viewMall)}
          onLift={() => setLiftMall(viewMall)}
        />
      )}

      {/* Suspend modal */}
      {suspendMall && (
        <SuspendModal
          mall={suspendMall}
          tierInfo={TIERS[suspendMall.tier]}
          onCancel={() => setSuspendMall(null)}
          onConfirm={data => handleSuspendConfirm(suspendMall, data)}
        />
      )}

      {/* Lift suspension modal */}
      {liftMall && (
        <LiftSuspensionModal
          mall={liftMall}
          tierInfo={TIERS[liftMall.tier]}
          onCancel={() => setLiftMall(null)}
          onConfirm={() => handleLiftConfirm(liftMall)}
        />
      )}
    </div>
  )
}
