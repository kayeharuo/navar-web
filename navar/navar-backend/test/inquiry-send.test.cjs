const {test}=require('node:test')
const assert=require('node:assert/strict')
const Fastify=require('fastify')
const register=require('../modules/inquiries/routes')

test('replies appear before email acceptance, reuse connections, and do not resend retries',async()=>{
 const originalFetch=global.fetch
 let downloads=0,created=0,sends=0,closed=0,release
 const accepted=new Promise(resolve=>{release=resolve})
 global.fetch=async()=>{downloads++;return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>Buffer.from('89504e470d0a1a0a','hex')}}
 const messages=new Map(),requests=new Map()
 const row={inquiry_id:1,inquiry_mall_name:'Example',inquiry_contact_person:'Ana',inquiry_contact_email:'ana@example.com',inquiry_mall_description:'Inquiry',inquiry_created_at:'2026-10-19T00:00:00Z'}
 const db={
  from(table){
   let update,before=Infinity,filters=[]
   const q={order(){return q},limit(){return q},select(){return q},eq(k,v){filters.push([k,v]);return q},lt(k,v){before=v;return q},update(v){update=v;return q},
    async maybeSingle(){
     const history=[
      {i_message_id:10,inquiry_id:1,i_message_sender_type:'mall',i_message_message:'Old mall message'},
      {i_message_id:11,inquiry_id:1,i_message_sender_type:'mall',i_message_message:'Latest mall question',i_message_sent_at:'2026-10-19T00:45:00Z',i_message_email_id:'<owner-reply@mail.example.com>'},
      {i_message_id:19,inquiry_id:2,i_message_sender_type:'mall',i_message_message:'Other mall private message'},
      {i_message_id:100,inquiry_id:1,i_message_sender_type:'mall',i_message_message:'Arrived after admin reply'}
     ];
     return {data:table==='inquiry_message'?history.filter(m=>m.i_message_id<before && filters.every(([k,v])=>m[k]===v)).sort((a,b)=>b.i_message_id-a.i_message_id)[0] || null:row}
    },async single(){return {data:[...messages.values()].find(m=>filters.every(([k,v])=>m[k]===v))}},
    then(resolve,reject){return Promise.resolve().then(()=>{assert.equal(table,'inquiry_message');const found=[...messages.values()].filter(m=>filters.every(([k,v])=>m[k]===v));if(update)found.forEach(m=>Object.assign(m,update));return {data:found}}).then(resolve,reject)}}
   return q
  },
  async rpc(name,args){
   if(!requests.has(args.p_request)){
    const id=messages.size+20;requests.set(args.p_request,id)
    messages.set(id,{i_message_id:id,inquiry_id:1,i_message_kind:'reply',i_message_sender_type:'admin',i_message_sender_email:'juan@gmail.com',i_message_request_id:args.p_request,i_message_message:args.p_data.text,i_message_sent_at:'2026-10-19T01:00:00Z',i_message_delivery_status:'pending'})
   }
   return {data:{message_id:requests.get(args.p_request)}}
  }
 }
 const app=Fastify();app.decorate('supabase',db)
 app.addHook('preHandler',async req=>{req.admin={id:1,name:'Juan',email:'juan@gmail.com'}})
 register(app,{env:{SUPABASE_URL:'https://branding.example.com',SMTP_USER:'navar@gmail.com'},transportFactory:()=>{
  created++;return {verify:async()=>assert.fail('Replies must not open an extra verification connection'),sendMail:async mail=>{assert.equal(mail.inReplyTo,'<owner-reply@mail.example.com>');assert.deepEqual(mail.references,['<owner-reply@mail.example.com>']);assert.match(mail.replyTo,/^navar\+inq\.[0-9a-f-]+@gmail\.com$/);assert.ok(mail.html.includes('mailto:navar%2Binq.'));assert.match(mail.messageId,/^<navar-inquiry\./);assert.ok(mail.html.includes('Latest mall question'));assert.ok(mail.text.includes('Latest mall question'));assert.ok(!mail.html.includes('Other mall private message'));assert.ok(!mail.html.includes('Arrived after admin reply'));sends++;await accepted;return {accepted:['ana@example.com']}},close(){closed++}}
 }})
 try {
  const post=requestId=>app.inject({method:'POST',url:'/api/inquiries/1/replies',payload:{text:'Reply',requestId}})
  const first=await post('11111111-1111-4111-8111-111111111111')
  assert.equal(first.statusCode,202)
  assert.equal(first.json().message.deliveryStatus,'pending')
  assert.equal(first.json().message.text,'Reply')
  for(let i=0;i<100 && sends===0;i++)await new Promise(resolve=>setImmediate(resolve))
  assert.equal(sends,1)
  // SMTP is still waiting on the simulated provider, but another message can be saved.
  assert.equal((await post('22222222-2222-4222-8222-222222222222')).statusCode,202)
  assert.equal((await post('11111111-1111-4111-8111-111111111111')).statusCode,202)
  assert.equal(sends,1)
  release()
  for(let i=0;i<100 && [...messages.values()].some(m=>m.i_message_delivery_status!=='sent');i++)await new Promise(resolve=>setImmediate(resolve))
  assert.equal(created,1);assert.equal(sends,2);assert.equal(downloads,0)
  assert.ok([...messages.values()].every(m=>m.i_message_delivery_status==='sent'))
 } finally {release();await app.close();global.fetch=originalFetch}
 assert.equal(closed,1)
})
