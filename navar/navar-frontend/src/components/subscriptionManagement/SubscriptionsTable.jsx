import { useState, useEffect } from 'react'
import { apiRequest } from '../../config/api'
import { Search, BellRing, X } from 'lucide-react'
import SubscriptionInfoPanel from './SubscriptionInfoPanel'
import SuspendModal from './SuspendModal'
import LiftSuspensionModal from './LiftSuspensionModal'
import LoadingSpinner from '../ui/LoadingSpinner'
import SubscriptionResultModal from './SubscriptionResultModal'

const STATUS_FILTERS = ['All', 'Onboarding', 'Active', 'Grace Period', 'Suspended']

function statusVariant(status) {
  const map = { Onboarding: 'setup', Active: 'active', 'Grace Period': 'grace', Suspended: 'suspended' }
  return map[status] || 'default'
}

function tierVariant(tier) {
  const map = { Basic: 'basic', Standard: 'standard', Premium: 'premium' }
  return map[tier] || 'basic'
}

function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP',minimumFractionDigits:2}).format(Number(amount || 0))
}

function onboardingFee(mall) {
  return mall.paymentHistory.find(payment => payment.type.startsWith('Onboarding Fee'))?.amount ?? mall.onboardingFee ?? null
}

export default function SubscriptionsTable() {
  const [malls, setMalls] = useState([])
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function reload(background = false) {
    if (!background) setLoading(true)
    try { const [data, alerts] = await Promise.all([apiRequest('/api/subscriptions'),apiRequest('/api/subscriptions/alerts')]); setMalls(data.malls);setNotifications(alerts);setError('') }
    catch(e) { setError(e.message) } finally { if (!background) setLoading(false) }
  }
  useEffect(() => { reload() }, [])
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMall, setViewMall] = useState(null)
  const [suspendMall, setSuspendMall] = useState(null)
  const [liftMall, setLiftMall] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionResult, setActionResult] = useState(null)

  function dismissNotification(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function clearAllNotifications() {
    setNotifications([])
  }

  function counts() {
    return {
      All: malls.length,
      Onboarding: malls.filter(m => m.status === 'Onboarding').length,
      Active: malls.filter(m => m.status === 'Active').length,
      'Grace Period': malls.filter(m => m.status === 'Grace Period').length,
      Suspended: malls.filter(m => m.status === 'Suspended').length,
    }
  }
  const filterCounts = counts()

  const filteredMalls = malls.filter(mall => {
    const matchesFilter = activeFilter === 'All' || mall.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || mall.name.toLowerCase().includes(q) || mall.city.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  async function changeSuspension(mall, action, data) {
    if (actionBusy) return
    setActionBusy(true)
    try {
      await apiRequest('/api/subscriptions/'+mall.id+'/'+action, {method:'POST', body:JSON.stringify(data)})
      setSuspendMall(null)
      setLiftMall(null)
      setViewMall(null)
      setActionResult({success:true, title:action === 'suspend' ? 'Subscription Suspended' : 'Suspension Lifted', message:action === 'suspend' ? mall.name + ' has been suspended. Its AR navigation is unpublished.' : mall.name + "'s suspension has been lifted."})
      await reload(true)
    } catch (e) {
      setActionResult({success:false, title:action === 'suspend' ? 'Suspension Failed' : 'Unable to Lift Suspension', message:e.message || 'Please try again.'})
    } finally {
      setActionBusy(false)
    }
  }
  const handleSuspendConfirm = (mall, data) => changeSuspension(mall, 'suspend', data)
  const handleLiftConfirm = mall => changeSuspension(mall, 'lift', {})

  return (
    <div className="sub-mgmt-content">
      {/* Header */}
      <div className="sub-mgmt-header">
        <h1 className="sub-mgmt-title">Subscription Management</h1>
        <p className="sub-mgmt-subtitle">Subscriptions are set automatically when AR goes Live. Manage renewals, grace periods, and suspensions here.</p>
      </div>

      {error && <p className="mall-field-error" role="alert">{error}</p>}
      {/* Notifications */}
      {loading ? <div className="sub-mgmt-notif-wrap"><div className="sub-mgmt-alert-loading"><LoadingSpinner label="Loading Subscription Alerts..." showLabel /></div></div> : notifications.length > 0 && (
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
        <div className="sub-mgmt-stat-card sub-mgmt-stat-card--blue">
          <div className="sub-mgmt-stat-num">{filterCounts.Onboarding}</div>
          <div className="sub-mgmt-stat-label">Onboarding</div>
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
                <th>Subscription Start</th>
                <th>Subscription End</th>
                <th>Status</th>
                <th>Days Left</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="sub-mgmt-empty"><LoadingSpinner label="Loading Subscriptions..." showLabel /></td></tr>}
              {!loading && filteredMalls.map(mall => (
                <tr key={mall.id} className="sub-mgmt-table-row" onClick={() => setViewMall(mall)}>
                  <td className="sub-mgmt-mall-name">{mall.name}</td>
                  <td>{mall.status === 'Onboarding' ? 'Not subscribed' : <span className={`sub-tier-badge sub-tier-badge--${tierVariant(mall.tier)}`}>{mall.tier}</span>}</td>
                  <td>{onboardingFee(mall) == null ? 'Not quoted' : formatPeso(onboardingFee(mall))}</td>
                  <td>{mall.status === 'Onboarding' ? '—' : formatPeso(mall.tierInfo.annualFee)}</td>
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
                      {!['Onboarding', 'Suspended'].includes(mall.status) && (
                        <button
                          className="sub-mgmt-action-btn sub-mgmt-action-btn--suspend"
                          onClick={e => { e.stopPropagation(); setSuspendMall(mall) }}
                        >
                          Suspend
                        </button>
                      )}
                      {mall.status === 'Suspended' && mall.suspension?.reason === 'Operational' && (
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
              {!loading && filteredMalls.length === 0 && (
                <tr><td colSpan={9} className="sub-mgmt-empty">{error ? 'Unable to load subscriptions.' : 'No subscriptions found.'}</td></tr>
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
          tierInfo={viewMall.tierInfo}
          onClose={() => setViewMall(null)}
          onSuspend={() => setSuspendMall(viewMall)}
          onLift={() => setLiftMall(viewMall)}
        />
      )}

      {/* Suspend modal */}
      {suspendMall && (
        <SuspendModal
          mall={suspendMall}
          tierInfo={suspendMall.tierInfo}
          busy={actionBusy}
          onCancel={() => !actionBusy && setSuspendMall(null)}
          onConfirm={data => handleSuspendConfirm(suspendMall, data)}
        />
      )}

      {/* Lift suspension modal */}
      {liftMall && (
        <LiftSuspensionModal
          mall={liftMall}
          tierInfo={liftMall.tierInfo}
          busy={actionBusy}
          onCancel={() => !actionBusy && setLiftMall(null)}
          onConfirm={() => handleLiftConfirm(liftMall)}
        />
      )}
      {actionResult && <SubscriptionResultModal result={actionResult} onClose={() => setActionResult(null)} />}
    </div>
  )
}
