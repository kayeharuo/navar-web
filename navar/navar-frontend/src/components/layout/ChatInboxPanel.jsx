import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { apiRequest } from '../../config/api'

export default function ChatInboxPanel({ onClose, onOpenThread }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    let mounted = true
    apiRequest('/api/conversations')
      .then(result => {
        if (mounted) setThreads(result)
      })
      .catch(requestError => {
        if (mounted) setError(requestError.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onClose()
    }
    function handleOutsideClick(event) {
      if (event.target.closest('.chat-inbox-trigger')) return
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [onClose])

  const filteredThreads = threads.filter(thread => {
    if (activeFilter === 'Unread') return thread.unread
    if (activeFilter === 'Applications') return thread.moduleKey === 'application' || thread.moduleKey === 'stall'
    if (activeFilter === 'AR Development') return thread.moduleKey === 'ar'
    return true
  })

  return (
    <div className="chat-inbox-panel" ref={panelRef} role="dialog" aria-label="All conversations">
      <div className="chat-inbox-header">
        <div>
          <h2 className="chat-inbox-title">All Conversations</h2>
          <p className="chat-inbox-subtitle">Application and AR Development threads</p>
        </div>
        <button className="chat-inbox-close" onClick={onClose} aria-label="Close conversations">
          <X size={17} />
        </button>
      </div>

      <div className="chat-inbox-filters">
        {['All', 'Unread', 'Applications', 'AR Development'].map(filter => (
          <button
            key={filter}
            className={`chat-inbox-filter${activeFilter === filter ? ' chat-inbox-filter--active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="chat-inbox-list">
        {loading && <p className="chat-inbox-empty">Loading conversations...</p>}
        {!loading && error && <p className="chat-inbox-empty">{error}</p>}
        {!loading && !error && filteredThreads.map(thread => (
          <button
            key={thread.id}
            className={`chat-inbox-thread${thread.unread ? ' chat-inbox-thread--unread' : ''}`}
            onClick={() => onOpenThread(thread.path)}
          >
            <span className={`chat-inbox-icon chat-inbox-icon--${thread.moduleKey}`}>
              <MessageCircle size={16} strokeWidth={1.8} />
            </span>
            <span className="chat-inbox-thread-body">
              <span className="chat-inbox-thread-topline">
                <strong>{thread.mallName}</strong>
                <span>{new Date(thread.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </span>
              <span className="chat-inbox-thread-meta">
                <span className={`chat-inbox-module chat-inbox-module--${thread.moduleKey}`}>{thread.moduleLabel}</span>
              </span>
              <span className="chat-inbox-preview">{thread.preview}</span>
            </span>
            {thread.unread && <span className="chat-inbox-unread-dot" />}
          </button>
        ))}
        {!loading && !error && filteredThreads.length === 0 && <p className="chat-inbox-empty">No conversations in this view.</p>}
      </div>

      <div className="chat-inbox-footer">Select a conversation to open its module entry.</div>
    </div>
  )
}
