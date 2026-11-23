import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ApplicationsTable from '../components/applicationManagement/ApplicationsTable'
import StallApplicationsTable from '../components/applicationManagement/StallApplicationsTable'
import ReviewPanel from '../components/applicationManagement/ReviewPanel'
import StallReviewPanel from '../components/applicationManagement/StallReviewPanel'
import '../styles/applicationManagement/stallApplications.css'
import { useRealtimeRefresh } from '../config/realtime'
import { apiRequest } from '../config/api'
import '../styles/applicationManagement/applicationManagementLayout.css'
import '../styles/applicationManagement/applicationManagement.css'

export default function ApplicationManagement({ onAppApproved }) {
  const [activeTab, setActiveTab] = useState('new') // 'new' or 'stall'
  const [reviewingApp, setReviewingApp] = useState(null)
  const [applications, setApplications] = useState(null) // Will be passed from ApplicationsTable
  const [stallApplications, setStallApplications] = useState(null) // Will be passed from StallApplicationsTable
  const [openingApp, setOpeningApp] = useState(false)
  const requestSeq = useRef(0)       // lets a close/new click cancel an in-flight detail request
  const autoOpenedKey = useRef('')   // the URL query already handled, so it only auto-opens once
  const location = useLocation()
  const navigate = useNavigate()

  const loadApplication=useCallback(async(app)=>{
    if (app.draft) return
    const seq = ++requestSeq.current
    setOpeningApp(true)
    try {
      const detail = await apiRequest(`/api/applications/${app.id}${app.historyId?`?historyId=${app.historyId}`:''}`)
      if (seq === requestSeq.current) setReviewingApp(detail)
    } catch (error) {
      console.error('Application detail request failed:', error)
    } finally {
      if (seq === requestSeq.current) setOpeningApp(false)
    }
  },[])

  const loadStallApplication=useCallback(async(app)=>{
    const seq=++requestSeq.current;setOpeningApp(true)
    try{const detail=await apiRequest(`/api/stall-applications/${app.id}`);if(seq===requestSeq.current)setReviewingApp(detail)}
    catch(e){window.alert(e.message)}finally{if(seq===requestSeq.current)setOpeningApp(false)}
  },[])

  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/stall-applications')||new URLSearchParams(location.search).get('type')==='stall'?'stall':'new')
  }, [location.pathname,location.search])

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
    if (isStallApplication) loadStallApplication(source)
    else loadApplication(source)
  }, [applications, location.search, stallApplications, loadApplication, loadStallApplication])

  const openThread = new URLSearchParams(location.search).get('view') === 'thread'

  // The URL (?applicationId=...) is what auto-opens the panel, so it has to be
  // cleared whenever the panel is closed or a different row is opened by hand.
  function clearReviewParams() {
    if (new URLSearchParams(location.search).has('applicationId')) {
      navigate(activeTab==='stall'?'/application-management/stall-applications':location.pathname, { replace: true })
    }
  }

  function closeReview() {
    requestSeq.current += 1   // ignore any detail request that is still loading
    setOpeningApp(false)
    setReviewingApp(null)
    clearReviewParams()
  }

  function handleReviewApp(app) {
    clearReviewParams()
    return loadApplication(app)
  }

  function handleReviewStallApp(app) {
    clearReviewParams()
    return loadStallApplication(app)
  }

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
      const current=reviewingApp
      const result=await apiRequest(`/api/stall-applications/${id}/approve`,{method:'POST',body:JSON.stringify({revision:current.revision})})
      setStallApplications(await apiRequest('/api/stall-applications'))
      await loadStallApplication({id})
      return result
    } else {
      await apiRequest(`/api/applications/${id}/approve`, { method: 'POST' })
      const next = await apiRequest('/api/applications')
      setApplications(next)
      const approved = next.find(app => app.id === id)
      if (onAppApproved && approved) onAppApproved(approved)
      // Refresh the open review panel too, so the Approve button disappears
      // and the status badge shows Approved immediately.
      setReviewingApp(await apiRequest(`/api/applications/${id}`))
    }
  }

  async function handleSendNote(id, note, attachments = [], isStallApplication = false) {
    const sentMessage = await apiRequest(`/api/${isStallApplication?'stall-applications':'applications'}/${id}/thread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note, attachments }),
    })
    setReviewingApp(current => current?.id === id
      ? { ...current, thread: [...(current.thread || []), sentMessage] }
      : current)
    // Refresh the table in the background; the thread must not wait for it.
    apiRequest(isStallApplication?'/api/stall-applications':'/api/applications').then(isStallApplication?setStallApplications:setApplications).catch(() => {})
    return sentMessage
  }

  useRealtimeRefresh(p=>{if(['application','ar_development','mall_service_request','contract_payment_request'].includes(p.table))window.dispatchEvent(new Event('navar-application-review-refresh'))})
  const historyId=reviewingApp?.historyId
  const threadId=reviewingApp?.id
  const isStallThread=Boolean(reviewingApp?.expansionId)
  useEffect(()=>{
    if(!threadId||historyId)return
    let mounted=true
    const refresh=async()=>{
      try{
        const [data,state]=await Promise.all([
          apiRequest(`/api/${isStallThread?'stall-applications':'applications'}/${threadId}/thread`),
          isStallThread?Promise.resolve(null):apiRequest(`/api/applications/${threadId}/state`),
        ])
        if(mounted)setReviewingApp(current=>{
          if(current?.id!==threadId)return current
          const newer=state&&(!current.updatedAt||!state.updatedAt||Date.parse(state.updatedAt)>=Date.parse(current.updatedAt))
          return {...current,...(newer?state:{}),thread:data.messages,...(typeof data.threadReadOnly==='boolean'?{threadReadOnly:data.threadReadOnly}:{})}
        })
      }catch{ /* Keep current details and messages during a temporary disconnect. */ }
    }
    const timer=setInterval(refresh,10000)
    window.addEventListener('focus',refresh);window.addEventListener('navar-application-review-refresh',refresh)
    return()=>{mounted=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('navar-application-review-refresh',refresh)}
  },[threadId,isStallThread,historyId])

  const currentReviewApp = reviewingApp && applications ? reviewingApp : null

  const currentReviewStallApp = activeTab==='stall'&&reviewingApp?.expansionId?reviewingApp:null

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
          key={`${currentReviewApp.id}:${currentReviewApp.historyId||'current'}`}
          app={currentReviewApp}
          onVersionChange={(id,historyId) => loadApplication({ id,historyId })}
          onDecision={async (id, name, notes) => {
            const response=await apiRequest(`/api/applications/${id}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
            setApplications(await apiRequest('/api/applications'))
            setReviewingApp(await apiRequest(`/api/applications/${id}`))
            return response
          }}
          onClose={closeReview}
          onRequestRevision={(id, notes) => handleRequestRevision(id, notes, false)}
          onApprove={(id) => handleApprove(id, false)}
          onSendNote={(id, note, attachments) => handleSendNote(id, note, attachments, false)}
          initialTab={openThread ? 'thread' : 'submission'}
        />
      )}


      {currentReviewStallApp && activeTab === 'stall' && (
        <StallReviewPanel key={currentReviewStallApp.id} app={currentReviewStallApp} onClose={closeReview}
          initialTab={openThread?'thread':'submission'}
          onDecision={async(action,note)=>{
            if(action==='approve')return handleApprove(currentReviewStallApp.id,true)
            const result=await apiRequest(`/api/stall-applications/${currentReviewStallApp.id}/revision`,{method:'POST',body:JSON.stringify({revision:currentReviewStallApp.revision,note})})
            setStallApplications(await apiRequest('/api/stall-applications'));await loadStallApplication(currentReviewStallApp);return result
          }}
          onSendNote={(note,files)=>handleSendNote(currentReviewStallApp.id,note,files,true)}/>
      )}

    </div>
  )
}
