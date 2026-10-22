import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function InquiryToast({ message, variant = 'notice', onDismiss, onReload }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(''), 10000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div className={`inq-toast inq-toast--${variant}`}>
      <div>
        <p role={variant === 'error' ? 'alert' : 'status'}>{message}</p>
        {onReload && <button type="button" className="inq-toast-reload" onClick={onReload}>Reload inquiries</button>}
      </div>
      <button type="button" className="inq-toast-close" aria-label="Dismiss notification" onClick={() => onDismiss('')}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
