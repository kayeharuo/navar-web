import { useEffect, useMemo, useState } from 'react'
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
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/stall-applications') ? 'stall' : 'new')
  }, [location.pathname])

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
    if (isStallApplication) setReviewingApp(source)
    else if (reviewingApp?.id !== applicationId || reviewingApp.scaleReference === undefined) handleReviewApp(source)
  }, [applications, location.search, reviewingApp, stallApplications])

  const openThread = new URLSearchParams(location.search).get('view') === 'thread'

  async function handleReviewApp(app) {
    if (app.draft) return
    try {
      setReviewingApp(await apiRequest(`/api/applications/${app.id}`))
    } catch (error) {
      console.error('Application detail request failed:', error)
    }
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
    setApplications(await apiRequest('/api/applications'))
    setReviewingApp(current => current?.id === id
      ? { ...current, thread: [...(current.thread || []), sentMessage] }
      : current)
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
          onSendNote={(id, note, attachments) => handleSendNote(id, note, attachments, false)}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}

      {currentReviewStallApp && activeTab === 'stall' && (
        <ReviewPanel
          app={currentReviewStallApp}
          onClose={() => setReviewingApp(null)}
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
