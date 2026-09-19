import { useState, useEffect } from 'react'
import SubmissionTab from './SubmissionTab'
import ThreadTab from './ThreadTab'
import RequestRevisionModal from './RequestRevisionModal'
import ApproveModal from './ApproveModal'
import Stepper from './Stepper'

export default function ReviewPanel({ app, onClose, onRequestRevision, onApprove, onSendNote, isStallApplication = false, initialTab = 'submission' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [app.id, initialTab])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleRevisionSubmit(notes) {
    setShowRevisionModal(false)
    onRequestRevision(app.id, notes)
    setActiveTab('thread')
  }

  function handleApproveConfirm() {
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

    setShowApproveModal(false)
    onApprove(app.id)
  }

  const isApproved = app.applicationStatus === 'Approved'

  return (
    <>
      <div className="review-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="review-panel" style={{ position: 'relative' }}>
          <button className="review-panel-close" onClick={onClose}>✕</button>

          <div className="review-panel-header">
            <h2 className="review-panel-title">{app.mallName}</h2>
            <p className="review-panel-meta">{app.city} · {app.adminName} · {app.adminEmail}</p>

            <Stepper status={app.applicationStatus} />

            <div className="review-badges-row">
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="review-badge-pill review-badge-pill--green">{app.agreement}</span>
                <span className={`review-badge-pill review-badge-pill--${app.applicationStatus === 'Submitted' ? 'green' : app.applicationStatus === 'For Revision' ? 'red' : app.applicationStatus === 'Approved' ? 'green' : 'grey'}`}>
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

          <div className="review-panel-body">
            {activeTab === 'submission'
              ? <SubmissionTab app={app} isStallApplication={isStallApplication} />
              : <ThreadTab app={app} onSendNote={(note) => onSendNote(app.id, note)} />
            }
          </div>

          {!isApproved && !isStallApplication && (
            <div className="review-panel-footer">
              <button className="review-footer-btn review-footer-btn--revision" onClick={() => setShowRevisionModal(true)}>
                Request Revision
              </button>
              <button className="review-footer-btn review-footer-btn--approve" onClick={() => setShowApproveModal(true)}>
                Approve Application
              </button>
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
    </>
  )
}
