import { useState } from 'react'
import ApplicationsTable from '../components/applicationManagement/ApplicationsTable'
import ReviewPanel from '../components/applicationManagement/ReviewPanel'
import '../styles/applicationManagement/applicationManagementLayout.css'
import '../styles/applicationManagement/applicationManagement.css'

export default function ApplicationManagement({ onAppApproved }) {
  const [reviewingApp, setReviewingApp] = useState(null)
  const [applications, setApplications] = useState(null) // Will be passed from ApplicationsTable

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

  return (
    <div className="app-mgmt-page">
      <div className="app-mgmt-content">
        <ApplicationsTable
          applications={applications}
          onApplicationsChange={setApplications}
          onReviewApp={setReviewingApp}
        />
      </div>

      {currentReviewApp && (
        <ReviewPanel
          app={currentReviewApp}
          onClose={() => setReviewingApp(null)}
          onRequestRevision={handleRequestRevision}
          onApprove={handleApprove}
          onSendNote={handleSendNote}
        />
      )}
    </div>
  )
}
