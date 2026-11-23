const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path')
const read=f=>fs.readFileSync(path.join(__dirname,'../database_schema',f),'utf8')
test('cleanup preserves onboarding payments by mall and removes only onboarding contracts',async()=>{
 const db=new PGlite()
 try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/subscription-baseline.sql'),'utf8'))
  await db.exec('CREATE TABLE wallet(wallet_id bigint PRIMARY KEY,mall_id bigint);CREATE TABLE payment(payment_id bigint PRIMARY KEY,contract_id bigint REFERENCES contract(contract_id),wallet_id bigint,payment_type text,payment_amount numeric,payment_paid_at timestamptz,s_application_id bigint);')
  for(const f of ['42_subscription_lifecycle.sql','43_subscription_payment_bridge.sql','45_subscription_scheduled_tiers.sql'])await db.exec(read(f))
  await db.exec(`INSERT INTO mall(mall_id,mall_name) VALUES(1,'Onboarding mall'),(2,'Subscribed mall');
  INSERT INTO subscription_tier(s_tier_id,s_tier_key,s_tier_label) VALUES(1,'basic','Basic');
  INSERT INTO contract(contract_id,mall_id,contract_version,contract_is_current,contract_status,contract_start,contract_end,contract_onboarding_fee,s_tier_id) VALUES(10,1,1,true,'Onboarding',now(),now()+interval '1 year',30000,1),(20,2,2,true,'active',now(),now()+interval '1 year',50000,1);
  INSERT INTO mall_onboarding(mall_id,contract_id) VALUES(1,10),(2,20);
  INSERT INTO wallet VALUES(1,1);
  INSERT INTO payment VALUES(1,10,1,'Onboarding',30000,now(),NULL);
  INSERT INTO contract_payment_request(request_id,mall_id,contract_id,fee_type,status,amount_cent,paid_at) VALUES(1,1,10,'onboarding','paid',3000000,now()),(2,2,20,'onboarding','pending',5000000,NULL),(3,2,20,'subscription','paid',2500000,now());`)
  await db.exec(read('56_mall_owned_onboarding.sql'))
  assert.deepEqual((await db.query('select contract_id from contract')).rows.map(r=>r.contract_id),[20])
  const receipt=(await db.query('select * from payment')).rows[0]
  assert.equal(receipt.mall_id,1);assert.equal(receipt.contract_id,null);assert.equal(Number(receipt.payment_amount),30000)
  assert.equal((await db.query('select contract_id from contract_payment_request where request_id=1')).rows[0].contract_id,null)
  assert.equal((await db.query('select contract_id from contract_payment_request where request_id=3')).rows[0].contract_id,20)
  assert.ok((await db.query('select fulfilled_at from contract_payment_request where request_id=1')).rows[0].fulfilled_at)
  assert.equal((await db.query('select count(*)::int n from mall_onboarding where contract_id is not null')).rows[0].n,0)
  assert.equal((await db.query('select onboarding_fee_cent from mall_onboarding where mall_id=1')).rows[0].onboarding_fee_cent,3000000)
  assert.equal((await db.query('select contract_onboarding_fee from contract')).rows[0].contract_onboarding_fee,0)
  assert.equal((await db.query("select count(*)::int n from app_private.onboarding_contract_archive where reason='Onboarding-only contract removed'")).rows[0].n,1)
  await assert.rejects(db.exec("insert into contract(contract_id,mall_id,contract_status,contract_onboarding_fee) values(30,1,'Onboarding',0)"),/constraint/)
  await assert.rejects(db.exec('update mall_onboarding set contract_id=20 where mall_id=2'),/constraint/)
  await db.exec("insert into contract_payment_request(request_id,contract_id,fee_type,status,amount_cent) values(4,20,'onboarding','pending',5000000)")
  assert.equal((await db.query('select mall_id from contract_payment_request where request_id=4')).rows[0].mall_id,2)
  assert.equal((await db.query('select contract_id from contract_payment_request where request_id=4')).rows[0].contract_id,null)
  await assert.rejects(db.exec("insert into contract_payment_request(request_id,mall_id,fee_type,status,amount_cent) values(5,1,'onboarding','paid',3000000)"),/unique/)
 }finally{await db.close()}
})

