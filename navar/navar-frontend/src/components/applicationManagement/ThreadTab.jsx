import { useState } from 'react'

export default function ThreadTab({ app, onSendNote }) {
  const [noteText, setNoteText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [attachmentError, setAttachmentError] = useState('')

  async function handleFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const next = [...attachments, ...files]
    if (next.length > 5) {
      setAttachmentError('You can attach up to 5 images per message.')
      return
    }
    if (next.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
      setAttachmentError('Only PNG, JPEG, and WebP images are allowed.')
      return
    }
    if (next.some(file => file.size > 5 * 1024 * 1024) || next.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
      setAttachmentError('Each image must be no larger than 5 MB and the total must not exceed 20 MB.')
      return
    }
    setAttachmentError('')
    try {
      const encoded = await Promise.all(next.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ fileName: file.name, dataUrl: reader.result })
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`))
        reader.readAsDataURL(file)
      })))
      setAttachments(encoded)
    } catch (error) {
      setAttachmentError(error.message)
    }
  }

  async function handleSend() {
    if (!noteText.trim() && attachments.length === 0) return
    await onSendNote(noteText.trim(), attachments)
    setNoteText('')
    setAttachments([])
  }

  return (
    <div className="review-thread-wrap">
      <div className="review-thread-messages">
        {(app.thread || []).length === 0
          ? <div className="review-thread-empty">No Messages yet.</div>
          : (app.thread || []).map((msg) => (
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
                {msg.attachments?.length > 0 && (
                  <div className="thread-msg-attachments">
                    {msg.attachments.map(attachment => (
                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                        <img src={attachment.url} alt={attachment.fileName} className="thread-msg-attachment-preview" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>

      <div className="review-note-area">
        {attachments.length > 0 && (
          <div className="thread-attachment-list">
            {attachments.map((attachment, index) => (
              <span key={`${attachment.fileName}-${index}`} className="thread-attachment-chip">
                {attachment.fileName}
                <button type="button" onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </span>
            ))}
          </div>
        )}
        {attachmentError && <div className="review-note-error">{attachmentError}</div>}
        <textarea
          className="review-note-textarea"
          placeholder="Add a note..."
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />
        <div className="review-note-actions">
          <label className="review-note-attach-btn">
            Attach images
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFiles} hidden />
          </label>
          <button className="review-note-send-btn" onClick={handleSend}>Send Note</button>
        </div>
      </div>
    </div>
  )
}
