const {threadWriteState,applicationThreads}=require('../applicationManagement/threadPolicy')
'use strict'
const {serializeMessages}=require('../applicationManagement/routes')
const {floorPlanImageUrl}=require('../storage/imageStorage')
const checked=r=>{if(r.error)throw r.error;return r.data}
const wrap=fn=>async(req,reply)=>{try{return await fn(req,reply)}catch(e){req.log.warn({code:e.code,message:e.message},'Map application action failed');return reply.code(e.code==='42501'?403:['P0001','40001','22023','22P02','23514','23505'].includes(e.code)?409:500).send({message:['P0001','40001','22023','22P02','23514','23505','42501'].includes(e.code)?e.message:'Unable to complete the map application action.'})}}
function register(app,mall=false){
 const db=app.supabase
 const prefix=mall?'/api/mall/map-applications':'/api/map-portal/:mallId'
 const mallId=req=>mall?req.admin.mallId:Number(req.params.mallId)
 const rpc=(req,action,data={})=>db.rpc('map_application_portal',{p_actor:req.admin.id,p_mall:mallId(req),p_action:action,p_data:data}).then(checked)
 app.get(prefix,wrap(async req=>{
  const context=await rpc(req,'context')
  const thread=context.latest?.application_id?checked(await applicationThreads(db,context.latest)):[]
  const messages=thread.length?checked(await db.from('thread_message').select('*').in('thread_id',thread.map(t=>t.thread_id)).order('message_sent_at')):[]
  context.threadReadOnly=context.latest?.application_id?(await threadWriteState(db,req.admin.id,'application',context.latest.application_id)).readOnly:true
  context.thread=await serializeMessages(db,messages)
  return context
 }))
 app.get(`${prefix}/plans/:planId`,wrap(async req=>{
  await rpc(req,'context')
  const plan=checked(await db.from('application_floor_plan').select('*').eq('app_floor_plan_id',Number(req.params.planId)).single())
  const owner=checked(await db.from('application').select('mall_id').eq('application_id',plan.application_id).single())
  if(Number(owner.mall_id)!==mallId(req)){const error=new Error('This plan belongs to another mall.');error.code='42501';throw error}
  return {url:await floorPlanImageUrl(db,plan,300)}
 }))
 app.post(`${prefix}/:action`,{bodyLimit:60*1024*1024,schema:{params:{type:'object',required:['action'],properties:{action:{enum:mall?['submit','revise','dispute','message','confirm']:['submit','pay','revise','dispute','message','confirm']},...(mall?{}:{mallId:{type:'integer',minimum:1}})}},body:{type:'object'}}},wrap((req,reply)=>{
  if(['submit','revise'].includes(req.params.action)&&(!Array.isArray(req.body?.floors)||!req.body.floors.length||req.body.floors.some(f=>!Number.isSafeInteger(f.floorId)||f.floorId<1||typeof f.changed!=='boolean'||!Number.isFinite(f.meterLength)||f.meterLength<=0)))return reply.code(400).send({message:'Every floor needs its ID, change selection and a positive finite meter length.'})
  return rpc(req,req.params.action,req.body||{})
 }))
}
module.exports=app=>register(app)
module.exports.registerMall=app=>register(app,true)
