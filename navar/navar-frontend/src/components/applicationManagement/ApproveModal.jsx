import { useState } from 'react'

function ApproveIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
      <path d="M35.6612 17.7138C35.8384 17.8909 35.979 18.1011 36.075 18.3325C36.1709 18.5639 36.2203 18.812 36.2203 19.0625C36.2203 19.313 36.1709 19.5611 36.075 19.7925C35.979 20.0239 35.8384 20.2341 35.6612 20.4112L22.3174 33.7549C22.1404 33.9322 21.9302 34.0728 21.6987 34.1687C21.4673 34.2646 21.2193 34.314 20.9688 34.314C20.7183 34.314 20.4702 34.2646 20.2388 34.1687C20.0074 34.0728 19.7971 33.9322 19.6201 33.7549L13.9013 28.0362C13.5436 27.6785 13.3427 27.1933 13.3427 26.6875C13.3427 26.1817 13.5436 25.6965 13.9013 25.3388C14.259 24.9811 14.7442 24.7802 15.25 24.7802C15.7559 24.7802 16.241 24.9811 16.5987 25.3388L20.9688 29.7113L32.9638 17.7138C33.1409 17.5366 33.3511 17.396 33.5825 17.3001C33.8139 17.2041 34.062 17.1548 34.3125 17.1548C34.563 17.1548 34.8111 17.2041 35.0425 17.3001C35.2739 17.396 35.4841 17.5366 35.6612 17.7138ZM49.5625 24.7812C49.5625 29.6825 48.1091 34.4737 45.3861 38.549C42.6631 42.6242 38.7928 45.8005 34.2646 47.6761C29.7365 49.5518 24.7538 50.0425 19.9467 49.0863C15.1396 48.1301 10.724 45.77 7.25827 42.3042C3.79255 38.8385 1.43237 34.4229 0.476176 29.6158C-0.480014 24.8087 0.0107373 19.8261 1.88637 15.2979C3.76201 10.7697 6.93828 6.89939 11.0135 4.17639C15.0888 1.4534 19.88 0 24.7813 0C31.3515 0.00693832 37.6507 2.62004 42.2966 7.26592C46.9425 11.9118 49.5556 18.211 49.5625 24.7812ZM45.75 24.7812C45.75 20.634 44.5202 16.5799 42.2161 13.1316C39.9121 9.68334 36.6372 6.99573 32.8057 5.40865C28.9741 3.82158 24.758 3.40632 20.6905 4.21541C16.6229 5.02449 12.8866 7.02157 9.95412 9.95411C7.02158 12.8866 5.0245 16.6229 4.21542 20.6905C3.40634 24.758 3.82159 28.9741 5.40866 32.8056C6.99574 36.6372 9.68335 39.9121 13.1316 42.2161C16.5799 44.5202 20.634 45.75 24.7813 45.75C30.3406 45.7437 35.6704 43.5325 39.6014 39.6014C43.5325 35.6704 45.7437 30.3406 45.75 24.7812Z" fill="#16A34A"/>
    </svg>
  )
}

export default function ApproveModal({ mallName, onCancel, onConfirm, isStallApplication = false }) {
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    setSubmitting(true)
    try { await onConfirm() }
    finally { setSubmitting(false) }
  }

  return (
    <div className="app-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="app-modal-box">
        <div className="app-modal-icon"><ApproveIcon /></div>
        <h2 className="app-modal-title">Approve {mallName}?</h2>
        <p className="app-modal-desc">
          {isStallApplication
            ? 'This marks the stall addition as Approved. The current published AR will be unpublished to incorporate the new stalls. The mall admin will be notified.'
            : 'This approves the application. New AR development enters the queue; AR work on hold resumes at its previous status. The mall admin will be notified.'
          }
        </p>
        <div className="app-modal-actions">
          <button className="app-modal-btn-cancel" disabled={submitting} onClick={onCancel}>Cancel</button>
          <button className="app-modal-btn-approve" disabled={submitting} onClick={confirm}>
            {submitting && <span className="app-btn-spinner" aria-hidden="true" />}
            {submitting ? 'Approving...' : isStallApplication ? 'Approve Stall Addition' : 'Approve Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
