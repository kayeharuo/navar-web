const {test}=require('node:test')
const assert=require('node:assert/strict')
const {simpleParser}=require('mailparser')
const {PGlite}=require('@electric-sql/pglite')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {outgoingThread,replyTokens,authenticatedSender,replyBody}=require('../modules/inquiries/mailThread')
const {createInboxSync}=require('../modules/inquiries/inbox')
const token='11111111-1111-4111-8111-111111111111'
const raw=(auth='pass')=>`Authentication-Results: mx.google.com; dmarc=${auth} header.from=gmail.com\r\nFrom: Ana <ana@gmail.com>\r\nTo: navar+inq.${token}@gmail.com\r\nMessage-ID: <owner-reply@gmail.com>\r\nIn-Reply-To: <navar-inquiry.${token}@navar.mail>\r\nDate: Mon, 19 Oct 2026 09:00:00 +0800\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nThank you!\r\n\r\nOn Mon, Oct 19, 2026 NavAR wrote:\r\n> Old message`
test('native email replies and reply-button messages match securely without subject matching',async()=>{
 const routing=outgoingThread({SMTP_USER:'navar@gmail.com'},token)
 assert.equal(routing.replyTo,`navar+inq.${token}@gmail.com`)
 const mail=await simpleParser(raw())
 assert.deepEqual(replyTokens(mail,'navar@gmail.com'),[token])
 assert.equal(authenticatedSender(mail,'ana@gmail.com'),true)
 assert.equal(authenticatedSender(mail,'ana@other.com'),false)
 assert.equal(authenticatedSender(await simpleParser(raw('fail')),'ana@gmail.com'),false)
 assert.equal(replyBody(mail.text),'Thank you!')
 assert.deepEqual(replyTokens({subject:'Re: NavAR inquiry: Mall'},'navar@gmail.com'),[])
 assert.deepEqual(replyTokens({to:{value:[{address:routing.replyTo}]}},'navar@gmail.com'),[token])
 assert.deepEqual(replyTokens({to:{value:[{address:routing.replyTo}]}},'someoneelse@gmail.com'),[])
})
test('database imports only the matching owner and stores repeated emails once',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE TABLE inquiry(inquiry_id bigint PRIMARY KEY,inquiry_contact_email text,inquiry_updated_at timestamptz);
   INSERT INTO inquiry VALUES(1,'ana@gmail.com',now());
   CREATE TABLE inquiry_message(i_message_id bigserial PRIMARY KEY,i_message_request_id uuid,i_message_sender_type text,i_message_sender_email text,i_message_message text,i_message_sent_at timestamptz,i_message_is_read boolean,inquiry_id bigint,i_message_kind text,i_message_delivery_status text);
   INSERT INTO inquiry_message(i_message_request_id,i_message_sender_type,inquiry_id,i_message_kind) VALUES('${token}','admin',1,'reply');`)
  await db.exec(readFileSync(join(__dirname,'../database_schema/22_inquiry_inbox.sql'),'utf8'))
  const run=async(sender,id='<reply@gmail.com>',request=token)=> (await db.query('SELECT import_inquiry_email($1,$2,$3,$4,$5) AS result',[request,id,sender,'Thank you','2026-10-19T01:00:00Z'])).rows[0].result
  assert.equal((await run('imposter@gmail.com')).imported,false)
  assert.equal((await run('ana@gmail.com',undefined,'22222222-2222-4222-8222-222222222222')).imported,false)
  assert.equal((await run('ana@gmail.com')).imported,true)
  assert.equal((await run('ana@gmail.com')).imported,false)
  assert.equal((await db.query("SELECT count(*)::int n FROM inquiry_message WHERE i_message_kind='incoming'")).rows[0].n,1)
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','import_inquiry_email(uuid,text,text,text,timestamptz)','EXECUTE') allowed")).rows[0].allowed,false)
 } finally {await db.close()}
})
test('worker preserves unread state and retries without advancing past a database failure',async()=>{
 let cursor=null,imports=0,fail=true,readOnly=false,closed=0
 const db={from(table){
  const q={select(){return q},eq(){return q},in(){return q},maybeSingle:async()=>({data:cursor}),
   upsert:async value=>{cursor=value;return {data:null}},
   then(resolve,reject){return Promise.resolve({data:[{inquiry_id:1,i_message_request_id:token}]}).then(resolve,reject)}}
  return q
 },async rpc(){imports++;return fail?{error:{code:'NETWORK'}}:{data:{imported:true}}}}
 let connections=0
 const factory=()=>({usable:false,mailbox:{uidValidity:1n,uidNext:2},async connect(){this.usable=true;connections++},status:async()=>({uidValidity:1n,uidNext:2}),
  getMailboxLock:async(name,options)=>{readOnly=options.readOnly;return {release(){}}},search:async()=>[1],
  fetchOne:async(uid,query)=>query.source?{source:Buffer.from(raw())}:{headers:Buffer.from(raw().split('\r\n\r\n')[0]+'\r\n\r\n'),size:1000,internalDate:new Date('2026-10-19T01:00:00Z')},logout:async()=>{},close(){this.usable=false;closed++}})
 const worker=createInboxSync({db,env:{SMTP_USER:'navar@gmail.com',INQUIRY_INBOX_ENABLED:'true'},log:{warn(){}},clientFactory:factory})
 await worker.poll();assert.equal(cursor,null);assert.ok(worker.state.error)
 fail=false;await worker.poll();assert.equal(cursor.last_uid,1);assert.equal(imports,2);assert.equal(readOnly,true);assert.equal(closed,1);assert.equal(worker.state.error,null)
 await worker.poll();assert.equal(connections,2) // Successful scans reuse the second connection.
 await worker.stop();assert.equal(closed,2)
})
