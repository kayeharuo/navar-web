import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'

export default function BusyButton({ onClick, disabled = false, children, className, ...props }) {
  const [loading, setLoading] = useState(false)

  async function handleClick(event) {
    if (loading || disabled) return
    setLoading(true)
    try {
      await onClick?.(event)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      {...props}
      className={`${className || ''} busy-button${loading ? ' busy-button--loading' : ''}`}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading && <LoaderCircle className="busy-button-spinner" size={15} aria-hidden="true" />}
      {children}
    </button>
  )
}
