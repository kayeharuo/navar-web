const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {PGlite}=require('@electric-sql/pglite')
const {estimateQuote}=require('../modules/subscriptions/quote')
async function setup(){
 const db=new PGlite()
 await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/subscription-baseline.sql'),'utf8'))
 await db.exec('CREATE TABLE operating_hours(opthrs_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,mall_id bigint,opthrs_is_mall boolean,opthrs_day_of_week text,opthrs_is_closed boolean,opthrs_open_time time,opthrs_close_time time)')
 await db.exec('CREATE TABLE wallet(wallet_id bigint PRIMARY KEY,mall_id bigint);CREATE TABLE payment(payment_id bigint PRIMARY KEY,contract_id bigint REFERENCES contract(contract_id),wallet_id bigint,payment_type text,payment_amount numeric,payment_paid_at timestamptz,s_application_id bigint);')
 for(const file of ['42_subscription_lifecycle.sql','43_subscription_payment_bridge.sql','44_subscription_settlement_and_diagnostics.sql','45_subscription_scheduled_tiers.sql','47_editable_rates_and_ar_queue.sql','50_manual_subscription_test_payments.sql','56_mall_owned_onboarding.sql','57_mall_onboarding_adapters.sql','58_mall_owned_payment_monitoring.sql','59_restrict_legacy_manual_settlement.sql']) await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema',file),'utf8'))
 await db.exec(`
 INSERT INTO mall(mall_id,mall_name,mall_address,mall_city,mall_state,mall_logo) VALUES(1,'Gaisano Fiesta Mall','Address','City','Province',decode('01','hex')),(2,'Production mall','Address','City','Province',decode('01','hex'));
 INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_deactivated,admin_email,mall_id) VALUES(1,'super_admin','official',false,'admin@example.test',NULL),(2,'mall_admin','official',false,'mall@example.test',1);
 INSERT INTO subscription_tier(s_tier_id,s_tier_key,s_tier_label,s_tier_annual_fee,s_tier_grace_period_days,s_tier_reinstatement_rate,s_tier_map_updates_per_year) VALUES(1,'basic','Basic',25000,15,0.2,0),(2,'standard','Standard',33000,15,0.2,0);
 INSERT INTO application(application_id,mall_id,application_status,application_version,application_attempt) VALUES(1,1,'approved',1,1);
 INSERT INTO floor(floor_id,mall_id,floor_num,floor_label) VALUES(1,1,1,'Ground');
 INSERT INTO application_floor_plan(application_id,floor_id,app_floor_plan_image,app_floor_plan_meter_length,app_floor_plan_reference_line,app_floor_plan_accessibility_route,app_floor_plan_emergency_route) VALUES(1,1,decode('01','hex'),10,'A to B','Accessible corridor','Exit through main entrance');
 INSERT INTO application_entry_point(application_id,floor_id,app_entry_point_label,app_entry_point_description) VALUES(1,1,'Main entrance','Enter from the street');
 INSERT INTO operating_hours(mall_id,opthrs_is_mall,opthrs_day_of_week,opthrs_is_closed,opthrs_open_time,opthrs_close_time) SELECT 1,true,day,false,'09:00','18:00' FROM unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) day;
 INSERT INTO ar_development(ar_development_id,application_id,ar_development_status,ar_development_version) VALUES(1,1,'testing',1);
 CREATE TRIGGER enforce_ar_release BEFORE INSERT OR UPDATE OF ar_development_status ON ar_development FOR EACH ROW EXECUTE FUNCTION app_private.enforce_ar_release();
 CREATE TRIGGER activate_verified_subscription AFTER UPDATE OF status ON contract_payment_request FOR EACH ROW WHEN(NEW.status='paid' AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION app_private.activate_verified_subscription();
 CREATE FUNCTION app_private.freeze_payment_amount() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF OLD.pricing_model='v3' AND (NEW.amount_cent,NEW.mall_id,NEW.quote_id,NEW.fee_type,NEW.details) IS DISTINCT FROM (OLD.amount_cent,OLD.mall_id,OLD.quote_id,OLD.fee_type,OLD.details) THEN
   RAISE EXCEPTION 'Payment request amount and purpose are immutable.';
  END IF;
  RETURN NEW;
 END $$;
 CREATE TRIGGER freeze_payment_amount BEFORE UPDATE ON contract_payment_request FOR EACH ROW EXECUTE FUNCTION app_private.freeze_payment_amount();
 `)
 const inputs={stores:3,tenants:3,averageRent:50000,floors:[{floorNum:1,areaSqm:100}]}
 await db.query('select prepare_subscription_test_mall(1,1,$1,$2)',[inputs,estimateQuote(inputs)])
 return db
}
test('manual test payments require acknowledgment, admin identity, a test mall, and normal AR approval',async()=>{
 const db=await setup()
 try{
  const pay=(fee,actor=1,mall=1,ack=true,tier='basic')=>db.query('select simulate_subscription_payment($1,$2,$3,$4,$5) result',[mall,actor,fee,tier,ack])
  await assert.rejects(pay('onboarding',1,1,false),/Confirm/)
  await assert.rejects(pay('onboarding',2),/Super Admin/)
  await assert.rejects(pay('onboarding',1,2),/test malls/)
  await assert.rejects(pay('subscription'),/onboarding payment/)
  const onboard=(await pay('onboarding')).rows[0].result
  assert.equal(onboard.fulfilled,true)
  assert.equal((await db.query('select status from onboarding_quote')).rows[0].status,'paid')
  assert.equal((await db.query('select count(*)::int n from contract')).rows[0].n,0)
  assert.equal((await db.query("select contract_id from contract_payment_request where fee_type='onboarding'")).rows[0].contract_id,null)
  assert.equal((await db.query('select count(*)::int n from mall_payment_checkout')).rows[0].n,0)
  assert.equal((await db.query('select paymongo_payment_id from contract_payment_request')).rows[0].paymongo_payment_id,null)
  assert.equal((await pay('onboarding')).rows[0].result.alreadyPaid,true)
  await assert.rejects(pay('subscription'),/Ready AR/)
  await db.query("select workflow_action(1,1,'ar_status','','ready')")
  await assert.rejects(pay('subscription'),/Ready AR/)
  await db.query('select acknowledge_test_ar(1,1)')
  const annual=(await pay('subscription')).rows[0].result
  assert.equal(annual.fulfilled,true)
  assert.equal((await db.query('select ar_development_status from ar_development')).rows[0].ar_development_status,'live')
  const contract=(await db.query('select * from contract where contract_is_current')).rows[0]
  assert.equal(contract.contract_version,1);assert.equal(contract.contract_onboarding_fee,0);
  assert.equal((await db.query('select contract_id from mall_onboarding')).rows[0].contract_id,null)
  assert.equal(contract.is_test,true);assert.equal(contract.contract_status,'active')
  assert.equal((await db.query('select has_simulated_subscription_payment(1) paid')).rows[0].paid,true)
  assert.equal((await pay('subscription')).rows[0].result.alreadyPaid,true)
  assert.equal((await db.query('select count(*)::int n from contract where contract_is_current')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from subscription_test_payment')).rows[0].n,2)
  assert.equal((await db.query('select count(*)::int n from mall_payment_checkout')).rows[0].n,0)
  await pay('upgrade',1,1,true,'standard')
  assert.equal((await db.query('select s_tier_id from contract where contract_is_current')).rows[0].s_tier_id,2)
  assert.equal((await db.query("select has_function_privilege('anon','public.simulate_subscription_payment(bigint,bigint,text,text,boolean)','EXECUTE') allowed")).rows[0].allowed,false)
  assert.equal((await db.query("select has_table_privilege('authenticated','public.subscription_test_payment','SELECT') allowed")).rows[0].allowed,false)
  await db.exec('SET ROLE authenticated')
  await assert.rejects(db.query('select complete_my_manual_onboarding_payment()'),/permission denied/)
  await db.exec('RESET ROLE')
  await db.exec('update mall set is_subscription_test=false where mall_id=1')
  assert.equal((await db.query('select has_simulated_subscription_payment(1) paid')).rows[0].paid,false)
 }finally{await db.close()}
})
test('missing readiness requirements roll back manual annual payment rather than bypassing publication checks',async()=>{
 const db=await setup()
 try{
  await db.query("select simulate_subscription_payment(1,1,'onboarding','basic',true)")
  await db.query("select workflow_action(1,1,'ar_status','','ready')")
  await db.query('select acknowledge_test_ar(1,1)')
  await db.exec("update application_floor_plan set app_floor_plan_emergency_route='' where application_id=1")
  await assert.rejects(db.query("select simulate_subscription_payment(1,1,'subscription','basic',true)"),/fulfillment failed/)
  assert.equal((await db.query("select count(*)::int n from contract_payment_request where fee_type='subscription'")).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from subscription_test_payment')).rows[0].n,1)
  assert.equal((await db.query('select ar_development_status from ar_development')).rows[0].ar_development_status,'ready')
 }finally{await db.close()}
})
