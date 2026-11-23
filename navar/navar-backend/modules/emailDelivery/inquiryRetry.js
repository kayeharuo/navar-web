'use strict'
const { checked } = require('../subscriptions/service')
function retryReason(log, message, latest, inquiry, owner, setup) {
  if (!message) return 'The original inquiry message is no longer available.'
  if (latest && Number(latest.email_log_id) > Number(log.email_log_id) && ['sent','pending','queued','sending'].includes(latest.email_log_status)) {
    return latest.email_log_status === 'sent'
      ? 'A newer delivery attempt for this inquiry message was already accepted by the mail server. This row is the historical unconfirmed or failed attempt.'
      : 'A newer delivery attempt is already queued or sending. Check that attempt before resending.'
  }
  if (message.i_message_delivery_status === 'sent') return 'This inquiry message has since been accepted by the mail server. The earlier attempt remains in the history.'
  if (['pending','sending'].includes(message.i_message_delivery_status)) return 'This inquiry message is already queued or sending. Wait for its delivery result.'
  if (['convert','reissue'].includes(message.i_message_kind)) {
    if (!owner || owner.admin_is_deactivated || owner.admin_account_status !== 'partial' || !setup || setup.setup_completed_at) {
      return 'The owner has already completed account setup or is no longer eligible for a setup invitation. If they need access, use Password Reset in Account Management.'
    }
  }
  if (['correction','corrections'].includes(message.i_message_kind) && (inquiry?.mall_id || ['approved','converted','rejected'].includes(String(inquiry?.inquiry_status).toLowerCase()))) {
    return 'This inquiry has been finalized, so its correction link can no longer be reissued.'
  }
  if (!['failed','unconfirmed','not_recorded'].includes(message.i_message_delivery_status)) return 'The inquiry delivery status changed. Refresh Email Logs before retrying.'
  return null
}
async function loadInquiryRetryReasons(db, logs) {
  const relevant = logs.filter(l => l.email_log_source_type === 'inquiry')
  if (!relevant.length) return new Map()
  const ids = [...new Set(relevant.map(l=>Number(l.email_log_source_id)).filter(id=>Number.isSafeInteger(id)&&id>0))]
  if (!ids.length) return new Map(relevant.map(l=>[l.email_log_id,'The original inquiry message is unavailable.']))
  const messages = checked(await db.from('inquiry_message').select('i_message_id,inquiry_id,i_message_kind,i_message_delivery_status').in('i_message_id',ids))
  const inquiryIds = [...new Set(messages.map(m=>m.inquiry_id))]
  const inquiries = inquiryIds.length ? checked(await db.from('inquiry').select('inquiry_id,mall_id,inquiry_contact_email,inquiry_status').in('inquiry_id',inquiryIds)) : []
  const mallIds = [...new Set(inquiries.map(i=>i.mall_id).filter(Boolean))]
  const owners = mallIds.length ? checked(await db.from('admin').select('admin_id,mall_id,admin_email,admin_is_deactivated,admin_account_status').in('mall_id',mallIds).eq('admin_role','mall_admin').eq('admin_is_primary',true)) : []
  const setups = owners.length ? checked(await db.from('mall_admin_account').select('admin_id,setup_completed_at').in('admin_id',owners.map(o=>o.admin_id))) : []
  const latest = new Map()
  for (const log of relevant) {
    const previous=latest.get(log.email_log_source_id)
    if (!previous || Number(log.email_log_id)>Number(previous.email_log_id)) latest.set(log.email_log_source_id,log)
  }
  return new Map(relevant.map(log=>{
    const message=messages.find(m=>String(m.i_message_id)===String(log.email_log_source_id))
    const inquiry=inquiries.find(i=>i.inquiry_id===message?.inquiry_id)
    const owner=owners.find(o=>o.mall_id===inquiry?.mall_id&&o.admin_email?.toLowerCase()===inquiry?.inquiry_contact_email?.toLowerCase())
    return [log.email_log_id,retryReason(log,message,latest.get(log.email_log_source_id),inquiry,owner,setups.find(s=>s.admin_id===owner?.admin_id))]
  }))
}
module.exports = { retryReason, loadInquiryRetryReasons }
