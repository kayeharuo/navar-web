const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const template = readFileSync(join(__dirname, '../../email_template/inquiry/index.html'), 'utf8')
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const lines = value => escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')
const imageNames = ['navar-icon-png.png','navar-wordmark-png.png','inbox-icon.png','fb-icon.png','twitter-icon.png','linkedin-icon.png']
// Bundle images with the server: sending must not depend on a storage download.
const brandingAttachments = imageNames.map(filename => {
 const content = readFileSync(join(__dirname, '../../email_template/inquiry/images', filename))
 if (!content.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) throw new Error(`Invalid bundled inquiry image: ${filename}`)
 return {filename,content,contentType:'image/png',contentDisposition:'inline',cid:`inquiry-${filename}@navar`}
})

function messageDate(value) {
 const date = value ? new Date(value) : null
 return date && !Number.isNaN(date.getTime())
  ? date.toLocaleString('en-PH', {timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
  : 'Date not recorded'
}
function conversation({row,message,senderName,sentAt,mallMessage}) {
 const bubble = (name, body, admin, date) => `<tr><td align="${admin ? 'left' : 'right'}" style="padding:0 0 20px;">
 <table role="presentation" cellpadding="0" cellspacing="0" width="92%" style="width:92%;table-layout:fixed;"><tr><td class="bubble" style="padding:18px;border:1px solid ${admin ? '#e2e8f0' : '#b5dff7'};border-radius:14px;background:${admin ? '#f8fafc' : '#e1f3ff'};color:#243746;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;">
 <p style="margin:0 0 12px;font-size:14px;font-weight:bold;">${escapeHtml(name)} <span style="font-size:12px;font-weight:normal;color:#526579;">&middot; ${admin ? 'NavAR Admin' : 'Mall representative'}</span></p>
 <p style="margin:0;font-size:16px;line-height:1.6;">${lines(body)}</p>
 <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#526579;">${escapeHtml(messageDate(date))}</p>
 </td></tr></table></td></tr>`
 return bubble(row.inquiry_contact_person || row.inquiry_mall_name,mallMessage?.i_message_message || row.inquiry_mall_description || 'No message was provided.',false,mallMessage?.i_message_sent_at || row.inquiry_created_at)
  + bubble(senderName || 'NavAR Team',message,true,sentAt)
}

function inquiryEmail({ row, message, link, linkKind, env, sentAt, senderName, replyTo, mallMessage }) {
 const branding = new URL('/storage/v1/object/public/branding', env.SUPABASE_URL)
 const sender = replyTo || env.SMTP_FROM || env.SMTP_USER
 if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(sender || '')) throw new Error('Invalid inquiry reply recipient')
 // Keep @ literal for mail clients that fail to populate percent-encoded recipients.
 const recipient = encodeURIComponent(sender).replace(/%40/gi, '@')
 let action = `mailto:${recipient}?subject=${encodeURIComponent(`Re: NavAR inquiry: ${row.inquiry_mall_name}`)}`
 if (link) {
  const url = new URL(link)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid owner setup URL')
  action = url.href
 }
 const values = {
  BRANDING_URL: escapeHtml(branding.href),
  CONTACT_NAME: escapeHtml(row.inquiry_contact_person || row.inquiry_mall_name),
  MALL_NAME: escapeHtml(row.inquiry_mall_name),
  CONVERSATION: conversation({row,message,senderName,sentAt,mallMessage}),
  ACTION_URL: escapeHtml(action),
  ACTION_LABEL: link ? (linkKind==='corrections'?'Update inquiry details':'Complete account setup') : 'Reply to NavAR',
  ACTION_DESCRIPTION: link ? (linkKind==='corrections'?'Update your saved inquiry using this secure link. It expires in 72 hours and can be submitted once.':'Use the button below to securely complete your owner account setup.') : 'You can reply to this email if you have questions about your inquiry.',
  YEAR: String(new Date().getFullYear()),
 }
 return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  if (!(key in values)) throw new Error(`Unknown inquiry email placeholder: ${key}`)
  return values[key]
 })
}
async function inquiryEmailParts(input) {
 let html = inquiryEmail(input)
 const base = new URL('/storage/v1/object/public/branding/', input.env.SUPABASE_URL)
 const attachments = brandingAttachments.map(image => ({...image}))
 for (const image of attachments) html = html.split(escapeHtml(new URL(image.filename,base).href)).join(`cid:${image.cid}`)
 return {html,attachments}
}
module.exports = { inquiryEmail, inquiryEmailParts }
