import { useState, useRef, useEffect } from 'react'
import { Search, Send } from 'lucide-react'
import AddMallModal from './AddMallModal'

const STATUS_FILTERS = ['All', 'New', 'In Progress', 'Converted']

const initialInquiries = [
  {
    id: 1,
    mallName: 'Ayala Malls Central Block',
    contactPerson: 'Maria Santos',
    email: 'm.santos@ayalacentralbloc.ph',
    phone: '09171234567',
    location: 'Cebu IT Park, Cebu City, Cebu',
    tier: 'Standard',
    annualFee: '₱100,000/yr',
    date: 'March 12, 9:00 AM',
    status: 'New',
    messages: [
      {
        id: 1,
        sender: 'mall',
        senderName: 'Ayala Malls Central Block',
        text: "We're interested in NavAR for our 4-floor mall. We have around 180 stores and would like to know more about your Standard or Premium tier.",
        time: 'Mar 14, 9:00 AM',
      },
    ],
  },
  {
    id: 2,
    mallName: 'Gaisano Grand Fiesta Mall',
    contactPerson: 'Jose Reyes',
    email: 'j.reyes@gaisanogrand.ph',
    phone: '09189876543',
    location: 'Talisay City, Cebu',
    tier: 'Basic',
    annualFee: '₱75,000/yr',
    date: 'Mar 10, 2:00 PM',
    status: 'In Progress',
    messages: [
      {
        id: 1,
        sender: 'mall',
        senderName: 'Gaisano Grand Fiesta Mall',
        text: 'Heard about NavAR from a partner mall. We have 2 floors and mostly food and fashion stores.',
        time: 'Mar 10, 2:00 PM',
      },
      {
        id: 2,
        sender: 'admin',
        senderName: 'You',
        text: 'Hi Jose! Thanks for reaching out. NavAR Basic would be a great fit for a 2-floor mall.',
        time: 'Mar 11, 10:00 AM',
      },
    ],
  },
  {
    id: 3,
    mallName: 'Robinsons Dumaguete',
    contactPerson: 'Ana Villanueva',
    email: 'a.villanueva@rpdumaguete.ph',
    phone: '09201112233',
    location: 'Dumaguete City, Negros Oriental',
    tier: 'Standard',
    annualFee: '₱100,000/yr',
    date: 'Feb 28, 8:00 AM',
    status: 'Converted',
    messages: [
      {
        id: 1,
        sender: 'mall',
        senderName: 'Robinsons Dumaguete',
        text: 'We operate a 3-floor mall with over 90 stores. Would like to explore NavAR.',
        time: 'Feb 28, 8:00 AM',
      },
      {
        id: 2,
        sender: 'admin',
        senderName: 'You',
        text: "Hi Ana! Great to hear from you. We'd recommend Standard tier for your setup. Shall we proceed?",
        time: 'Mar 11, 10:00 AM',
      },
      {
        id: 3,
        sender: 'mall',
        senderName: 'Robinsons Dumaguete',
        text: "Yes, let's proceed!",
        time: 'Mar 1, 10:00 AM',
      },
    ],
  },
]

const STATUS_COLORS = {
  New:         { border: '#2563EB', bg: '#E1F3FF', text: '#2563EB' },
  'In Progress': { border: '#FF9233', bg: '#FFF8F1', text: '#FF9233' },
  Converted:   { border: '#016630', bg: '#E1FFEC', text: '#016630' },
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

function InquiryCard({ inquiry, isSelected, onClick }) {
  return (
    <button
      className={`inq-card${isSelected ? ' inq-card--active' : ''}`}
      onClick={onClick}
    >
      <p className="inq-card-name">{inquiry.mallName}</p>
      <p className="inq-card-meta">
        {inquiry.contactPerson} · {inquiry.location}
      </p>
      <p className="inq-card-date">{inquiry.date}</p>
      <div className="inq-card-badges">
        <span className="inq-tier-badge">{inquiry.tier}</span>
        <StatusBadge status={inquiry.status} />
      </div>
    </button>
  )
}

function ViewDetailsPanel({ inquiry, onClose }) {
  return (
    <div className="inq-details-overlay" onClick={onClose}>
      <aside className="inq-details-panel" onClick={e => e.stopPropagation()}>
        <div className="inq-details-header">
          <h2 className="inq-details-title">{inquiry.mallName}</h2>
          <button className="inq-details-close" onClick={onClose}>X</button>
        </div>
        <div className="inq-details-divider" />
        <div className="inq-details-body">
          <div className="inq-detail-row">
            <span className="inq-detail-label">Contact Person</span>
            <span className="inq-detail-value">{inquiry.contactPerson}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Email</span>
            <span className="inq-detail-value">{inquiry.email}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Phone</span>
            <span className="inq-detail-value">{inquiry.phone}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Location</span>
            <span className="inq-detail-value">{inquiry.location}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Interested Tier</span>
            <span className="inq-detail-value">{inquiry.tier}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Annual Fee</span>
            <span className="inq-detail-value">{inquiry.annualFee}</span>
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Status</span>
            <StatusBadge status={inquiry.status} />
          </div>
          <div className="inq-detail-row">
            <span className="inq-detail-label">Date Inquired</span>
            <span className="inq-detail-value">{inquiry.date}</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default function InquiriesTab({ onConvertToMall }) {
  const [inquiries, setInquiries] = useState(initialInquiries)
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [showAddMall, setShowAddMall] = useState(false)
  const messagesEndRef = useRef(null)

  const selectedInquiry = selected != null ? inquiries.find(i => i.id === selected) : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedInquiry?.messages?.length])

  const filteredInquiries = inquiries.filter(inq => {
    const matchFilter = statusFilter === 'All' || inq.status === statusFilter
    const matchSearch = !searchQuery ||
      inq.mallName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inq.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    All: inquiries.length,
    New: inquiries.filter(i => i.status === 'New').length,
    'In Progress': inquiries.filter(i => i.status === 'In Progress').length,
    Converted: inquiries.filter(i => i.status === 'Converted').length,
  }

  function handleStatusChange(id, newStatus) {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
  }

  function handleSendReply(e) {
    e?.preventDefault()
    if (!replyText.trim() || !selectedInquiry) return
    const now = new Date()
    const timeStr = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    const newMsg = {
      id: Date.now(),
      sender: 'admin',
      senderName: 'You',
      text: replyText.trim(),
      time: timeStr,
    }
    setInquiries(prev => prev.map(i => {
      if (i.id !== selectedInquiry.id) return i
      const updated = { ...i, messages: [...i.messages, newMsg] }
      if (updated.status === 'New') updated.status = 'In Progress'
      return updated
    }))
    setReplyText('')
  }

  function handleReplyKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendReply()
    }
  }

  function handleConvertToMall() {
    setShowAddMall(true)
  }

  function handleAddMallSave(data) {
    handleStatusChange(selectedInquiry.id, 'Converted')
    setShowAddMall(false)
    if (onConvertToMall) onConvertToMall(data)
  }


  return (
    <div className="inq-layout">
      {/* Left sidebar */}
      <aside className="inq-sidebar">
        <div className="inq-search-wrap">
          <Search size={14} className="inq-search-icon" />
          <input
            type="text"
            placeholder="Search"
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
              {f === 'All' ? `All\n(${counts.All})` : f === 'In Progress' ? `Activated\n(${counts['In Progress']})` : `${f}\n(${counts[f] ?? 0})`}
            </button>
          ))}
        </div>

        <div className="inq-list">
          {filteredInquiries.length === 0 ? (
            <p className="inq-empty">No inquiries found.</p>
          ) : filteredInquiries.map(inq => (
            <InquiryCard
              key={inq.id}
              inquiry={inq}
              isSelected={selected === inq.id}
              onClick={() => { setSelected(inq.id); setShowDetails(false) }}
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
                <button className="inq-btn-details" onClick={() => setShowDetails(true)}>
                  View Details
                </button>
                {selectedInquiry.status !== 'Converted' && (
                  <button className="inq-btn-convert" onClick={handleConvertToMall}>
                    Convert to Mall
                  </button>
                )}
                <select
                  className="inq-status-select"
                  value={selectedInquiry.status}
                  onChange={e => handleStatusChange(selectedInquiry.id, e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Converted">Converted</option>
                </select>
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
            <div className="inq-messages">
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
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="inq-reply-area">
              <textarea
                className="inq-reply-input"
                placeholder="Reply to mall... Enter to send, Shift+Enter for new line"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                rows={2}
              />
              <button className="inq-send-btn" onClick={handleSendReply}>
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

      {/* Convert to Mall → AddMallModal */}
      {showAddMall && selectedInquiry && (
        <AddMallModal
          onClose={() => setShowAddMall(false)}
          onSave={handleAddMallSave}
          initialData={{
            name: selectedInquiry.mallName,
            city: selectedInquiry.location.split(',')[0]?.trim() || '',
            address: selectedInquiry.location,
            tier: selectedInquiry.tier,
          }}
        />
      )}
    </div>
  )
}
