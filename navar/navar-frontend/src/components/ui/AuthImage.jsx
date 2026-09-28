import { useEffect, useState } from 'react'
import { apiRequest } from '../../config/api'

export default function AuthImage({ src, alt = '', ...props }) {
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    let mounted = true
    let createdUrl = null
    if (!src) return undefined
    apiRequest(src, { responseType: 'blob' }).then(blob => {
      if (!mounted) return
      createdUrl = URL.createObjectURL(blob)
      setObjectUrl(createdUrl)
    }).catch(() => {
      if (mounted) setObjectUrl(null)
    })
    return () => {
      mounted = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [src])

  if (!objectUrl) return null
  return <img src={objectUrl} alt={alt} {...props} />
}