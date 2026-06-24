import { useState } from 'react'
import Sidebar from './components/layout/SideBar'
import TopBar from './components/layout/TopBar'
import Dashboard from './pages/Dashboard'
<<<<<<< Updated upstream
import './App.css'
=======
import MallManagement from './pages/MallManagement'
import NotificationsPanel, { INITIAL_NOTIFICATIONS } from './components/panels/NotificationsPanel'
import ProfilePanel from './components/panels/ProfilePanel'
import './App.css'
import './styles/panels.css'
>>>>>>> Stashed changes

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

export default function App() {
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [activePage, setActivePage]     = useState('Dashboard')
  const [activePanel, setActivePanel]   = useState(null)
  const [showLogout, setShowLogout]     = useState(false)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)

  function handleNavigate(page) {
    setActivePage(page)
    setSidebarOpen(false)
    setActivePanel(null)
  }

  function renderPage() {
    switch (activePage) {
      case 'Mall Management':
        return <MallManagement />
      default:
        return <Dashboard />
    }
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-content">
        <TopBar
          activePage={activePage}
          onMenuClick={() => setSidebarOpen(prev => !prev)}
          onOpenNotifications={() => setActivePanel('notifications')}
          onOpenProfile={() => setActivePanel('profile')}
          onLogoutClick={() => setShowLogout(true)}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>

      {/* Notifications full panel */}
      {activePanel === 'notifications' && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setActivePanel(null)}
          onUpdate={setNotifications}
        />
      )}

      {/* Profile panel */}
      {activePanel === 'profile' && (
        <ProfilePanel onClose={() => setActivePanel(null)} />
      )}

      {/* Logout modal */}
      {showLogout && (
        <LogoutModal
          onCancel={() => setShowLogout(false)}
          onConfirm={() => {
            setShowLogout(false)
            alert('Logged out! (No backend yet)')
          }}
        />
      )}
    </div>
  )
}
