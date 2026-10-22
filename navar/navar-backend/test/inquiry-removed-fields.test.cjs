const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const sql=readFileSync(join(__dirname,'../database_schema/28_inquiry_removed_fields_compatibility.sql'),'utf8')

test('compatibility repair retains job title and removes only logo fields',async()=>{
 const db=new PGlite()
 try {
  const columns=sql.match(/INSERT INTO public.inquiry \(([\s\S]*?)\) VALUES/)[1].split(',').map(c=>c.trim())
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE TABLE subscription_tier(s_tier_key text);
   CREATE TABLE inquiry(${columns.map(c=>c+' '+(c==='inquiry_mall_floor_count'?'integer':c.endsWith('_at')?'timestamptz':'text')).join(',')});
   CREATE FUNCTION provision_inquiry_mall() RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i public.inquiry%ROWTYPE; BEGIN RETURN i.inquiry_contact_job_title; END $$;
   CREATE FUNCTION review_super_admin_inquiry() RETURNS bytea LANGUAGE plpgsql AS $$
   DECLARE i public.inquiry%ROWTYPE; BEGIN RETURN i.inquiry_mall_logo; END $$;`)
  await db.exec(sql)
  assert.equal((await db.query('SELECT provision_inquiry_mall() AS result')).rows[0].result,null)
  assert.equal((await db.query('SELECT review_super_admin_inquiry() AS result')).rows[0].result,null)
  await db.query('SELECT submit_public_inquiry($1::jsonb,$2,$3)',[JSON.stringify({mallName:'Test Mall',email:'test@example.com',jobTitle:'Mall Manager',floorCount:2,address:'Main Street, Barangay Luz'}),'a'.repeat(64),'New'])
  assert.equal((await db.query('SELECT inquiry_mall_name FROM inquiry')).rows[0].inquiry_mall_name,'Test Mall')
  assert.equal((await db.query('SELECT inquiry_contact_job_title FROM inquiry')).rows[0].inquiry_contact_job_title,'Mall Manager')
  await db.exec(sql)
  assert.equal((await db.query('SELECT inquiry_contact_job_title FROM inquiry')).rows[0].inquiry_contact_job_title,'Mall Manager')
 }finally{await db.close()}
})
