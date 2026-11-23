'use strict'
const { checked, listSubscriptions, runLifecycle, estimateQuote, testContext, emit } = require('./service')
const { paymongo, verifySignature } = require('./paymongo')
const { action } = require('../applicationManagement/arService')
const { currentRateCard } = require('../systemSettings/rateCard')
function wrap(fn) { return async (request, reply) => { try { return await fn(request,reply) } catch(error) { if(error.code==='P0001'||error.statusCode) return reply.code(error.statusCode||409).send({message:error.message}); throw error } } }
function registerAdmin(app) {
  const db=app.supabase
  app.get('/api/subscriptions',wrap(async()=>({ malls:await listSubscriptions(db),asOf:new Date().toISOString() })))
  app.get('/api/subscriptions/alerts',wrap(async()=> (await listSubscriptions(db)).filter(m=>['Suspended','Grace Period'].includes(m.status)).map(m=>({ id:m.id,type:m.status==='Suspended'?'error':'warning',title:`${m.name}: ${m.status}`,message:m.daysLeftLabel,text:`${m.name}: ${m.status}. ${m.daysLeftLabel}` }))))
  app.post('/api/subscriptions/:id/suspend',wrap(async(req)=>checked(await db.rpc('manage_subscription_suspension',{p_mall:Number(req.params.id),p_actor:req.admin.id,p_action:'suspend',p_reason:req.body?.reason,p_notes:req.body?.notes||'',p_penalty:Number(req.body?.penalty||0)}))))
  app.post('/api/subscriptions/:id/lift',wrap(async(req)=>checked(await db.rpc('manage_subscription_suspension',{p_mall:Number(req.params.id),p_actor:req.admin.id,p_action:'lift'}))))
  app.get('/api/subscriptions/:id/test-context',wrap(req=>testContext(db,Number(req.params.id))))
  app.post('/api/subscriptions/:id/test-estimate',wrap(async req=>estimateQuote(req.body?.inputs||{},await currentRateCard(db))))
  app.post('/api/subscriptions/:id/test-quote',wrap(async(req,reply)=>{
    const id=Number(req.params.id)
    const mall=checked(await db.from('mall').select('mall_name').eq('mall_id',id).single())
    if(mall.mall_name!=='Gaisano Fiesta Mall') return reply.code(409).send({message:'This testing setup is limited to Gaisano Fiesta Mall.'})
    if(req.body?.acknowledged!==true) return reply.code(400).send({message:'Acknowledge that these are synthetic test quote inputs.'})
    const input=req.body.inputs, estimate=estimateQuote(input,await currentRateCard(db))
    if (req.body.rateVersion !== estimate.rateVersion) return reply.code(409).send({message:'Onboarding rates changed. Preview the estimate again before confirming.'})
    const floors=checked(await db.from('floor').select('floor_num').eq('mall_id',id))
    if(floors.length!==input.floors.length||floors.some(f=>!input.floors.some(i=>i.floorNum===f.floor_num))) return reply.code(400).send({message:'Include every existing mall floor in the quote.'})
    const count=checked(await db.from('store').select('store_id').eq('mall_id',id).eq('store_type','store').neq('store_status','inactive'))
    if(input.stores<count.length) return reply.code(400).send({message:'Capacity cannot be lower than the existing active store count.'})
    const q=checked(await db.rpc('prepare_subscription_test_mall',{p_mall:id,p_actor:req.admin.id,p_inputs:input,p_estimate:estimate}))
    return {quoteId:q,estimate}
  }))
  app.post('/api/subscriptions/:id/test-approve',wrap(async(req,reply)=>{
    if(req.body?.acknowledged!==true) return reply.code(400).send({message:'Confirm this is a simulated mall review for testing.'})
    const context=await testContext(db,Number(req.params.id))
    if(context.mallAdmins.length!==1) return reply.code(409).send({message:'This simulation requires exactly one active, official mall administrator.'})
    checked(await db.rpc('acknowledge_test_ar',{p_mall:Number(req.params.id),p_actor:req.admin.id}));return {approved:true,testOnly:true,message:`Mall approval simulated for ${context.mallAdmins[0].admin_full_name}. Choose a subscription tier and confirm the test payment next.`}
  }))
  app.post('/api/subscriptions/:id/test-floor-details',wrap(async(req,reply)=>{
    if(req.body?.acknowledged!==true) return reply.code(400).send({message:'Acknowledge the test workflow first.'})
    checked(await db.rpc('save_test_application_details',{p_mall:Number(req.params.id),p_actor:req.admin.id,p_rows:req.body.floors||{}}));return {saved:true}
  }))
  app.post('/api/subscriptions/:id/test-readiness',wrap(async(req,reply)=>{
    const context=await testContext(db,Number(req.params.id))
    if(!context.mall.is_subscription_test) return reply.code(409).send({message:'Prepare the explicit test quote first.'})
    if(!context.development) return reply.code(409).send({message:'No AR development exists.'})
    if(context.issues.length) return reply.code(409).send({message:`Complete application requirements: ${context.issues.join('; ')}`})
    return action(db,context.development.application_id,req.admin.id,'ar_status','','ready')
  }))
  app.post('/api/subscriptions/:id/test-checkout',wrap((req)=>createCheckout(db,Number(req.params.id),req.admin.id,req.body,true)))
  app.post('/api/subscriptions/:id/test-simulate-payment', {
    schema: { body: { type:'object',required:['feeType','acknowledged'],additionalProperties:false,properties:{
      feeType:{type:'string',enum:['onboarding','subscription','renewal','reinstatement','upgrade']},
      tier:{type:'string',enum:['basic','standard','premium']},acknowledged:{type:'boolean'},
    } } },
  }, wrap(async(req,reply)=>{
    if(req.body.acknowledged!==true) return reply.code(400).send({message:'Confirm this is a simulated payment with no real money collected.'})
    return checked(await db.rpc('simulate_subscription_payment',{
      p_mall:Number(req.params.id),p_actor:req.admin.id,p_fee:req.body.feeType,
      p_tier:req.body.tier||null,p_acknowledged:true,
    }))
  }))
  app.post('/api/subscriptions/:id/test-downgrade',wrap(async req=>checked(await db.rpc('schedule_subscription_downgrade',{p_mall:Number(req.params.id),p_actor:req.admin.id,p_tier:req.body?.tier,p_test:true}))))
  app.post('/api/subscriptions/:id/payments/:requestId/reconcile',wrap(req=>reconcile(db,Number(req.params.id),Number(req.params.requestId))))
}
async function createCheckout(db,mallId,actor,body={},test=false) {
  if(!test) throw Object.assign(new Error('This checkout bridge is for explicitly marked test malls. Live checkout belongs in the production mall billing integration.'),{statusCode:503})
  // Fail before creating a request if no test provider key is configured.
  if(!process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_')) throw Object.assign(new Error('Add PAYMONGO_SECRET_KEY (sk_test_) to the backend .env to enable no-money test payments.'),{statusCode:503})
  if(body.acknowledged!==true) throw Object.assign(new Error('Review and acknowledge the payment terms first.'),{statusCode:400})
  const row=checked(await db.rpc('prepare_subscription_payment',{p_mall:mallId,p_actor:actor,p_fee:body.feeType,p_tier:body.tier||null,p_test:test}))
  if(row.checkout_url) return {requestId:row.request_id,url:row.checkout_url,testOnly:true}
  const origin=process.env.FRONTEND_ORIGIN||'http://localhost:5173'
  const session=await paymongo('/checkout_sessions',{method:'POST',body:JSON.stringify({data:{attributes:{description:`NavAR TEST ${row.fee_type} — request ${row.request_id}`,line_items:[{name:`NavAR ${row.fee_type}`,amount:Number(row.amount_cent),currency:'PHP',quantity:1}],payment_method_types:['card'],send_email_receipt:false,show_description:true,reference_number:String(row.request_id),metadata:{request_id:String(row.request_id)},success_url:`${origin}/subscription-management/test/${mallId}?request=${row.request_id}`,cancel_url:`${origin}/subscription-management/test/${mallId}`}}})})
  if(session.attributes?.livemode!==false) throw new Error('Only test checkouts are supported by this bridge')
  const existing=checked(await db.from('mall_payment_checkout').select('session_id').eq('request_id',row.request_id).maybeSingle())
  if(!existing) checked(await db.from('mall_payment_checkout').insert({request_id:row.request_id,session_id:session.id,amount_cent:row.amount_cent,livemode:false}))
  else if(existing.session_id!==session.id) throw Object.assign(new Error('A checkout already exists; reload its payment request.'),{statusCode:409})
  checked(await db.from('contract_payment_request').update({checkout_url:session.attributes.checkout_url}).eq('request_id',row.request_id))
  return {requestId:row.request_id,url:session.attributes.checkout_url,testOnly:true}
}
async function reconcile(db,mallId,requestId) {
  const r=checked(await db.from('contract_payment_request').select('*').eq('request_id',requestId).eq('mall_id',mallId).single())
  const pc=checked(await db.from('mall_payment_checkout').select('*').eq('request_id',requestId).single())
  const session=await paymongo(`/checkout_sessions/${encodeURIComponent(pc.session_id)}`)
  if(session.attributes.livemode!==false||pc.livemode!==false) throw new Error('Payment mode mismatch')
  const payment=(session.attributes.payments||[]).find(p=>p.attributes?.status==='paid')
  if(!payment) return {paid:false,message:'PayMongo has not confirmed a successful payment.'}
  if(payment.attributes.amount!==Number(r.amount_cent)||payment.attributes.currency!=='PHP'||payment.attributes.livemode===true) throw new Error('Payment amount, currency or mode mismatch')
  const paidAt=new Date((payment.attributes.paid_at||payment.attributes.created_at)*1000).toISOString()
  const settled=checked(await db.rpc('settle_subscription_payment',{p_request:requestId,p_session:pc.session_id,p_payment:payment.id,p_amount:Number(r.amount_cent),p_paid_at:paidAt}))
  return {paid:true,...settled}
}
function registerPublic(app) {
  app.register(async hooks=>{
    hooks.removeContentTypeParser('application/json')
    hooks.addContentTypeParser('application/json',{parseAs:'string'},(req,body,done)=>{req.rawBody=body;try{done(null,JSON.parse(body))}catch(e){done(e)}})
    hooks.post('/api/payments/paymongo/webhook',async(req,reply)=>{
      if(!verifySignature(req.rawBody,req.headers['paymongo-signature'],process.env.PAYMONGO_WEBHOOK_SECRET)) return reply.code(401).send({message:'Invalid webhook signature'})
      const event=req.body?.data?.attributes || req.body?.data
      if(event?.type!=='checkout_session.payment.paid') return {received:true}
      const sessionId=event.data?.id
      const pc=checked(await app.supabase.from('mall_payment_checkout').select('request_id').eq('session_id',sessionId).maybeSingle())
      if(!pc) return reply.code(409).send({message:'Checkout has not been registered yet; retry delivery.'})
      const r=checked(await app.supabase.from('contract_payment_request').select('mall_id').eq('request_id',pc.request_id).single())
      return reconcile(app.supabase,r.mall_id,pc.request_id)
    })
  })
}
function registerMall(app) {
  app.post('/api/mall/subscription/downgrade',wrap(async req=>checked(await app.supabase.rpc('schedule_subscription_downgrade',{p_mall:req.admin.mallId,p_actor:req.admin.id,p_tier:req.body?.tier,p_test:false}))))
  app.get('/api/mall/subscription/notifications',wrap(async req=>checked(await app.supabase.from('notification').select('*').eq('mall_id',req.admin.mallId).eq('notif_admin_recipient',req.admin.id).eq('notif_is_archived',false).order('notif_created_at',{ascending:false}).limit(100))))
  app.get('/api/mall/subscription',wrap(async req=>({subscription:(await listSubscriptions(app.supabase)).find(m=>m.id===req.admin.mallId)})))
  app.post('/api/mall/subscription/checkout',wrap(async req=>{
    const mall=checked(await app.supabase.from('mall').select('is_subscription_test').eq('mall_id',req.admin.mallId).single())
    return createCheckout(app.supabase,req.admin.mallId,req.admin.id,req.body,mall.is_subscription_test)
  }))
  app.post('/api/mall/subscription/payments/:requestId/reconcile',wrap(req=>reconcile(app.supabase,req.admin.mallId,Number(req.params.requestId))))
}
module.exports={registerAdmin,registerPublic,registerMall,createCheckout,reconcile}
