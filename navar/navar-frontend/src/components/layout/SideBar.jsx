import { NavLink } from 'react-router-dom'
import navarLogo from '../../images/navar-logo.png'
import { NAV_ITEMS } from '../../config/navigation'
import '../../styles/layout/sidebar.css'

export default function Sidebar({ isOpen, onClose, onNavigate }) {
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
            {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => {
              return (
                <li key={label}>
                  <NavLink
                    to={path}
                    end={exact}
                    onClick={onNavigate}
                    className={({ isActive }) => `sidebar-nav-btn${isActive ? ' sidebar-nav-btn--active' : ''}`}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={17}
                          strokeWidth={isActive ? 2.2 : 1.8}
                          className="sidebar-nav-icon"
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
