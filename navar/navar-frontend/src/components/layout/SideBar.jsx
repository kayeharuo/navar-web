import {
  LayoutDashboard, Building2, FileText, Layers,
  Users, CreditCard, BarChart2, Mail, Settings, ClipboardList,
} from 'lucide-react'
import navarLogo from '../../images/navar-logo.png'
import '../../styles/layout/sidebar.css'

const navItems = [
  { label: 'Dashboard',              icon: LayoutDashboard },
  { label: 'Mall Management',        icon: Building2 },
  { label: 'Application Management', icon: FileText },
  { label: 'AR Development',         icon: Layers },
  { label: 'Account Management',     icon: Users },
  { label: 'License Management',     icon: CreditCard },
  { label: 'Analytics',              icon: BarChart2 },
  { label: 'Email Logs',             icon: Mail },
  { label: 'System Settings',        icon: Settings },
  { label: 'Audit Logs',             icon: ClipboardList },
]

export default function Sidebar({ isOpen, onClose, activePage, onNavigate }) {
  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? ' sidebar-overlay--visible' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <img src={navarLogo} alt="NavAR" />
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-menu-label">Menu</p>
          <ul className="sidebar-nav-list">
            {navItems.map(({ label, icon: Icon }) => {
              const isActive = activePage === label
              return (
                <li key={label}>
                  <button
                    onClick={() => onNavigate(label)}
                    className={`sidebar-nav-btn${isActive ? ' sidebar-nav-btn--active' : ''}`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      className="sidebar-nav-icon"
                    />
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
