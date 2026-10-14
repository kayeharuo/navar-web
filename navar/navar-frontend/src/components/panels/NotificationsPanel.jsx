import { useEffect, useState } from 'react'
import { Archive, Bell, Building2, ExternalLink, X } from 'lucide-react'

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  return date.toLocaleString()
}

function NotifCard({ notif, onArchive, onOpen }) {
  return (
    <div
      className={`notif-card${!notif.read ? ' notif-card--unread' : ''}`}
      onClick={() => onOpen(notif)}
    >
      <div className="notif-card-icon">
        {notif.sourceType === 'beacon_ticket' || notif.sourceType === 'beacon'
          ? <Bell size={20} strokeWidth={1.5} />
          : <Building2 size={20} strokeWidth={1.5} />}
      </div>
      <div className="notif-card-content">
        <p className="notif-card-text">
          <strong>{notif.title}</strong> {notif.message}
        </p>
        <p className="notif-card-time">{relativeTime(notif.createdAt)}</p>
      </div>
      <div className="notif-card-right">
        {!notif.read && <span className="notif-card-dot" />}
        {notif.actionUrl && (
          <button type="button" title={notif.actionLabel || 'Open'} onClick={event => { event.stopPropagation(); onOpen(notif) }}>
            <ExternalLink size={15} />
          </button>
        )}
        <button type="button" title="Archive" onClick={event => { event.stopPropagation(); onArchive(notif.id) }}>
          <Archive size={15} />
        </button>
      </div>
    </div>
  )
}

export default function NotificationsPanel({ notifications, archivedNotifications, onClose, onMarkRead, onMarkAllRead, onArchive, onOpenNotification }) {
  const [tab, setTab] = useState('all')

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const unreadCount = notifications.filter(n => !n.read).length

  const displayed = tab === 'archived'
    ? archivedNotifications
    : tab === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications
  const groups = displayed.reduce((result, notification) => {
    const key = new Date(notification.createdAt).toDateString()
    const existing = result.find(group => group.key === key)
    if (existing) existing.items.push(notification)
    else result.push({ key, label: key === new Date().toDateString() ? 'Today' : 'Earlier', items: [notification] })
    return result
  }, [])

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="panel-sheet" role="dialog" aria-label="Notifications">
        {/* Header */}
        <div className="panel-header">
          <div className="panel-header-info">
            <h2 className="panel-title">Notifications</h2>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close notifications"><X size={18} /></button>
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
          <button
            className={`notif-panel-tab${tab === 'archived' ? ' notif-panel-tab--active' : ''}`}
            onClick={() => setTab('archived')}
          >
            Archived ({archivedNotifications.length})
          </button>
          {unreadCount > 0 && (
            <button className="notif-mark-all" onClick={onMarkAllRead}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="panel-divider" />

        {/* Notification list */}
        <div className="notif-panel-body">
          {groups.map(({ key, label, items }) => {
            return (
              <div key={key} className="notif-panel-group">
                <p className="notif-group-label">{label}</p>
                <div className="notif-card-group">
                  {items.map(n => (
                  <NotifCard key={n.id} notif={n} onArchive={onArchive} onOpen={onOpenNotification} />
                  ))}
                </div>
              </div>
            )
          })}
          {displayed.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontFamily: 'Poppins' }}>
              No {tab === 'unread' ? 'unread' : tab === 'archived' ? 'archived' : ''} notifications.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
