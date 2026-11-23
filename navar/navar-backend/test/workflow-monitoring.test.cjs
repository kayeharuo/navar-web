const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const fs=require('node:fs'),path=require('node:path')
const read=f=>fs.readFileSync(path.join(__dirname,'../database_schema',f),'utf8')
test('database changes generate deduplicated Super Admin alerts without interface calls',async()=>{
 const db=new PGlite()
 try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/subscription-baseline.sql'),'utf8'))
  await db.exec(read('42_subscription_lifecycle.sql'))
  await db.exec(`CREATE TABLE stall(stall_id bigint PRIMARY KEY,floor_id bigint,s_application_id bigint,store_id bigint);CREATE TABLE beacon(beacon_id bigint PRIMARY KEY,mall_id bigint,beacon_status text);CREATE TABLE beacon_ticket(ticket_id bigint PRIMARY KEY,mall_id bigint,beacon_id bigint,ticket_current_status text);CREATE TABLE payment(payment_id bigint PRIMARY KEY,payment_paid_at timestamptz,payment_type text,contract_id bigint,s_application_id bigint);`)
  await db.exec(read('54_workflow_monitor_notifications.sql'))
  await db.exec(`INSERT INTO mall(mall_id,mall_name) VALUES(1,'Monitoring mall');
   INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_deactivated) VALUES(1,'super_admin','official',false),(2,'mall_admin','official',false),(3,'super_admin','partial',false),(4,'super_admin','official',true);
   INSERT INTO floor(floor_id,mall_id) VALUES(1,1);
   INSERT INTO application(application_id,mall_id,application_version,application_status) VALUES(10,1,1,'draft');
   UPDATE application SET application_status='submitted' WHERE application_id=10;
   UPDATE application SET application_status='submitted' WHERE application_id=10;
   INSERT INTO stall_application(s_application_id,mall_id,s_application_status) VALUES(20,1,'submitted');
   INSERT INTO ar_development(ar_development_id,application_id,ar_development_version,ar_development_status) VALUES(30,10,1,'ready');
   UPDATE ar_development SET ar_development_mall_approved_at=now() WHERE ar_development_id=30;
   UPDATE ar_development SET ar_development_mall_approved_at=ar_development_mall_approved_at WHERE ar_development_id=30;
   UPDATE ar_development SET ar_development_status='live' WHERE ar_development_id=30;
   INSERT INTO contract_payment_request(request_id,mall_id,fee_type,status,amount_cent) VALUES(40,1,'onboarding','pending',3017850);
   UPDATE contract_payment_request SET status='paid' WHERE request_id=40;
   UPDATE contract_payment_request SET status='paid' WHERE request_id=40;
   INSERT INTO contract(contract_id,mall_id,contract_version,contract_is_current,contract_status,contract_start,contract_end,contract_grace_period_days,tier_snapshot,change_type) VALUES(2,1,2,true,'active',now(),now()+interval '1 year',5,'{"s_tier_label":"Basic"}','initial');
   INSERT INTO store(store_id,mall_id,store_type,store_status,store_name) VALUES(50,1,'store','inactive','Former tenant');
   DELETE FROM store WHERE store_id=50;
   INSERT INTO stall(stall_id,floor_id,s_application_id) VALUES(60,1,20);
   DELETE FROM stall WHERE stall_id=60;
   INSERT INTO mall_service_request(service_id,mall_id,kind,status) VALUES(70,1,'structural_update','requested');
   UPDATE contract_payment_request SET fulfillment_error='Needs reconciliation' WHERE request_id=40;
   INSERT INTO contract_payment_request(request_id,mall_id,fee_type,status,amount_cent) VALUES(41,1,'map_update','paid',2500000);
   INSERT INTO beacon(beacon_id,mall_id,beacon_status) VALUES(80,1,'active');
   INSERT INTO beacon_ticket(ticket_id,mall_id,beacon_id,ticket_current_status) VALUES(81,1,80,'open');
   UPDATE beacon SET beacon_status='missing' WHERE beacon_id=80;
   INSERT INTO payment(payment_id,contract_id,payment_type,payment_paid_at) VALUES(90,2,'Stall fee',now());
   UPDATE contract SET cancellation_requested_at=now() WHERE contract_id=2;`)
  const rows=(await db.query('select * from admin_notification')).rows
  for(const title of ['Map application submitted','Stall application submitted','AR approved by mall','AR published','Onboarding payment received','Subscription activated','Store removed after publication','Stall or store location removed','Structural Update request updated','Payment requires review','Map Update payment received','Beacon service ticket updated','Beacon requires attention','Payment received','Subscription cancellation requested']) assert.ok(rows.some(n=>n.admin_notif_title===title),title)
  assert.ok(rows.every(n=>n.admin_id===1))
  assert.equal(rows.filter(n=>n.admin_notif_title==='AR approved by mall').length,1)
  assert.equal(rows.filter(n=>n.admin_notif_title==='Onboarding payment received').length,1)
  assert.equal(rows.filter(n=>n.admin_notif_title==='Map application submitted').length,1)
  await db.exec("UPDATE contract SET contract_end=now()-interval '2 days' WHERE contract_id=2; SELECT monitor_subscription_deadlines(); SELECT monitor_subscription_deadlines();")
  assert.equal((await db.query("select count(*)::int n from admin_notification where admin_notif_title='Subscription under grace period'")).rows[0].n,1)
  await db.exec("UPDATE contract SET contract_end=now()-interval '10 days' WHERE contract_id=2; SELECT monitor_subscription_deadlines(); SELECT monitor_subscription_deadlines();")
  assert.equal((await db.query("select count(*)::int n from admin_notification where admin_notif_title='Subscription not renewed'")).rows[0].n,1)
  const before=(await db.query('select count(*)::int n from admin_notification')).rows[0].n
  await db.exec('BEGIN;UPDATE application SET application_status=\'draft\' WHERE application_id=10; UPDATE application SET application_status=\'submitted\' WHERE application_id=10;ROLLBACK;')
  assert.equal((await db.query('select count(*)::int n from admin_notification')).rows[0].n,before)
  assert.equal((await db.query("select has_function_privilege('authenticated','public.monitor_subscription_deadlines()','execute') allowed")).rows[0].allowed,false)
 }finally{await db.close()}
})

