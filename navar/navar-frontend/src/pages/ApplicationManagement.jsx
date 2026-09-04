import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ApplicationsTable from '../components/applicationManagement/ApplicationsTable'
import StallApplicationsTable from '../components/applicationManagement/StallApplicationsTable'
import ReviewPanel from '../components/applicationManagement/ReviewPanel'
import '../styles/applicationManagement/applicationManagementLayout.css'
import '../styles/applicationManagement/applicationManagement.css'

export default function ApplicationManagement({ onAppApproved, arProjects = [], onStallAppApproved }) {
  const [activeTab, setActiveTab] = useState('new') // 'new' or 'stall'
  const [reviewingApp, setReviewingApp] = useState(null)
  const [applications, setApplications] = useState(null) // Will be passed from ApplicationsTable
  const [stallApplications, setStallApplications] = useState(null) // Will be passed from StallApplicationsTable
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const applicationId = Number(params.get('applicationId'))
    if (!applicationId) return

    const isStallApplication = params.get('type') === 'stall'
    const source = isStallApplication
      ? stallApplications?.find(app => app.id === applicationId)
      : applications?.find(app => app.id === applicationId)

    if (!source) return
    setActiveTab(isStallApplication ? 'stall' : 'new')
    setReviewingApp(source)
  }, [applications, location.search, stallApplications])

  const openThread = new URLSearchParams(location.search).get('view') === 'thread'

  const liveProjects = useMemo(() => {
    const approvedLiveApps = (applications || [])
      .filter(app => app.applicationStatus === 'Approved' && app.arDevelopment === 'Live')
      .map(app => ({
        id: app.id,
        mallName: app.mallName,
        arStatus: 'Live',
      }))

    const externalLiveProjects = (arProjects || [])
      .filter(project => project.arStatus === 'Live')
      .map(project => ({
        id: project.id,
        mallName: project.mallName,
        arStatus: 'Live',
      }))

    const merged = [...externalLiveProjects, ...approvedLiveApps]
    const seen = new Set()
    return merged.filter(project => {
      const key = `${project.mallName}:${project.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [applications, arProjects])

  function handleRequestRevision(id, notes, isStallApplication = false) {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const threadMsg = {
      id: Date.now(),
      sender: 'admin',
      name: 'Delicious B.',
      isAdmin: true,
      date: dateStr,
      message: notes,
    }

    if (isStallApplication) {
      setStallApplications(prev => prev.map(app => {
        if (app.id !== id) return app
        return {
          ...app,
          applicationStatus: 'For Revision',
          lastUpdated: dateStr,
          thread: [...app.thread, threadMsg],
        }
      }))
    } else {
      setApplications(prev => prev.map(app => {
        if (app.id !== id) return app
        return {
          ...app,
          applicationStatus: 'For Revision',
          lastUpdated: dateStr,
          thread: [...app.thread, threadMsg],
        }
      }))
    }
  }

  function handleApprove(id, isStallApplication = false) {
    if (isStallApplication) {
      const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const approvedStallApp = stallApplications?.find(a => a.id === id)
      setStallApplications(prev => prev.map(app => {
        if (app.id !== id) return app
        return {
          ...app,
          applicationStatus: 'Approved',
          lastUpdated: now,
        }
      }))
      // Notify parent that stall app was approved so AR can be unpublished
      if (onStallAppApproved && approvedStallApp) {
        onStallAppApproved({
          ...approvedStallApp,
          applicationStatus: 'Approved',
          lastUpdated: now,
        })
      }
    } else {
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
  }

  function handleSendNote(id, note, isStallApplication = false) {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const threadMsg = {
      id: Date.now(),
      sender: 'admin',
      name: 'Delicious B.',
      isAdmin: true,
      date: dateStr,
      message: note,
    }

    if (isStallApplication) {
      setStallApplications(prev => prev.map(app => {
        if (app.id !== id) return app
        return {
          ...app,
          thread: [...app.thread, threadMsg],
        }
      }))
    } else {
      setApplications(prev => prev.map(app => {
        if (app.id !== id) return app
        return {
          ...app,
          thread: [...app.thread, threadMsg],
        }
      }))
    }
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
            liveProjects={liveProjects}
          />
        )}
      </div>

      {currentReviewApp && activeTab === 'new' && (
        <ReviewPanel
          app={currentReviewApp}
          onClose={() => setReviewingApp(null)}
          onRequestRevision={(id, notes) => handleRequestRevision(id, notes, false)}
          onApprove={(id) => handleApprove(id, false)}
          onSendNote={(id, note) => handleSendNote(id, note, false)}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}

      {currentReviewStallApp && activeTab === 'stall' && (
        <ReviewPanel
          app={currentReviewStallApp}
          onClose={() => setReviewingApp(null)}
          onRequestRevision={(id, notes) => handleRequestRevision(id, notes, true)}
          onApprove={(id) => handleApprove(id, true)}
          onSendNote={(id, note) => handleSendNote(id, note, true)}
          isStallApplication={true}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}
    </div>
  )
}
