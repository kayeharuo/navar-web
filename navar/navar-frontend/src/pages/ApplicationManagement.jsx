import { useState } from 'react'
import ApplicationsTable from '../components/applicationManagement/ApplicationsTable'
import StallApplicationsTable from '../components/applicationManagement/StallApplicationsTable'
import ReviewPanel from '../components/applicationManagement/ReviewPanel'
import '../styles/applicationManagement/applicationManagementLayout.css'
import '../styles/applicationManagement/applicationManagement.css'

export default function ApplicationManagement({ onAppApproved }) {
  const [activeTab, setActiveTab] = useState('new') // 'new' or 'stall'
  const [reviewingApp, setReviewingApp] = useState(null)
  const [applications, setApplications] = useState(null) // Will be passed from ApplicationsTable
  const [stallApplications, setStallApplications] = useState(null) // Will be passed from StallApplicationsTable

  function handleRequestRevision(id, notes) {
    setApplications(prev => prev.map(app => {
      if (app.id !== id) return app
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      return {
        ...app,
        applicationStatus: 'For Revision',
        lastUpdated: dateStr,
        thread: [
          ...app.thread,
          {
            id: Date.now(),
            sender: 'admin',
            name: 'Delicious B.',
            isAdmin: true,
            date: dateStr,
            message: notes,
          },
        ],
      }
    }))
  }

  function handleApprove(id) {
    setApplications(prev => prev.map(app => {
      if (app.id !== id) return app
      const approved = {
        ...app,
        applicationStatus: 'Approved',
        arDevelopment: 'AR: Pending',
        lastUpdated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      }
      if (onAppApproved) onAppApproved(approved)
      return approved
    }))
  }

  function handleSendNote(id, note) {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    setApplications(prev => prev.map(app => {
      if (app.id !== id) return app
      return {
        ...app,
        thread: [
          ...app.thread,
          {
            id: Date.now(),
            sender: 'admin',
            name: 'Delicious B.',
            isAdmin: true,
            date: dateStr,
            message: note,
          },
        ],
      }
    }))
  }

  const currentReviewApp = reviewingApp && applications
    ? applications.find(a => a.id === reviewingApp.id) ?? null
    : null

  const currentReviewStallApp = reviewingApp && stallApplications
    ? stallApplications.find(a => a.id === reviewingApp.id) ?? null
    : null

  return (
    <div className="app-mgmt-page">
      {/* Title Section */}
      <div className="app-mgmt-header">
        <h1 className="app-mgmt-title">Application Management</h1>
        <p className="app-mgmt-subtitle">Review mall submissions before AR development begins.</p>
      </div>

      {/* Tabs */}
      <div className="app-mgmt-tabs">
        <button
          className={`app-mgmt-tab ${activeTab === 'new' ? 'app-mgmt-tab--active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          New Applications
        </button>
        <button
          className={`app-mgmt-tab ${activeTab === 'stall' ? 'app-mgmt-tab--active' : ''}`}
          onClick={() => setActiveTab('stall')}
        >
          Stall Applications
        </button>
      </div>

      <div className="app-mgmt-content">
        {activeTab === 'new' ? (
          <ApplicationsTable
            applications={applications}
            onApplicationsChange={setApplications}
            onReviewApp={setReviewingApp}
          />
        ) : (
          <StallApplicationsTable
            applications={stallApplications}
            onApplicationsChange={setStallApplications}
            onReviewApp={setReviewingApp}
          />
        )}
      </div>

      {currentReviewApp && activeTab === 'new' && (
        <ReviewPanel
          app={currentReviewApp}
          onClose={() => setReviewingApp(null)}
          onRequestRevision={handleRequestRevision}
          onApprove={handleApprove}
          onSendNote={handleSendNote}
        />
      )}

      {currentReviewStallApp && activeTab === 'stall' && (
        <ReviewPanel
          app={currentReviewStallApp}
          onClose={() => setReviewingApp(null)}
          onRequestRevision={handleRequestRevision}
          onApprove={handleApprove}
          onSendNote={handleSendNote}
          isStallApplication={true}
        />
      )}
    </div>
  )
}
