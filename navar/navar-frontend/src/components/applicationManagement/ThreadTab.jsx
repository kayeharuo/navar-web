import { useEffect, useRef, useState } from 'react'

export default function ThreadTab({ app, onSendNote }) {
  const [noteText, setNoteText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  // Messages sent from this tab, shown immediately while the request is still running.
  const [localMessages, setLocalMessages] = useState([])
  const listRef = useRef(null)

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

  async function deliver(tempId, text, files) {
    try {
      const sent = await onSendNote(text, files)
      setLocalMessages(current => current.map(item => item.tempId === tempId
        ? { ...item, realId: sent?.id ?? null, status: 'sent' }
        : item))
    } catch {
      setLocalMessages(current => current.map(item => item.tempId === tempId ? { ...item, status: 'failed' } : item))
    }
  }

  function handleSend() {
    const text = noteText.trim()
    const files = attachments
    if (!text && files.length === 0) return
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setLocalMessages(current => [...current, { tempId, realId: null, message: text, files, status: 'sending' }])
    setNoteText('')
    setAttachments([])
    setAttachmentError('')
    deliver(tempId, text, files)
  }

  function handleRetry(tempId) {
    const item = localMessages.find(entry => entry.tempId === tempId)
    if (!item) return
    setLocalMessages(current => current.map(entry => entry.tempId === tempId ? { ...entry, status: 'sending' } : entry))
    deliver(tempId, item.message, item.files)
  }

  const serverMessages = app.thread || []
  const serverIds = new Set(serverMessages.map(message => String(message.id)))
  const localByRealId = new Map(localMessages.filter(item => item.realId != null).map(item => [String(item.realId), item]))
  const items = [
    ...serverMessages.map(message => ({
      ...message,
      key: String(message.id),
      localStatus: localByRealId.get(String(message.id))?.status,
    })),
    ...localMessages
      .filter(item => item.status !== 'sent' || !serverIds.has(String(item.realId)))
      .map(item => ({
        id: item.tempId,
        key: String(item.realId ?? item.tempId),
        tempId: item.tempId,
        name: 'Super Admin',
        isAdmin: true,
        date: item.status === 'sent' ? 'Just now' : '',
        message: item.message,
        attachments: item.files.map(file => ({ id: file.fileName, url: file.dataUrl, fileName: file.fileName })),
        localStatus: item.status,
      })),
  ]
  const lastTracked = [...items].reverse().find(item => item.localStatus)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [items.length, lastTracked?.localStatus])

  return (
    <div className="review-thread-wrap">
      <div className="review-thread-messages" ref={listRef}>
        {items.length === 0
          ? <div className="review-thread-empty">No Messages yet.</div>
          : items.map((msg) => (
            <div key={msg.key} className={`thread-msg-row ${msg.isAdmin ? 'thread-msg-row--admin' : ''}`}>
              <div className={`thread-msg-avatar ${msg.isAdmin ? 'thread-msg-avatar--admin' : 'thread-msg-avatar--mall'}`}>
                {msg.name.charAt(0)}
              </div>
              <div className={`thread-msg-bubble ${msg.isAdmin ? 'thread-msg-bubble--admin' : 'thread-msg-bubble--mall'}`}>
                <div className="thread-msg-meta">
                  <span className={`thread-msg-name ${msg.isAdmin ? '' : 'thread-msg-name--mall'}`}>{msg.name}</span>
                  {msg.isAdmin && <span className="thread-msg-admin-badge">Admin</span>}
                  {msg.date && <span className="thread-msg-date">{msg.date}</span>}
                </div>
                {msg.message && <div className="thread-msg-text">{msg.message}</div>}
                {msg.attachments?.length > 0 && (
                  <div className="thread-msg-attachments">
                    {msg.attachments.map(attachment => (
                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                        <img src={attachment.url} alt={attachment.fileName} className="thread-msg-attachment-preview" />
                      </a>
                    ))}
                  </div>
                )}
                {msg.localStatus === 'sending' && (
                  <div className="thread-msg-status">
                    <span className="thread-msg-status-spinner" aria-hidden="true" />
                    <span>Sending...</span>
                  </div>
                )}
                {msg.localStatus === 'failed' && (
                  <div className="thread-msg-status thread-msg-status--failed">
                    <span>Failed to send</span>
                    <button type="button" onClick={() => handleRetry(msg.tempId)}>Retry</button>
                  </div>
                )}
                {msg.localStatus === 'sent' && lastTracked?.key === msg.key && (
                  <div className="thread-msg-status thread-msg-status--sent">
                    <span>&#10003; Sent</span>
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {!app.readOnly && <div className="review-note-area">
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
      </div>}
    </div>
  )
}
