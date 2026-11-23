import { useEffect, useState } from 'react'
import { apiRequest } from '../../config/api'

const imageRequests = new Map()

function loadImage(src) {
  if (!imageRequests.has(src)) {
    const request = apiRequest(src, { responseType: 'blob' }).catch(error => {
      imageRequests.delete(src)
      throw error
    })
    imageRequests.set(src, request)
  }
  return imageRequests.get(src)
}

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
    loadImage(src).then(blob => {
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
