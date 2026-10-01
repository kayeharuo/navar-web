import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

const THREADS = [
  {
    id: 'application-1',
    module: 'Application Management',
    moduleKey: 'application',
    mallName: 'SM Seaside City Cebu',
    counterpart: 'Jose Dela Cruz',
    preview: 'Initial AR development application is awaiting review.',
    time: 'Sep 1, 2025',
    unread: true,
    path: '/application-management?applicationId=1&type=new&view=thread',
  },
  {
    id: 'stall-101',
    module: 'Application Management',
    moduleKey: 'stall',
    mallName: 'Ayala Center Cebu',
    counterpart: 'Maria Santos',
    preview: 'Stall application and store-list verification are ready for review.',
    time: 'Apr 1, 2026',
    unread: true,
    path: '/application-management?applicationId=101&type=stall&view=thread',
  },
  {
    id: 'ar-1',
    module: 'AR Development',
    moduleKey: 'ar',
    mallName: 'SM Seaside City Cebu',
    counterpart: 'Jose Dela Cruz',
    preview: 'Confirmation request sent with the map summary.',
    time: 'Sep 20, 2025',
    unread: true,
    path: '/ar-development?projectId=1',
  },
  {
    id: 'ar-4',
    module: 'AR Development',
    moduleKey: 'ar',
    mallName: 'Gaisano Grand Minglanilla',
    counterpart: 'Lily Cruz',
    preview: 'Map preview reviewed and approved for activation.',
    time: 'Dec 10, 2025',
    unread: false,
    path: '/ar-development?projectId=4',
  },
]

const MODULE_LABELS = {
  application: 'APP',
  stall: 'STALL',
  ar: 'AR DEV',
}

export default function ChatInboxPanel({ onClose, onOpenThread }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const panelRef = useRef(null)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    function handleOutsideClick(e) {
      if (e.target.closest('.chat-inbox-trigger')) return
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [onClose])

  const filteredThreads = THREADS.filter(thread => {
    if (activeFilter === 'Unread') return thread.unread
    if (activeFilter === 'Application Management') return thread.module === activeFilter
    if (activeFilter === 'AR Development') return thread.module === activeFilter
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
        {['All', 'Unread', 'Application Management', 'AR Development'].map(filter => (
          <button
            key={filter}
            className={`chat-inbox-filter${activeFilter === filter ? ' chat-inbox-filter--active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter === 'Application Management' ? 'Applications' : filter}
          </button>
        ))}
      </div>

      <div className="chat-inbox-list">
        {filteredThreads.map(thread => (
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
                <span>{thread.time}</span>
              </span>
              <span className="chat-inbox-thread-meta">
                <span className={`chat-inbox-module chat-inbox-module--${thread.moduleKey}`}>{MODULE_LABELS[thread.moduleKey]}</span>
                <span>with {thread.counterpart}</span>
              </span>
              <span className="chat-inbox-preview">{thread.preview}</span>
            </span>
            {thread.unread && <span className="chat-inbox-unread-dot" />}
          </button>
        ))}
        {filteredThreads.length === 0 && <p className="chat-inbox-empty">No conversations in this view.</p>}
      </div>

      <div className="chat-inbox-footer">Select a conversation to open its module entry.</div>
    </div>
  )
}
