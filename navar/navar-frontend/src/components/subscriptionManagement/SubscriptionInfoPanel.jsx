import { X, AlertTriangle } from 'lucide-react'

function formatPeso(amount) {
  return `₱${amount.toLocaleString('en-US')}.00`
}

function statusVariant(status) {
  const map = { Active: 'active', 'Grace Period': 'grace', Suspended: 'suspended', Setup: 'setup' }
  return map[status] || 'default'
}

function tierVariant(tier) {
  const map = { Basic: 'basic', Standard: 'standard', Premium: 'premium' }
  return map[tier] || 'basic'
}

function InfoRow({ label, value }) {
  return (
    <div className="sub-info-row">
      <span className="sub-info-label">{label}</span>
      <span className="sub-info-value">{value ?? '—'}</span>
    </div>
  )
}

function SectionHeader({ title }) {
  return <p className="sub-info-section-header">{title}</p>
}

export default function SubscriptionInfoPanel({ mall, tierInfo, onClose, onSuspend, onLift }) {
  const reason = mall.suspension?.reason

  return (
    <>
      <div className="sub-panel-overlay" onClick={onClose} />

      <aside className="sub-panel" role="dialog" aria-modal="true">
        <div className="sub-panel-header">
          <h2 className="sub-panel-title">{mall.name}</h2>
          <button className="sub-panel-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="sub-panel-divider" />

        <div className="sub-panel-body">
          <div className="sub-panel-badges">
            <span className={`sub-status-badge sub-status-badge--${statusVariant(mall.status)}`}>{mall.status}</span>
            <span className={`sub-tier-badge sub-tier-badge--${tierVariant(mall.tier)}`}>{mall.tier}</span>
          </div>

          <div className="sub-wallet-box">
            <div>
              <p className="sub-wallet-label">Wallet Balance</p>
              <p className={`sub-wallet-value${mall.wallet <= 0 ? ' sub-wallet-value--zero' : ''}`}>{formatPeso(mall.wallet)}</p>
            </div>
            <div className="sub-wallet-meta">
              <p className="sub-wallet-annual">Annual Fee: {formatPeso(tierInfo.annualFee)}</p>
              <p className="sub-wallet-days">{mall.daysLeftLabel}</p>
            </div>
          </div>

          {mall.status === 'Setup' && (
            <div className="sub-setup-note">
              Onboarding fee has been paid. This subscription will begin once the AR map is published live for public use.
            </div>
          )}

          {mall.status === 'Suspended' && (
            <div className="sub-suspension-callout">
              <div className="sub-suspension-callout-head">
                <AlertTriangle size={15} className="sub-suspension-callout-icon" />
                <span>{reason} Suspension</span>
              </div>
              <p className="sub-suspension-callout-date">Suspended since {mall.suspension.date}</p>
              {mall.suspension.notes && <p className="sub-suspension-callout-notes">{mall.suspension.notes}</p>}
              {reason === 'Non-Payment' && (
                <p className="sub-suspension-callout-hint">
                  Auto-lifts once the wallet balance covers {formatPeso(tierInfo.annualFee + Math.round(tierInfo.annualFee * tierInfo.reinstatementRate / 100))} (annual fee + {tierInfo.reinstatementRate}% reinstatement fee). No manual action needed.
                </p>
              )}
              {reason === 'Operational' && (
                <p className="sub-suspension-callout-hint">
                  Voluntary pause. The subscription clock keeps running and this can be lifted anytime at no charge.
                </p>
              )}
              {(reason === 'Breach of Contract' || reason === 'Other') && (
                <p className="sub-suspension-callout-hint">
                  Must be lifted manually. Reinstating requires paying the annual fee again{mall.suspension.penalty ? ` plus a ${formatPeso(mall.suspension.penalty)} penalty` : ''}, even though the subscription term hasn't ended.
                </p>
              )}
            </div>
          )}

          <SectionHeader title="SUBSCRIPTION DETAILS" />
          <InfoRow label="Tier" value={mall.tier} />
          <InfoRow label="Annual Fee" value={formatPeso(tierInfo.annualFee)} />
          <InfoRow label="Onboarding Fee" value={formatPeso(tierInfo.onboardingFee)} />
          <InfoRow label="Subscription Start" value={mall.subscriptionStart || 'Not started yet'} />
          <InfoRow label="Subscription End" value={mall.subscriptionEnd || 'Not started yet'} />
          <InfoRow label="Grace Period" value={`${tierInfo.gracePeriodDays} days`} />
          <InfoRow label="Reinstatement Rate" value={`${tierInfo.reinstatementRate}% of annual fee`} />

          <SectionHeader title="SUBSCRIPTION TIER HISTORY" />
          {mall.tierHistory.length === 0 ? (
            <p className="sub-history-empty">No subscription tier history yet.</p>
          ) : (
            <div className="sub-history-list">
              {mall.tierHistory.map((h, i) => (
                <div key={i} className={`sub-history-card${i === 0 ? ' sub-history-card--current' : ''}`}>
                  <div className="sub-history-card-top">
                    <span className="sub-history-card-title">{h.version} · {h.tier}</span>
                    <span className="sub-history-card-fee">{formatPeso(h.fee)}</span>
                  </div>
                  <p className="sub-history-card-dates">{h.start} — {h.end}</p>
                  {h.note && <p className="sub-history-card-note">{h.note}</p>}
                </div>
              ))}
            </div>
          )}

          <SectionHeader title="PAYMENT HISTORY" />
          {mall.paymentHistory.length === 0 ? (
            <p className="sub-history-empty">No payment history yet.</p>
          ) : (
            <div className="sub-history-list">
              {mall.paymentHistory.map((p, i) => (
                <div key={i} className="sub-payment-row">
                  <div>
                    <p className="sub-payment-type">{p.type}</p>
                    <p className="sub-payment-date">{p.date}</p>
                  </div>
                  <div className="sub-payment-right">
                    <p className="sub-payment-amount">{formatPeso(p.amount)}</p>
                    <span className={`sub-payment-status sub-payment-status--${p.status === 'Paid' ? 'paid' : 'pending'}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <SectionHeader title="SUSPENSION HISTORY" />
          {mall.suspensionHistory.length === 0 ? (
            <p className="sub-history-empty">No suspension history.</p>
          ) : (
            <div className="sub-history-list">
              {mall.suspensionHistory.map((s, i) => (
                <div key={i} className="sub-history-card sub-history-card--suspension">
                  <div className="sub-history-card-top">
                    <span className="sub-history-card-title">{s.reason}</span>
                  </div>
                  <p className="sub-history-card-dates">{s.dateStart} — {s.dateEnd || 'Ongoing'}</p>
                  {s.notes && <p className="sub-history-card-note">{s.notes}</p>}
                  {s.resolution && <p className="sub-history-card-resolution">{s.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sub-panel-divider" />

        <div className="sub-panel-footer">
          {mall.status !== 'Setup' && mall.status !== 'Suspended' && (
            <button className="sub-footer-btn sub-footer-btn--suspend" onClick={onSuspend}>Suspend</button>
          )}
          {mall.status === 'Suspended' && reason !== 'Non-Payment' && (
            <button className="sub-footer-btn sub-footer-btn--lift" onClick={onLift}>Lift Suspension</button>
          )}
          {mall.status === 'Suspended' && reason === 'Non-Payment' && (
            <p className="sub-footer-note">Auto-lifts when wallet is sufficient — no manual action available.</p>
          )}
          {mall.status === 'Setup' && (
            <p className="sub-footer-note">Subscription actions unlock once the AR map is published live.</p>
          )}
        </div>
      </aside>
    </>
  )
}
