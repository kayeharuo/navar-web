const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {mapInquiry}=require('../modules/inquiries/routes')

test('inquiry decisions use submitted facts, preserve onboarding, and reject stale or duplicate decisions',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE TABLE admin(admin_id bigint PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean,admin_email text);
   INSERT INTO admin VALUES(1,'super_admin','official',false,'admin@example.com'),(2,'mall_admin','official',false,'owner@example.com');
   CREATE TABLE inquiry(inquiry_id bigint PRIMARY KEY,inquiry_status text,inquiry_updated_at timestamptz,mall_id bigint,inquiry_interested_tier text,
    inquiry_mall_address text,inquiry_mall_zip_code text,inquiry_mall_floor_count integer,inquiry_mall_description text,inquiry_mall_logo bytea,inquiry_rejection_reason text);
   INSERT INTO inquiry(inquiry_id,inquiry_status,inquiry_updated_at,inquiry_mall_address,inquiry_mall_floor_count)
    SELECT n,'New','2026-10-19T00:00:00Z','Owner supplied address',3 FROM generate_series(1,5) n;
   CREATE TABLE mall(mall_id bigserial PRIMARY KEY,mall_address text,mall_zipcode text,mall_floor_count integer,mall_description text,mall_logo bytea,mall_updated_at timestamptz);
   CREATE TABLE subscription_tier(s_tier_id bigint,s_tier_key text);
   CREATE TABLE inquiry_message(i_message_id bigserial PRIMARY KEY,i_message_sender_type text,i_message_sender_email text,i_message_message text,
    i_message_sent_at timestamptz,i_message_is_read boolean,inquiry_id bigint,i_message_request_id uuid UNIQUE,i_message_admin_id bigint,i_message_kind text,i_message_delivery_status text);
   -- Stub the existing owner-provisioning dependency, not the review function.
   CREATE FUNCTION public.provision_inquiry_mall(bigint,bigint,uuid,bigint,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE m bigint; BEGIN
    INSERT INTO public.mall DEFAULT VALUES RETURNING mall_id INTO m;
    UPDATE public.inquiry SET mall_id=m,inquiry_status='Approved',inquiry_updated_at=now() WHERE inquiry_id=$1;
    RETURN jsonb_build_object('mall_id',m);
   END; $$;
   CREATE FUNCTION public.reject_mall_inquiry(bigint,bigint,text) RETURNS void LANGUAGE sql AS $$
    UPDATE public.inquiry SET inquiry_status='Rejected',inquiry_rejection_reason=$3,inquiry_updated_at=now() WHERE inquiry_id=$1;
   $$;`)
  await db.exec(readFileSync(join(__dirname,'../database_schema/23_inquiry_review_decisions.sql'),'utf8'))
  const token=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const run=(id,action,request=id,extra={},actor=1)=>db.query('SELECT review_super_admin_inquiry($1,$2,$3,$4,$5) result',
   [id,actor,action,{updatedAt:'2026-10-19T00:00:00Z',authUserId:token(99),offer:{},...extra},token(request)])
  await assert.rejects(run(1,'approve',1,{},2),/Super Admin/)
  await assert.rejects(run(1,'approve',1,{updatedAt:'2020-01-01'}),/Inquiry changed/)
  const approved=(await run(1,'approve',1,{name:'Forged name',address:'Forged address',floorDetails:[{floorNo:99}]})).rows[0].result
  assert.ok(approved.mall_id)
  assert.equal((await db.query('SELECT mall_address FROM mall')).rows[0].mall_address,'Owner supplied address')
  assert.equal((await db.query('SELECT mall_floor_count FROM mall')).rows[0].mall_floor_count,3)
  assert.equal((await run(1,'approve')).rows[0].result.replayed,true)
  assert.equal((await db.query('SELECT count(*)::int n FROM mall')).rows[0].n,1)
  await assert.rejects(run(1,'reject',10,{reason:'No'}),/finalized/)
  await assert.rejects(run(2,'reject',2,{reason:' '}),/rejection reason/)
  await run(2,'reject',2,{reason:'Outside our service area'})
  assert.equal((await db.query('SELECT inquiry_status FROM inquiry WHERE inquiry_id=2')).rows[0].inquiry_status,'Rejected')
  assert.equal((await run(2,'reject',2,{reason:'Outside our service area'})).rows[0].result.replayed,true)
  await assert.rejects(run(2,'reject',2,{reason:'Different reason'}),/already used/)
  await assert.rejects(run(2,'approve',11),/finalized/)
  await assert.rejects(run(3,'approve',1),/already used/)
  assert.equal((await db.query('SELECT count(*)::int n FROM inquiry_message')).rows[0].n,2)
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid)','EXECUTE') allowed")).rows[0].allowed,false)
  // A failure after provisioning must roll back both the new mall and approval.
  await db.exec("ALTER TABLE inquiry_message ADD CONSTRAINT simulate_failure CHECK(inquiry_id<>4)")
  await assert.rejects(run(4,'approve'),/simulate_failure/)
  assert.equal((await db.query('SELECT mall_id FROM inquiry WHERE inquiry_id=4')).rows[0].mall_id,null)
  assert.equal((await db.query('SELECT count(*)::int n FROM mall')).rows[0].n,1)
 } finally {await db.close()}
})

test('legacy converted inquiries display as Approved, separately from onboarding completion',()=>{
 assert.equal(mapInquiry({inquiry_id:1,inquiry_status:'Converted'},[]).status,'Approved')
 assert.equal(mapInquiry({inquiry_id:2,inquiry_status:'Rejected'},[]).status,'Rejected')
})

test('approval endpoint accepts a review decision without mall fields and uses the authenticated actor',async()=>{
 const Fastify=require('fastify')
 const register=require('../modules/inquiries/routes')
 const row={inquiry_id:1,inquiry_contact_email:'owner@example.com',inquiry_status:'New',inquiry_updated_at:'2026-10-19T00:00:00Z'}
 let call,linkOptions
 const db={auth:{admin:{async generateLink(options){linkOptions=options;return {data:{user:{id:'00000000-0000-4000-8000-000000000099'},properties:{action_link:'https://example.com/setup'}}}}}},
  from(table){const q={select(){return q},eq(){return q},update(){return q},order(){return q},limit(){return q},
   maybeSingle:async()=>({data:table==='inquiry'?row:null}),single:async()=>({data:{i_message_delivery_status:'sent'}}),then(resolve){return Promise.resolve({data:[]}).then(resolve)}};return q},
  async rpc(name,args){call={name,args};return {data:{mall_id:12,message_id:22}}}}
 const app=Fastify();app.decorate('supabase',db)
 app.addHook('preHandler',async req=>{req.admin={id:7,name:'Reviewer'}})
 register(app,{env:{SMTP_USER:'navar@gmail.com',MALL_ADMIN_ORIGIN:'http://localhost:5174',INQUIRY_REFUND_TERMS:'Terms',INQUIRY_FEE_DETAILS:'Fees'},transportFactory:()=>({verify:async()=>{},close(){}})})
 try {
  const response=await app.inject({method:'POST',url:'/api/inquiries/1/approve',payload:{requestId:'00000000-0000-4000-8000-000000000001',updatedAt:row.inquiry_updated_at,actor:999,mall:{name:'Injected override'}}})
  assert.equal(response.statusCode,200)
  assert.equal(call.name,'review_super_admin_inquiry')
  assert.equal(call.args.p_actor,7)
  assert.equal(call.args.p_action,'approve')
  assert.equal(call.args.p_data.mall,undefined)
  assert.equal(call.args.p_data.name,undefined)
  assert.equal(linkOptions.email,row.inquiry_contact_email)
  assert.equal(linkOptions.options.redirectTo,'http://localhost:5174/complete-setup')
 } finally {await app.close()}
})
