// A successful write remains successful if the following status refresh fails.
export async function runTestAction(submit, refresh) {
  const result = await submit()
  try {
    await refresh()
    return { result, refreshError: null }
  } catch (error) {
    return { result, refreshError: error.message }
  }
}
