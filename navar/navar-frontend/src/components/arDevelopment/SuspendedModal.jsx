export default function SuspendedModal({ project, onClose }) {
  return (
    <div className="ar-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ar-modal-box">
        <div className="ar-modal-pending-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D51D1D" strokeWidth="2">
            <circle cx="12" cy="12" r="10.5" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="8" y1="16" x2="16" y2="16" />
          </svg>
        </div>

        <h3 className="ar-modal-title" style={{ color: '#D51D1D' }}>
          Map Editing Suspended — {project.mallName}
        </h3>

        <p className="ar-modal-subtitle">
          The application for this mall was sent back for revision.
          The map cannot be edited until the mall admin resubmits the
          application and the super admin approves the new submission.
        </p>

        <div className="ar-modal-notes" style={{ marginBottom: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#D51D1D', fontFamily: 'Poppins, sans-serif', lineHeight: 1.6 }}>
            <strong>What to do next:</strong> Open the Application Management page, find this mall's application, and review the revision thread to see what changes are needed. Once the mall admin resubmits, you can approve it again and editing will be unlocked.
          </p>
        </div>

        <div className="ar-modal-actions">
          <button className="ar-modal-btn-cancel" onClick={onClose} style={{ background: '#D51D1D', color: '#fff', border: 'none' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}