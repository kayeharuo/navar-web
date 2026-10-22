import {test} from 'node:test'
import assert from 'node:assert/strict'
import {withRequestTimeout} from '../src/components/mallManagement/followupRequest.js'

test('returns a completed request without aborting it', async () => {
  let signal
  const result = await withRequestTimeout(s => { signal = s; return {ok:true} }, 1000)
  assert.deepEqual(result, {ok:true})
  assert.equal(signal.aborted, false)
})

test('releases a hung request even when the operation ignores abort', async () => {
  let signal
  await assert.rejects(withRequestTimeout(s => {
    signal = s
    return new Promise(() => {})
  }, 10), {name:'TimeoutError'})
  assert.equal(signal.aborted, true)
})

test('preserves a server failure so it can be shown in the panel', async () => {
  const error = new Error('Inquiry changed. Reload before updating.')
  await assert.rejects(withRequestTimeout(() => Promise.reject(error), 1000), e => e === error)
})
