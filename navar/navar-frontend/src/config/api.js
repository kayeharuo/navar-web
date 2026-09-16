const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch (error) {
    throw new Error(`Cannot connect to the backend at ${API_URL}. Start the backend server and try again.`, { cause: error })
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Request failed with status ${response.status}.`)
    error.status = response.status
    error.details = body
    throw error
  }
  return body
}
