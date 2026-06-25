import { useState } from 'react'

function UploadFileIcon() {
  return (
    <svg width="32" height="38" viewBox="0 0 32 38" fill="none">
      <path d="M31.2045 10.483L21.142 0.420469C21.0084 0.28702 20.8499 0.1812 20.6753 0.109054C20.5008 0.036909 20.3138 -0.000148042 20.125 4.44473e-07H2.875C2.1125 4.44473e-07 1.38123 0.302901 0.842068 0.842068C0.302901 1.38124 0 2.1125 0 2.875V34.5C0 35.2625 0.302901 35.9938 0.842068 36.5329C1.38123 37.0721 2.1125 37.375 2.875 37.375H28.75C29.5125 37.375 30.2438 37.0721 30.7829 36.5329C31.3221 35.9938 31.625 35.2625 31.625 34.5V11.5C31.6251 11.3112 31.5881 11.1242 31.5159 10.9497C31.4438 10.7751 31.338 10.6166 31.2045 10.483ZM21.5625 4.90727L26.7177 10.0625H21.5625V4.90727ZM28.75 34.5H2.875V2.875H18.6875V11.5C18.6875 11.8812 18.8389 12.2469 19.1085 12.5165C19.3781 12.786 19.7438 12.9375 20.125 12.9375H28.75V34.5ZM21.142 20.5455C21.2756 20.679 21.3815 20.8376 21.4538 21.0121C21.5261 21.1866 21.5633 21.3736 21.5633 21.5625C21.5633 21.7514 21.5261 21.9384 21.4538 22.1129C21.3815 22.2874 21.2756 22.446 21.142 22.5795C21.0085 22.7131 20.8499 22.819 20.6754 22.8913C20.5009 22.9636 20.3139 23.0008 20.125 23.0008C19.9361 23.0008 19.7491 22.9636 19.5746 22.8913C19.4001 22.819 19.2415 22.7131 19.108 22.5795L17.25 20.7198V28.75C17.25 29.1312 17.0986 29.4969 16.829 29.7665C16.5594 30.0361 16.1937 30.1875 15.8125 30.1875C15.4313 30.1875 15.0656 30.0361 14.796 29.7665C14.5265 29.4969 14.375 29.1312 14.375 28.75V20.7198L12.517 22.5795C12.3835 22.7131 12.2249 22.819 12.0504 22.8913C11.8759 22.9636 11.6889 23.0008 11.5 23.0008C11.3111 23.0008 11.1241 22.9636 10.9496 22.8913C10.7751 22.819 10.6165 22.7131 10.483 22.5795C10.3494 22.446 10.2435 22.2874 10.1712 22.1129C10.0989 21.9384 10.0617 21.7514 10.0617 21.5625C10.0617 21.3736 10.0989 21.1866 10.1712 21.0121C10.2435 20.8376 10.3494 20.679 10.483 20.5455L14.7955 16.233C14.929 16.0993 15.0875 15.9933 15.262 15.9209C15.4365 15.8486 15.6236 15.8114 15.8125 15.8114C16.0014 15.8114 16.1885 15.8486 16.363 15.9209C16.5375 15.9933 16.696 16.0993 16.8295 16.233L21.142 20.5455Z" fill="black"/>
    </svg>
  )
}

export default function RequestRevisionModal({ mallName, onCancel, onSubmit }) {
  const [notes, setNotes] = useState('')

  function handleSubmit() {
    if (!notes.trim()) return
    onSubmit(notes.trim())
  }

  return (
    <div className="app-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="app-modal-box">
        <div className="app-modal-icon"><UploadFileIcon /></div>
        <h2 className="app-modal-title">Request Revision {mallName}?</h2>
        <p className="app-modal-desc">
          Describe what needs to be corrected. Status will change to{' '}
          <span className="app-modal-desc-highlight">For Revision</span> and the mall admin will be notified.
        </p>
        <div className="app-modal-label">
          REVISION NOTES <span className="app-modal-label-required">*</span>
        </div>
        <textarea
          className="app-modal-textarea"
          placeholder="Describe what needs to be corrected..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="app-modal-actions">
          <button className="app-modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="app-modal-btn-revision" onClick={handleSubmit} disabled={!notes.trim()}>
            Send Revision Request
          </button>
        </div>
      </div>
    </div>
  )
}
