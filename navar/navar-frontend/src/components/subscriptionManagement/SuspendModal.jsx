import { useState } from 'react'

function formatPeso(amount) {
  return `₱${amount.toLocaleString('en-US')}.00`
}

const REASONS = [
  {
    key: 'Non-Payment',
    color: '#D51D1D',
    desc: 'Grace period ended with no payment. AR halted until annual + reinstatement fee is paid.',
  },
  {
    key: 'Operational',
    color: '#FF9233',
    desc: 'Voluntary pause (renovation, maintenance, etc.). Subscription clock keeps running. No fee to lift.',
  },
  {
    key: 'Breach of Contract',
    color: '#9E5BF0',
    desc: 'Subscription terms violated. Remaining days forfeited. Penalty fee required before reinstatement.',
  },
  {
    key: 'Other',
    color: '#2563EB',
    desc: 'Any other reason not covered above. Notes are required. Lifting terms decided case by case.',
  },
]

export default function SuspendModal({ mall, tierInfo, onCancel, onConfirm }) {
  const [reason, setReason] = useState('Non-Payment')
  const [notes, setNotes] = useState('')
  const [penalty, setPenalty] = useState('')

  const requiresNotes = reason === 'Breach of Contract' || reason === 'Other'
  const requiresPenalty = reason === 'Breach of Contract'
  const penaltyNumber = Number(penalty) || 0

  const canConfirm = (!requiresNotes || notes.trim().length > 0) && (!requiresPenalty || penaltyNumber > 0)

  let reinstateLabel
  if (reason === 'Non-Payment') {
    const total = tierInfo.annualFee + Math.round(tierInfo.annualFee * tierInfo.reinstatementRate / 100)
    reinstateLabel = `${formatPeso(tierInfo.annualFee)} + ${tierInfo.reinstatementRate}% = ${formatPeso(total)}`
  } else if (reason === 'Operational') {
    reinstateLabel = 'Keeps Running'
  } else {
    reinstateLabel = penaltyNumber > 0
      ? `Annual ${formatPeso(tierInfo.annualFee)} + penalty ${formatPeso(penaltyNumber)} = ${formatPeso(tierInfo.annualFee + penaltyNumber)}`
      : `Annual ${formatPeso(tierInfo.annualFee)} (add penalty if any)`
  }

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm({ reason, notes: notes.trim(), penalty: penaltyNumber })
  }

  return (
    <div className="sub-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="sub-modal-box">
        <div className="sub-modal-top">
          <h2 className="sub-modal-title">Suspend Subscription</h2>
          <button className="sub-modal-x" onClick={onCancel} aria-label="Close">X</button>
        </div>

        <div className="sub-modal-divider" />

        <div className="sub-modal-scroll">
          <div className="sub-modal-warning">
            Suspending immediately halts AR navigation for this mall. Mall users will lose navigation access.
          </div>

          <p className="sub-modal-section-label">Reason</p>

          <div className="sub-reason-list">
            {REASONS.map(r => (
              <label
                key={r.key}
                className={`sub-reason-card${reason === r.key ? ' sub-reason-card--active' : ''}`}
                style={reason === r.key ? { borderColor: r.color, background: `${r.color}14` } : undefined}
              >
                <input
                  type="radio"
                  name="suspend-reason"
                  value={r.key}
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="sub-reason-radio"
                />
                <div>
                  <p className="sub-reason-title" style={{ color: r.color }}>{r.key}</p>
                  <p className="sub-reason-desc">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {requiresPenalty && (
            <div className="sub-modal-field">
              <label className="sub-modal-field-label">
                Penalty Amount (₱) <span className="sub-modal-required">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="sub-modal-input"
                value={penalty}
                onChange={e => setPenalty(e.target.value)}
                placeholder="50,000"
              />
            </div>
          )}

          {reason === 'Other' && (
            <div className="sub-modal-field">
              <label className="sub-modal-field-label sub-modal-field-label--italic">Penalty Amount (₱) — if any</label>
              <input
                type="number"
                min="0"
                className="sub-modal-input"
                value={penalty}
                onChange={e => setPenalty(e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          <div className="sub-modal-field">
            <label className="sub-modal-field-label">
              Notes {requiresNotes ? <span className="sub-modal-required">(required — explain the reason)</span> : '(Optional)'}
            </label>
            <textarea
              className="sub-modal-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="sub-modal-summary">
            <div className="sub-modal-summary-labels">
              <span>Annual Fee</span>
              <span>Subscription End</span>
              <span>To Reinstate</span>
            </div>
            <div className="sub-modal-summary-values">
              <span>{formatPeso(tierInfo.annualFee)}</span>
              <span>{mall.subscriptionEnd || '—'}</span>
              <span>{reinstateLabel}</span>
            </div>
          </div>
        </div>

        <div className="sub-modal-footer">
          <button className="sub-modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="sub-modal-btn-confirm"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirm Suspension
          </button>
        </div>
      </div>
    </div>
  )
}
