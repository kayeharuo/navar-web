// Bound the full operation, including session lookup and response parsing.
// Aborting the browser request does not undo a server-side save or email delivery.
export async function withRequestTimeout(operation, timeoutMs = 60000) {
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Request timed out')
      error.name = 'TimeoutError'
      reject(error)
      controller.abort()
    }, timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout])
  } finally {
    clearTimeout(timer)
  }
}
