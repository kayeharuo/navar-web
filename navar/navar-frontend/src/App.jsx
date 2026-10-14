import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import Sidebar from './components/layout/SideBar'
import TopBar from './components/layout/TopBar'
import LoginPage from './pages/LoginPage'
import AuthPasswordPage from './pages/AuthPasswordPage'
import Dashboard from './pages/Dashboard'
import MallManagement from './pages/MallManagement'
import UnitsPage from './pages/UnitsPage'
import StoresPage from './pages/StoresPage'
import BeaconsPage from './pages/BeaconsPage'
import ApplicationManagement from './pages/ApplicationManagement'
import ARDevelopment from './pages/ARDevelopment'
import NodeEditorPage from './pages/NodeEditorPage'
import Analytics from './pages/Analytics'
import AccountManagement from './pages/AccountManagement'
import EmailLogs from './pages/EmailLogs'
import AuditLogs from './pages/AuditLogs'
import SystemSettings from './pages/SystemSettings'
import SubscriptionManagement from './pages/SubscriptionManagement'
import ApplicationManagementTesting from './pages/ApplicationManagementTesting'
import NotificationsPanel from './components/panels/NotificationsPanel'
import ProfilePanel from './components/panels/ProfilePanel'
import { NAV_ITEMS, getActiveNavItem } from './config/navigation'
import { apiRequest } from './config/api'
import { supabase } from './config/supabase'
import './App.css'
import './styles/panels.css'
import { playNotificationSound, unlockNotificationSound } from './utils/notificationSound'

const TIER_MAP = {
  'SM Seaside City Cebu': 'Premium',
  'Ayala Center Cebu': 'Premium',
  'Pacific Mall Cebu': 'Standard',
  'Gaisano Grand Liloan': 'Standard',
  'Gaisano Grand Minglanilla': 'Basic',
  'SM City Cebu': 'Premium',
}

function LogoutModal({ onCancel, onConfirm }) {
  return (
    <div className="logout-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="logout-modal">
        <div className="logout-modal-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M10.5 24.5C10.5 24.7761 10.3946 25.0409 10.2071 25.2364C10.0196 25.4319 9.76522 25.5417 9.5 25.5417H1.16667C0.901448 25.5417 0.647038 25.4319 0.459502 25.2364C0.271966 25.0409 0.166667 24.7761 0.166667 24.5V3.5C0.166667 3.22391 0.271966 2.95913 0.459502 2.7636C0.647038 2.56808 0.901448 2.45834 1.16667 2.45834H9.5C9.76522 2.45834 10.0196 2.56808 10.2071 2.7636C10.3946 2.95913 10.5 3.22391 10.5 3.5C10.5 3.77609 10.3946 4.04087 10.2071 4.2364C10.0196 4.43192 9.76522 4.54167 9.5 4.54167H2.16667V23.4583H9.5C9.76522 23.4583 10.0196 23.5681 10.2071 23.7636C10.3946 23.9591 10.5 24.2239 10.5 24.5ZM27.7806 13.2139L22.7806 8.21392C22.5929 8.01826 22.3382 7.9084 22.0727 7.9084C21.8073 7.9084 21.5526 8.01826 21.3649 8.21392C21.1772 8.40957 21.0719 8.6744 21.0719 8.95C21.0719 9.2256 21.1772 9.49043 21.3649 9.68608L24.5972 12.9583H9.5C9.23478 12.9583 8.98043 13.0681 8.7929 13.2636C8.60536 13.4591 8.5 13.7239 8.5 14C8.5 14.2761 8.60536 14.5409 8.7929 14.7364C8.98043 14.9319 9.23478 15.0417 9.5 15.0417H24.5972L21.3649 18.3139C21.1772 18.5096 21.0719 18.7744 21.0719 19.05C21.0719 19.3256 21.1772 19.5904 21.3649 19.7861C21.5526 19.9817 21.8073 20.0916 22.0727 20.0916C22.3382 20.0916 22.5929 19.9817 22.7806 19.7861L27.7806 14.7861C27.8737 14.6898 27.9474 14.5762 27.9977 14.4514C28.0479 14.3267 28.0737 14.1933 28.0737 14.0587C28.0737 13.924 28.0479 13.7906 27.9977 13.6659C27.9474 13.5411 27.8737 13.4276 27.7806 13.3312L27.7806 13.2139Z" fill="#D51D1D"/>
          </svg>
        </div>
        <h3 className="logout-modal-title">Log Out</h3>
        <p className="logout-modal-desc">
          Are you sure you want to log out? You'll need to sign in again to access your account.
        </p>
        <div className="logout-modal-actions">
          <button className="logout-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="logout-btn-confirm" onClick={onConfirm}>Log Out</button>
        </div>
      </div>
    </div>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="page-placeholder" style={{ padding: '24px 8px' }}>
      <div style={{ maxWidth: 720 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', fontFamily: 'Poppins' }}>
          Section
        </p>
        <h2 style={{ margin: '10px 0 8px', fontSize: 28, lineHeight: 1.1, color: '#111827' }}>{title}</h2>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 15, lineHeight: 1.6, fontFamily: 'Poppins' }}>
          This section now has its own route, so it behaves like a separate page in the browser.
          The underlying feature view can be built out here next.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthRoute = location.pathname.startsWith('/auth/')
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [activePanel, setActivePanel]   = useState(null)
  const [showLogout, setShowLogout]     = useState(false)
  const [notifications, setNotifications] = useState([])
  const [archivedNotifications, setArchivedNotifications] = useState([])
  const [incomingToast, setIncomingToast] = useState(null)
  const [arIncomingProjects, setArIncomingProjects] = useState([])

  useEffect(() => {
    const unlock = () => unlockNotificationSound()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (!nextSession) setAdmin(null)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authLoading || !session || isAuthRoute) return
    let mounted = true
    setAccessDenied(false)
    apiRequest('/api/auth/login-complete', { method: 'POST' }).then(() => apiRequest('/api/auth/me')).then(me => {
      if (mounted) setAdmin(me.role === 'super_admin' ? me : null)
      if (mounted && me.role !== 'super_admin') setAccessDenied(true)
    }).catch(async error => {
      if (!mounted) return
      if (error.status === 403) setAccessDenied(true)
      await supabase.auth.signOut()
    })
    return () => { mounted = false }
  }, [authLoading, session, isAuthRoute])

  useEffect(() => {
    if (!admin) {
      setNotifications([])
      setArchivedNotifications([])
      return undefined
    }
    let mounted = true
    const loadNotifications = async () => {
      try {
        const [result, archivedResult] = await Promise.all([
          apiRequest('/api/admin-notifications'),
          apiRequest('/api/admin-notifications?includeArchived=true'),
        ])
        const normalize = notification => ({
          ...notification,
          mallName: notification.sourceLabel || 'NavAR',
          text: notification.message,
          time: new Date(notification.createdAt).toLocaleString(),
        })
        if (mounted) {
          setNotifications(result.map(normalize))
          setArchivedNotifications(archivedResult.map(normalize))
        }
      } catch (error) {
        if (mounted) console.error('Admin notifications request failed:', error)
      }
    }
    loadNotifications()
    const interval = window.setInterval(loadNotifications, 30000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [admin])

  useEffect(() => {
    if (!admin) return undefined
    const channel = supabase
      .channel(`admin-notifications-${admin.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_notification',
        filter: `admin_id=eq.${admin.id}`,
      }, payload => {
        const row = payload.new
        if (!row || String(row.admin_id) !== String(admin.id)) return
        const notification = {
          id: row.admin_notif_id,
          type: row.admin_notif_type,
          title: row.admin_notif_title,
          message: row.admin_notif_message,
          actionUrl: row.admin_notif_action_url,
          actionLabel: row.admin_notif_action_label,
          sourceType: row.admin_notif_source_type,
          sourceId: row.admin_notif_source_id,
          sourceLabel: row.admin_notif_source_label,
          mallId: row.mall_id,
          read: row.admin_notif_is_read,
          createdAt: row.admin_notif_created_at,
          mallName: row.admin_notif_source_label || 'NavAR',
          text: row.admin_notif_message,
          time: new Date(row.admin_notif_created_at).toLocaleString(),
        }
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => prev.some(item => item.id === notification.id) ? prev : [notification, ...prev])
          playNotificationSound('notification')
          setIncomingToast(notification)
        } else if (payload.eventType === 'UPDATE') {
          if (row.admin_notif_is_archived) {
            setNotifications(prev => prev.filter(item => item.id !== notification.id))
            setArchivedNotifications(prev => prev.some(item => item.id === notification.id) ? prev : [notification, ...prev])
          } else {
            setNotifications(prev => prev.map(item => item.id === notification.id ? notification : item))
            setArchivedNotifications(prev => prev.filter(item => item.id !== notification.id))
          }
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin])

  useEffect(() => {
    if (!incomingToast) return undefined
    const timeout = window.setTimeout(() => setIncomingToast(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [incomingToast])

  useEffect(() => {
    if (!admin) return undefined
    const channel = supabase
      .channel(`thread-messages-${admin.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'thread_message',
      }, payload => {
        const senderId = payload.new?.message_sender
        if (senderId != null && String(senderId) === String(admin.id)) return
        playNotificationSound('thread')
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin])

  useEffect(() => {
    setSidebarOpen(false)
    setActivePanel(null)
  }, [location.pathname])

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/auth/set-password" element={<AuthPasswordPage />} />
        <Route path="/auth/reset-password" element={<AuthPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (location.pathname === '/application-management-testing') {
    return <ApplicationManagementTesting />
  }

  if (authLoading || (session && !admin && !accessDenied)) {
    return <div className="login-page" aria-busy="true"><span className="login-spinner login-spinner--dark" aria-label="Loading" /></div>
  }

  if (accessDenied) {
    return <div className="login-page"><div className="login-form-panel"><p role="alert">You do not have access to this system.</p></div></div>
  }

  if (!session || !admin) {
    return <LoginPage message={location.state?.message} />
  }

  if (location.pathname.startsWith('/ar-development/editor/')) {
    return (
      <Routes>
        <Route path="/ar-development/editor/:projectId" element={<NodeEditorPage />} />
      </Routes>
    )
  }

  const activePage = getActiveNavItem(location.pathname).label

  function handleAppApproved(app) {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    setArIncomingProjects(prev => {
      const alreadyExists = prev.some(p => p.id === app.id)
      if (alreadyExists) return prev
      return [...prev, {
        id: app.id,
        mallName: app.mallName,
        tier: TIER_MAP[app.mallName] || 'Basic',
        city: app.city,
        adminName: app.adminName,
        adminEmail: app.adminEmail,
        version: app.version,
        floors: app.floors,
        agreement: app.agreement,
        applicationStatus: 'Approved',
        arStatus: 'Pending',
        dateAdded: now,
        lastUpdated: now,
        thread: [],
        testErrors: [],
      }]
    })
  }

  function handleStallAppApproved(stallApp) {
    // Unpublish the AR for this mall
    setArIncomingProjects(prev => prev.map(p =>
      p.mallName === stallApp.mallName && p.arStatus === 'Live'
        ? { ...p, arStatus: 'Unpublished' }
        : p
    ))
  }

  async function handleMarkRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await apiRequest(`/api/admin-notifications/${id}/read`, { method: 'PATCH' })
    } catch (error) {
      console.error('Admin notification read request failed:', error)
    }
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await apiRequest('/api/admin-notifications/read-all', { method: 'PATCH' })
    } catch (error) {
      console.error('Admin notifications read-all request failed:', error)
    }
  }

  async function handleArchive(id) {
    const archived = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (archived) setArchivedNotifications(prev => [archived, ...prev])
    try {
      await apiRequest(`/api/admin-notifications/${id}/archive`, { method: 'PATCH' })
    } catch (error) {
      console.error('Admin notification archive request failed:', error)
    }
  }

  function handleOpenNotification(notification) {
    handleMarkRead(notification.id)
    const actionUrl = notification.actionUrl || ''
    const targetUrl = notification.sourceType === 'beacon_ticket' &&
      notification.sourceId &&
      actionUrl === '/mall-management/beacon-tickets'
      ? `${actionUrl}?ticketId=${notification.sourceId}`
      : actionUrl
    if (targetUrl) navigate(targetUrl)
    setActivePanel(null)
  }

  function closeSidebar() {
    setSidebarOpen(false)
    setActivePanel(null)
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={closeSidebar}
      />

      <div className="app-content">
        <TopBar
          activePage={activePage}
          onMenuClick={() => setSidebarOpen(prev => !prev)}
          onOpenNotifications={() => setActivePanel('notifications')}
          onOpenNotification={handleOpenNotification}
          onOpenProfile={() => setActivePanel('profile')}
          onLogoutClick={() => setShowLogout(true)}
          notifications={notifications}
          archivedNotifications={archivedNotifications}
          onMarkAllRead={handleMarkAllRead}
          user={admin}
        />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mall-management" element={<MallManagement />} />
            <Route path="/mall-management/:tab" element={<MallManagement />} />
            <Route path="/mall-management/units/:mallId" element={<><MallManagement /><UnitsPage /></>} />
            <Route path="/mall-management/stores/:mallId" element={<StoresPage />} />
            <Route path="/mall-management/beacons/:mallId" element={<BeaconsPage />} />
            <Route path="/application-management" element={<ApplicationManagement onAppApproved={handleAppApproved} arProjects={arIncomingProjects} onStallAppApproved={handleStallAppApproved} />} />
            <Route path="/application-management/:tab" element={<ApplicationManagement onAppApproved={handleAppApproved} arProjects={arIncomingProjects} onStallAppApproved={handleStallAppApproved} />} />
            <Route path="/ar-development" element={<ARDevelopment incomingProjects={arIncomingProjects} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/account-management" element={<AccountManagement />} />
            <Route path="/email-logs" element={<EmailLogs />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="/system-settings/:tab" element={<SystemSettings />} />
            <Route path="/subscription-management" element={<SubscriptionManagement />} />
            {NAV_ITEMS.filter(item => !['/', '/mall-management', '/mall-management/stores/:mallId', '/application-management', '/ar-development', '/account-management', '/email-logs', '/audit-logs', '/system-settings', '/subscription-management'].includes(item.path)).map(item => (
              <Route
                key={item.path}
                path={item.path}
                element={<PlaceholderPage title={item.label} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Notifications full panel */}
      {incomingToast && (
        <div
          className="notification-toast"
          role="status"
          tabIndex={0}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            const notification = incomingToast
            setIncomingToast(null)
            handleOpenNotification(notification)
          }}
          onClick={() => {
            const notification = incomingToast
            setIncomingToast(null)
            handleOpenNotification(notification)
          }}
        >
          <span className="notification-toast-icon"><Bell size={17} /></span>
          <span className="notification-toast-content">
            <strong>{incomingToast.title}</strong>
            <span>{incomingToast.message}</span>
          </span>
          <button
            type="button"
            className="notification-toast-close"
            aria-label="Dismiss notification"
            onClick={event => {
              event.stopPropagation()
              setIncomingToast(null)
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {activePanel === 'notifications' && (
        <NotificationsPanel
          notifications={notifications}
          archivedNotifications={archivedNotifications}
          onClose={() => setActivePanel(null)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onArchive={handleArchive}
          onOpenNotification={handleOpenNotification}
        />
      )}

      {/* Profile panel */}
      {activePanel === 'profile' && (
        <ProfilePanel
          onClose={() => setActivePanel(null)}
          onProfileUpdated={updatedProfile => setAdmin(current => ({
            ...current,
            name: updatedProfile.name,
            jobTitle: updatedProfile.jobTitle,
            profilePicture: updatedProfile.profilePicture,
          }))}
        />
      )}

      {/* Logout modal */}
      {showLogout && (
        <LogoutModal
          onCancel={() => setShowLogout(false)}
          onConfirm={() => {
            setShowLogout(false)
            supabase.auth.signOut()
          }}
        />
      )}
    </div>
  )
}
