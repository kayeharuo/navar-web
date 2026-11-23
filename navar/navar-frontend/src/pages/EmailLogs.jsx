import { apiRequest } from '../config/api'
import { useState, useEffect, useMemo } from 'react'
import BusyButton from '../components/ui/BusyButton'
import { emailTypeLabel } from '../utils/emailTypeLabel'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import '../styles/emailLogs/emailLogs.css'

const STATUS_OPTIONS = ['All Statuses', 'Accepted by mail server', 'Failed', 'Pending', 'Unconfirmed']

function StatusBadge({ status }) {
  return (
    <span className={`email-status-badge email-status-badge--${status}`}>
      {status === 'sent' ? 'Accepted' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
      <path d="M22.67 21.55L17.73 16.61C19.16 14.89 19.88 12.69 19.72 10.45C19.57 8.22 18.56 6.13 16.91 4.62C15.26 3.11 13.09 2.3 10.85 2.35C8.61 2.4 6.48 3.31 4.9 4.9C3.31 6.48 2.4 8.61 2.35 10.85C2.3 13.09 3.11 15.26 4.62 16.91C6.13 18.56 8.22 19.57 10.45 19.72C12.69 19.88 14.89 19.16 16.61 17.73L21.55 22.67C21.72 22.85 21.92 22.9 22.11 22.9C22.31 22.9 22.5 22.85 22.67 22.67C22.85 22.5 22.9 22.31 22.9 22.11C22.9 21.92 22.85 21.73 22.67 21.55ZM3.95 11.06C3.95 7.16 7.16 3.95 11.06 3.95C14.95 3.95 18.16 7.16 18.16 11.06C18.16 14.95 14.95 18.16 11.06 18.16C7.16 18.16 3.95 14.95 3.95 11.06Z" fill="#979797"/>
    </svg>
  )
}

function DetailModal({ log, onResend, onClose }) {

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const isFailed = ['failed','unconfirmed'].includes(log.status)

  return (
    <div className="email-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="email-detail-modal">
        <div className="email-detail-top">
          <div>
            <h2 className="email-detail-title">{emailTypeLabel(log.type)}</h2>
            <StatusBadge status={log.status} />
          </div>
          <button className="email-detail-x" onClick={onClose}>X</button>
        </div>

        <div className="email-detail-divider" />

        <div className="email-detail-body">
          <div className="email-detail-row">
            <span className="email-detail-label">When</span>
            <span className="email-detail-value">{log.timestamp}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Recipient</span>
            <span className="email-detail-value">{log.recipient}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Mall</span>
            <span className="email-detail-value">{log.mall}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Type</span>
            <span className="email-detail-value">{emailTypeLabel(log.type)}</span>
          </div>
          <div className="email-detail-row">
            <span className="email-detail-label">Triggered By</span>
            <span className="email-detail-value">{log.triggeredBy}</span>
          </div>

          {isFailed && log.failReason && (
            <div className="email-detail-section">
              <p className="email-detail-section-label">Failure Reason</p>
              <div className="email-detail-text-box email-detail-text-box--error">{log.failReason}</div>
            </div>
          )}
          {isFailed && log.retryUnavailableReason && <div className="email-detail-section"><p className="email-detail-section-label">Resend unavailable</p><div className="email-detail-text-box">{log.retryUnavailableReason}</div></div>}

          <div className="email-detail-section">
            <p className="email-detail-section-label">Email Content</p>
            <div className="email-detail-text-box">{log.body}</div>
          </div>

        </div>

        <div className="email-detail-divider" />

        <div className="email-detail-footer">
          {isFailed && log.canResend && (
            <button className="email-modal-resend-btn" onClick={() => onResend(log.id)}>
              Resend Email
            </button>
          )}
          <button className="email-modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function ResendModal({ dialog, onConfirm, onClose }) {
  const working = dialog.phase === 'working'
  const confirming = dialog.phase === 'confirm' || working
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && !working) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [working, onClose])
  const title = confirming ? 'Resend Email' : dialog.phase === 'success' ? 'Email Resent' : dialog.phase === 'queued' ? 'Resend Queued' : 'Resend Failed or Unconfirmed'
  return <div className="email-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !working) onClose() }}>
    <div className="email-detail-modal" role="dialog" aria-modal="true" aria-labelledby="resend-modal-title" aria-busy={working}>
      <div className="email-detail-top"><h2 id="resend-modal-title" className="email-detail-title">{title}</h2><button disabled={working} className="email-detail-x" onClick={onClose} aria-label="Close">X</button></div>
      <div className="email-detail-divider" />
      <div className="email-detail-body">
        <p>{confirming ? 'Resend' : 'Email:'} <strong>{emailTypeLabel(dialog.log.type)}</strong> {confirming ? 'to' : 'for'} <strong>{dialog.log.recipient}</strong>{confirming ? '?' : ''}</p>
        {confirming && dialog.log.status === 'unconfirmed' && <p className="email-detail-text-box email-detail-text-box--error">This email may already have been sent. Check the sending mailbox before clicking Okay to try again.</p>}
        {working && <p role="status">Sending and checking the delivery status…</p>}
        {!confirming && <div className={`email-detail-text-box${dialog.phase === 'failed' ? ' email-detail-text-box--error' : ''}`} role={dialog.phase === 'failed' ? 'alert' : 'status'}>{dialog.message}</div>}
      </div>
      <div className="email-detail-divider" />
      <div className="email-detail-footer">{confirming ? <><button className="email-modal-close-btn" disabled={working} onClick={onClose}>Cancel</button><BusyButton className="email-modal-resend-btn" onClick={onConfirm}>{working ? 'Resending…' : 'Okay'}</BusyButton></> : <button className="email-modal-close-btn" onClick={onClose}>Okay</button>}</div>
    </div>
  </div>
}

export default function EmailLogs() {
  const [logs, setLogs] = useState([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  async function reload(){const rows=await apiRequest('/api/email-logs');setLogs(rows);setError('')}
  useEffect(()=>{reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));const timer=setInterval(()=>reload().catch(e=>setError(e.message)),30000);return()=>clearInterval(timer)},[])
  const EMAIL_TYPES=['All Email Types',...new Set(logs.map(l=>l.type))]
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [typeFilter, setTypeFilter] = useState('All Email Types')
  const [selected, setSelected] = useState(null)
  const [resendDialog, setResendDialog] = useState(null)

  const statusMap = { 'Accepted by mail server': 'sent', 'Failed': 'failed', 'Pending': 'pending', 'Unconfirmed':'unconfirmed' }
  const statusToDisplay = statusFilter === 'All Statuses' ? null : statusMap[statusFilter]

  const totalSent = logs.filter(l => l.status === 'sent').length
  const totalFailed = logs.filter(l => l.status === 'failed').length
  const totalPending = logs.filter(l => l.status === 'pending').length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(l => {
      const matchSearch = !q ||
        l.timestamp.toLowerCase().includes(q) ||
        l.recipient.toLowerCase().includes(q) ||
        emailTypeLabel(l.type).toLowerCase().includes(q) ||
        l.triggeredBy.toLowerCase().includes(q)
      const matchStatus = !statusToDisplay || l.status === statusToDisplay
      const matchType = typeFilter === 'All Email Types' || l.type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [logs, search, typeFilter, statusToDisplay])

  function handleResend(id) {
    const log = logs.find(l => l.id === id)
    if (!log) return
    setSelected(null)
    if (!log.canResend) { setResendDialog({ log, phase: 'failed', message: log.retryUnavailableReason || 'This attempt is no longer eligible for resend. Refresh Email Logs.' }); return }
    setResendDialog({ log, phase: 'confirm' })
  }

  async function confirmResend() {
    const log = resendDialog.log
    setResendDialog({ log, phase: 'working' })
    try {
      const result = await apiRequest(`/api/email-logs/${log.id}/resend`, { method: 'POST', body: JSON.stringify({ acknowledged: true }) })
      let attempt = result.attempt
      for (let i = 0; result.attemptId && i < 15 && (!attempt || ['queued','pending','sending'].includes(attempt.status)); i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        attempt = await apiRequest(`/api/email-logs/${result.attemptId}/status`)
      }
      if (result.warning || ['failed','unconfirmed'].includes(attempt?.status)) {
        setResendDialog({ log, phase: 'failed', message: attempt?.reason || result.warning || 'Delivery could not be confirmed. Check the sending mailbox before retrying.' })
      } else if (attempt?.status === 'sent') {
        setResendDialog({ log, phase: 'success', message: `The mail server accepted the new email for ${log.recipient}. Inbox delivery is not confirmed by SMTP acceptance.` })
      } else {
        setResendDialog({ log, phase: 'queued', message: result.message || 'The resend is queued. Its final delivery status will appear in Email Logs.' })
      }
      await reload().catch(() => {})
    } catch (e) { setResendDialog({ log, phase: 'failed', message: e.message }) }
  }

  return (
    <div className="email-page">
      <div className="email-header">
        <h1 className="email-title">Email Logs</h1>
        <p className="email-subtitle">Record of all emails sent through the system, both admin-triggered and automated.</p>
      </div>

      {error && <p className="mall-field-error" role="alert">{error}</p>}
      <div className="email-stats">
        <div className="email-stat-card email-stat-card--blue">
          <div className="email-stat-num">{logs.length}</div>
          <div className="email-stat-label">Delivery Attempts</div>
        </div>
        <div className="email-stat-card email-stat-card--green">
          <div className="email-stat-num">{totalSent}</div>
          <div className="email-stat-label">Accepted by mail server</div>
        </div>
        <div className="email-stat-card email-stat-card--red">
          <div className="email-stat-num">{totalFailed}</div>
          <div className="email-stat-label">Failed</div>
        </div>
        <div className="email-stat-card email-stat-card--orange">
          <div className="email-stat-num">{totalPending}</div>
          <div className="email-stat-label">Pending</div>
        </div>
      </div>

      <div className="email-toolbar">
        <div className="email-search-wrap">
          <SearchIcon />
          <input
            className="email-search-input"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="email-filters">
          <select className="email-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="email-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {EMAIL_TYPES.map(t => <option key={t} value={t}>{t === 'All Email Types' ? t : emailTypeLabel(t)}</option>)}
          </select>
          <span className="email-result-count">{filtered.length} results</span>
        </div>
      </div>

      <div className="email-table-wrap">
        <div className="email-table-scroll">
          <table className="email-table">
            <thead>
              <tr>
                <th>EMAIL TYPE</th>
                <th>MALL</th>
                <th>RECIPIENT</th>
                <th>SENT AT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="email-empty-row"><td colSpan={5}><LoadingSpinner label="Loading Email Logs..." showLabel /></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr className="email-empty-row"><td colSpan={5}>{error ? 'Unable to load email logs.' : 'No email logs found.'}</td></tr>
              )}
              {!loading && filtered.map(log => (
                <tr key={log.id} className="email-table-row" onClick={() => setSelected(log)}>
                  <td>{emailTypeLabel(log.type)}</td>
                  <td>{log.mall}</td>
                  <td>{log.recipient}</td>
                  <td>{log.timestamp}</td>
                  <td>
                    <div className="email-actions-cell">
                      <StatusBadge status={log.status} />
                      {log.canResend && (
                        <button
                          className="email-resend-btn"
                          onClick={e => { e.stopPropagation(); handleResend(log.id) }}
                        >
                          Resend
                        </button>
                      )}
                      {['failed','unconfirmed'].includes(log.status) && log.retryUnavailableReason && <span className="email-retry-note" title={log.retryUnavailableReason}>Resend unavailable</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="email-hint">Click any row to view full details. Failed emails can be resent.</p>
      </div>

      {selected && (
        <DetailModal
          log={logs.find(l => l.id === selected.id) || selected}
          onResend={handleResend}
          onClose={() => setSelected(null)}
        />
      )}
      {resendDialog && <ResendModal dialog={resendDialog} onConfirm={confirmResend} onClose={() => setResendDialog(null)} />}
    </div>
  )
}
