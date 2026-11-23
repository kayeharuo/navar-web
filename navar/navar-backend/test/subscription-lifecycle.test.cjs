const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {subscriptionState,renewalDates,reminderKind}=require('../modules/subscriptions/domain')
const {estimateQuote}=require('../modules/subscriptions/quote')
const {verifySignature}=require('../modules/subscriptions/paymongo')
test('Manila inclusive expiry, grace, reminders and renewal dates remain anchored',()=>{
 const c={contract_start:'2025-11-21T16:00:00Z',contract_end:'2026-11-21T15:59:59.999Z',contract_grace_period_days:15}
 assert.equal(subscriptionState(c,null,new Date('2026-11-21T04:00Z')).status,'Active')
 assert.equal(subscriptionState(c,null,new Date('2026-11-21T16:00Z')).status,'Grace Period')
 assert.equal(subscriptionState(c,null,new Date('2026-12-06T04:00Z')).status,'Grace Period')
 assert.equal(subscriptionState(c,null,new Date('2026-12-06T16:00Z')).status,'Suspended')
 assert.equal(reminderKind(c,new Date('2026-11-21T16:00Z')),'grace_started')
 assert.deepEqual(renewalDates(c.contract_end),{start:'2026-11-21T16:00:00.000Z',end:'2027-11-21T15:59:59.999Z'})
})
test('quote math uses updated margin, installation and unchanged fixed stall fees',()=>{
 const q=estimateQuote({stores:150,tenants:120,averageRent:50000,floors:[{floorNum:1,areaSqm:4000,hallwaySqm:1200,connectors:8},{floorNum:2,areaSqm:4000,hallwaySqm:1200,connectors:6},{floorNum:3,areaSqm:2000,hallwaySqm:600,connectors:5}]})
 assert.equal(q.installed,219);assert.equal(q.spares,11);assert.equal(q.costCent,29741250);assert.equal(q.amountCent,37200000)
 assert.throws(()=>estimateQuote({stores:3,tenants:4,averageRent:1,floors:[]}),/Provide/)
})
test('PayMongo signatures reject tampering and stale deliveries',()=>{
 const body='{"data":{"id":"evt_test"}}',secret='test_secret',timestamp=Math.floor(Date.now()/1000)
 const signature=crypto.createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')
 assert.equal(verifySignature(body,`t=${timestamp},te=${signature}`,secret),true)
 assert.equal(verifySignature(body+' ',`t=${timestamp},te=${signature}`,secret),false)
 assert.equal(verifySignature(body,`t=${timestamp},te=${signature}`,secret,(timestamp+301)*1000),false)
})
test('lifecycle migrations compile; suspension preserves dates and enforces payment; store labels and capacity',async()=>{
 const db=new PGlite()
 try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/subscription-baseline.sql'),'utf8'))
  await db.exec('CREATE TABLE operating_hours(opthrs_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,mall_id bigint,opthrs_is_mall boolean,opthrs_day_of_week text,opthrs_is_closed boolean,opthrs_open_time time,opthrs_close_time time)')
  for(const file of ['42_subscription_lifecycle.sql','43_subscription_payment_bridge.sql','44_subscription_settlement_and_diagnostics.sql','45_subscription_scheduled_tiers.sql','47_editable_rates_and_ar_queue.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema',file),'utf8'))
  await db.exec(`
   INSERT INTO mall(mall_id,mall_name,quoted_store_count,is_subscription_test) VALUES(1,'Test mall',1,true);
   INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_deactivated,admin_email,mall_id) VALUES(1,'super_admin','official',false,'admin@example.test',NULL),(2,'mall_admin','official',false,'mall@example.test',1);
   INSERT INTO subscription_tier(s_tier_id,s_tier_key,s_tier_label,s_tier_annual_fee,s_tier_grace_period_days,s_tier_reinstatement_rate,s_tier_map_updates_per_year) VALUES(1,'basic','Basic',25000,15,0.2,0);
   INSERT INTO contract(contract_id,mall_id,contract_is_current,contract_start,contract_end,contract_annual_fee,contract_grace_period_days,contract_reinstatement_rate,contract_status,s_tier_id) VALUES(1,1,true,now()-interval '1 month',now()+interval '11 months',25000,15,0.2,'active',1);
   INSERT INTO application(application_id,mall_id,application_status) VALUES(1,1,'approved');
   INSERT INTO ar_development(ar_development_id,application_id,ar_development_status,ar_development_mall_approved_at) VALUES(1,1,'live',now());
   CREATE TRIGGER enforce_ar_release BEFORE INSERT OR UPDATE OF ar_development_status ON ar_development FOR EACH ROW EXECUTE FUNCTION app_private.enforce_ar_release();
  `)
  const term=(await db.query('select contract_start,contract_end from contract where contract_id=1')).rows[0]
  await db.query("select manage_subscription_suspension(1,1,'suspend','Operational','Renovation',0)")
  assert.equal((await db.query('select ar_development_status from ar_development')).rows[0].ar_development_status,'unpublished')
  assert.deepEqual((await db.query('select contract_start,contract_end from contract where contract_id=1')).rows[0],term)
  assert.equal((await db.query('select count(*)::int n from notification')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from admin_notification')).rows[0].n,2)
  await assert.rejects(db.query("select manage_subscription_suspension(1,2,'lift')"),/Access denied/)
  // Release is still blocked by missing actual application requirements.
  await assert.rejects(db.query("select manage_subscription_suspension(1,1,'lift')"),/complete every profile/)
  await db.exec("update ar_development set ar_development_mall_approved_at=NULL")
  await db.query("select manage_subscription_suspension(1,1,'lift')")
  await db.query("select manage_subscription_suspension(1,1,'suspend','Breach of Contract','Test breach',500)")
  await assert.rejects(db.query("select manage_subscription_suspension(1,1,'lift')"),/Verified/)
  await db.exec("insert into floor(floor_id,mall_id,floor_num,floor_label) values(1,1,1,'Ground'); insert into store(store_id,mall_id,store_name,store_type,store_status) values(1,1,'Old store','store','mapped')")
  await assert.rejects(db.exec("insert into store(store_id,mall_id,store_name,store_type,store_status) values(2,1,'Too many','store','mapped')"),/capacity/)
  await db.exec("update store set store_status='inactive' where store_id=1; insert into store(store_id,mall_id,store_name,store_type,store_status) values(2,1,'New store','store','mapped')")
  await db.exec("insert into unit(unit_id,floor_id,store_id) values(1,1,1);insert into ar_development(ar_development_id,application_id,ar_development_status,ar_development_map_revision) values(2,1,'testing',0);insert into node(node_id,unit_id,node_type,node_label,ar_development_id) values(1,1,'STORE_ENTRANCE','Old store',2);update unit set store_id=2 where unit_id=1")
  assert.equal((await db.query('select node_label from node')).rows[0].node_label,'New store')
  const issues=(await db.query('select application_readiness_issues(1) issues')).rows[0].issues
  assert(issues.some(i=>i.includes('route descriptions')))
 }finally{await db.close()}
})

test('verified test onboarding, first publication, duplicate webhook and late reinstatement',async()=>{
 const db=new PGlite()
 try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/subscription-baseline.sql'),'utf8'))
  await db.exec('CREATE TABLE operating_hours(opthrs_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,mall_id bigint,opthrs_is_mall boolean,opthrs_day_of_week text,opthrs_is_closed boolean,opthrs_open_time time,opthrs_close_time time)')
  for(const file of ['42_subscription_lifecycle.sql','43_subscription_payment_bridge.sql','44_subscription_settlement_and_diagnostics.sql','45_subscription_scheduled_tiers.sql','47_editable_rates_and_ar_queue.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema',file),'utf8'))
  await db.exec(`
   INSERT INTO mall(mall_id,mall_name,mall_address,mall_city,mall_state,mall_logo) VALUES(1,'Test mall','Address','City','Province',decode('01','hex'));
   INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_deactivated,admin_email,mall_id) VALUES(1,'super_admin','official',false,'admin@example.test',NULL),(2,'mall_admin','official',false,'mall@example.test',1);
   INSERT INTO subscription_tier(s_tier_id,s_tier_key,s_tier_label,s_tier_annual_fee,s_tier_grace_period_days,s_tier_reinstatement_rate,s_tier_map_updates_per_year) VALUES(1,'basic','Basic',25000,15,0.2,0);
   INSERT INTO application(application_id,mall_id,application_status,application_version,application_attempt) VALUES(1,1,'approved',1,1);
   INSERT INTO floor(floor_id,mall_id,floor_num,floor_label) VALUES(1,1,1,'Ground');
   INSERT INTO application_floor_plan(application_id,floor_id,app_floor_plan_image,app_floor_plan_meter_length,app_floor_plan_reference_line,app_floor_plan_accessibility_route,app_floor_plan_emergency_route) VALUES(1,1,decode('01','hex'),10,'A to B','Main accessible corridor','Exit via main entrance');
   INSERT INTO application_entry_point(application_id,floor_id,app_entry_point_label,app_entry_point_description) VALUES(1,1,'Main entrance','Enter from the street');
   INSERT INTO operating_hours(mall_id,opthrs_is_mall,opthrs_day_of_week,opthrs_is_closed,opthrs_open_time,opthrs_close_time) SELECT 1,true,day,false,'09:00','18:00' FROM unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) day;
   INSERT INTO ar_development(ar_development_id,application_id,ar_development_status,ar_development_version) VALUES(1,1,'testing',1);
   CREATE TRIGGER enforce_ar_release BEFORE INSERT OR UPDATE OF ar_development_status ON ar_development FOR EACH ROW EXECUTE FUNCTION app_private.enforce_ar_release();
   CREATE TRIGGER guard_onboarding_checkout_claim BEFORE INSERT ON mall_payment_checkout FOR EACH ROW EXECUTE FUNCTION app_private.guard_onboarding_checkout_claim();
   CREATE TRIGGER activate_verified_subscription AFTER UPDATE OF status ON contract_payment_request FOR EACH ROW WHEN(NEW.status='paid' AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION app_private.activate_verified_subscription();
  `)
  const input={stores:3,tenants:3,averageRent:50000,floors:[{floorNum:1,areaSqm:100}]},estimate=estimateQuote(input)
  await db.query('select prepare_subscription_test_mall(1,1,$1,$2)',[JSON.stringify(input),JSON.stringify(estimate)])
  const prepare=async (fee,tier='basic')=>(await db.query('select prepare_subscription_payment(1,1,$1,$2,true) request',[fee,tier])).rows[0].request
  const settle=async(r,index)=>{
   await db.query('insert into mall_payment_checkout(request_id,session_id,amount_cent,livemode) values($1,$2,$3,false)',[r.request_id,`cs_test${index}`,r.amount_cent])
   return db.query('select settle_subscription_payment($1,$2,$3,$4,now()) result',[r.request_id,`cs_test${index}`,`pay_test${index}`,r.amount_cent])
  }
  await assert.rejects(prepare('subscription'),/onboarding payment/)
  const onboarding=await prepare('onboarding');await settle(onboarding,1)
  assert.equal((await db.query('select status from onboarding_quote')).rows[0].status,'paid')
  await assert.rejects(prepare('subscription'),/Ready AR/)
  await db.query("select workflow_action(1,1,'ar_status','','ready')")
  await db.query('select acknowledge_test_ar(1,1)')
  const subscription=await prepare('subscription')
  assert.equal((await settle(subscription,2)).rows[0].result.fulfilled,true)
  assert.equal((await db.query('select ar_development_status from ar_development')).rows[0].ar_development_status,'live')
  assert.equal((await db.query('select count(*)::int n from contract')).rows[0].n,1)
  await db.query('select settle_subscription_payment($1,$2,$3,$4,now())',[subscription.request_id,'cs_test2','pay_test2',subscription.amount_cent])
  assert.equal((await db.query('select count(*)::int n from contract')).rows[0].n,1)
  await assert.rejects(db.query('select settle_subscription_payment($1,$2,$3,$4,now())',[subscription.request_id,'cs_test2','pay_wrong',1]),/does not match/)
  await db.exec("insert into subscription_tier(s_tier_id,s_tier_key,s_tier_label,s_tier_annual_fee,s_tier_grace_period_days,s_tier_reinstatement_rate,s_tier_map_updates_per_year) values(2,'standard','Standard',33000,30,0.15,0)")
  const originalEnd=(await db.query('select contract_end from contract where contract_is_current')).rows[0].contract_end
  const upgrade=await prepare('upgrade','standard');await settle(upgrade,4)
  assert.deepEqual((await db.query('select contract_end from contract where contract_is_current')).rows[0].contract_end,originalEnd)
  await db.query("select schedule_subscription_downgrade(1,1,'basic',true)")
  assert.equal((await db.query('select s_tier_id from contract where contract_is_current')).rows[0].s_tier_id,2)
  assert.equal((await db.query("select count(*)::int n from contract where scheduled and change_type='downgrade'")).rows[0].n,1)
  await db.exec("update contract set contract_end=now()-interval '40 days' where contract_is_current")
  const expiry=(await db.query('select contract_end from contract where contract_is_current')).rows[0].contract_end
  await db.query("select manage_subscription_suspension(1,NULL,'suspend','Non-Payment','Overdue',0)")
  const reinstatement=await prepare('reinstatement')
  assert.equal(reinstatement.amount_cent,2995000)
  assert.equal((await settle(reinstatement,3)).rows[0].result.fulfilled,true)
  const current=(await db.query('select * from contract where contract_is_current')).rows[0]
  assert.equal(current.contract_start.toISOString(),renewalDates(expiry).start)
  assert.equal((await db.query('select ar_development_status from ar_development')).rows[0].ar_development_status,'live')
 }finally{await db.close()}
})
