import { useState } from 'react'
import SubmissionTab from './SubmissionTab'
import ThreadTab from './ThreadTab'
import RequestRevisionModal from './RequestRevisionModal'
import ApproveModal from './ApproveModal'
import Stepper from './Stepper'

export default function ReviewPanel({ app, onClose, onRequestRevision, onApprove, onSendNote }) {
  const [activeTab, setActiveTab] = useState('submission')
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  function handleRevisionSubmit(notes) {
    setShowRevisionModal(false)
    onRequestRevision(app.id, notes)
    setActiveTab('thread')
  }

  function handleApproveConfirm() {
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
              ? <SubmissionTab app={app} />
              : <ThreadTab app={app} onSendNote={(note) => onSendNote(app.id, note)} />
            }
          </div>

          {!isApproved && (
            <div className="review-panel-footer">
              <button className="review-footer-btn review-footer-btn--revision" onClick={() => setShowRevisionModal(true)}>
                Request Revision
              </button>
              <button className="review-footer-btn review-footer-btn--approve" onClick={() => setShowApproveModal(true)}>
                Approve Application
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
        />
      )}

      {showApproveModal && (
        <ApproveModal
          mallName={app.mallName}
          onCancel={() => setShowApproveModal(false)}
          onConfirm={handleApproveConfirm}
        />
      )}
    </>
  )
}
