import { useState, useEffect } from 'react'

export default function ThreadModal({ project, onClose, onSendNote, onPublish }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const isApproved = project.thread && project.thread.some(msg => msg.sender === 'mall')

  function handleSend() {
    const trimmed = note.trim()
    if (!trimmed) return
    onSendNote(project.id, trimmed)
    setNote('')
  }

  return (
    <div className="ar-thread-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ar-thread-drawer">

        {/* Header */}
        <div className="ar-thread-header">
          <div>
            <h3 className="ar-thread-title">{project.mallName}</h3>
            <p className="ar-thread-subtitle">Mall Admin Confirmation</p>
          </div>
          <button className="ar-thread-close" onClick={onClose}>X</button>
        </div>

        {/* Approval banner */}
        <div className={`ar-thread-approval-banner${isApproved ? ' ar-thread-approval-banner--approved' : ' ar-thread-approval-banner--waiting'}`}>
          {isApproved
            ? 'Mall Admin confirmed. Ready to Activate or Publish.'
            : "Waiting for the Mall Admin's confirmation."}
        </div>

        <div className="ar-thread-divider" />

        {/* Scrollable body */}
        <div className="ar-thread-body">

          {/* MAP SUMMARY */}
          <div className="ar-thread-section">
            <div className="ar-thread-section-header">
              <div className="ar-thread-section-bar" />
              <span className="ar-thread-section-label">MAP SUMMARY</span>
            </div>
            <div className="ar-thread-summary">
              <div className="ar-thread-summary-row">
                <span className="ar-thread-summary-label">Mall</span>
                <span className="ar-thread-summary-value">{project.mallName}</span>
              </div>
              <div className="ar-thread-summary-row">
                <span className="ar-thread-summary-label">Admin</span>
                <span className="ar-thread-summary-value">{project.adminName} · {project.adminEmail}</span>
              </div>
              <div className="ar-thread-summary-row">
                <span className="ar-thread-summary-label">Floors</span>
                <span className="ar-thread-summary-value">{project.floors}</span>
              </div>
              <div className="ar-thread-summary-row">
                <span className="ar-thread-summary-label">Nodes</span>
                <span className="ar-thread-summary-value">{project.nodes ?? '—'}</span>
              </div>
              <div className="ar-thread-summary-row">
                <span className="ar-thread-summary-label">Edges</span>
                <span className="ar-thread-summary-value">{project.edges ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* THREAD */}
          <div className="ar-thread-section">
            <div className="ar-thread-section-header">
              <div className="ar-thread-section-bar" />
              <span className="ar-thread-section-label">THREAD</span>
            </div>
            <div className="ar-thread-messages">
              {(!project.thread || project.thread.length === 0) ? (
                <div className="ar-thread-empty">No messages yet.</div>
              ) : (
                project.thread.map(msg => (
                  <div
                    key={msg.id}
                    className={`ar-thread-msg-row${msg.sender === 'system' ? ' ar-thread-msg-row--system' : ''}`}
                  >
                    <div className={`ar-thread-msg-avatar ar-thread-msg-avatar--${msg.sender === 'system' ? 'system' : 'mall'}`}>
                      {msg.sender === 'system' ? 'N' : msg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`ar-thread-msg-bubble ar-thread-msg-bubble--${msg.sender === 'system' ? 'system' : 'mall'}`}>
                      <div className="ar-thread-msg-meta">
                        <span className={`ar-thread-msg-name${msg.sender !== 'system' ? ' ar-thread-msg-name--mall' : ''}`}>
                          {msg.name}
                        </span>
                        <span className="ar-thread-msg-date">{msg.date}</span>
                      </div>
                      <div className="ar-thread-msg-text">{msg.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Note input footer */}
        <div className="ar-thread-footer">
          <textarea
            className="ar-thread-textarea"
            placeholder="Add a note..."
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <button className="ar-thread-send-btn" onClick={handleSend}>Send Note</button>
        </div>

        {/* Bottom: publish button or status bar */}
        {isApproved ? (
          <div className="ar-thread-publish-footer">
            <button className="ar-thread-publish-footer-btn" onClick={onPublish}>Publish</button>
          </div>
        ) : (
          <div className="ar-thread-status-footer">
            <p className="ar-thread-status-line">Confirmation request sent.</p>
            <p className="ar-thread-status-line">
              <strong>Status:</strong> Waiting for the Mall Admin's response.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
