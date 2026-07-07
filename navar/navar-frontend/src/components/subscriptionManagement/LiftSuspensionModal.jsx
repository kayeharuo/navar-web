import { useEffect } from 'react'

function formatPeso(amount) {
  return `₱${amount.toLocaleString('en-US')}.00`
}

export default function LiftSuspensionModal({ mall, tierInfo, onCancel, onConfirm }) {
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const reason = mall.suspension?.reason
  const isOperational = reason === 'Operational'
  const penalty = mall.suspension?.penalty || 0
  const totalDue = tierInfo.annualFee + penalty

  return (
    <div className="sub-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="sub-modal-box sub-modal-box--sm">
        <div className="sub-modal-top">
          <h2 className="sub-modal-title">Lift Suspension</h2>
          <button className="sub-modal-x" onClick={onCancel} aria-label="Close">X</button>
        </div>
        <p className="sub-modal-subtext">{mall.name}</p>

        <div className="sub-modal-divider" />

        <div className="sub-modal-scroll">
          {isOperational ? (
            <p className="sub-lift-text">
              This is a voluntary operational pause. There is no fee to lift the suspension — AR navigation will resume immediately once confirmed.
            </p>
          ) : (
            <>
              <p className="sub-lift-text">
                Lifting this suspension ({reason}) requires paying the annual fee again{penalty ? ' plus the penalty amount' : ''}, even though the subscription term hasn't ended.
              </p>
              <div className="sub-modal-summary">
                <div className="sub-modal-summary-labels">
                  <span>Annual Fee</span>
                  {penalty > 0 && <span>Penalty</span>}
                  <span>Total to Reinstate</span>
                </div>
                <div className="sub-modal-summary-values">
                  <span>{formatPeso(tierInfo.annualFee)}</span>
                  {penalty > 0 && <span>{formatPeso(penalty)}</span>}
                  <span>{formatPeso(totalDue)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sub-modal-footer">
          <button className="sub-modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="sub-modal-btn-lift" onClick={onConfirm}>
            {isOperational ? 'Confirm and Restore' : 'Confirm and Restore'}
          </button>
        </div>
      </div>
    </div>
  )
}
