'use strict'
const { checked } = require('../subscriptions/service')
const { sendQueued } = require('./service')
const { loadInquiryRetryReasons } = require('./inquiryRetry')
module.exports = function registerEmailRoutes(app) {
  async function outcome(original, sourceId, response = {}) {
    const result = await app.supabase.from('email_log').select('email_log_id,email_log_status,email_log_fail_reason')
      .eq('email_log_source_type', original.email_log_source_type).eq('email_log_source_id', String(sourceId))
      .gt('email_log_id', original.email_log_id).order('email_log_id', { ascending: false }).limit(1).maybeSingle()
    const row = checked(result)
    return { ...response, attemptId: row?.email_log_id, attempt: row ? { status: row.email_log_status, reason: row.email_log_fail_reason } : null }
  }
  app.get('/api/email-logs/:id/status', async request => {
    const row = checked(await app.supabase.from('email_log').select('email_log_status,email_log_fail_reason').eq('email_log_id', request.params.id).single())
    return { status: row.email_log_status, reason: row.email_log_fail_reason }
  })
  app.get('/api/email-logs', async () => {
    const rows = checked(await app.supabase.from('email_log').select('*').order('email_log_created_at', { ascending: false }).limit(1000))
    const malls = checked(await app.supabase.from('mall').select('mall_id,mall_name'))
    const actors = checked(await app.supabase.from('admin').select('admin_id,admin_full_name'))
    const retryReasons = await loadInquiryRetryReasons(app.supabase, rows)
    return rows.map(r => ({ id: r.email_log_id, timestamp: new Date(r.email_log_sent_at || r.email_log_created_at).toLocaleString('en-US',{timeZone:'Asia/Manila'}), recipient: r.email_log_to_email,
      mall: malls.find(m => m.mall_id===r.mall_id)?.mall_name || 'Internal', type: r.email_log_type, triggeredBy: actors.find(a => a.admin_id===r.email_log_triggered_by)?.admin_full_name || 'System (automated)',
      status: ['queued','pending','sending'].includes(r.email_log_status) ? 'pending' : r.email_log_status, body: r.email_log_body, failReason: r.email_log_fail_reason, sender: r.email_log_sender,
      canResend: ['failed','unconfirmed'].includes(r.email_log_status) && !retryReasons.get(r.email_log_id), retryUnavailableReason: retryReasons.get(r.email_log_id) || null, sourceType: r.email_log_source_type, attemptOf: r.email_log_attempt_of,
    }))
  })
  app.post('/api/email-logs/:id/resend', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const r = checked(await app.supabase.from('email_log').select('*').eq('email_log_id', request.params.id).single())
    if (!['failed','unconfirmed'].includes(r.email_log_status)) return reply.code(409).send({ message: 'Only failed or unconfirmed messages can be retried.' })
    if (r.email_log_status==='unconfirmed' && request.body?.acknowledged!==true) return reply.code(409).send({ message: 'Confirm you checked the sending mailbox before retrying an uncertain send.' })
    if (r.email_log_source_type==='account') {
      const target = Number(r.email_log_source_id)
      if (!Number.isSafeInteger(target)) return reply.code(409).send({ message: 'Resend through Account Management to generate a fresh link.' })
      const action = r.email_log_type==='password_reset' ? 'reset-password' : 'resend-invite'
      const response = await app.inject({ method:'POST',url:`/api/admin-accounts/${target}/${action}`,headers:{authorization:request.headers.authorization} })
      if (response.statusCode >= 400) return reply.code(response.statusCode).send(response.json())
      return outcome(r, target, response.json())
    }
    if (r.email_log_source_type==='inquiry') {
      const history=checked(await app.supabase.from('email_log').select('*').eq('email_log_source_type','inquiry').eq('email_log_source_id',r.email_log_source_id))
      const reasons=await loadInquiryRetryReasons(app.supabase,history)
      const reason=reasons.get(r.email_log_id)
      if(reason) return reply.code(409).send({message:reason})
      const response=await app.inject({method:'POST',url:`/api/inquiry-messages/${Number(r.email_log_source_id)}/retry`,headers:{authorization:request.headers.authorization},payload:{acknowledged:request.body?.acknowledged}})
      if (response.statusCode >= 400) return reply.code(response.statusCode).send(response.json())
      const body = response.json()
      return outcome(r, body.messageId || r.email_log_source_id, body)
    }
    const row = checked(await app.supabase.from('email_log').insert({ email_log_type:r.email_log_type,email_log_to_email:r.email_log_to_email,email_log_subject:r.email_log_subject,email_log_body:r.email_log_body,email_log_status:'queued',email_log_sent_at:null,email_log_attempt_of:r.email_log_id,email_log_triggered_by:request.admin.id,mall_id:r.mall_id,email_log_source_type:r.email_log_source_type,email_log_source_id:r.email_log_source_id }).select('email_log_id').single())
    await sendQueued(app.supabase, process.env, { ids: [row.email_log_id] })
    const sent = checked(await app.supabase.from('email_log').select('email_log_status,email_log_fail_reason').eq('email_log_id',row.email_log_id).single())
    return { attemptId:row.email_log_id, attempt:{status:sent.email_log_status,reason:sent.email_log_fail_reason}, message:'A new delivery attempt was recorded. The previous attempt is preserved.' }
  })
}
