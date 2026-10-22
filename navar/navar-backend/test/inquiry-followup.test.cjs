const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {hashToken,correctionFields,safeOrigin}=require('../modules/inquiries/followup')
const token=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const fields={mallName:'Example Mall',contactPerson:'Ana Santos',phone:'+63 912 345 6789',province:'Cebu',city:'Cebu City',address:'12 Example Street',zipCode:'6000',floors:2,description:'Updated inquiry',coverageArea:'1000 sqm'}

test('follow-up protects correction links, notes, read receipts, reissues and duplicate decisions',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE TABLE admin(admin_id bigint PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean,admin_email text,admin_is_primary boolean,mall_id bigint);
   INSERT INTO admin VALUES(1,'super_admin','official',false,'reviewer@example.com',false,null),(2,'super_admin','official',false,'second@example.com',false,null),(3,'mall_admin','partial',false,'owner@example.com',true,9);
   CREATE TABLE inquiry(inquiry_id bigint PRIMARY KEY,inquiry_status text,inquiry_updated_at timestamptz,inquiry_created_at timestamptz DEFAULT now(),mall_id bigint,
    inquiry_interested_tier text,inquiry_mall_address text,inquiry_mall_zip_code text,inquiry_mall_floor_count int,inquiry_mall_description text,inquiry_mall_logo bytea,
    inquiry_mall_name text,inquiry_contact_person text,inquiry_contact_num text,inquiry_contact_email text,inquiry_mall_state text,inquiry_mall_city text,inquiry_coverage_area text,
    inquiry_reviewed_by bigint,inquiry_reviewed_at timestamptz,inquiry_rejection_reason text);
   INSERT INTO inquiry(inquiry_id,inquiry_status,inquiry_updated_at,inquiry_mall_name,inquiry_contact_email,inquiry_mall_description)
    SELECT n,'New',now(),'Mall '||n,'owner'||n||'@example.com','Original inquiry' FROM generate_series(1,6)n;
   UPDATE inquiry SET mall_id=9,inquiry_status='Approved',inquiry_contact_email='owner@example.com' WHERE inquiry_id=6;
   CREATE TABLE mall(mall_id bigserial PRIMARY KEY,mall_address text,mall_zipcode text,mall_floor_count int,mall_description text,mall_logo bytea,mall_updated_at timestamptz);
   CREATE TABLE mall_admin_account(admin_id bigint,setup_completed_at timestamptz);
   INSERT INTO mall_admin_account VALUES(3,null);
   CREATE TABLE mall_onboarding(mall_id bigint,completed_at timestamptz,profile_completed_at timestamptz,agreement_acceptance jsonb);
   INSERT INTO mall_onboarding(mall_id)VALUES(9);
   CREATE TABLE subscription_tier(s_tier_id bigint,s_tier_key text);
   CREATE TABLE inquiry_message(i_message_id bigserial PRIMARY KEY,i_message_sender_type text,i_message_sender_email text,i_message_message text,
    i_message_sent_at timestamptz,i_message_is_read boolean,inquiry_id bigint,i_message_request_id uuid UNIQUE,i_message_admin_id bigint,i_message_kind text,i_message_delivery_status text,i_message_email_id text UNIQUE);
   CREATE FUNCTION public.provision_inquiry_mall(bigint,bigint,uuid,bigint,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE m bigint;BEGIN INSERT INTO public.mall DEFAULT VALUES RETURNING mall_id INTO m;
    UPDATE public.inquiry SET mall_id=m,inquiry_status='Approved',inquiry_reviewed_by=$2,inquiry_reviewed_at=now() WHERE inquiry_id=$1;
    RETURN jsonb_build_object('mall_id',m);END;$$;
   CREATE FUNCTION public.reject_mall_inquiry(bigint,bigint,text) RETURNS void LANGUAGE sql AS $$
    UPDATE public.inquiry SET inquiry_status='Rejected',inquiry_rejection_reason=$3,inquiry_reviewed_by=$2,inquiry_reviewed_at=now() WHERE inquiry_id=$1;$$;`)
  for(const file of ['23_inquiry_review_decisions.sql','24_inquiry_followup.sql'])await db.exec(readFileSync(join(__dirname,'../database_schema',file),'utf8'))
  const current=async id=>(await db.query('SELECT inquiry_updated_at FROM inquiry WHERE inquiry_id=$1',[id])).rows[0].inquiry_updated_at
  const follow=async(id,action,request,data={},actor=1)=>(await db.query('SELECT inquiry_followup($1,$2,$3,$4,$5) result',[id,actor,action,{updatedAt:await current(id),...data},request?token(request):null])).rows[0].result
  const edit=async(hash,data=null)=>(await db.query('SELECT submit_inquiry_correction($1,$2) result',[hash,data])).rows[0].result
  const summary=async actor=>(await db.query('SELECT inquiry_followup_summary($1) result',[actor])).rows[0].result
  await assert.rejects(follow(1,'note',1,{text:'Private'},3),/Super Admin/)
  await follow(1,'note',1,{text:'Private internal note'})
  await follow(1,'note',1,{text:'Private internal note'})
  assert.equal((await db.query('SELECT count(*)::int n FROM inquiry_note')).rows[0].n,1)
  assert.equal((await db.query('SELECT count(*)::int n FROM inquiry_message')).rows[0].n,0)
  await assert.rejects(follow(2,'note',1,{text:'Private internal note'}),/already used/)
  const hash=hashToken('a'.repeat(64))
  const correction=await follow(1,'corrections',2,{reason:'Please provide your address',tokenHash:hash})
  assert.equal((await follow(1,'corrections',2,{reason:'Please provide your address',tokenHash:hash})).replayed,true)
  await assert.rejects(follow(1,'corrections',3,{reason:'Again',tokenHash:hashToken('b'.repeat(64))}),/10 minutes/)
  assert.equal((await edit(hash)).fields.description,'Original inquiry')
  const incoming=await db.query('SELECT import_inquiry_email($1,$2,$3,$4,now()) result',[token(2),'<correction-reply@example.com>','owner1@example.com','I will update my details.'])
  assert.equal(incoming.rows[0].result.imported,true)
  await assert.rejects(edit(hashToken('invalid')),/invalid or expired/)
  await edit(hash,fields)
  await assert.rejects(edit(hash,fields),/no longer available/)
  const saved=(await db.query('SELECT * FROM inquiry WHERE inquiry_id=1')).rows[0]
  assert.equal(saved.inquiry_contact_email,'owner1@example.com')
  assert.equal(saved.inquiry_mall_description,fields.description)
  assert.equal(saved.inquiry_original_description,'Original inquiry')
  assert.equal((await db.query('SELECT after_data FROM inquiry_correction WHERE message_id=$1',[correction.message_id])).rows[0].after_data.address,fields.address)
  assert.ok((await summary(1)).find(i=>i.id===1).unread>0)
  const last=(await db.query('SELECT max(i_message_id) id FROM inquiry_message WHERE inquiry_id=1')).rows[0].id
  await follow(1,'read',null,{messageId:Number(last)})
  assert.equal((await summary(1)).find(i=>i.id===1).unread,0)
  assert.ok((await summary(2)).find(i=>i.id===1).unread>0)
  // A consumed or finalized token cannot mutate a reviewed inquiry.
  const secondHash=hashToken('c'.repeat(64))
  await follow(2,'corrections',4,{reason:'Address',tokenHash:secondHash})
  await db.exec("UPDATE inquiry SET inquiry_status='Rejected' WHERE inquiry_id=2")
  await assert.rejects(edit(secondHash,fields),/no longer available/)
  const expiredHash=hashToken('d'.repeat(64))
  await follow(3,'corrections',5,{reason:'Address',tokenHash:expiredHash})
  await db.exec('UPDATE inquiry_correction SET expires_at=now()-interval \'1 hour\' WHERE inquiry_id=3')
  await assert.rejects(edit(expiredHash,fields),/no longer available/)
  // Reissuing reserves one delivery, has a cooldown, and cannot reset completed owners.
  assert.equal((await summary(1)).find(i=>i.id===6).progress,'Invitation pending')
  await follow(6,'reissue',6)
  assert.equal((await follow(6,'reissue',6)).replayed,true)
  await assert.rejects(follow(6,'reissue',7),/10 minutes/)
  await db.exec("UPDATE inquiry_message SET i_message_sent_at=now()-interval '11 minutes' WHERE inquiry_id=6")
  await assert.rejects(follow(6,'reissue',7),/acknowledge/)
  await follow(6,'reissue',7,{acknowledgeUncertain:true})
  await db.exec("UPDATE inquiry_message SET i_message_sent_at=now()-interval '11 minutes' WHERE inquiry_id=6;UPDATE mall_admin_account SET setup_completed_at=now() WHERE admin_id=3")
  await assert.rejects(follow(6,'reissue',8,{acknowledgeUncertain:true}),/completed setup/)
  assert.equal((await summary(1)).find(i=>i.id===6).progress,'Account setup completed')
  // Duplicate matches require an explicit reviewer acknowledgement.
  await db.exec("UPDATE inquiry SET inquiry_contact_email='same@example.com' WHERE inquiry_id IN (4,5)")
  assert.equal((await summary(1)).find(i=>i.id===4).duplicates.length,1)
  const approve=async ack=>db.query('SELECT review_super_admin_inquiry($1,$2,$3,$4,$5)',[4,1,'approve',{updatedAt:await current(4),authUserId:token(99),offer:{},acknowledgeDuplicates:ack},token(9)])
  await assert.rejects(approve(false),/Possible duplicate/)
  await approve(true)
  assert.equal((await db.query("SELECT count(*)::int n FROM inquiry_activity WHERE inquiry_id=4 AND action='Approved'")).rows[0].n,1)
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','inquiry_note','SELECT') allowed")).rows[0].allowed,false)
  assert.equal((await db.query("SELECT has_function_privilege('anon','submit_inquiry_correction(text,jsonb)','EXECUTE') allowed")).rows[0].allowed,false)
 } finally {await db.close()}
})

test('correction API rejects invalid tokens and fields without leaking data',async()=>{
 const Fastify=require('fastify'),register=require('../modules/inquiries/correctionsPublic')
 const app=Fastify();let calls=0
 app.decorate('supabase',{async rpc(name,args){calls++;assert.equal(args.p_hash,hashToken('a'.repeat(64)));return {data:{fields,email:'owner@example.com'}}}})
 register(app)
 try {
  const invalid=await app.inject({method:'POST',url:'/api/inquiry-corrections',payload:{token:'bad'}})
  assert.equal(invalid.statusCode,400);assert.equal(calls,0)
  const valid=await app.inject({method:'POST',url:'/api/inquiry-corrections',payload:{token:'a'.repeat(64)}})
  assert.equal(valid.statusCode,200);assert.equal(valid.headers['cache-control'],'no-store')
  assert.equal(calls,1)
  const badFields=await app.inject({method:'POST',url:'/api/inquiry-corrections',payload:{token:'a'.repeat(64),fields:{...fields,floors:1.5}}})
  assert.equal(badFields.statusCode,400);assert.equal(calls,1)
  assert.equal(correctionFields({...fields,email:'attacker@example.com',status:'Approved'}).email,undefined)
  assert.throws(()=>safeOrigin('http://example.com',null,{}),/HTTPS/)
 }finally{await app.close()}
})

test('correction requests email a hashed single-use link once and keep notes out of delivery',async()=>{
 const Fastify=require('fastify'),{registerFollowup}=require('../modules/inquiries/followup')
 const app=Fastify();let sent=0,saved,link,kind
 const seen=new Set()
 const db={async rpc(name,args){saved=args;const replayed=seen.has(args.p_request);seen.add(args.p_request);return {data:{message_id:20,replayed}}}}
 app.addHook('preHandler',async req=>{req.admin={id:7,name:'Reviewer'}})
 registerFollowup(app,{db,env:{INQUIRY_PUBLIC_ORIGIN:'https://api.example.com'},wrap:fn=>fn,
  inquiry:async()=>({inquiry_id:1,inquiry_contact_email:'owner@example.com'}),getTransport:()=>({}),events:{publish(){}},
  deliver:async(req,row,result,transport,url,type)=>{sent++;link=url;kind=type;return null}})
 try {
  const payload={action:'corrections',requestId:token(20),reason:'Please update your address',updatedAt:'2026-10-19T00:00:00Z'}
  const result=await app.inject({method:'POST',url:'/api/inquiries/1/followup',payload})
  assert.equal(result.statusCode,200);assert.equal(saved.p_actor,7)
  assert.equal(sent,1);assert.equal(kind,'corrections')
  assert.equal(new URL(link).pathname,'/inquiry-corrections')
  assert.equal(saved.p_data.tokenHash,hashToken(new URL(link).hash.slice(1)))
  assert.equal(saved.p_data.token,undefined)
  const retry=await app.inject({method:'POST',url:'/api/inquiries/1/followup',payload})
  assert.equal(retry.statusCode,200);assert.equal(sent,1)
  await app.inject({method:'POST',url:'/api/inquiries/1/notes',payload:{requestId:token(21),text:'Private'}})
  assert.equal(sent,1);assert.equal(saved.p_action,'note')
 }finally{await app.close()}
})
