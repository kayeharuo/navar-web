import { useState, useRef, useEffect } from 'react'
import { Search, Send, LoaderCircle, RefreshCw } from 'lucide-react'
import InquiryToast from './InquiryToast'
import InquiryDecisionModal from './InquiryDecisionModal'
import InquiryFollowupPanel from './InquiryFollowupPanel'
import { apiRequest } from '../../config/api'
import { subscribeToInquiry } from './inquiryLive'
import { withRequestTimeout } from './followupRequest'

const STATUS_FILTERS = ['All', 'New', 'Approved', 'Rejected']

const STATUS_COLORS = {
  New:         { border: '#2563EB', bg: '#E1F3FF', text: '#2563EB' },
  'In Progress': { border: '#FF9233', bg: '#FFF8F1', text: '#FF9233' },
  Approved:   { border: '#016630', bg: '#E1FFEC', text: '#016630' },
  Rejected:   { border: '#DC2626', bg: '#FEF2F2', text: '#DC2626' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || {}
  return (
    <span
      className="inq-status-badge"
      style={{ borderColor: c.border, background: c.bg, color: c.text }}
    >
      {status}
    </span>
  )
}

function InquiryCard({ inquiry, summary, isSelected, onClick, onShowDuplicates }) {
  return (
    <div className={`inq-card${isSelected ? ' inq-card--active' : ''}`}>
      <button type="button" className="inq-card-open" onClick={onClick} aria-pressed={isSelected}>
      <p className="inq-card-name">{inquiry.mallName}</p>
      <p className="inq-card-meta">
        {inquiry.contactPerson} · {inquiry.location}
      </p>
      <p className="inq-card-date">{inquiry.date}</p>
      {!!summary?.unread && <span className="inq-unread">{summary.unread} unread</span>}
      {summary?.waitingSince && <p className="inq-followup-hint">Awaiting response since {new Date(summary.waitingSince).toLocaleDateString()}</p>}
      {summary?.progress && <p className="inq-followup-hint">{summary.progress}</p>}
      <div className="inq-card-badges">
        <span className="inq-tier-badge">{inquiry.tier}</span>
        <StatusBadge status={inquiry.status} />
      </div>
      </button>
      {!!summary?.duplicates?.length && (
        <button type="button" className="inq-duplicate-link" onClick={onShowDuplicates}
          aria-label={`Show possible duplicate inquiries for ${inquiry.mallName}`}>
          Possible duplicate inquiry ? View matches ({summary.duplicates.length})
        </button>
      )}
    </div>
  )
}

function ViewDetailsPanel({ inquiry, onClose }) {
  const sections = [
    ['Inquiry', [['Reference', `INQ-${inquiry.id}`], ['Date Inquired', inquiry.date], ['Last Updated', inquiry.lastUpdated], ['Reviewed On', inquiry.reviewedAt]]],
    ['Contact Information', [['Contact Person', inquiry.contactPerson], ['Email', inquiry.email], ['Phone', inquiry.phone]]],
    ['Mall Information', [['Mall Name', inquiry.mallName], ['Full Address', inquiry.fullAddress], ['Barangay', inquiry.barangay], ['City', inquiry.city], ['Province', inquiry.province], ['ZIP Code', inquiry.zipCode], ['Number of Floors', inquiry.floors], ['Coverage Area', inquiry.mallCoverageArea]]],
    ['Subscription Interest', [['Interested Tier', inquiry.tier], ['Annual Fee', inquiry.annualFee]]],
  ]
  return (
    <div className="inq-details-overlay" onClick={onClose}>
      <aside className="inq-details-panel" role="dialog" aria-modal="true" aria-labelledby="inq-details-title" onClick={e => e.stopPropagation()}>
        <div className="inq-details-header">
          <h2 id="inq-details-title" className="inq-details-title">{inquiry.mallName}</h2>
          <button className="inq-details-close" aria-label="Close inquiry details" onClick={onClose}>X</button>
        </div>
        <div className="inq-details-divider" />
        <div className="inq-details-body">
          <div className="inq-detail-row">
            <span className="inq-detail-label">Status</span>
            <StatusBadge status={inquiry.status} />
          </div>
          {sections.map(([heading, rows]) => (
            <section className="inq-detail-section" key={heading}>
              <h3>{heading}</h3>
              <dl>
                {rows.map(([label, value]) => (
                  <div className="inq-detail-row" key={label}>
                    <dt className="inq-detail-label">{label}</dt>
                    <dd className="inq-detail-value">{value == null || value === '' ? 'Not recorded' : value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="inq-detail-section">
            <h3>{inquiry.hasRevision ? 'Updated Description' : 'Inquiry Description'}</h3>
            <p className="inq-detail-description">{inquiry.description || 'No description provided.'}</p>
          </section>
          {inquiry.rejectionReason && <section className="inq-detail-section">
            <h3>Rejection Reason</h3>
            <p className="inq-detail-description">{inquiry.rejectionReason}</p>
          </section>}
        </div>
      </aside>
    </div>
  )
}

export default function InquiriesTab() {
  const [inquiries, setInquiries] = useState([])
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [duplicateSource, setDuplicateSource] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [decision, setDecision] = useState(null)
  const [decisionInquiry, setDecisionInquiry] = useState(null)
  const [decisionError, setDecisionError] = useState('')
  const [decisionNotice, setDecisionNotice] = useState('')
  const [summaries, setSummaries] = useState([])
  const [showFollowup, setShowFollowup] = useState(false)
  const [attention,setAttention]=useState('all')
  const messagesEndRef = useRef(null)
  const busyRef = useRef(false)
  const requestRef = useRef(null)
  const threadWriteRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thread, setThread] = useState({ id: null, messages: [] })
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadRevision, setThreadRevision] = useState(0)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller=new AbortController()
    const refresh=async()=>{
      if(document.hidden)return
      try {const data=await apiRequest('/api/inquiries/followup',{signal:controller.signal});if(!controller.signal.aborted)setSummaries(data.summaries)}
      catch(e){if(!controller.signal.aborted)setError(e.message)}
    }
    void refresh()
    const timer=setInterval(refresh,15000)
    return()=>{controller.abort();clearInterval(timer)}
  },[revision])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    apiRequest('/api/inquiries', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setInquiries(data.inquiries) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (selected == null) return
    const controller = new AbortController()
    setThreadLoading(true)
    let pending = false
    let lastRead = -1
    const refreshThread = async () => {
      if (pending || document.hidden || controller.signal.aborted) return
      pending = true
      const writeVersion = threadWriteRef.current
      try {
        const data = await apiRequest(`/api/inquiries/${selected}/messages`, { signal: controller.signal })
        if (!controller.signal.aborted && writeVersion === threadWriteRef.current) {
          setThread({ id: selected, messages: data.messages, syncWarning: data.inboxSync?.warning })
          if(data.currentInquiry)setInquiries(current=>current.map(item=>item.id===selected?{...item,...data.currentInquiry}:item))
          const messageId=Math.max(0,...data.messages.map(m=>Number(m.id)||0))
          if(!document.hidden && messageId>lastRead) {
            await apiRequest(`/api/inquiries/${selected}/read`,{method:'POST',signal:controller.signal,body:JSON.stringify({messageId})})
            lastRead=messageId
            if(!controller.signal.aborted)setSummaries(current=>current.map(s=>s.id===selected?{...s,unread:0}:s))
          }
        }
      } catch (e) { if (!controller.signal.aborted) setError(e.message) }
      finally { pending = false; if (!controller.signal.aborted) setThreadLoading(false) }
    }
    void refreshThread()
    const timer = setInterval(refreshThread, 3000)
    const unsubscribe = subscribeToInquiry(selected, refreshThread)
    document.addEventListener('visibilitychange', refreshThread)
    return () => { unsubscribe(); controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refreshThread) }
  }, [selected, revision, threadRevision])

  const record = selected != null ? inquiries.find(i => i.id === selected) : null
  const summary = summaries.find(item=>item.id===selected)
  const selectedInquiry = record ? { ...record, messages: [...record.messages, ...(thread.id === selected ? thread.messages : [])] } : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedInquiry?.messages?.length])

  const duplicateMatches = summaries.find(item => item.id === duplicateSource?.id)?.duplicates || []
  const duplicateIds = new Set([duplicateSource?.id, ...duplicateMatches.map(item => item.id)])

  function showDuplicates(inquiry) {
    if (busyRef.current) return
    setDuplicateSource({ id: inquiry.id, mallName: inquiry.mallName })
    setStatusFilter('All')
    setSearchQuery('')
    setAttention('all')
    setSelected(inquiry.id)
    setReplyText('')
    setShowDetails(false)
    setShowFollowup(false)
    setDecision(null)
    setError('')
  }

  const filteredInquiries = inquiries.filter(inq => {
    const matchFilter = statusFilter === 'All' || inq.status === statusFilter
    const matchSearch = !searchQuery ||
      inq.mallName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inq.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inq.email.toLowerCase().includes(searchQuery.toLowerCase())
    const followup=summaries.find(item=>item.id===inq.id)
    const matchAttention=attention==='all' || (attention==='unread' && followup?.unread>0) || (attention==='waiting' && followup?.waitingSince)
    return (!duplicateSource || duplicateIds.has(inq.id)) && matchFilter && matchSearch && matchAttention
  })

  const counts = {
    All: inquiries.length,
    New: inquiries.filter(i => i.status === 'New').length,
    'In Progress': inquiries.filter(i => i.status === 'In Progress').length,
    Approved: inquiries.filter(i => i.status === 'Approved').length,
    Rejected: inquiries.filter(i => i.status === 'Rejected').length,
  }

  async function perform(action, refresh = true) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await action()
      if (result?.warning) setError(result.warning)
      if (refresh) setRevision(value => value + 1)
      return true
    } catch (e) { setError(e.message); return false }
    finally { busyRef.current = false; setBusy(false) }
  }
  function handleStatusChange(id, newStatus) {
    perform(() => apiRequest(`/api/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus, updatedAt: selectedInquiry.updatedAt }) }))
  }
  async function handleSendReply(e) {
    e?.preventDefault()
    if (!replyText.trim() || !selectedInquiry || busyRef.current) return
    const id = selectedInquiry.id, text = replyText.trim()
    const signature = `${id}:reply:${text}`
    if (requestRef.current?.signature !== signature) requestRef.current = { signature, id: crypto.randomUUID() }
    const ok = await perform(async () => {
      const result = await apiRequest(`/api/inquiries/${id}/replies`, { method: 'POST', body: JSON.stringify({ text, requestId: requestRef.current.id }) })
      threadWriteRef.current += 1
      setThread(current => ({ ...current, id, messages: [...(current.id === id ? current.messages : []).filter(m => m.id !== result.message.id), result.message] }))
      setInquiries(current => current.map(inquiry => inquiry.id === id ? { ...inquiry, status: result.status, updatedAt: result.updatedAt } : inquiry))
      return result
    }, false)
    if (ok) { setReplyText(''); requestRef.current = null }
  }

  function handleReplyKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendReply()
    }
  }

  function openDecision(action) {
    if (!selectedInquiry || busyRef.current) return
    setDecisionInquiry({ ...selectedInquiry, duplicates: summary?.duplicates || [] })
    setDecisionError('')
    setDecisionNotice('')
    setDecision(action)
  }


  async function handleDecision(reason, acknowledgeDuplicates) {
    if (busyRef.current || !decisionInquiry) return
    const target = decisionInquiry
    const action = decision
    const signature = `${target.id}:${action}:${reason || ''}`
    if (requestRef.current?.signature !== signature) requestRef.current = { signature, id: crypto.randomUUID() }
    busyRef.current = true
    setBusy(true)
    setDecisionError('')
    setError('')
    if (action === 'approve') {
      setDecision(null)
      setDecisionInquiry(null)
      setDecisionNotice(`Approving ${target.mallName} and sending the setup link...`)
    }
    try {
      const result = await withRequestTimeout(signal => apiRequest(`/api/inquiries/${target.id}/${action}`, {
        method: 'POST', signal,
        body: JSON.stringify({ reason, acknowledgeDuplicates, updatedAt: target.updatedAt, requestId: requestRef.current.id }),
      }), 90000)
      if (!result?.ok) throw new Error('The server did not confirm this decision. Reload the inquiry before retrying.')
      setDecisionNotice(result.warning || (action === 'approve'
        ? 'Inquiry approved. The setup-link email was accepted by the mail server. Check the recipient inbox and spam folder.'
        : 'Inquiry rejected. The notification was submitted to the mail server.'))
      setRevision(value => value + 1)
      setDecision(null)
      setDecisionInquiry(null)
      requestRef.current = null
    } catch (error) {
      const message = error.name === 'TimeoutError'
        ? 'The server has not confirmed the request yet and may still be processing it.'
        : error.message || 'Unable to submit this decision. Please try again.'
      if (action === 'approve') {
        setDecisionNotice('')
        setError(`Approval for ${target.mallName} could not be confirmed. ${message} Reload the inquiry to check its status before retrying.`)
        setRevision(value => value + 1)
      } else {
        setDecisionError(message)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }



  return (
    <div className="inq-layout">
      <div className="inq-toast-stack" aria-label="Inquiry notifications">
        {decisionNotice && <InquiryToast message={decisionNotice} onDismiss={setDecisionNotice} />}
        {error && <InquiryToast message={error} variant="error" onDismiss={setError}
          onReload={() => { setError(''); setRevision(v => v + 1) }} />}
      </div>
      {/* Left sidebar */}
      <aside className="inq-sidebar">
        <div className="inq-search-wrap">
          <Search size={14} className="inq-search-icon" />
          <input
            type="text"
            placeholder="Search inquiries"
            aria-label="Search by mall name, contact or email"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="inq-search-input"
          />
        </div>

        <div className="inq-filter-bar">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`inq-filter-btn${statusFilter === f ? ' inq-filter-btn--active' : ''}`}
            >
              {`${f}\n(${counts[f] ?? inquiries.filter(i => i.status === f).length})`}
            </button>
          ))}
        </div>

        <select className="inq-attention-filter" aria-label="Follow-up filter" value={attention} onChange={e=>setAttention(e.target.value)}>
          <option value="all">All conversations</option><option value="unread">Unread inquiries and replies</option><option value="waiting">Awaiting admin response</option>
        </select>

        {duplicateSource && <div className="inq-duplicate-filter">
          <p role="status">Showing {duplicateSource.mallName} (INQ-{duplicateSource.id}) and its possible duplicates.</p>
          <button type="button" onClick={() => setDuplicateSource(null)}>Clear duplicate filter</button>
        </div>}

        <div className="inq-list" aria-busy={loading}>
          {filteredInquiries.length === 0 ? (
            <p className="inq-empty">{loading ? 'Loading inquiries...' : 'No inquiries found.'}</p>
          ) : filteredInquiries.map(inq => (
            <InquiryCard
              key={inq.id}
              inquiry={inq}
              isSelected={selected === inq.id}
              summary={summaries.find(item=>item.id===inq.id)}
              onShowDuplicates={() => showDuplicates(inq)}
              onClick={() => { if (busyRef.current) return; setSelected(inq.id); setShowDetails(false); setReplyText(''); setError('') }}
            />
          ))}
        </div>
      </aside>

      {/* Right thread panel */}
      <div className="inq-thread-panel">
        {!selectedInquiry ? (
          <div className="inq-empty-state">
            <p className="inq-empty-state-title">Select an Inquiry to view the thread</p>
            <p className="inq-empty-state-sub">Replies here are sent to the mall via email</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="inq-thread-header">
              <div className="inq-thread-header-info">
                <p className="inq-thread-name">{selectedInquiry.mallName}</p>
                <p className="inq-thread-contact">{selectedInquiry.contactPerson}</p>
                <p className="inq-thread-contact-sub">
                  {selectedInquiry.email} · {selectedInquiry.phone}
                </p>
              </div>
              <div className="inq-thread-actions">
                <select className="inq-status-select" aria-label="Inquiry status" title="Inquiry status"
                  disabled={busy || ['Approved', 'Rejected'].includes(selectedInquiry.status)}
                  value={selectedInquiry.status} onChange={e => handleStatusChange(selectedInquiry.id, e.target.value)}>
                  {['Approved', 'Rejected'].includes(selectedInquiry.status) && <option value={selectedInquiry.status}>{selectedInquiry.status}</option>}
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                </select>
                <button className="inq-status-select" onClick={()=>setShowFollowup(true)}>Follow-up</button>
                {!['Approved', 'Rejected'].includes(selectedInquiry.status) && (
                  <select className="inq-status-select" aria-label="Review actions" title="Review actions"
                    disabled={busy} value="" onChange={e => openDecision(e.target.value)}>
                    <option value="" disabled>Review Actions</option>
                    <option value="approve">Approve &amp; Invite</option>
                    <option value="reject">Reject</option>
                  </select>
                )}
                <button className="inq-btn-details" onClick={() => setShowDetails(true)}>View Details</button>
                <button type="button" className="inq-btn-details inq-btn-refresh" disabled={threadLoading}
                  aria-label="Refresh inquiry conversation"
                  onClick={() => { setThreadLoading(true); setThreadRevision(value => value + 1) }}>
                  <RefreshCw className={threadLoading ? 'inq-loading-spinner' : undefined} size={14} aria-hidden="true" />
                  {threadLoading ? 'Refreshing' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Info bar */}
            <div className="inq-info-bar">
              <span className="inq-info-location">{selectedInquiry.location}</span>
              <span className="inq-info-sep">·</span>
              <span className="inq-info-interested">
                Interested: <strong>{selectedInquiry.tier} — {selectedInquiry.annualFee}</strong>
              </span>
            </div>

            {/* Messages */}
            <div className="inq-messages-container" aria-busy={threadLoading}>
            {threadLoading && <div className="inq-messages-loading" role="status"><LoaderCircle className="inq-loading-spinner" size={22} aria-hidden="true" />Loading messages...</div>}
            <div className="inq-messages">
              {thread.id === selected && thread.syncWarning && <p className="inq-empty" role="status">{thread.syncWarning}</p>}
              {selectedInquiry.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`inq-msg-wrap inq-msg-wrap--${msg.sender}`}
                >
                  <div className={`inq-bubble inq-bubble--${msg.sender}`}>
                    <div className="inq-bubble-meta">
                      <span className="inq-bubble-sender">
                        {msg.senderName}
                        {msg.sender === 'admin' && (
                          <span className="inq-admin-tag">Admin</span>
                        )}
                      </span>
                      <span className="inq-bubble-time">{msg.time}</span>
                    </div>
                    <p className="inq-bubble-text">{msg.text}</p>
                    {msg.sender === 'admin' && ['pending', 'sending', 'sent', 'unconfirmed'].includes(msg.deliveryStatus) && (
                      <span className="inq-bubble-time" role="status">
                        {{ pending: 'Email queued', sending: 'Email sending · awaiting confirmation', sent: 'Email accepted by mail server', unconfirmed: 'Email delivery unconfirmed — check the sending inbox before resending' }[msg.deliveryStatus]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            </div>

            {/* Reply box */}
            <div className="inq-reply-area">
              <textarea
                className="inq-reply-input"
                placeholder="Reply to mall... Enter to send, Shift+Enter for new line"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                rows={1}
                maxLength={4000}
                disabled={busy}
              />
              <button disabled={busy || !replyText.trim()} className="inq-send-btn" onClick={handleSendReply}>
                <Send size={14} />
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* View Details panel */}
      {showDetails && selectedInquiry && (
        <ViewDetailsPanel
          inquiry={selectedInquiry}
          onClose={() => setShowDetails(false)}
        />
      )}

      {decision && decisionInquiry && (
        <InquiryDecisionModal
          key={`${decisionInquiry.id}:${decision}`}
          inquiry={decisionInquiry}
          duplicates={decisionInquiry.duplicates}
          decision={decision}
          busy={busy}
          error={decisionError}
          onClose={() => { if (!busyRef.current) setDecision(null) }}
          onConfirm={handleDecision}
          onShowDuplicates={() => showDuplicates(decisionInquiry)}
        />
      )}
      {showFollowup && selectedInquiry && <InquiryFollowupPanel key={selectedInquiry.id} inquiry={selectedInquiry} summary={summary} onShowDuplicates={() => showDuplicates(selectedInquiry)} onClose={()=>setShowFollowup(false)} onChanged={()=>setRevision(value=>value+1)} />}
    </div>
  )
}
