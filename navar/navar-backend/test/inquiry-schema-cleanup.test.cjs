const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {PGlite}=require('@electric-sql/pglite')
const migration=readFileSync(join(__dirname,'../database_schema/27_inquiry_address_cleanup.sql'),'utf8')

test('schema cleanup preserves addresses and updates barangay on corrections',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`CREATE TABLE inquiry(inquiry_id int PRIMARY KEY,inquiry_mall_address text,inquiry_mall_zip_code text,inquiry_mall_logo_path text);
   INSERT INTO inquiry VALUES(1,'123 Main Street, Barangay Luz','0600',NULL),(2,'Old address','6000',NULL);`)
  await db.exec(migration)
  assert.deepEqual((await db.query('SELECT inquiry_mall_barangay FROM inquiry ORDER BY inquiry_id')).rows,[{inquiry_mall_barangay:'Luz'},{inquiry_mall_barangay:null}])
  assert.equal((await db.query('SELECT inquiry_mall_zip_code FROM inquiry WHERE inquiry_id=1')).rows[0].inquiry_mall_zip_code,'0600')
  await db.exec("UPDATE inquiry SET inquiry_mall_address='456 New Street, Barangay Lahug' WHERE inquiry_id=1")
  assert.equal((await db.query('SELECT inquiry_mall_barangay FROM inquiry WHERE inquiry_id=1')).rows[0].inquiry_mall_barangay,'Lahug')
  await db.exec(migration)
  assert.equal((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='inquiry' AND column_name='inquiry_mall_logo_path'")).rows.length,0)
 } finally {await db.close()}
})

test('cleanup rolls back if a logo path would be lost',async()=>{
 const db=new PGlite()
 try {
  await db.exec("CREATE TABLE inquiry(inquiry_mall_address text,inquiry_mall_logo_path text); INSERT INTO inquiry VALUES('Address','existing/logo.png')")
  await assert.rejects(db.exec(migration),/contains data/)
  await db.exec('ROLLBACK')
  assert.equal((await db.query('SELECT inquiry_mall_logo_path FROM inquiry')).rows[0].inquiry_mall_logo_path,'existing/logo.png')
 } finally {await db.close()}
})
