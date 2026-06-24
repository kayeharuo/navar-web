import { Bell, ChevronDown, LayoutDashboard, Menu } from 'lucide-react'
import '../../styles/layout/topbar.css'

export default function TopBar({ onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Hamburger — visible on tablet/mobile via CSS */}
        <button className="topbar-hamburger" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={22} strokeWidth={1.75} />
        </button>

        <LayoutDashboard size={20} strokeWidth={1.5} className="topbar-page-icon" />
        <h1 className="topbar-page-title">Dashboard</h1>
      </div>

      <div className="topbar-right">
        <button className="topbar-icon-btn" aria-label="Notifications">
          <Bell size={18} strokeWidth={1.75} />
        </button>

        <button className="topbar-user-btn">
          <div className="topbar-avatar">🍔</div>
          <span className="topbar-username">Delicious Burger</span>
          <ChevronDown size={14} className="topbar-chevron" />
        </button>
      </div>
    </header>
  )
}