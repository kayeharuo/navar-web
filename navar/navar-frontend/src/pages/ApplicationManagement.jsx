import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ApplicationsTable from '../components/applicationManagement/ApplicationsTable'
import StallApplicationsTable from '../components/applicationManagement/StallApplicationsTable'
import ReviewPanel from '../components/applicationManagement/ReviewPanel'
import { apiRequest } from '../config/api'
import '../styles/applicationManagement/applicationManagementLayout.css'
import '../styles/applicationManagement/applicationManagement.css'

export default function ApplicationManagement({ onAppApproved, arProjects = [], onStallAppApproved }) {
  const [activeTab, setActiveTab] = useState('new') // 'new' or 'stall'
  const [reviewingApp, setReviewingApp] = useState(null)
  const [applications, setApplications] = useState(null) // Will be passed from ApplicationsTable
  const [stallApplications, setStallApplications] = useState(null) // Will be passed from StallApplicationsTable
  const [openingApp, setOpeningApp] = useState(false)
  const requestSeq = useRef(0)       // lets a close/new click cancel an in-flight detail request
  const autoOpenedKey = useRef('')   // the URL query already handled, so it only auto-opens once
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/stall-applications') ? 'stall' : 'new')
  }, [location.pathname])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const applicationId = Number(params.get('applicationId'))
    if (!applicationId) {
      autoOpenedKey.current = ''
      return
    }
    if (autoOpenedKey.current === location.search) return

    const isStallApplication = params.get('type') === 'stall'
    const source = isStallApplication
      ? stallApplications?.find(app => app.id === applicationId)
      : applications?.find(app => app.id === applicationId)

    if (!source) return
    autoOpenedKey.current = location.search
    setActiveTab(isStallApplication ? 'stall' : 'new')
    if (isStallApplication) setReviewingApp(source)
    else loadApplication(source)
  }, [applications, location.search, stallApplications])

  const openThread = new URLSearchParams(location.search).get('view') === 'thread'

  // The URL (?applicationId=...) is what auto-opens the panel, so it has to be
  // cleared whenever the panel is closed or a different row is opened by hand.
  function clearReviewParams() {
    if (new URLSearchParams(location.search).has('applicationId')) {
      navigate(location.pathname, { replace: true })
    }
  }

  function closeReview() {
    requestSeq.current += 1   // ignore any detail request that is still loading
    setOpeningApp(false)
    setReviewingApp(null)
    clearReviewParams()
  }

  async function loadApplication(app) {
    if (app.draft) return
    const seq = ++requestSeq.current
    setOpeningApp(true)
    try {
      const detail = await apiRequest(`/api/applications/${app.id}`)
      if (seq === requestSeq.current) setReviewingApp(detail)
    } catch (error) {
      console.error('Application detail request failed:', error)
    } finally {
      if (seq === requestSeq.current) setOpeningApp(false)
    }
  }

  function handleReviewApp(app) {
    clearReviewParams()
    return loadApplication(app)
  }

  function handleReviewStallApp(app) {
    clearReviewParams()
    setReviewingApp(app)
  }

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

  async function handleRequestRevision(id, notes, isStallApplication = false) {
    if (isStallApplication) return
    await apiRequest(`/api/applications/${id}/revision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const nextApplications = await apiRequest('/api/applications')
    setApplications(nextApplications)
    setReviewingApp(await apiRequest(`/api/applications/${id}`))
  }

  async function handleApprove(id, isStallApplication = false) {
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
      await apiRequest(`/api/applications/${id}/approve`, { method: 'POST' })
      const next = await apiRequest('/api/applications')
      setApplications(next)
      const approved = next.find(app => app.id === id)
      if (onAppApproved && approved) onAppApproved(approved)
    }
  }

  async function handleSendNote(id, note, attachments = [], isStallApplication = false) {
    if (isStallApplication) return
    const sentMessage = await apiRequest(`/api/applications/${id}/thread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note, attachments }),
    })
    setReviewingApp(current => current?.id === id
      ? { ...current, thread: [...(current.thread || []), sentMessage] }
      : current)
    // Refresh the table in the background; the thread must not wait for it.
    apiRequest('/api/applications').then(setApplications).catch(() => {})
    return sentMessage
  }

  const currentReviewApp = reviewingApp && applications ? reviewingApp : null

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
          onClick={() => navigate('/application-management')}
        >
          New Applications
        </button>
        <button
          className={`app-mgmt-tab ${activeTab === 'stall' ? 'app-mgmt-tab--active' : ''}`}
          onClick={() => navigate('/application-management/stall-applications')}
        >
          Stall Applications
        </button>
      </div>

      <div className="app-mgmt-content">
        {activeTab === 'new' ? (
          <ApplicationsTable
            applications={applications}
            onApplicationsChange={setApplications}
            onReviewApp={handleReviewApp}
          />
        ) : (
          <StallApplicationsTable
            applications={stallApplications}
            onApplicationsChange={setStallApplications}
            onReviewApp={handleReviewStallApp}
            liveProjects={liveProjects}
          />
        )}
      </div>

      {openingApp && !currentReviewApp && (
        <div className="review-overlay" onClick={closeReview}>
          <div className="review-panel review-panel--loading" role="status" aria-live="polite" onClick={e => e.stopPropagation()}>
            <span className="stores-page-spinner" aria-hidden="true" />
            <span>Loading application...</span>
          </div>
        </div>
      )}

      {currentReviewApp && activeTab === 'new' && (
        <ReviewPanel
          app={currentReviewApp}
          onClose={closeReview}
          onRequestRevision={(id, notes) => handleRequestRevision(id, notes, false)}
          onApprove={(id) => handleApprove(id, false)}
          onSendNote={(id, note, attachments) => handleSendNote(id, note, attachments, false)}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}

      {currentReviewStallApp && activeTab === 'stall' && (
        <ReviewPanel
          app={currentReviewStallApp}
          onClose={closeReview}
          onRequestRevision={(id, notes) => handleRequestRevision(id, notes, true)}
          onApprove={(id) => handleApprove(id, true)}
          onSendNote={(id, note, attachments) => handleSendNote(id, note, attachments, true)}
          isStallApplication={true}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}
    </div>
  )
}
