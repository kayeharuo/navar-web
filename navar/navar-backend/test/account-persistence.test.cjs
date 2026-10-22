const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const Fastify=require('fastify')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const routes=require('../modules/accountManagement/routes')

test('existing account edits persist, can be read back, and invalid changes leave data and audit untouched',async()=>{
 const db=new PGlite()
 const app=Fastify()
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE TABLE admin(admin_id bigint PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean DEFAULT false,
    admin_is_primary boolean DEFAULT false,admin_full_name text,admin_email text,admin_contact_num text,admin_job_title text,
    store_id bigint,admin_created_at timestamptz,admin_auth_user_id uuid,admin_updated_at timestamptz,admin_deactivated_on timestamptz,mall_id bigint);
   CREATE TABLE audit_log(audit_log_module text,audit_log_action text,audit_log_details text,audit_log_performed_at timestamptz,audit_log_performed_by bigint,mall_id bigint NOT NULL);
   CREATE TABLE mall(mall_id bigint PRIMARY KEY);
   INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_primary,admin_full_name,admin_email,admin_job_title,admin_contact_num)
    VALUES(1,'super_admin','official',true,'Primary','primary@example.test',NULL,NULL),
    (2,'super_admin','official',false,'Existing','existing@example.test','Old title','09123456789');`)
  await db.exec(readFileSync(join(__dirname,'../database_schema/26_account_management_repair.sql'),'utf8'))
  let actor=1
  const adapter={rpc:async(name,args)=>{
   assert.equal(name,'manage_super_admin_account')
   try{return {data:(await db.query('SELECT manage_super_admin_account($1,$2,$3,$4) AS result',[args.p_actor,args.p_target,args.p_action,args.p_data])).rows[0].result}}
   catch(error){return {error:{code:error.code,message:error.message}}}
  }}
  routes(app,{supabase:adapter,requireAuth:()=>async req=>{req.admin={id:actor}},requireSuperAdmin:async()=>{},requirePrimarySuperAdmin:async()=>{}})
  const patch=payload=>app.inject({method:'PATCH',url:'/api/admin-accounts/2',payload})
  const row=async()=>(await db.query('SELECT * FROM admin WHERE admin_id=2')).rows[0]
  const edits=async()=>(await db.query('SELECT count(*)::int AS count FROM audit_log')).rows[0].count
  const edited=await patch({name:'  Updated Name  ',job_title:'Manager',contact_num:'+63 912 345 6789'})
  assert.equal(edited.statusCode,200)
  assert.equal(edited.json().name,'Updated Name')
  const saved=await row()
  assert.equal(saved.admin_full_name,'Updated Name')
  assert.equal(saved.admin_job_title,'Manager')
  assert.equal(saved.admin_contact_num,'+63 912 345 6789')
  assert.equal(saved.admin_email,'existing@example.test')
  assert.equal(saved.admin_role,'super_admin')
  assert.ok(saved.admin_updated_at)
  assert.equal(await edits(),1)
  for(const payload of [{name:''},{name:'   '},{name:'x'.repeat(101)},{job_title:'x'.repeat(101)},{contact_num:'not a phone'},{name:null},{}]){
   assert.equal((await patch(payload)).statusCode,400)
   assert.deepEqual(await row(),saved)
   assert.equal(await edits(),1)
  }
  // Exercise the database's own validation independently of HTTP validation.
  for(const payload of [{admin_role:'mall_admin'},{mall_id:13},{name:'   '},{contact_num:'invalid'}]){
   await assert.rejects(db.query('SELECT manage_super_admin_account($1,$2,$3,$4)',[1,2,'edit',payload]))
   assert.deepEqual(await row(),saved)
   assert.equal(await edits(),1)
  }
  assert.equal((await patch({job_title:'',contact_num:''})).statusCode,200)
  assert.equal((await row()).admin_job_title,null)
  assert.equal((await row()).admin_contact_num,null)
  const cleared=await row()
  const auditCount=await edits()
  await db.exec('UPDATE admin SET admin_is_deactivated=true WHERE admin_id=1')
  assert.equal((await patch({name:'Must not save'})).statusCode,403)
  assert.deepEqual(await row(),cleared)
  assert.equal(await edits(),auditCount)
  actor=999
  assert.equal((await patch({name:'Unknown actor'})).statusCode,403)
  assert.deepEqual(await row(),cleared)
 }finally{await app.close();await db.close()}
})
