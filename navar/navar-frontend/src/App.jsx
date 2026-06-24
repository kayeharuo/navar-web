import { useState } from 'react'
import Sidebar from './components/layout/SideBar'
import TopBar from './components/layout/TopBar'
import Dashboard from './pages/Dashboard'
import './App.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="app-content">
        <TopBar onMenuClick={() => setSidebarOpen(prev => !prev)} />
        <main className="app-main">
          <Dashboard />
        </main>
      </div>
    </div>
  )
}