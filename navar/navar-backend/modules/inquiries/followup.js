const {randomBytes,createHash}=require('node:crypto')
const {uuid,text,fail}=require('./validation')
const check=r=>{if(r.error)throw r.error;return r.data}
const hashToken=token=>createHash('sha256').update(token).digest('hex')
function correctionFields(input) {
 if(!input || typeof input!=='object' || Array.isArray(input))fail('Invalid inquiry details.')
 const fields={}
 for(const [key,max,required] of [['mallName',100,true],['contactPerson',100,true],['phone',30,true],['province',50,true],['city',50,true],['address',200,true],['zipCode',10,false],['description',3000,false],['coverageArea',150,false]])fields[key]=text(input[key],max,required)
 if(!/^\+?[0-9 ()-]{7,30}$/.test(fields.phone))fail('Enter a valid contact number.')
 if(!Number.isInteger(input.floors) || input.floors<1 || input.floors>300)fail('Enter a floor count from 1 to 300.')
 // Keep the current database address contract, including on installations
 // where the generated barangay column migration has not yet been applied.
 if(Object.hasOwn(input,'barangay')) {
  const barangay=text(input.barangay,100,true)
  if(barangay.includes(','))fail('Enter only the barangay name, without commas.')
  const address=fields.address.replace(/(?:^|,)\s*Barangay\s+[^,]+/gi,'').replace(/^,\s*/, '').trim()
  fields.address=text(`${address}, Barangay ${barangay}`,200,true)
 }
 fields.floors=input.floors
 return fields
}
function safeOrigin(value,fallback,env) {
 const url=new URL(value || (env.NODE_ENV==='production'?'':fallback))
 if(url.username || url.password || (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))))fail('Configure an HTTPS public origin.')
 return url.origin
}
function registerFollowup(app,{db,env,wrap,inquiry,deliver,getTransport,events}) {
 const call=(req,action,data,request)=>{
  if(!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))fail('Invalid inquiry ID.')
  return db.rpc('inquiry_followup',{p_id:Number(req.params.id),p_actor:req.admin.id,p_action:action,p_data:data,p_request:request || null}).then(check)
 }
 app.get('/api/inquiries/followup',wrap(async req=>({summaries:check(await db.rpc('inquiry_followup_summary',{p_actor:req.admin.id}))})))
 app.get('/api/inquiries/:id/followup',wrap(async req=>{
  const row=await inquiry(req.params.id)
  const [notes,activity,deliveries,revisions]=await Promise.all([
   db.from('inquiry_note').select('id,body,actor_id,created_at').eq('inquiry_id',row.inquiry_id).order('id',{ascending:false}).limit(100).then(check),
   db.from('inquiry_activity').select('id,actor_id,action,details,created_at').eq('inquiry_id',row.inquiry_id).order('id',{ascending:false}).limit(100).then(check),
   db.from('inquiry_message').select('i_message_id,i_message_kind,i_message_delivery_status,i_message_sent_at,i_message_delivered_at').eq('inquiry_id',row.inquiry_id).in('i_message_kind',['convert','correction','reply']).order('i_message_id',{ascending:false}).limit(100).then(check),
   db.from('inquiry_correction').select('id,before_data,after_data,created_at,used_at,expires_at,revoked_at').eq('inquiry_id',row.inquiry_id).order('id',{ascending:false}).limit(100).then(check),
  ])
  const ids=[...new Set([...notes,...activity].map(n=>n.actor_id).filter(Boolean))]
  const actors=ids.length?check(await db.from('admin').select('admin_id,admin_full_name').in('admin_id',ids)):[]
  const name=id=>id?(actors.find(a=>a.admin_id===id)?.admin_full_name || 'NavAR Admin'):'Mall owner'
  // Include saved decisions predating the history trigger without inventing timestamps.
  const reviewed=check(await db.from('inquiry').select('inquiry_reviewed_by,inquiry_reviewed_at,inquiry_rejection_reason,inquiry_status').eq('inquiry_id',row.inquiry_id).single())
  if(reviewed.inquiry_reviewed_at && !activity.some(a=>['approved','converted','rejected'].includes(a.action.toLowerCase()))) {
   const actor=reviewed.inquiry_reviewed_by?check(await db.from('admin').select('admin_full_name').eq('admin_id',reviewed.inquiry_reviewed_by).maybeSingle()):null
   activity.push({id:'previous-decision',action:reviewed.inquiry_status,details:{reason:reviewed.inquiry_rejection_reason},created_at:reviewed.inquiry_reviewed_at,actorName:actor?.admin_full_name || 'NavAR Admin'})
  }
  return {notes:notes.map(n=>({...n,actorName:name(n.actor_id)})),activity:activity.map(a=>({...a,actorName:a.actorName || name(a.actor_id)})),deliveries,revisions}
 }))
 app.post('/api/inquiries/:id/read',wrap(async req=>{
  const id=req.body?.messageId
  if(!Number.isSafeInteger(id) || id<0)fail('Invalid message reference.')
  return call(req,'read',{messageId:id})
 }))
 app.post('/api/inquiries/:id/notes',{bodyLimit:20000},wrap(async req=>{
  const result=await call(req,'note',{text:text(req.body?.text,4000)},uuid(req.body?.requestId));events.publish(Number(req.params.id));return result
 }))
 app.post('/api/inquiries/:id/followup',{bodyLimit:20000},wrap(async req=>{
  const row=await inquiry(req.params.id),action=req.body?.action,request=uuid(req.body?.requestId)
  if(!['reissue','corrections'].includes(action))fail('Invalid follow-up action.')
  const transport=getTransport()
  const token=randomBytes(32).toString('hex')
  // Validate configuration before reserving a new delivery.
  const origin=action==='reissue'?safeOrigin(env.MALL_ADMIN_ORIGIN,'http://localhost:5174',env):safeOrigin(env.INQUIRY_PUBLIC_ORIGIN,'http://localhost:3000',env)
  const data={updatedAt:req.body.updatedAt,acknowledgeUncertain:req.body.acknowledgeUncertain===true,
   ...(action==='corrections'?{reason:text(req.body.reason,3000),tokenHash:hashToken(token)}:{})}
  const result=await call(req,action,data,request)
  if(result.replayed)return {ok:true,warning:'This request is already saved. Check its delivery history before issuing another link.'}
  try {
   let link
   if(action==='corrections')link=`${origin}/inquiry-corrections#${token}`
   else {
    const generated=await db.auth.admin.generateLink({type:'magiclink',email:row.inquiry_contact_email,options:{redirectTo:`${origin}/complete-setup`}})
    if(generated.error || !generated.data?.properties?.action_link)throw new Error('Unable to prepare the setup link.')
    // The reservation checked the primary owner; never deliver to a different identity.
    const owner=check(await db.from('admin').select('admin_auth_user_id').eq('mall_id',row.mall_id).eq('admin_is_primary',true).eq('admin_email',row.inquiry_contact_email.toLowerCase()).single())
    if(owner.admin_auth_user_id!==generated.data.user?.id)throw new Error('Owner identity mismatch.')
    link=generated.data.properties.action_link
   }
   const warning=await deliver(req,row,result,transport,link,action==='corrections'?'corrections':undefined)
   events.publish(row.inquiry_id)
   return {ok:true,warning}
  } catch(error) {
   await db.from('inquiry_message').update({i_message_delivery_status:'unconfirmed'}).eq('i_message_id',result.message_id).eq('i_message_delivery_status','pending')
   events.publish(row.inquiry_id)
   req.log.warn({inquiryId:row.inquiry_id,code:error.code || 'LINK_DELIVERY_ERROR'},'Inquiry link preparation failed')
   return {ok:true,warning:'Request saved, but link delivery could not be completed. Check delivery history before reissuing.'}
  }
 }))
}
module.exports={registerFollowup,correctionFields,hashToken,safeOrigin}
