const {threadWriteState}=require('../applicationManagement/threadPolicy')
'use strict'
const crypto=require('node:crypto')
const {serializeMessages}=require('../applicationManagement/routes')
const {parseImageDataUrl,MAX_THREAD_IMAGES_PER_MESSAGE,MAX_THREAD_IMAGE_BYTES,MAX_THREAD_TOTAL_BYTES}=require('../storage/attachmentValidation')
const {uploadImage}=require('../storage/imageStorage')
const reviewStatus=status=>status==='completed'?'Approved':status==='revision'?'For Revision':status==='submitted'?'Submitted':title(status)
const title=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const checked=result=>{if(result.error)throw result.error;return result.data}
const wrap=fn=>async(req,reply)=>{try{return await fn(req,reply)}catch(e){req.log.warn({code:e.code,message:e.message},'Stall application request failed');return reply.code(e.code==='42501'?403:['P0001','40001','22023','23505','23514'].includes(e.code)?409:500).send({message:['P0001','40001','22023','23505','23514','42501'].includes(e.code)?e.message:'Unable to complete the stall application action.'})}}
async function list(db){
 const [entries,malls,services]=await Promise.all([
  db.from('stall_expansion').select('*').order('id',{ascending:false}),db.from('mall').select('mall_id,mall_name,mall_city'),db.from('mall_service_request').select('service_id,quote,payment_request_id'),
 ]).then(rows=>rows.map(checked))
 return entries.filter(e=>['submitted','revision','approved','completed'].includes(e.status)).sort((a,b)=>(Date.parse(b.submitted_at||b.created_at)||0)-(Date.parse(a.submitted_at||a.created_at)||0)||b.stall_application_id-a.stall_application_id).map(e=>{
  const mall=malls.find(m=>m.mall_id===e.mall_id),service=services.find(s=>s.service_id===e.service_id)
  return {id:e.stall_application_id,expansionId:e.id,mallId:e.mall_id,mallName:mall?.mall_name||'Mall',city:mall?.mall_city,submittedStalls:service?.quote?.quantity||0,fee:Number(service?.quote?.amount_cent||0)/100,applicationStatus:reviewStatus(e.status),submittedDate:e.submitted_at,lastUpdated:e.updated_at,revision:e.revision}
 })
}
module.exports=function registerStallApplicationRoutes(app){
 const db=app.supabase
 app.get('/api/stall-applications',wrap(()=>list(db)))
 app.get('/api/stall-portal/malls',wrap(async()=>{
  const [malls,contracts,developments,applications,admins,suspensions]=await Promise.all([
   db.from('mall').select('mall_id,mall_name'),db.from('contract').select('contract_id,mall_id,contract_status,contract_start,contract_end').eq('contract_is_current',true),
   db.from('ar_development').select('application_id').eq('ar_development_status','live'),db.from('application').select('application_id,mall_id'),db.from('admin').select('mall_id').eq('admin_role','mall_admin').eq('admin_account_status','official').eq('admin_is_deactivated',false),db.from('suspension').select('contract_id').is('suspension_lifted_at',null),
  ]).then(rows=>rows.map(checked))
  const now=Date.now()
  return malls.filter(m=>admins.some(a=>a.mall_id===m.mall_id)&&contracts.some(c=>c.mall_id===m.mall_id&&c.contract_status.toLowerCase()==='active'&&new Date(c.contract_start)<=now&&new Date(c.contract_end)>now&&!suspensions.some(s=>s.contract_id===c.contract_id))&&developments.some(d=>applications.some(a=>a.application_id===d.application_id&&a.mall_id===m.mall_id)))
 }))
 app.get('/api/stall-portal/:mallId',wrap(async req=>{const data=checked(await db.rpc('stall_application_portal',{p_actor:req.admin.id,p_mall:Number(req.params.mallId),p_action:'context',p_data:{}}));data.applications=await Promise.all((data.applications||[]).map(async e=>({...e,threadReadOnly:(await threadWriteState(db,req.admin.id,'stall',e.stall_application_id)).readOnly})));return data}))
 app.post('/api/stall-portal/:mallId/:action',{bodyLimit:8*1024*1024,schema:{params:{type:'object',required:['mallId','action'],properties:{mallId:{type:'integer',minimum:1},action:{enum:['prepare','pay','save-floor','submit','cancel','confirm','message']}}}}},wrap(req=>db.rpc('stall_application_portal',{p_actor:req.admin.id,p_mall:Number(req.params.mallId),p_action:req.params.action,p_data:req.body||{}}).then(checked)))
 async function entry(id){const e=checked(await db.from('stall_expansion').select('*').eq('stall_application_id',id).single());return e}
 app.get('/api/stall-applications/:id',wrap(async req=>{
  const e=await entry(Number(req.params.id))
  const detail=checked(await db.rpc('get_stall_expansion_review',{p_id:e.id,p_actor:req.admin.id}))
  const permission=await threadWriteState(db,req.admin.id,'stall',e.stall_application_id)
  const thread=await loadThread(e.stall_application_id)
  return {...detail,threadReadOnly:permission.readOnly,id:e.stall_application_id,expansionId:e.id,thread:thread.messages,applicationStatus:reviewStatus(e.status)}
 }))
 for(const action of ['approve','revision']) app.post(`/api/stall-applications/:id/${action}`,{schema:{body:{type:'object',additionalProperties:false,required:['revision'],properties:{revision:{type:'integer',minimum:0},note:{type:'string',maxLength:3000}}}}},wrap(async req=>{
  const e=await entry(Number(req.params.id))
  const result=checked(await db.rpc('review_stall_expansion',{p_id:e.id,p_actor:req.admin.id,p_action:action,p_revision:req.body.revision,p_note:req.body.note||''}))
  return {...result,message:action==='approve'?'Stalls approved. The AR is now in Node Mapping.':'Corrections requested. The mall can update its stall details.'}
 }))
 async function loadThread(applicationId){
  const threads=checked(await db.from('thread').select('thread_id').eq('s_application_id',applicationId).order('thread_id'))
  const messages=threads.length?checked(await db.from('thread_message').select('*').in('thread_id',threads.map(t=>t.thread_id)).order('message_sent_at')):[]
  return {threadId:threads[0]?.thread_id||null,messages:await serializeMessages(db,messages)}
 }
 app.get('/api/stall-applications/:id/thread',wrap(async req=>{const permission=await threadWriteState(db,req.admin.id,'stall',Number(req.params.id));return {...await loadThread(Number(req.params.id)),threadReadOnly:permission.readOnly}}))
 app.post('/api/stall-applications/:id/thread',{bodyLimit:30*1024*1024},wrap(async req=>{
  const e=await entry(Number(req.params.id))
  const permission=await threadWriteState(db,req.admin.id,'stall',e.stall_application_id)
  if(permission.readOnly)throw {code:'P0001',message:'A newer version exists. This thread is read-only.'}
  const content=String(req.body?.content||'').trim(),attachments=req.body?.attachments||[]
  if((!content&&!attachments.length)||content.length>10000||!Array.isArray(attachments)||attachments.length>MAX_THREAD_IMAGES_PER_MESSAGE)throw {code:'P0001',message:'Enter a message and attach no more than five images.'}
  const parsed=attachments.map(a=>({...a,file:parseImageDataUrl(a.dataUrl)}))
  if(parsed.some(a=>!a.file||a.file.size>MAX_THREAD_IMAGE_BYTES)||parsed.reduce((n,a)=>n+a.file.size,0)>MAX_THREAD_TOTAL_BYTES)throw {code:'P0001',message:'Images must be PNG, JPEG or WebP, up to 5 MB each and 20 MB in total.'}
  const threads=checked(await db.from('thread').select('thread_id').eq('s_application_id',e.stall_application_id).order('thread_id').limit(1))
  if(!threads[0])throw {code:'P0001',message:'The application thread is unavailable.'}
  const message=checked(await db.from('thread_message').insert({thread_id:threads[0].thread_id,message_sender:req.admin.id,message_sender_type:'admin',message_content:content,message_sent_at:new Date().toISOString()}).select('*').single())
  for(const a of parsed){
   const path=`thread-messages/${message.message_id}/${crypto.randomUUID()}.${a.file.mimeType.split('/')[1]}`
   await uploadImage(db,path,a.dataUrl)
   checked(await db.from('thread_message_attachment').insert({thread_message_id:message.message_id,thread_message_attachment_type:'image',thread_message_attachment_storage_path:path,thread_message_attachment_file_name:a.fileName||'Attachment',thread_message_attachment_mime_type:a.file.mimeType,thread_message_attachment_file_size:a.file.size,thread_message_attachment_created_at:new Date().toISOString(),thread_message_attachment_uploaded_by:req.admin.id}))
  }
  return (await serializeMessages(db,[message]))[0]
 }))
}
module.exports.list=list

module.exports.registerMall=function(app){
 const db=app.supabase
 app.get('/api/mall/stall-applications',wrap(async req=>{const data=checked(await db.rpc('stall_application_portal',{p_actor:req.admin.id,p_mall:req.admin.mallId,p_action:'context',p_data:{}}));data.applications=await Promise.all((data.applications||[]).map(async e=>({...e,threadReadOnly:(await threadWriteState(db,req.admin.id,'stall',e.stall_application_id)).readOnly})));return data}))
 app.post('/api/mall/stall-applications/:action',{bodyLimit:8*1024*1024,schema:{params:{type:'object',required:['action'],properties:{action:{enum:['prepare','save-floor','submit','cancel','confirm','message']}}}}},wrap(req=>db.rpc('stall_application_portal',{p_actor:req.admin.id,p_mall:req.admin.mallId,p_action:req.params.action,p_data:req.body||{}}).then(checked)))
}
