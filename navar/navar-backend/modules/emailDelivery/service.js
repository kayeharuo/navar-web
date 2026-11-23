'use strict'
const nodemailer = require('nodemailer')
const { subscriptionEmail } = require('./subscriptionTemplate')
const { checked } = require('../subscriptions/service')
function failureReason(error) {
  return {
    EAUTH: 'The mail server rejected the sender login. Check the SMTP account and app password.',
    EENVELOPE: 'The mail server rejected the sender or recipient address. Verify the email addresses.',
    EDNS: 'The configured mail server could not be found. Check the SMTP host.',
    ECONNECTION: 'The backend could not connect to the mail server. Check the SMTP host, port and network connection.',
  }[error.code] || 'Delivery could not be confirmed. Check the sending mailbox before retrying.'
}
function officialEnv(env = process.env) {
  return { ...env, SMTP_USER: env.OFFICIAL_SMTP_USER || env.SMTP_USER, SMTP_PASS: env.OFFICIAL_SMTP_USER ? env.OFFICIAL_SMTP_PASS : env.SMTP_PASS,
    SMTP_FROM: env.OFFICIAL_SMTP_FROM || env.OFFICIAL_SMTP_USER || env.SMTP_FROM || env.SMTP_USER,
    SMTP_FROM_NAME: env.OFFICIAL_SMTP_FROM_NAME || env.SMTP_FROM_NAME || 'NavAR', SMTP_HOST: env.OFFICIAL_SMTP_HOST || env.SMTP_HOST,
    SMTP_PORT: env.OFFICIAL_SMTP_PORT || env.SMTP_PORT, SMTP_SECURE: env.OFFICIAL_SMTP_SECURE || env.SMTP_SECURE }
}
async function trackSend(db, details, send) {
  const row = checked(await db.from('email_log').insert({ email_log_type: details.type, email_log_to_email: details.to, email_log_subject: details.subject,
    email_log_body: details.body, email_log_status: 'sending', email_log_sent_at: null, email_log_triggered_by: details.actor || null,
    mall_id: details.mallId || null, email_log_source_type: details.sourceType || null, email_log_source_id: details.sourceId == null ? null : String(details.sourceId),
    email_log_metadata: details.metadata || {}, email_log_sender: details.sender || process.env.SMTP_FROM || process.env.SMTP_USER, email_log_claimed_at: new Date().toISOString(),
  }).select('email_log_id').single())
  let outcome
  try { outcome = await send() }
  catch (error) {
    const definite = ['EAUTH','EENVELOPE','EDNS','ECONNECTION'].includes(error.code)
    checked(await db.from('email_log').update({ email_log_status: definite ? 'failed' : 'unconfirmed', email_log_fail_reason: failureReason(error) }).eq('email_log_id', row.email_log_id))
    throw error
  }
  checked(await db.from('email_log').update({ email_log_status: 'sent', email_log_sent_at: new Date().toISOString(), email_log_provider_id: outcome?.messageId || null }).eq('email_log_id', row.email_log_id))
  return outcome
}
async function sendQueued(db, env = process.env, { ids } = {}) {
  const config = officialEnv(env)
  if (!config.SMTP_USER || !config.SMTP_PASS) return { waitingForSMTP: true }
  const transport = nodemailer.createTransport({ host: config.SMTP_HOST || 'smtp.gmail.com', port: Number(config.SMTP_PORT || 465), secure: config.SMTP_SECURE !== 'false', auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 })
  // A crash after SMTP accepted a message is ambiguous; never automatically resend it.
  checked(await db.from('email_log').update({ email_log_status: 'unconfirmed', email_log_fail_reason: 'Worker stopped during delivery. Check the sending mailbox before resending.' }).eq('email_log_status','sending').lt('email_log_claimed_at', new Date(Date.now()-15*60000).toISOString()))
  let query = db.from('email_log').select('*').eq('email_log_status','queued').order('email_log_created_at').limit(50)
  if (ids?.length) query = query.in('email_log_id', ids)
  const queued = checked(await query)
  let sent = 0
  try {
    for (const row of queued) {
      if (row.email_log_source_type === 'account' || row.email_log_source_type === 'inquiry') continue
      const claimed = checked(await db.from('email_log').update({ email_log_status: 'sending', email_log_claimed_at: new Date().toISOString(), email_log_sender: config.SMTP_FROM }).eq('email_log_id',row.email_log_id).eq('email_log_status','queued').select('email_log_id'))
      if (!claimed.length) continue
      let outcome
      try {
        const presentation = row.email_log_source_type === 'subscription' || row.email_log_type?.startsWith('subscription_')
          ? subscriptionEmail({ subject: row.email_log_subject, body: row.email_log_body, type: row.email_log_type }) : {}
        outcome = await transport.sendMail({ from: { name: config.SMTP_FROM_NAME, address: config.SMTP_FROM }, to: row.email_log_to_email, subject: row.email_log_subject, text: row.email_log_body, ...presentation })
        if (!outcome.accepted?.length) throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' })
      } catch (error) {
        checked(await db.from('email_log').update({ email_log_status: ['EAUTH','EENVELOPE','EDNS','ECONNECTION'].includes(error.code) ? 'failed' : 'unconfirmed', email_log_fail_reason: failureReason(error) }).eq('email_log_id',row.email_log_id))
        continue
      }
      checked(await db.from('email_log').update({ email_log_status: 'sent', email_log_sent_at: new Date().toISOString(), email_log_provider_id: outcome.messageId }).eq('email_log_id',row.email_log_id))
      sent++
    }
  } finally { transport.close() }
  return { sent }
}
module.exports = { officialEnv, trackSend, sendQueued }
