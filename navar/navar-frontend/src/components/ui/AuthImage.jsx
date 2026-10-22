import { useEffect, useState } from 'react'
import { apiRequest } from '../../config/api'

export default function AuthImage({ src, alt = '', ...props }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [loading, setLoading] = useState(Boolean(src))

  useEffect(() => {
    let mounted = true
    let createdUrl = null
    if (!src) {
      setObjectUrl(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    apiRequest(src, { responseType: 'blob' }).then(blob => {
      if (!mounted) return
      createdUrl = URL.createObjectURL(blob)
      setObjectUrl(createdUrl)
    }).catch(() => {
      if (mounted) setObjectUrl(null)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => {
      mounted = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [src])

  if (loading) return <span className="stores-page-spinner auth-image-spinner" role="status" aria-label="Loading image" />
  if (!objectUrl) return null
  return <img src={objectUrl} alt={alt} {...props} />
}
