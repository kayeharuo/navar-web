'use strict'
const crypto = require('node:crypto')
function verifySignature(body, header, secret, now = Date.now()) {
  if (!secret || !header) return false
  const parts = Object.fromEntries(header.split(',').map(part => part.trim().split('=')))
  if (!/^\d+$/.test(parts.t || '') || Math.abs(now / 1000 - Number(parts.t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${body}`).digest('hex')
  return [parts.te, parts.li].some(value => /^[a-f\d]{64}$/i.test(value || '') && crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex')))
}
async function paymongo(path, options = {}, env = process.env) {
  const key = env.PAYMONGO_SECRET_KEY
  if (!key?.startsWith('sk_test_')) {
    const error = new Error('Configure a PayMongo sk_test_ secret key to use no-money test checkout. Live charging is disabled in this test bridge.')
    error.statusCode = 503; throw error
  }
  const response = await fetch(`https://api.paymongo.com/v2${path}`, {
    ...options, headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error('PayMongo could not process the test checkout. Check the provider dashboard.'), { statusCode: 502 })
  return result.data
}
module.exports = { verifySignature, paymongo }
