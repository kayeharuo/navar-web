const {test}=require('node:test'),assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path')
const {mapUpdateState}=require('../modules/mapApplications/paymentState')
const {historyDetails}=require('../modules/applicationManagement/reviewHistory')

test('rejected review rounds are immutable and unpaid requests cannot approve or request revision',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE SCHEMA app_private;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE TABLE admin(admin_id bigint PRIMARY KEY);INSERT INTO admin VALUES(1);
   CREATE TABLE mall(mall_id bigint PRIMARY KEY,mall_name text);INSERT INTO mall VALUES(1,'History Mall');
   CREATE TABLE application(application_id bigint PRIMARY KEY,mall_id bigint,application_version int,application_attempt int DEFAULT 1,application_status text,application_dispute_count int DEFAULT 0,application_accepted_at timestamptz,application_created_at timestamptz DEFAULT now(),application_updated_at timestamptz DEFAULT now(),application_reason_notes text,application_reason_category text);
   CREATE TABLE floor(floor_id bigint,mall_id bigint,floor_num int,floor_label text);
   CREATE TABLE application_floor_plan(app_floor_plan_id bigint,application_id bigint,floor_id bigint,app_floor_plan_updated_at timestamptz DEFAULT now(),app_floor_plan_image bytea);
   CREATE TABLE application_entry_point(app_entry_point_id bigint,application_id bigint,floor_id bigint,app_entry_point_updated_at timestamptz DEFAULT now());
   CREATE TABLE operating_hours(opthrs_id bigint,mall_id bigint,opthrs_is_mall boolean);
   CREATE TABLE mall_service_request(service_id bigint PRIMARY KEY,application_id bigint,kind text,status text,quote jsonb,payment_request_id bigint);
   CREATE TABLE contract_payment_request(request_id bigint PRIMARY KEY,status text,amount_cent bigint,fulfilled_at timestamptz,reconciliation_reason text);
   CREATE TABLE thread(thread_id bigint PRIMARY KEY,application_id bigint);
   CREATE TABLE thread_message(message_id bigint GENERATED ALWAYS AS IDENTITY,thread_id bigint,message_sender bigint,message_sender_type text,message_sent_at timestamptz,message_content text);
   CREATE TABLE thread_message_attachment(thread_message_id bigint);
   CREATE TABLE audit_log(mall_id bigint,audit_log_action text,audit_log_performed_by bigint,audit_log_performed_at timestamptz);
   INSERT INTO application(application_id,mall_id,application_version,application_status,application_reason_notes) VALUES(10,1,2,'pending','Original submission'),(11,1,2,'submitted','Payment case'),(12,1,2,'submitted','Included case');
   INSERT INTO floor VALUES(1,1,1,'Floor 1');INSERT INTO application_floor_plan VALUES(20,10,1,now(),decode('89504e470d0a1a0a','hex'));INSERT INTO thread VALUES(1,10);
   INSERT INTO mall_service_request VALUES(5,11,'map_update','awaiting_payment','{"amount_cent":2800000}',6),(7,12,'map_update','queued','{"amount_cent":0}',NULL);
   INSERT INTO contract_payment_request VALUES(6,'pending',2800000,NULL,NULL);
   CREATE FUNCTION public.workflow_action(p_id bigint,p_actor bigint,p_action text,p_text text DEFAULT '',p_target text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$BEGIN
    IF p_action='reject' THEN UPDATE application SET application_status=CASE WHEN application_dispute_count=2 THEN 'rejected_final' ELSE 'rejected' END WHERE application_id=p_id;
    ELSIF p_action='dispute' THEN UPDATE application SET application_status='disputed',application_dispute_count=application_dispute_count+1 WHERE application_id=p_id;
    ELSE UPDATE application SET application_status=CASE WHEN p_action='revision' THEN 'for_revision' ELSE 'approved' END WHERE application_id=p_id;END IF;
    IF p_action IN ('reject','dispute') THEN INSERT INTO thread_message(thread_id,message_sender,message_sender_type,message_sent_at,message_content) VALUES(1,p_actor,CASE WHEN p_action='reject' THEN 'admin' ELSE 'mall_admin' END,now(),p_text);END IF;
    RETURN '{}';END $$;`)
  await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema/68_application_review_history.sql'),'utf8'))
  await db.query("SELECT workflow_action(10,1,'reject','First rejection')")
  const first=(await db.query('SELECT payload FROM application_review_history WHERE review_round=1')).rows[0].payload
  await db.exec("UPDATE application SET application_reason_notes='Later changes' WHERE application_id=10;UPDATE application_floor_plan SET app_floor_plan_image=decode('ffd8ff','hex') WHERE application_id=10;")
  await db.query("SELECT workflow_action(10,1,'dispute','First dispute')")
  await db.query("SELECT workflow_action(10,1,'reject','Second rejection')")
  await db.query("SELECT workflow_action(10,1,'dispute','Second dispute')")
  await db.query("SELECT workflow_action(10,1,'reject','Final rejection')")
  const history=(await db.query('SELECT review_round,decision_status,payload FROM application_review_history ORDER BY review_round')).rows
  assert.deepEqual(history.map(h=>h.review_round),[1,2,3])
  assert.deepEqual(history.map(h=>h.decision_status),['rejected','rejected','rejected_final'])
  assert.deepEqual(history.map(h=>h.payload.messages.length),[1,3,5])
  assert.equal(history[0].payload.application.application_reason_notes,'Original submission')
  assert.deepEqual(history[0].payload.plans,first.plans)
  for(const action of ['approve','revision'])await assert.rejects(()=>db.query('SELECT workflow_action(11,1,$1)',[action]),/Record the map-update payment/)
  await db.exec("UPDATE mall_service_request SET status='queued' WHERE service_id=5")
  await assert.rejects(()=>db.query("SELECT workflow_action(11,1,'revision')"),/Record the map-update payment/)
  await db.exec("UPDATE contract_payment_request SET status='paid',fulfilled_at=now(),reconciliation_reason='Needs reconciliation' WHERE request_id=6")
  assert.equal((await db.query('SELECT app_private.map_application_payment_cleared(11) AS ok')).rows[0].ok,false)
  await db.exec('UPDATE contract_payment_request SET reconciliation_reason=NULL WHERE request_id=6')
  await db.query("SELECT workflow_action(11,1,'revision')")
  await db.query("SELECT workflow_action(11,1,'approve')")
  await db.query("SELECT workflow_action(12,1,'approve')")
  assert.equal((await db.query('SELECT application_status FROM application WHERE application_id=11')).rows[0].application_status,'approved')
 }finally{await db.close()}
})

test('review history responses use saved details and archived plan links rather than current mutable content',async()=>{
 const base={id:10,reasonNotes:'New content',versions:[{application_id:10}],readOnly:false,canRevise:true}
 const record={history_id:2,review_round:1,decision_status:'rejected',rejection_reason:'Original rejection',reviewed_at:'2026-11-23T12:00:00Z',payload:{application:{application_attempt:1,application_version:2,application_reason_notes:'Old content',application_dispute_count:0},floors:[{floor_id:49,floor_label:'Floor 1'}],plans:[{floor_id:49,app_floor_plan_id:20,app_floor_plan_file_name:'original.png',app_floor_plan_reference_line:'A to B',app_floor_plan_meter_length:6}],messages:[{message_id:1,message_sender_type:'admin',message_content:'Original rejection',message_sent_at:'2026-11-23T12:00:00Z'}]}}
 const data=await historyDetails({},base,record)
 assert.equal(data.readOnly,true);assert.equal(data.canRevise,false);assert.equal(data.reasonNotes,'Old content')
 assert.equal(data.floorPlans[0].previewEndpoint,'/api/applications/10/review-history/2/plans/49')
 assert.equal(data.thread.length,1);assert.equal(base.reasonNotes,'New content')
})

test('payment display only clears included allowance or fully fulfilled matching paid receipts',async()=>{
 const service={status:'queued',quote:{amount_cent:2800000},inputs:{floorIds:[49]},payment_request_id:6}
 const pay={status:'pending',amount_cent:2800000,fulfilled_at:null,reconciliation_reason:null}
 const db={from(table){const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>Promise.resolve({data:table==='mall_service_request'?[service]:pay,error:null}).then(resolve);return()=>q}});return q}}
 assert.equal((await mapUpdateState(db,10)).paymentCleared,false)
 Object.assign(pay,{status:'paid',fulfilled_at:'2026-11-23T12:00:00Z'})
 assert.equal((await mapUpdateState(db,10)).paymentCleared,true)
 pay.amount_cent=1;assert.equal((await mapUpdateState(db,10)).paymentCleared,false)
 service.quote.amount_cent=0;service.payment_request_id=null
 assert.equal((await mapUpdateState(db,10)).paymentCleared,true)
 service.status='awaiting_payment';assert.equal((await mapUpdateState(db,10)).paymentCleared,false)
})
