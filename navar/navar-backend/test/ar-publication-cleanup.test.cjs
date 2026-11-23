const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path')
const sql=name=>fs.readFileSync(path.join(__dirname,'../database_schema',name),'utf8')
async function fixture(){
 const db=new PGlite()
 await db.exec(`CREATE SCHEMA app_private;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE mall(mall_id bigint PRIMARY KEY,mall_name text,mall_description text,mall_updated_at timestamptz);
 INSERT INTO mall VALUES(5,'SM Seaside City Cebu',NULL,NULL),(12,'Gaisano Fiesta Mall',NULL,NULL),(21,'Robinsons Galleria',NULL,NULL),(10,'Ayala',NULL,NULL),(11,'SM J Mall',NULL,NULL),(13,'South Town',NULL,NULL),(16,'Tabunok',NULL,NULL),(19,'Hyper Market',NULL,NULL),(20,'Gaisano Grand Mall Minglanilla','Internally entered for onboarding.',NULL);
 CREATE TABLE application(application_id bigint PRIMARY KEY,mall_id bigint,application_status text,application_accepted_at timestamptz,application_approved_at timestamptz,application_reason_category text,application_reason_notes text,application_dispute_count int,application_updated_at timestamptz);
 INSERT INTO application(application_id,mall_id,application_status) VALUES(10,11,'approved'),(15,10,'approved'),(50,5,'approved'),(51,12,'approved'),(52,21,'approved');
 CREATE TABLE ar_development(ar_development_id bigint PRIMARY KEY,application_id bigint,ar_development_version int,ar_development_status text,ar_development_unpublish_reason text,ar_development_updated_at timestamptz);
 CREATE TABLE beacon_ticket(ticket_id bigint PRIMARY KEY,ticket_current_status text);
 CREATE TABLE contract(contract_id bigint PRIMARY KEY,mall_id bigint,previous_contract_id bigint);
 INSERT INTO contract VALUES(6,13,NULL),(9,16,NULL),(12,19,NULL),(100,5,NULL),(101,12,NULL),(102,21,NULL);
 CREATE TABLE suspension(suspension_id bigint,contract_id bigint);INSERT INTO suspension VALUES(1,12),(2,12),(3,12),(4,12);
 CREATE TABLE payment(contract_id bigint);CREATE TABLE contract_payment_request(contract_id bigint);CREATE TABLE mall_onboarding(contract_id bigint);
 CREATE TABLE mall_service_request(application_id bigint,contract_id bigint);
 CREATE TABLE application_floor_plan(app_floor_plan_id bigint,application_id bigint,app_floor_plan_reused_from bigint);INSERT INTO application_floor_plan VALUES(1,10,NULL),(2,15,NULL),(3,50,NULL),(4,51,NULL),(5,52,NULL);
 CREATE TABLE application_entry_point(application_id bigint);INSERT INTO application_entry_point VALUES(10),(15),(50),(51),(52);
 CREATE TABLE map_application_floor_source(application_id bigint,source_plan_id bigint);
 CREATE TABLE application_review_history(application_id bigint);
 CREATE TABLE app_private.map_intake_submission(application_id bigint);`)
 await db.exec(sql('78_ar_release_and_ticket_states.sql'))
 return db
}
test('publication unpublishes only older Live versions of the same mall and rejects stale publication',async()=>{
 const db=await fixture();try{
  await db.exec(`INSERT INTO application(application_id,mall_id) VALUES(60,10),(61,10),(62,11);
   INSERT INTO ar_development VALUES(1,15,1,'live',NULL,NULL),(2,60,2,'ready',NULL,NULL),(3,61,3,'testing',NULL,NULL),(4,62,1,'live',NULL,NULL);
   UPDATE ar_development SET ar_development_status='live' WHERE ar_development_id=2;`)
  assert.deepEqual((await db.query('SELECT ar_development_status FROM ar_development ORDER BY ar_development_id')).rows.map(r=>r.ar_development_status),['unpublished','live','testing','live'])
  await assert.rejects(()=>db.exec("UPDATE ar_development SET ar_development_status='live' WHERE ar_development_id=1"),/newer or equal/)
  await db.exec("INSERT INTO beacon_ticket VALUES(1,'pending'),(2,'FAULTY'),(3,'resolved')")
  assert.deepEqual((await db.query('SELECT ticket_current_status FROM beacon_ticket ORDER BY ticket_id')).rows.map(r=>r.ticket_current_status),['faulty','faulty','resolved'])
  await assert.rejects(()=>db.exec("UPDATE beacon_ticket SET ticket_current_status='unsupported' WHERE ticket_id=1"),/beacon_ticket_supported_state/)
 }finally{await db.close()}
})
test('reviewed cleanup retains application shells and all three protected malls, archives removed details and subscriptions',async()=>{
 const db=await fixture();try{
  await db.exec(sql('cleanup_unlinked_applications_and_subscriptions.sql'))
  assert.deepEqual((await db.query('SELECT application_status FROM application ORDER BY application_id')).rows.map(r=>r.application_status),['draft','draft','approved','approved','approved'])
  assert.deepEqual((await db.query('SELECT application_id FROM application_floor_plan ORDER BY application_id')).rows.map(r=>r.application_id),[50,51,52])
  assert.equal((await db.query('SELECT count(*) n FROM application_entry_point')).rows[0].n,3)
  assert.deepEqual((await db.query('SELECT contract_id FROM contract ORDER BY contract_id')).rows.map(r=>r.contract_id),[100,101,102])
  assert.equal((await db.query('SELECT count(*) n FROM app_private.workflow_cleanup_archive')).rows[0].n,5)
  assert.equal((await db.query('SELECT count(*) n FROM suspension')).rows[0].n,0)
  await db.exec(sql('cleanup_unlinked_applications_and_subscriptions.sql'))
  assert.equal((await db.query('SELECT count(*) n FROM app_private.workflow_cleanup_archive')).rows[0].n,5)
 }finally{await db.close()}
})
