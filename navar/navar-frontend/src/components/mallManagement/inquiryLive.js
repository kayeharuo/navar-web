import { apiRequest } from '../../config/api'

// Fetch-based SSE keeps the session token in the Authorization header, not a URL.
export function subscribeToInquiry(inquiryId, refresh) {
  const controller = new AbortController()
  let timer, retryDelay = 1000
  async function connect() {
    try {
      const stream = await apiRequest('/api/inquiries/events', { responseType: 'stream', signal: controller.signal })
      if (!stream) throw new Error('Live inquiry stream unavailable')
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      retryDelay = 1000
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          if (buffer.length > 16384) throw new Error('Invalid live inquiry event')
          let boundary
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const data = frame.split('\n').find(line => line.startsWith('data: '))
            if (!data) continue
            const event = JSON.parse(data.slice(6))
            if (event.type === 'connected' || (event.type === 'inquiry_changed' && String(event.inquiryId) === String(inquiryId))) void refresh()
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    } catch (error) {
      if (error.status === 401 || error.status === 403) return
      // The existing periodic thread refresh remains available if streaming fails.
      retryDelay = Math.min(retryDelay * 2, 15000)
    }
    if (!controller.signal.aborted) timer = setTimeout(connect, retryDelay)
  }
  void connect()
  return () => { clearTimeout(timer); controller.abort() }
}
