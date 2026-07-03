import { useState } from 'react'
import { Building2 } from 'lucide-react'

export const INITIAL_NOTIFICATIONS = [
  { id: 1, mallName: 'Parkmall Cebu', text: 'submitted proof of payment. Please verify and confirm in Subscription Management.', time: '2 minutes ago', group: 'today', read: false },
  { id: 2, mallName: 'SM City Consolacion Cebu', text: 'resubmitted their application after revision. Ready for your review.', time: '1 hour ago', group: 'today', read: false },
  { id: 3, mallName: 'Robinsons Galleria Cebu', text: 'subscription expires in 7 days. Consider following up on payment.', time: '3 hours ago', group: 'today', read: false },
  { id: 4, mallName: 'Gaisano Grand Mall', text: 'confirmed their AR map. You may now set the map to Live.', time: 'Yesterday, 2:14 PM', group: 'yesterday', read: true },
  { id: 5, mallName: 'SM Seaside City Cebu', text: 'AR map was published and is now live. Subscription period has started.', time: 'Yesterday, 9:00 AM', group: 'yesterday', read: true },
  { id: 6, mallName: 'Ayala Center Cebu', text: 'submitted their Annual Renewal request. Please review when available.', time: 'Mar 10, 10:22 AM', group: 'earlier', read: true },
]

function NotifCard({ notif, onMark }) {
  return (
    <div
      className={`notif-card${!notif.read ? ' notif-card--unread' : ''}`}
      onClick={() => onMark(notif.id)}
    >
      <div className="notif-card-icon">
        <Building2 size={20} strokeWidth={1.5} />
      </div>
      <div className="notif-card-content">
        <p className="notif-card-text">
          <strong>{notif.mallName}</strong> {notif.text}
        </p>
        <p className="notif-card-time">{notif.time}</p>
      </div>
      <div className="notif-card-right">
        {notif.read
          ? <span className="notif-card-read-dot" />
          : <span className="notif-card-dot" />}
      </div>
    </div>
  )
}

export default function NotificationsPanel({ notifications, onClose, onUpdate }) {
  const [tab, setTab] = useState('all')

  const unreadCount = notifications.filter(n => !n.read).length

  function markAll() {
    onUpdate(notifications.map(n => ({ ...n, read: true })))
  }

  function markOne(id) {
    onUpdate(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const displayed = tab === 'unread' ? notifications.filter(n => !n.read) : notifications

  const groups = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'earlier',   label: 'Earlier' },
  ]

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="panel-sheet" role="dialog" aria-label="Notifications">
        {/* Header */}
        <div className="panel-header">
          <div className="panel-header-info">
            <h2 className="panel-title">Notifications</h2>
          </div>
          <button className="panel-close" onClick={onClose}>X</button>
        </div>

        {/* Tabs */}
        <div className="notif-panel-tabs">
          <button
            className={`notif-panel-tab${tab === 'all' ? ' notif-panel-tab--active' : ''}`}
            onClick={() => setTab('all')}
          >
            All
          </button>
          <button
            className={`notif-panel-tab${tab === 'unread' ? ' notif-panel-tab--active' : ''}`}
            onClick={() => setTab('unread')}
          >
            Unread ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button className="notif-mark-all" onClick={markAll}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="panel-divider" />

        {/* Notification list */}
        <div className="notif-panel-body">
          {groups.map(({ key, label }) => {
            const items = displayed.filter(n => n.group === key)
            if (items.length === 0) return null
            return (
              <div key={key} className="notif-panel-group">
                <p className="notif-group-label">{label}</p>
                <div className="notif-card-group">
                  {items.map(n => (
                    <NotifCard key={n.id} notif={n} onMark={markOne} />
                  ))}
                </div>
              </div>
            )
          })}
          {displayed.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontFamily: 'Poppins' }}>
              No {tab === 'unread' ? 'unread' : ''} notifications.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
