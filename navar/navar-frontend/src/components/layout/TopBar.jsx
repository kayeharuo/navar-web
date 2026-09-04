import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, LayoutDashboard, Building2, FileText, Layers, Users, CreditCard, BarChart2, Mail, Settings, ClipboardList, Menu, LogOut, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ChatInboxPanel from './ChatInboxPanel'
import '../../styles/layout/topbar.css'
import '../../styles/panels.css'
import { Building2 as BuildingIcon } from 'lucide-react'

const pageIconMap = {
  'Dashboard':              LayoutDashboard,
  'Mall Management':        Building2,
  'Application Management': FileText,
  'AR Development':         Layers,
  'Account Management':     Users,
  'Subscription Management': CreditCard,
  'Analytics':              BarChart2,
  'Email Logs':             Mail,
  'System Settings':        Settings,
  'Audit Logs':             ClipboardList,
}

function useOutsideClick(ref, handler) {
  useEffect(() => {
    function listener(e) {
      if (!ref.current || ref.current.contains(e.target)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

export default function TopBar({
  onMenuClick,
  activePage = 'Dashboard',
  onOpenNotifications,
  onOpenProfile,
  onLogoutClick,
  notifications = [],
  onMarkAllRead,
}) {
  const PageIcon = pageIconMap[activePage] || LayoutDashboard
  const [showAccount, setShowAccount] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showChatInbox, setShowChatInbox] = useState(false)
  const navigate = useNavigate()

  const accountRef = useRef(null)
  const notifRef   = useRef(null)

  useOutsideClick(accountRef, () => setShowAccount(false))
  useOutsideClick(notifRef,   () => setShowNotifDropdown(false))

  const unreadCount = notifications.filter(n => !n.read).length
  const recentNotifs = notifications.slice(0, 4)

  function handleViewAll() {
    setShowNotifDropdown(false)
    onOpenNotifications()
  }

  function handleProfile() {
    setShowAccount(false)
    onOpenProfile()
  }

  function handleLogout() {
    setShowAccount(false)
    onLogoutClick()
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-hamburger" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={22} strokeWidth={1.75} />
        </button>
        <PageIcon size={20} strokeWidth={1.5} className="topbar-page-icon" />
        <h1 className="topbar-page-title">{activePage}</h1>
      </div>

      <div className="topbar-right">
        {/* Conversations */}
        <div className="chat-inbox-wrap">
          <button
            className="topbar-icon-btn chat-inbox-trigger"
            aria-label="Open all conversations"
            onClick={() => setShowChatInbox(s => !s)}
          >
            <MessageCircle size={18} strokeWidth={1.75} />
            <span className="chat-inbox-count">3</span>
          </button>
          {showChatInbox && (
            <ChatInboxPanel
              onClose={() => setShowChatInbox(false)}
              onOpenThread={path => {
                setShowChatInbox(false)
                navigate(path)
              }}
            />
          )}
        </div>

        {/* Bell */}
        <div className="notif-mini-wrap" ref={notifRef}>
          <div className="bell-btn-wrap">
            <button
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => setShowNotifDropdown(s => !s)}
            >
              <Bell size={18} strokeWidth={1.75} />
            </button>
            {unreadCount > 0 && <span className="bell-unread-dot" />}
          </div>

          {showNotifDropdown && (
            <div className="notif-mini">
              <div className="notif-mini-header">
                <span className="notif-mini-title">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="notif-mini-badge">{unreadCount}</span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button className="notif-mini-mark" onClick={onMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notif-mini-divider" />
              <div className="notif-mini-list">
                {recentNotifs.map(n => (
                  <div key={n.id} className={`notif-mini-item${!n.read ? ' notif-mini-item--unread' : ''}`}>
                    <div className="notif-mini-icon">
                      <BuildingIcon size={16} strokeWidth={1.5} />
                    </div>
                    <div className="notif-mini-body">
                      <p className="notif-mini-text">
                        <strong>{n.mallName}</strong> {n.text}
                      </p>
                      <p className="notif-mini-time">{n.time}</p>
                    </div>
                    {!n.read && <span className="notif-mini-unread-dot" />}
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px', fontFamily: 'Poppins' }}>
                    No notifications
                  </div>
                )}
              </div>
              <div className="notif-mini-divider" />
              <div className="notif-mini-footer">
                <button className="notif-mini-view-all" onClick={handleViewAll}>
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="acct-menu-wrap" ref={accountRef}>
          <button
            className="topbar-user-btn"
            onClick={() => setShowAccount(s => !s)}
          >
            <div className="topbar-avatar">🍔</div>
            <span className="topbar-username">Delicious Burger</span>
            <ChevronDown size={14} className="topbar-chevron" />
          </button>

          {showAccount && (
            <div className="acct-dropdown">
              <div className="acct-dropdown-user">
                <div className="acct-dropdown-avatar">🍔</div>
                <div>
                  <p className="acct-dropdown-name">Delicious Burger</p>
                  <p className="acct-dropdown-role">IT Manager</p>
                </div>
              </div>
              <div className="acct-dropdown-divider" />
              <button className="acct-dropdown-item" onClick={handleProfile}>
                <svg width="18" height="19" viewBox="0 0 20 19" fill="none">
                  <path d="M19.4082 17.6276C17.9803 15.1591 15.78 13.3891 13.2122 12.5501C14.4824 11.7939 15.4692 10.6417 16.0212 9.27048C16.5731 7.89922 16.6597 6.38468 16.2676 4.95945C15.8755 3.53422 15.0264 2.27711 13.8506 1.38117C12.6749 0.485228 11.2376 0 9.75941 0C8.28122 0 6.84391 0.485228 5.66818 1.38117C4.49246 2.27711 3.64334 3.53422 3.25123 4.95945C2.85911 6.38468 2.94569 7.89922 3.49765 9.27048C4.04961 10.6417 5.03644 11.7939 6.3066 12.5501C3.73878 13.3882 1.53847 15.1582 0.110659 17.6276C0.0582987 17.7129 0.0235684 17.8079 0.00851736 17.9069C-0.00653367 18.006 -0.00160057 18.107 0.0230256 18.2041C0.0476518 18.3011 0.0914723 18.3923 0.151901 18.4722C0.212331 18.552 0.288144 18.619 0.37487 18.6691C0.461595 18.7192 0.557476 18.7514 0.656854 18.7638C0.756232 18.7763 0.857095 18.7687 0.953492 18.7415C1.04989 18.7143 1.13987 18.6681 1.21812 18.6056C1.29637 18.5431 1.3613 18.4656 1.4091 18.3776C3.17535 15.3251 6.29722 13.5026 9.75941 13.5026C13.2216 13.5026 16.3435 15.3251 18.1097 18.3776C18.2225 18.5431 18.379 18.6681 18.5653 18.7415C18.6617 18.7687 18.7626 18.7763 18.862 18.7638C18.9613 18.7514 19.0572 18.7192 19.1439 18.6691C19.2307 18.619 19.3065 18.552 19.3669 18.4722C19.4273 18.3923 19.4712 18.3011 19.4958 18.2041C19.5204 18.107 19.5254 18.006 19.5103 17.9069C19.4952 17.8079 19.4605 17.7129 19.4082 17.6276ZM4.50941 6.75255C4.50941 5.7142 4.81732 4.69917 5.39419 3.83581C5.97107 2.97245 6.79101 2.29954 7.75032 1.90218C8.70963 1.50482 9.76523 1.40086 10.7836 1.60343C11.802 1.806 12.7375 2.30601 13.4717 3.04024C14.2059 3.77447 14.706 4.70993 14.9085 5.72833C15.1111 6.74673 15.0071 7.80233 14.6098 8.76164C14.2124 9.72095 13.5395 10.5409 12.6762 11.1178C11.8128 11.6946 10.7978 12.0026 9.75941 12.0026C8.36748 12.0011 7.03299 11.4475 6.04874 10.4632C5.0645 9.47897 4.5109 8.14448 4.50941 6.75255Z" fill="currentColor"/>
                </svg>
                My Profile
              </button>
              <div className="acct-dropdown-divider" />
              <button className="acct-dropdown-item acct-dropdown-item--danger" onClick={handleLogout}>
                <LogOut size={17} />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
