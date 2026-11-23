import { useState, useEffect, useRef } from 'react'
import SubmissionTab from './SubmissionTab'
import ThreadTab from './ThreadTab'
import RequestRevisionModal from './RequestRevisionModal'
import ApproveModal from './ApproveModal'
import Stepper from './Stepper'
import LoadingSpinner from '../ui/LoadingSpinner'
import {CircleCheck, CircleAlert} from 'lucide-react'

export default function ReviewPanel({ app, onClose, onRequestRevision, onApprove, onSendNote, isStallApplication = false, initialTab = 'submission', onVersionChange, onDecision }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loadingVersion, setLoadingVersion] = useState(null)
  async function changeVersion(id, historyId) {
    if (loadingVersion) return
    setLoadingVersion({ id, historyId })
    try {
      await onVersionChange(id, historyId)
    } finally {
      setLoadingVersion(null)
    }
  }
  const versionNav=useRef(null)
  useEffect(()=>{versionNav.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'})},[app.id,app.historyId])
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [gateAction, setGateAction] = useState(null)
  const [result, setResult] = useState(null)
  const [explanation, setExplanation] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  async function decide(name) {
    setBusy(true); setActionError('')
    try { const response=await onDecision(app.id, name, explanation); setGateAction(null); setExplanation(''); setResult({title:name==='accept'?'Request accepted':'Request rejected',message:response?.message||(name==='accept'?'The request can proceed to normal application review. Any required update payment must be completed before approval.':'The rejection explanation has been sent to the mall in the application thread.')}) }
    catch (error) { setActionError(error.message) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    setActiveTab(initialTab)
  }, [app.id, initialTab])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape'&&!busy&&!gateAction&&!result&&!showApproveModal&&!showRevisionModal) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose,busy,gateAction,result,showApproveModal,showRevisionModal])

  async function handleRevisionSubmit(notes) {
    try {
      await onRequestRevision(app.id, notes)
      setShowRevisionModal(false)
      setActiveTab('thread')
    } catch (error) {
      setActionError(error.message)
    }
  }

  async function handleApproveConfirm() {
    if (isStallApplication) {
      if (!app.floorPlans || app.floorPlans.length === 0) {
        alert('Please submit floor plans before approving this application.')
        return
      }

      // Check if all stalls have been added to store list
      const allStallsAdded = app.stalls && app.stalls.every(stall => stall.status === 'added_to_store_list')
      if (!allStallsAdded) {
        alert('Please add all stalls to the store list before approving.')
        return
      }

      // Check wallet sufficiency
      const SUBSCRIPTION_TIERS = {
        'Basic': { maxTenants: 50 },
        'Standard': { maxTenants: 100 },
        'Premium': { maxTenants: 200 },
      }
      const STALL_PRICE = 3500
      const tier = SUBSCRIPTION_TIERS[app.tier]
      if (tier) {
        const totalAfter = app.currentStores + app.submittedStalls
        const exceedsBy = Math.max(0, totalAfter - tier.maxTenants)
        const cost = exceedsBy * STALL_PRICE

        // In a real app, check wallet balance from database
        // For now, we'll just note this in the approval
        if (cost > 0) {
          alert(`Additional cost: ₱${cost.toLocaleString('en-US')} for ${exceedsBy} extra stalls. Ensure wallet has sufficient balance.`)
        }
      }
    }

    try {
      await onApprove(app.id)
      setShowApproveModal(false)
    } catch (error) {
      setActionError(error.message)
    }
  }

  const isApproved = app.applicationStatus === 'Approved'
  const paymentBlocked=!!app.mapUpdate&&app.mapUpdate.paymentCleared!==true

  return (
    <>
      <div className="review-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="review-panel review-panel--compact" style={{ position: 'relative' }}>
          <button className="review-panel-close" onClick={onClose}>✕</button>

          <div className="review-panel-header">
            <h2 className="review-panel-title">{app.mallName}</h2>
            <p className="review-panel-meta">{app.city} · {app.adminName} · {app.adminEmail}</p>

            {!isStallApplication && <div className="workflow-version-tabs review-version-nav" ref={versionNav} aria-label="Application versions and review history">{(app.versions || []).map(v => <div className="review-version-group" key={v.application_id}>
              <button disabled={busy||!!loadingVersion} aria-busy={loadingVersion?.id===v.application_id&&!loadingVersion.historyId} aria-pressed={v.application_id===app.id&&!app.historyId} onClick={()=>changeVersion(v.application_id)}>Version {v.application_version} / Attempt {v.application_attempt}{loadingVersion?.id===v.application_id&&!loadingVersion.historyId&&<LoadingSpinner label="Loading version" />}</button>
              {(app.reviewHistory||[]).filter(h=>h.application_id===v.application_id).map(h=><button key={h.history_id} disabled={busy||!!loadingVersion} aria-busy={loadingVersion?.historyId===h.history_id} aria-pressed={h.history_id===app.historyId} title={`Rejected on ${new Date(h.reviewed_at).toLocaleString()}`} onClick={()=>changeVersion(v.application_id,h.history_id)}>Review {v.application_version}.{v.application_attempt}.{h.review_round}{loadingVersion?.historyId===h.history_id&&<LoadingSpinner label="Loading attempt" />}</button>)}
            </div>)}</div>}
            <div className="review-badges-row">
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="review-badge-pill review-badge-pill--green">{app.agreement}</span>
                <span className={`review-badge-pill review-badge-pill--${app.applicationStatus === 'Submitted' ? 'green' : ['For Revision','Rejected','Rejected Final'].includes(app.applicationStatus) ? 'red' : app.applicationStatus === 'Approved' ? 'green' : 'grey'}`}>
                  {app.applicationStatus}
                </span>
              </div>
              {app.submittedDate !== '-' && (
                <span className="review-submitted-date">Submitted {app.submittedDate}</span>
              )}
            </div>
          </div>

          <div className="review-panel-divider" />

          <div className="review-tabs">
            <button
              className={`review-tab-btn ${activeTab === 'submission' ? 'review-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('submission')}
            >
              Submission
            </button>
            <button
              className={`review-tab-btn ${activeTab === 'thread' ? 'review-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('thread')}
            >
              Thread
            </button>
          </div>

          <div className="review-panel-divider" />

          <div className={`review-panel-body ${activeTab==='thread'?'review-panel-body--thread':''}`}>
            {activeTab === 'submission'
              ? <><details className="review-submission-context" open><summary>Application details{app.historyId?` / Review ${app.version}.${app.attempt}.${app.reviewRound}`:''}</summary>{app.historyId?null:['Pending','Disputed','Rejected','Rejected Final'].includes(app.applicationStatus)?<p className="workflow-info">{app.applicationStatus==='Pending'?'New version request awaiting acceptance or rejection.':app.applicationStatus==='Disputed'?`Disputed request: ${app.disputeCount || 0} of 2 disputes used.`:app.applicationStatus==='Rejected Final'?'Finally rejected after two disputes. A new attempt is required.':`Rejected. The mall may dispute this decision (${app.disputeCount || 0} of 2 used).`}</p>:<Stepper status={app.applicationStatus} />}{app.readOnly && <p className="workflow-info">{app.historyId?`Read-only review history: ${app.version}.${app.attempt}.${app.reviewRound}`:app.threadReadOnly?'Read-only older version or attempt':'Application details are read-only; the thread remains open.'}</p>}{app.version > 1 && <div className="workflow-reason"><strong>{app.reasonCategory}</strong><p>{app.reasonNotes}</p><p>Disputes used: {app.disputeCount || 0} / 2</p></div>}{app.rejectionReason&&<div className="workflow-reason review-history-explanation"><strong>Rejection explanation</strong><p>{app.rejectionReason}</p><small>{new Date(app.reviewedAt).toLocaleString()}</small></div>}{app.mapUpdate&&!app.historyId&&<div className="workflow-info" style={{margin:'10px 24px'}}><strong>Map update: {app.mapUpdate.status==='requested'?'Quote issued after acceptance':app.mapUpdate.status==='awaiting_payment'?'Awaiting payment':app.mapUpdate.status==='cancelled'?'Request closed':app.mapUpdate.paymentCleared?(app.mapUpdate.quote?.amount_cent===0?'Included in subscription':'Payment recorded'):'Payment not recorded'}</strong>{app.mapUpdate.quote&&<p>{new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(app.mapUpdate.quote.amount_cent/100)} / {app.mapUpdate.changedFloors} changed {app.mapUpdate.changedFloors===1?'floor':'floors'}</p>}{paymentBlocked&&app.mapUpdate.status!=='requested'&&app.mapUpdate.status!=='cancelled'&&<p>The mall must complete this service payment before approval or a revision request.</p>}</div>}</details><SubmissionTab app={app} isStallApplication={isStallApplication} /></>
              : <ThreadTab app={app} onSendNote={(note, attachments) => onSendNote(app.id, note, attachments)} />
            }
          </div>

          {!isStallApplication && !app.readOnly && ['Pending','Disputed','Submitted','Approved','For Revision'].includes(app.applicationStatus) && (
            <div className="review-panel-footer">
              {['Pending','Disputed'].includes(app.applicationStatus) ? <>
                <button className="review-footer-btn review-footer-btn--approve" disabled={busy} onClick={() => setGateAction('accept')}>Accept request</button>
                <button className="review-footer-btn review-footer-btn--revision" disabled={busy} onClick={() => setGateAction('reject')}>Reject request</button>

              </> : <>
                {app.canRevise && <button className="review-footer-btn review-footer-btn--revision" disabled={busy||paymentBlocked} title={paymentBlocked?'Record payment before requesting revision':undefined} onClick={() => setShowRevisionModal(true)}>Request Revision</button>}
                {['Submitted','For Revision'].includes(app.applicationStatus) && <button className="review-footer-btn review-footer-btn--approve" disabled={busy||paymentBlocked} onClick={() => setShowApproveModal(true)}>Approve Application</button>}
              </>}
            </div>
          )}

          {!isApproved && isStallApplication && (
            <div className="review-panel-footer">
              <button className="review-footer-btn review-footer-btn--revision" onClick={() => setShowRevisionModal(true)}>
                Request Revision
              </button>
              <button className="review-footer-btn review-footer-btn--approve" onClick={() => setShowApproveModal(true)}>
                Approve Stall Addition
              </button>
            </div>
          )}
        </div>
      </div>

      {showRevisionModal && (
        <RequestRevisionModal
          mallName={app.mallName}
          onCancel={() => setShowRevisionModal(false)}
          onSubmit={handleRevisionSubmit}
          isStallApplication={isStallApplication}
        />
      )}

      {showApproveModal && (
        <ApproveModal
          mallName={app.mallName}
          onCancel={() => setShowApproveModal(false)}
          onConfirm={handleApproveConfirm}
          isStallApplication={isStallApplication}
        />
      )}

      {gateAction&&<div className="app-modal-overlay" onClick={e=>{if(e.target===e.currentTarget&&!busy)setGateAction(null)}}><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="request-decision-title">
        <div className="app-modal-icon">{gateAction==='accept'?<CircleCheck size={50} color="#16A34A"/>:<CircleAlert size={50} color="#D51D1D"/>}</div>
        <h2 className="app-modal-title" id="request-decision-title">{gateAction==='accept'?'Accept':'Reject'} {app.mallName}'s version {app.version} request?</h2>
        <p className="app-modal-desc">{gateAction==='accept'?'Acceptance moves this request into application review. The server issues the map-update quote; any amount due must be paid before application approval. The current AR stays Live.':`Explain why this structural update is not accepted. The explanation is recorded in the thread. ${Number(app.disputeCount)>=2?'This will be the final rejection.':`The mall has ${2-Number(app.disputeCount||0)} disputes remaining.`}`}</p>
        {gateAction==='reject'&&<><label className="app-modal-label" htmlFor="map-rejection-reason">REJECTION EXPLANATION <span className="app-modal-label-required">*</span></label><textarea className="app-modal-textarea" id="map-rejection-reason" required maxLength={10000} value={explanation} disabled={busy} onChange={e=>setExplanation(e.target.value)}/></>}
        <div className="app-modal-actions"><button className="app-modal-btn-cancel" disabled={busy} onClick={()=>setGateAction(null)}>Cancel</button><button className={gateAction==='accept'?'app-modal-btn-approve':'app-modal-btn-revision'} disabled={busy||(gateAction==='reject'&&!explanation.trim())} onClick={()=>decide(gateAction)}>{busy&&<span className="app-btn-spinner" aria-hidden="true"/>}{busy?'Saving...':gateAction==='accept'?'Accept Request':'Reject Request'}</button></div>
      </div></div>}
      {result&&<div className="app-modal-overlay"><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="map-decision-result"><div className="app-modal-icon"><CircleCheck size={50} color="#16A34A"/></div><h2 id="map-decision-result" className="app-modal-title">{result.title}</h2><p className="app-modal-desc">{result.message}</p><div className="app-modal-actions"><button className="app-modal-btn-cancel" onClick={()=>setResult(null)}>Close</button></div></div></div>}
      {actionError && (
        <div className="app-modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="workflow-error-title">
          <div className="app-modal-box app-modal-box--compact">
            <h2 className="app-modal-title" id="workflow-error-title">Action could not be completed</h2>
            <p className="app-modal-desc">{actionError}</p>
            <div className="app-modal-actions">
              <button className="app-modal-btn-approve" onClick={() => setActionError('')}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
