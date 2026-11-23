const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const fs=require('node:fs'),path=require('node:path')

test('normalization repairs status casing without workflow events and normalizes future writes before guards',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE SCHEMA app_private; CREATE ROLE anon; CREATE ROLE authenticated;
   CREATE TABLE contract(id int PRIMARY KEY,contract_status text,contract_resume_status varchar,description text);
   CREATE TABLE inquiry(id int PRIMARY KEY,inquiry_status text,inquiry_mall_state text);
   CREATE TABLE events(id int);
   CREATE FUNCTION track_status() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO events VALUES(NEW.id); RETURN NEW;END$$;
   CREATE FUNCTION guard_status() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.contract_status<>lower(NEW.contract_status) THEN RAISE EXCEPTION 'Guard saw uppercase';END IF;RETURN NEW;END$$;
   INSERT INTO contract VALUES(1,'Active',NULL,'Keep This Label');
   INSERT INTO inquiry VALUES(1,'Rejected','Cebu');
   CREATE TRIGGER tracking AFTER UPDATE ON contract FOR EACH ROW EXECUTE FUNCTION track_status();
   CREATE TRIGGER guard BEFORE UPDATE ON contract FOR EACH ROW EXECUTE FUNCTION guard_status();
   CREATE TRIGGER disabled_tracking AFTER UPDATE ON contract FOR EACH ROW EXECUTE FUNCTION track_status();
   ALTER TABLE contract DISABLE TRIGGER disabled_tracking;
   CREATE TRIGGER always_tracking AFTER UPDATE ON inquiry FOR EACH ROW EXECUTE FUNCTION track_status();
   ALTER TABLE inquiry ENABLE ALWAYS TRIGGER always_tracking;`)
  await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema/64_lowercase_business_statuses.sql'),'utf8'))
  assert.deepEqual((await db.query('SELECT * FROM contract')).rows,[{id:1,contract_status:'active',contract_resume_status:null,description:'Keep This Label'}])
  assert.equal((await db.query('SELECT inquiry_mall_state FROM inquiry')).rows[0].inquiry_mall_state,'Cebu')
  assert.equal((await db.query('SELECT count(*)::int n FROM events')).rows[0].n,0)
  const modes=(await db.query("SELECT tgname,tgenabled FROM pg_trigger WHERE tgname IN ('disabled_tracking','always_tracking','tracking','guard') ORDER BY tgname")).rows
  assert.deepEqual(modes.map(r=>r.tgenabled),['A','D','O','O'])
  await db.exec("UPDATE contract SET contract_status='ACTIVE',contract_resume_status='Pending' WHERE id=1; INSERT INTO inquiry VALUES(2,'In Progress','Metro Manila');")
  assert.equal((await db.query('SELECT contract_status FROM contract')).rows[0].contract_status,'active')
  assert.equal((await db.query('SELECT contract_resume_status FROM contract')).rows[0].contract_resume_status,'pending')
  assert.equal((await db.query('SELECT inquiry_status FROM inquiry WHERE id=2')).rows[0].inquiry_status,'in progress')
  assert.equal((await db.query('SELECT count(*)::int n FROM events')).rows[0].n,1)
 }finally{await db.close()}
})
