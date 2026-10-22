const {test}=require('node:test')
const assert=require('node:assert/strict')
const Fastify=require('fastify')
const {createInquiryEvents}=require('../modules/inquiries/events')
const createGuards=require('../modules/auth/authGuard')
const {inquiryEmail}=require('../modules/inquiries/emailTemplate')

test('live inquiry stream is guarded and pushes updates without waiting for polling',async()=>{
 const app=Fastify(),events=createInquiryEvents()
 let role='mall_admin'
 const db={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{admin_id:1,admin_role:role,admin_account_status:'official',admin_is_deactivated:false}})};return q}}
 const guards=createGuards(db)
 app.addHook('preHandler',guards.requireAuth());app.addHook('preHandler',guards.requireSuperAdmin)
 app.addHook('preClose',async()=>events.close())
 app.get('/events',(req,res)=>events.open(req,res))
 let reader
 try {
  assert.equal((await app.inject('/events')).statusCode,401)
  assert.equal((await app.inject({url:'/events',headers:{authorization:'Bearer demo'}})).statusCode,403)
  role='super_admin'
  const address=await app.listen({port:0,host:'127.0.0.1'})
  const response=await fetch(`${address}/events`,{headers:{authorization:'Bearer demo'},signal:AbortSignal.timeout(5000)})
  assert.equal(response.status,200)
  assert.match(response.headers.get('content-type'),/text\/event-stream/)
  reader=response.body.getReader()
  assert.match(new TextDecoder().decode((await reader.read()).value),/connected/)
  events.publish(7)
  const update=new TextDecoder().decode((await reader.read()).value)
  assert.match(update,/inquiry_changed/);assert.match(update,/"inquiryId":7/)
 } finally {await reader?.cancel();await app.close()}
})

test('email uses the latest mall reply and date, falling back only when there is no reply',()=>{
 const input={row:{inquiry_mall_name:'Mall',inquiry_contact_person:'Ana',inquiry_mall_description:'Original submission',inquiry_created_at:'2026-10-18T00:00:00Z'},message:'Admin answer',sentAt:'2026-10-19T02:00:00Z',env:{SUPABASE_URL:'https://example.com',SMTP_USER:'navar@gmail.com'}}
 const first=inquiryEmail(input)
 assert.ok(first.includes('Original submission'))
 const next=inquiryEmail({...input,mallMessage:{i_message_message:'Updated <question>',i_message_sent_at:'2026-10-19T01:00:00Z'}})
 assert.ok(next.includes('Updated &lt;question&gt;'));assert.ok(next.includes('9:00 AM'))
 assert.ok(next.includes('Admin answer'));assert.ok(!next.includes('Original submission'))
})
