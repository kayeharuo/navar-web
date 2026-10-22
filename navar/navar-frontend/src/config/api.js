import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function apiRequest(path, options = {}) {
  const { responseType, ...requestOptions } = options
  async function send(session) {
    return fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers: {
        ...(requestOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(requestOptions.headers || {}),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    })
  }

  const { data } = await supabase.auth.getSession()
  let response
  try {
    response = await send(data.session)
    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.data.session) response = await send(refreshed.data.session)
    }
  } catch (error) {
    throw new Error(`Cannot connect to the backend at ${API_URL}. Start the backend server and try again.`, { cause: error })
  }

  if (response.ok && responseType === 'stream') return response.body
  const body = responseType === 'blob' ? await response.blob() : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) await supabase.auth.signOut()
    const error = new Error(body?.message || body?.error || `Request failed with status ${response.status}.`)
    error.status = response.status
    error.details = body
    throw error
  }
  return body
}
