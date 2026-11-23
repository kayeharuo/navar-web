const {test}=require('node:test'),assert=require('node:assert/strict')
const {mapPricingDatabase}=require('./helpers/map-pricing-db.cjs')
const quote=async(db,floors=[49])=>(await db.query('SELECT app_private.map_update_floor_quote(1,$1,22) AS q',[JSON.stringify(floors)])).rows[0].q

test('percentage quotes use original paid onboarding per floor and retain the Premium single-floor allowance',async()=>{
 const db=await mapPricingDatabase()
 try{
  assert.equal((await quote(db)).amount_cent,502975)
  assert.equal((await quote(db,[49,50])).amount_cent,1005950)
  await db.exec('UPDATE contract SET s_tier_id=2')
  assert.equal((await quote(db)).amount_cent,402380)
  await db.exec('UPDATE contract SET s_tier_id=3')
  assert.equal((await quote(db)).amount_cent,0)
  assert.equal((await quote(db,[49,50])).amount_cent,603570)
  await db.exec("INSERT INTO mall_service_request(service_id,mall_id,kind,status,allowance_start,allowance_units) SELECT 23,1,'map_update','completed',contract_start,1 FROM contract")
  assert.equal((await quote(db)).amount_cent,301785)
 }finally{await db.close()}
})

test('original floor denominator is frozen, invalid floors fail and accepted quotes stay unchanged when rates change',async()=>{
 const db=await mapPricingDatabase()
 try{
  const original=await quote(db)
  await db.exec("INSERT INTO floor VALUES(52,1);UPDATE onboarding_quote SET capacity='{\"floors\":4}';UPDATE mall_onboarding SET onboarding_fee_cent=99999999")
  assert.equal((await quote(db)).amount_cent,original.amount_cent)
  await assert.rejects(()=>db.exec('UPDATE mall_onboarding SET onboarding_floor_count=4'),/immutable/)
  await assert.rejects(()=>quote(db,[60]),/belonging/)
  await assert.rejects(()=>quote(db,[49,49]),/distinct/)
  await assert.rejects(()=>quote(db,[]),/at least one/)
  await db.query('UPDATE mall_service_request SET quote=$1 WHERE service_id=22',[JSON.stringify(original)])
  await db.exec("UPDATE subscription_tier SET s_tier_map_update_rate=0.4 WHERE s_tier_key='basic'")
  assert.equal((await quote(db)).amount_cent,402380)
  assert.equal((await db.query('SELECT quote FROM mall_service_request WHERE service_id=22')).rows[0].quote.amount_cent,502975)
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','app_private.map_update_floor_quote(bigint,jsonb,bigint)','execute') allowed")).rows[0].allowed,false)
  await db.exec('DELETE FROM contract_payment_request;UPDATE mall_onboarding SET completed_at=NULL')
  await assert.rejects(()=>quote(db),/original onboarding payment/)
 }finally{await db.close()}
})

test('actual acceptance workflow creates the percentage quote and matching payment request atomically',async()=>{
 const db=await mapPricingDatabase()
 try{
  await db.query("SELECT app_private.workflow_before_review_history(39,1,'accept','','')")
  const s=(await db.query('SELECT * FROM mall_service_request WHERE service_id=22')).rows[0]
  assert.equal(s.status,'awaiting_payment');assert.equal(s.quote.amount_cent,502975)
  assert.equal(s.quote.original_floors,3);assert.equal(s.quote.percent,50)
  const p=(await db.query('SELECT * FROM contract_payment_request WHERE request_id=$1',[s.payment_request_id])).rows[0]
  assert.equal(p.amount_cent,502975);assert.equal(p.details.pricing.amount_cent,s.quote.amount_cent)
  assert.equal(Number((await db.query("SELECT tiers->'basic'->>'mapUpdateRate' rate FROM navar_rate_card WHERE is_current")).rows[0].rate),0.5)
 }finally{await db.close()}
})
