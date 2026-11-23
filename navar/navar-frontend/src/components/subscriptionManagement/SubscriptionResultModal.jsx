import { useEffect } from 'react'
import { CheckCircle, CircleAlert, X } from 'lucide-react'

export default function SubscriptionResultModal({ result, onClose }) {
  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', closeOnEscape, true)
    return () => window.removeEventListener('keydown', closeOnEscape, true)
  }, [onClose])

  const Icon = result.success ? CheckCircle : CircleAlert
  return (
    <div className="sub-modal-overlay sub-result-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="sub-modal-box sub-modal-box--sm" role="dialog" aria-modal="true" aria-labelledby="subscription-result-title" aria-describedby="subscription-result-message">
        <div className="sub-modal-top">
          <h2 id="subscription-result-title" className="sub-modal-title">{result.title}</h2>
          <button type="button" className="sub-modal-x" aria-label="Close result" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sub-modal-divider" />
        <div className="sub-modal-scroll">
          <div className={`sub-result-message${result.success ? ' sub-result-message--success' : ' sub-result-message--failed'}`}>
            <Icon size={22} aria-hidden="true" />
            <p id="subscription-result-message" className="sub-lift-text" role={result.success ? 'status' : 'alert'}>{result.message}</p>
          </div>
        </div>
        <div className="sub-modal-footer"><button type="button" className="sub-modal-btn-cancel" autoFocus onClick={onClose}>Okay</button></div>
      </div>
    </div>
  )
}
