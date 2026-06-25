import { useState } from 'react'

export default function ThreadTab({ app, onSendNote }) {
  const [noteText, setNoteText] = useState('')

  function handleSend() {
    if (!noteText.trim()) return
    onSendNote(noteText.trim())
    setNoteText('')
  }

  return (
    <div className="review-thread-wrap">
      <div className="review-thread-messages">
        {app.thread.length === 0
          ? <div className="review-thread-empty">No Messages yet.</div>
          : app.thread.map((msg) => (
            <div key={msg.id} className={`thread-msg-row ${msg.isAdmin ? 'thread-msg-row--admin' : ''}`}>
              <div className={`thread-msg-avatar ${msg.isAdmin ? 'thread-msg-avatar--admin' : 'thread-msg-avatar--mall'}`}>
                {msg.name.charAt(0)}
              </div>
              <div className={`thread-msg-bubble ${msg.isAdmin ? 'thread-msg-bubble--admin' : 'thread-msg-bubble--mall'}`}>
                <div className="thread-msg-meta">
                  <span className={`thread-msg-name ${msg.isAdmin ? '' : 'thread-msg-name--mall'}`}>{msg.name}</span>
                  {msg.isAdmin && <span className="thread-msg-admin-badge">Admin</span>}
                  <span className="thread-msg-date">{msg.date}</span>
                </div>
                <div className="thread-msg-text">{msg.message}</div>
              </div>
            </div>
          ))
        }
      </div>

      <div className="review-note-area">
        <textarea
          className="review-note-textarea"
          placeholder="Add a note..."
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />
        <button className="review-note-send-btn" onClick={handleSend}>Send Note</button>
      </div>
    </div>
  )
}
