const nodemailer = require('nodemailer')
const { inquiryEmailParts } = require('./emailTemplate')
const {outgoingThread,sharedInbox}=require('./mailThread')
const {createInboxSync}=require('./inbox')
const {createOutbox}=require('./outbox')
const {createInquiryEvents}=require('./events')
const {registerFollowup}=require('./followup')
const { uuid, text, fail } = require('./validation')
const columns = 'inquiry_id,inquiry_mall_name,inquiry_mall_state,inquiry_mall_city,inquiry_mall_zip_code,inquiry_mall_address,inquiry_mall_floor_count,inquiry_mall_description,inquiry_contact_person,inquiry_contact_num,inquiry_contact_email,inquiry_interested_tier,inquiry_status,inquiry_created_at,inquiry_updated_at,inquiry_coverage_area,mall_id,inquiry_original_description,inquiry_has_revision,inquiry_reviewed_at,inquiry_rejection_reason'
const messageColumns = 'i_message_id,i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,i_message_kind,i_message_delivery_status'
const formatDate = value => value ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not recorded'
const mapMessage=m=>({id:m.i_message_id,sender:['admin','super_admin'].includes(m.i_message_sender_type)?'admin':'mall',senderName:m.i_message_sender_email,text:m.i_message_message,time:formatDate(m.i_message_sent_at),deliveryStatus:m.i_message_delivery_status})
function status(row) { return row.mall_id != null || ['approved','converted'].includes(String(row.inquiry_status).toLowerCase()) ? 'Approved' : row.inquiry_status || 'New' }
function mapInquiry(row, tiers) {
 const barangay=(row.inquiry_mall_address || '').match(/(?:^|,)\s*Barangay\s+([^,]+)/i)?.[1]?.trim() || ''
 const originalMessage=row.inquiry_has_revision ? row.inquiry_original_description : row.inquiry_mall_description
 const tier=tiers.find(t=>t.s_tier_key===row.inquiry_interested_tier)
 return {id:row.inquiry_id,mallName:row.inquiry_mall_name,contactPerson:row.inquiry_contact_person || '',email:row.inquiry_contact_email,phone:row.inquiry_contact_num || 'Not recorded',
  location:[row.inquiry_mall_address,row.inquiry_mall_city,row.inquiry_mall_state].filter(Boolean).join(', '),
  tier:tier?.s_tier_label || row.inquiry_interested_tier || 'Not selected',
  annualFee:tier?.s_tier_annual_fee == null ? 'Not selected' : `${new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(tier.s_tier_annual_fee)}/yr`,
  date:formatDate(row.inquiry_created_at),status:status(row),updatedAt:row.inquiry_updated_at,mallId:row.mall_id,
  reviewedAt:formatDate(row.inquiry_reviewed_at),rejectionReason:row.inquiry_rejection_reason || '',lastUpdated:formatDate(row.inquiry_updated_at),hasRevision:!!row.inquiry_has_revision,
  barangay,fullAddress:[row.inquiry_mall_address,row.inquiry_mall_city,row.inquiry_mall_state,row.inquiry_mall_zip_code].filter(Boolean).join(', '),
  description:row.inquiry_mall_description || '',province:row.inquiry_mall_state,city:row.inquiry_mall_city,address:row.inquiry_mall_address || '',zipCode:row.inquiry_mall_zip_code || '',floors:row.inquiry_mall_floor_count,mallCoverageArea:row.inquiry_coverage_area,
  messages:originalMessage ? [{id:`submission-${row.inquiry_id}`,sender:'mall',senderName:row.inquiry_contact_person || row.inquiry_mall_name,text:originalMessage,time:formatDate(row.inquiry_created_at)}] : []}
}
function check(result) { if (result.error) throw result.error; return result.data }
async function all(query) { const rows=[]; for(let offset=0;;offset+=500) { const batch=check(await query().range(offset,offset+499)); rows.push(...batch); if(batch.length<500) return rows } }
function mailTransport(env) {
 if (!env.SMTP_USER || !env.SMTP_PASS) { const e=new Error('Configure backend SMTP_USER and SMTP_PASS before sending inquiry emails.'); e.statusCode=503; throw e }
 return nodemailer.createTransport({pool:true,maxConnections:2,maxMessages:100,host:env.SMTP_HOST || 'smtp.gmail.com',port:Number(env.SMTP_PORT || 465),secure:(env.SMTP_SECURE || 'true')==='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:60000})
}
function deliveryFailure(error) {
 if (error.code==='EAUTH') return 'Email was not sent: the mail provider rejected the backend SMTP credentials.'
 if (error.code==='EENVELOPE') return 'Email was not sent: the mail provider rejected the sender or recipient address.'
 if (error.command==='CONN' || ['EDNS','ECONNECTION'].includes(error.code)) return 'Email was not sent: the backend could not connect to the mail server.'
 return 'Email delivery could not be confirmed. Check the sending mailbox before resending this reply.'
}
async function verifyTransport(transport) {
 try { await transport.verify() }
 catch (cause) {
  const error=new Error(`Reply not sent. ${deliveryFailure(cause)} Check the backend mail configuration and try again.`)
  error.statusCode=503; error.code=cause.code; throw error
 }
}
module.exports = function registerInquiryRoutes(app, {env=process.env, transportFactory=mailTransport}={}) {
 const db=app.supabase
 const events=createInquiryEvents()
 const inbox=createInboxSync({db,env,log:app.log,onImport:id=>events.publish(id)})
 app.addHook('preClose',async()=>{events.close()})
 app.addHook('onReady',async()=>{inbox.start();outbox.start()})
 let sharedTransport
 const getTransport=()=>sharedTransport || (sharedTransport=transportFactory(env))
 app.addHook('onClose',async()=>{await inbox.stop();await outbox.stop();sharedTransport?.close?.()})
 const inquiry=async id=>{ if(!/^[1-9]\d*$/.test(String(id))) fail('Invalid inquiry ID.'); const row=check(await db.from('inquiry').select(columns).eq('inquiry_id',id).maybeSingle()); if(!row) {const e=new Error('Inquiry not found.');e.statusCode=404;throw e} return row }
 const wrap=fn=>async(req,reply)=>{ try {reply.header('Cache-Control','no-store');return await fn(req,reply)} catch(e) {
  req.log.error({code:e.code || 'INQUIRY_ERROR',action:req.routeOptions.url},'Inquiry operation failed')
  const schema=['42703','42P01','42883','PGRST202','PGRST204'].includes(e.code)
  if(schema)req.log.error({code:e.code,message:e.message},'Inquiry schema mismatch')
  return reply.code(e.statusCode || (schema?503:e.code==='40001'?409:e.code==='42501'?403:e.code==='P0002'?404:e.code==='P0001'?400:500)).send({message:schema?`Inquiry database schema mismatch (${e.code}). Check the backend log for the affected column or function.`:e.statusCode || e.code==='40001' || e.code==='P0001'?e.message:'Unable to complete the inquiry request. Please try again.'})
 }}
 const rpc=async(req,action,data,requestId=null)=>check(await db.rpc('manage_super_admin_inquiry',{p_id:Number(req.params.id),p_actor:req.admin.id,p_action:action,p_data:data,p_request:requestId}))
 async function deliver(req,row,result,transport,link,linkKind) {
  // Claim once across backend processes. Never auto-resend an uncertain SMTP result.
  const claimed=check(await db.from('inquiry_message').update({i_message_delivery_status:'sending'}).eq('i_message_id',result.message_id).eq('i_message_delivery_status','pending').select('i_message_id,i_message_message,i_message_sent_at,i_message_sender_email,i_message_request_id'))
  if (!claimed.length) {
   const message=check(await db.from('inquiry_message').select('i_message_delivery_status').eq('i_message_id',result.message_id).single())
   return message.i_message_delivery_status==='sent' ? null : 'The reply is saved, but email delivery is not confirmed. It has not been sent again.'
  }
  let accepted=false
  let deliveryStage='preparation'
  try {
   const {replyTo,messageId}=outgoingThread(env,claimed[0].i_message_request_id)
   // Pair this reply with the latest owner message saved before it. A later owner
   // message arriving while SMTP is queued must not change what this reply answers.
   const mallMessage=check(await db.from('inquiry_message').select('i_message_id,i_message_message,i_message_sent_at,i_message_email_id')
    .eq('inquiry_id',row.inquiry_id).eq('i_message_sender_type','mall').lt('i_message_id',claimed[0].i_message_id)
    .order('i_message_id',{ascending:false}).limit(1).maybeSingle())
   const email=await inquiryEmailParts({row,message:claimed[0].i_message_message,sentAt:claimed[0].i_message_sent_at,senderName:req.admin.name,replyTo,link,linkKind,env,mallMessage})
   // Link the response to the received email so Gmail can group both sides.
   // Imported Message-IDs are untrusted input: accept a single bounded ID only.
   const parentId=mallMessage?.i_message_email_id
   if (typeof parentId==='string' && parentId.length<=998 && /^<[^<>\s]+@[^<>\s]+>$/.test(parentId)) {
    email.inReplyTo=parentId
    email.references=[parentId]
   }
   deliveryStage='smtp'
   const sent=await transport.sendMail({from:{name:env.SMTP_FROM_NAME || 'NavAR',address:sharedInbox(env)},to:row.inquiry_contact_email,replyTo,messageId,subject:`NavAR inquiry: ${row.inquiry_mall_name}`,...email,text:claimed[0].i_message_message+`\n\nReply to: ${replyTo}\n\nYour inquiry INQ-${row.inquiry_id}\nMall: ${row.inquiry_mall_name}\nYour latest message:\n${mallMessage?.i_message_message || row.inquiry_mall_description || 'No message was provided.'}`+(link?`\n\n${linkKind==='corrections'?'Update your inquiry':'Complete your account setup'}: ${link}`:'' )})
   if (!sent.accepted?.length) throw new Error('SMTP did not accept recipient')
   accepted=true
   deliveryStage='recording'
   check(await db.from('inquiry_message').update({i_message_delivery_status:'sent',i_message_delivered_at:new Date().toISOString()}).eq('i_message_id',result.message_id))
   events.publish(row.inquiry_id)
   return null
  } catch (error) {
   // SMTP acceptance and database persistence are separate outcomes. Never call a
   // database update failure a send failure, or automatically retry an accepted mail.
   const statusUpdate=await db.from('inquiry_message').update(accepted
    ? {i_message_delivery_status:'sent',i_message_delivered_at:new Date().toISOString()}
    : {i_message_delivery_status:'unconfirmed'}).eq('i_message_id',result.message_id)
   events.publish(row.inquiry_id)
   req.log.warn({inquiryId:row.inquiry_id,messageId:result.message_id,smtpAccepted:accepted,deliveryStage,
    code:error.code,responseCode:error.responseCode,command:error.command,statusUpdateCode:statusUpdate.error?.code},'Inquiry delivery or status update failed')
   if (accepted) return statusUpdate.error ? 'The mail server accepted your reply, but its delivery status could not be saved. Do not resend it.' : null
   return deliveryStage==='preparation'
    ? 'Request saved, but the email could not be prepared and was not sent. Check the backend delivery log before reissuing.'
    : `Request saved. ${deliveryFailure(error)}`
  }
 }
 const outbox=createOutbox({log:app.log,
  listPending:async()=>check(await db.from('inquiry_message').select('i_message_id,inquiry_id,i_message_admin_id,i_message_sender_email')
   .eq('i_message_kind','reply').eq('i_message_delivery_status','pending').order('i_message_id').limit(20)),
  send:async message=>{
   const row=await inquiry(message.inquiry_id)
   const actor=message.i_message_admin_id?check(await db.from('admin').select('admin_full_name').eq('admin_id',message.i_message_admin_id).maybeSingle()):null
   await deliver({admin:{name:actor?.admin_full_name || 'NavAR Team'},log:app.log},row,{message_id:message.i_message_id},getTransport())
  }})
 app.get('/api/inquiries/events',(req,reply)=>events.open(req,reply))
 app.get('/api/inquiries',wrap(async()=>{
  const [rows,tiers]=await Promise.all([all(()=>db.from('inquiry').select(columns).order('inquiry_created_at',{ascending:false}).order('inquiry_id',{ascending:false})),all(()=>db.from('subscription_tier').select('s_tier_key,s_tier_label,s_tier_annual_fee').order('s_tier_id'))])
  return {inquiries:rows.map(row=>mapInquiry(row,tiers))}
 }))
 app.get('/api/inquiries/:id/messages',wrap(async req=>{
  const row=await inquiry(req.params.id)
  const rows=await all(()=>db.from('inquiry_message').select(messageColumns).eq('inquiry_id',row.inquiry_id).order('i_message_sent_at').order('i_message_id'))
  const {tier,annualFee,...currentInquiry}=mapInquiry(row,[])
  return {currentInquiry,inboxSync:{enabled:inbox.state.enabled,lastCheckedAt:inbox.state.lastCheckedAt,warning:inbox.state.error},messages:rows.map(mapMessage)}
 }))
 app.patch('/api/inquiries/:id/status',wrap(async req=>{
  await inquiry(req.params.id)
  if (!['New','In Progress'].includes(req.body?.status)) fail('Use Approve & Invite or Reject to decide an inquiry.')
  await rpc(req,'status',{status:req.body.status,updatedAt:req.body.updatedAt})
  return {ok:true}
 }))
 app.post('/api/inquiries/:id/replies', {bodyLimit:20000},wrap(async (req,reply)=>{
  const row=await inquiry(req.params.id), requestId=uuid(req.body?.requestId), message=text(req.body?.text,4000)
  // sendMail authenticates the pooled connection itself. A separate verify here
  // repeats the network handshake without providing a delivery guarantee.
  getTransport()
  sharedInbox(env)
  const result=await rpc(req,'reply',{text:message},requestId)
  const [saved,current]=await Promise.all([
   db.from('inquiry_message').select(messageColumns).eq('i_message_id',result.message_id).single().then(check),
   inquiry(row.inquiry_id),
  ])
  // Respond after persistence, without waiting for SMTP or branding downloads.
  // Pending rows survive a restart; ambiguous sends are never automatically retried.
  setImmediate(()=>{void outbox.kick()})
  events.publish(row.inquiry_id)
  reply.code(202)
  return {ok:true,message:mapMessage(saved),status:status(current),updatedAt:current.inquiry_updated_at}
 }))
 app.post('/api/inquiries/:id/reject',{bodyLimit:20000},wrap(async(req,reply)=>{
  const row=await inquiry(req.params.id),requestId=uuid(req.body?.requestId),reason=text(req.body?.reason,3000)
  getTransport();sharedInbox(env)
  const result=check(await db.rpc('review_super_admin_inquiry',{p_id:row.inquiry_id,p_actor:req.admin.id,p_action:'reject',p_request:requestId,p_data:{reason,updatedAt:req.body.updatedAt}}))
  setImmediate(()=>{void outbox.kick()});events.publish(row.inquiry_id)
  reply.code(202)
  return {ok:true,messageId:result.message_id}
 }))
 const approve=wrap(async req=>{
  const row=await inquiry(req.params.id), requestId=uuid(req.body?.requestId)
  const existing=check(await db.from('inquiry_message').select('i_message_id,i_message_delivery_status').eq('i_message_request_id',requestId).eq('inquiry_id',row.inquiry_id).eq('i_message_admin_id',req.admin.id).eq('i_message_kind','convert').maybeSingle())
  if (existing) return {ok:true,mallId:row.mall_id,warning:existing.i_message_delivery_status==='sent'?null:'Conversion is saved; invitation delivery is not confirmed. No duplicate invitation was sent.'}
  if (row.mall_id || ['approved','converted','rejected'].includes(String(row.inquiry_status).toLowerCase())) fail('This inquiry is already finalized.')
  const transport=getTransport()
  await verifyTransport(transport)
  const origin=env.MALL_ADMIN_ORIGIN || (env.NODE_ENV==='production'?null:'http://localhost:5174')
  if (!origin || !env.INQUIRY_REFUND_TERMS || !env.INQUIRY_FEE_DETAILS) {const e=new Error('Configure MALL_ADMIN_ORIGIN, INQUIRY_REFUND_TERMS and INQUIRY_FEE_DETAILS before converting inquiries.');e.statusCode=503;throw e}
  const redirect=new URL('/complete-setup',origin)
  if (redirect.protocol!=='https:' && !['localhost','127.0.0.1'].includes(redirect.hostname)) fail('The owner setup URL must use HTTPS.')
  const profile=check(await db.from('admin').select('admin_id').eq('admin_email',row.inquiry_contact_email.toLowerCase()).maybeSingle())
  if(profile) fail('This contact already has an admin account. Use a separate owner email.')
  // generateLink prepares identity/link but sends no email before the transaction commits.
  let generated=await db.auth.admin.generateLink({type:'invite',email:row.inquiry_contact_email,options:{redirectTo:redirect.href}})
  if(generated.error && ['email_exists','user_already_exists'].includes(generated.error.code)) generated=await db.auth.admin.generateLink({type:'magiclink',email:row.inquiry_contact_email,options:{redirectTo:redirect.href}})
  if(generated.error || !generated.data?.user?.id || !generated.data?.properties?.action_link) {const e=new Error('Unable to prepare the owner setup link. Check Supabase Auth configuration.');e.statusCode=503;throw e}
  const result=check(await db.rpc('review_super_admin_inquiry',{p_id:row.inquiry_id,p_actor:req.admin.id,p_action:'approve',p_request:requestId,p_data:{updatedAt:req.body.updatedAt,acknowledgeDuplicates:req.body.acknowledgeDuplicates===true,authUserId:generated.data.user.id,offer:{refund_terms:env.INQUIRY_REFUND_TERMS,fee_details:env.INQUIRY_FEE_DETAILS}}}))
  return {ok:true,mallId:result.mall_id,warning:await deliver(req,row,result,transport,generated.data.properties.action_link)}
 })
 app.post('/api/inquiries/:id/approve',{bodyLimit:20000},approve)
 // Keep older clients compatible while ignoring editable mall details.
 app.post('/api/inquiries/:id/convert',{bodyLimit:20000},approve)
 registerFollowup(app,{db,env,wrap,inquiry,deliver,getTransport,events})
}
module.exports.mapInquiry=mapInquiry
module.exports.deliveryFailure=deliveryFailure
