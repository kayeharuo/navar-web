const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {PGlite}=require('@electric-sql/pglite')
const {summarizeMessages}=require('../modules/applicationManagement/conversationSummary')
const Fastify=require('fastify')
const message=(id,sender,type,content)=>({message_id:id,message_sender:sender,message_sender_type:type,message_content:content,message_sent_at:`2026-11-23T00:00:${String(id).padStart(2,'0')}Z`})
test('inbox uses sender identity, preserves incoming unread after an outgoing reply, and handles legacy labels',()=>{
 const messages=[message(1,2,'super_admin','My old message'),message(2,33,'mall_admin','Mall response'),message(3,2,'admin','My reply')]
 let s=summarizeMessages(messages,2)
 assert.equal(s.unread,true);assert.equal(s.unreadCount,1);assert.equal(s.preview,'Mall response');assert.equal(s.latestMessageId,3)
 s=summarizeMessages(messages,2,2)
 assert.equal(s.unread,false);assert.equal(s.preview,'You: My reply')
 assert.equal(summarizeMessages([message(4,2,'super_admin','Own')],2).unread,false)
 assert.equal(summarizeMessages([message(4,19,'admin','Another administrator')],2).unread,true)
 assert.equal(summarizeMessages([message(4,33,'mall_admin','')],2).preview,'Image attachment')
 assert.equal(summarizeMessages([],2).unread,false)
 assert.equal(summarizeMessages([...messages,message(4,33,'mall_admin','New response')],2,3).unread,true)
})
test('read receipts are per administrator, monotonic, private, and validate the selected thread',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA app_private;
  CREATE TABLE admin(admin_id bigint PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean);
  CREATE TABLE thread(thread_id bigint PRIMARY KEY);
  CREATE TABLE thread_message(message_id bigint PRIMARY KEY,thread_id bigint REFERENCES thread(thread_id));
  CREATE FUNCTION app_private.is_super_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
  INSERT INTO admin VALUES(1,'super_admin','official',false),(2,'super_admin','official',false),(3,'mall_admin','official',false);
  INSERT INTO thread VALUES(1),(2); INSERT INTO thread_message VALUES(10,1),(11,1),(12,2);`)
  await db.exec(readFileSync(join(__dirname,'../database_schema/53_thread_inbox_reads.sql'),'utf8'))
  await db.query('select mark_admin_thread_read(1,1,11)')
  await db.query('select mark_admin_thread_read(1,1,10)')
  assert.equal((await db.query('select last_message_id from thread_admin_read where admin_id=1')).rows[0].last_message_id,11)
  assert.equal((await db.query('select count(*)::int n from thread_admin_read where admin_id=2')).rows[0].n,0)
  await assert.rejects(db.query('select mark_admin_thread_read(1,1,12)'),/does not belong/)
  await assert.rejects(db.query('select mark_admin_thread_read(3,1,10)'),/Super Admin/)
  assert.equal((await db.query("select has_function_privilege('authenticated','public.mark_admin_thread_read(bigint,bigint,bigint)','execute') permitted")).rows[0].permitted,false)
  assert.equal((await db.query("select has_table_privilege('anon','public.thread_admin_read','select') permitted")).rows[0].permitted,false)
 }finally{await db.close()}
})
test('conversation API includes application, stall and AR messages, and binds read receipts to the signed-in administrator',async()=>{
 const data={thread:[{thread_id:1,application_id:10},{thread_id:2,s_application_id:20},{thread_id:3,ar_development_id:30}],
  application:[{application_id:10,mall_id:1,application_version:2,application_attempt:1}],stall_application:[{s_application_id:20,mall_id:1}],ar_development:[{ar_development_id:30,application_id:10}],mall:[{mall_id:1,mall_name:'Test mall'}],thread_admin_read:[],
  thread_message:[{...message(1,33,'mall_admin','Application reply'),thread_id:1},{...message(2,33,'mall_admin','Stall reply'),thread_id:2},{...message(3,33,'mall_admin','AR reply'),thread_id:3},{...message(4,7,'super_admin','Own reply'),thread_id:1}]}
 const calls=[]
 const db={from(table){let start=0,end=Infinity;const predicates=[];const q=new Proxy({},{get(_,key){
  if(key==='then')return resolve=>Promise.resolve({data:(data[table]||[]).filter(r=>predicates.every(p=>p(r))).slice(start,end+1),error:null}).then(resolve)
  return (...args)=>{if(key==='range')[start,end]=args;if(key==='eq')predicates.push(r=>r[args[0]]===args[1]);if(key==='in')predicates.push(r=>args[1].includes(r[args[0]]));return q}
 }});return q},async rpc(name,args){calls.push({name,args});return {data:name==='thread_write_state'?{mallId:1,version:2,readOnly:args.p_id!==11}:null,error:null}}}
 const app=Fastify();app.decorate('supabase',db);app.addHook('preHandler',async r=>{r.admin={id:7}})
 require('../modules/applicationManagement/routes')(app)
 try{
  const response=await app.inject({method:'GET',url:'/api/conversations'})
  assert.equal(response.statusCode,200)
  const rows=response.json();assert.deepEqual(new Set(rows.map(r=>r.moduleKey)),new Set(['application','stall','ar']))
  assert.equal(rows.every(r=>r.unread),true)
  assert.equal(rows.find(r=>r.moduleKey==='application').preview,'Application reply')
  assert.match(rows.find(r=>r.moduleKey==='stall').path,/type=stall/)
  const read=await app.inject({method:'POST',url:'/api/conversations/2/read',payload:{messageId:2}})
  assert.equal(read.statusCode,200)
  assert.deepEqual(calls[0],{name:'mark_admin_thread_read',args:{p_admin:7,p_thread:2,p_message:2}})
  data.application.push({application_id:11,mall_id:1,application_version:2,application_attempt:2})
  data.thread.push({thread_id:4,application_id:11})
  data.thread_message.push({...message(5,33,'mall_admin','New attempt response'),thread_id:4})
  const grouped=(await app.inject({url:'/api/conversations'})).json().filter(r=>r.moduleKey==='application')
  assert.equal(grouped.length,1);assert.match(grouped[0].path,/applicationId=11/);assert.equal(grouped[0].unreadCount,2)
  const latestThread=await app.inject({url:'/api/applications/11/thread'})
  assert.equal(latestThread.statusCode,200);assert.equal(latestThread.json().threadReadOnly,false)
  assert.deepEqual(latestThread.json().messages.map(m=>m.id),[1,4,5])
  const oldThread=(await app.inject({url:'/api/applications/10/thread'})).json()
  assert.equal(oldThread.threadReadOnly,true);assert.deepEqual(oldThread.messages.map(m=>m.id),[1,4,5])
 }finally{await app.close()}
})
