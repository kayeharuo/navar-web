import { X } from 'lucide-react'

export default function MessageModal({ title = 'Notice', message, onClose }) {
  return (
    <div className="message-modal-overlay" role="presentation" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="message-modal" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
        <button className="message-modal-close" type="button" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <h2 id="message-modal-title">{title}</h2>
        <p>{message}</p>
        <button className="message-modal-action" type="button" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}