const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const Fastify = require('fastify')
const routes = require('../modules/accountManagement/routes')

test('account lifecycle validates authority, roles, state, email cooldown and audit atomically', async () => {
 const db = new PGlite()
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE admin(admin_id bigserial PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean DEFAULT false,
 admin_is_primary boolean DEFAULT false,admin_full_name text,admin_email text,admin_contact_num text,admin_job_title text,
 store_id bigint,admin_created_at timestamptz,admin_auth_user_id uuid,admin_updated_at timestamptz,admin_deactivated_on timestamptz,mall_id bigint);
 CREATE TABLE audit_log(audit_log_module text,audit_log_action text,audit_log_details text,audit_log_performed_at timestamptz,audit_log_performed_by bigint,mall_id bigint NOT NULL);
 CREATE TABLE mall(mall_id bigint PRIMARY KEY); INSERT INTO mall VALUES(13);
 INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_primary,admin_full_name,mall_id) VALUES
 (1,'super_admin','official',true,'Primary',null),(2,'super_admin','official',false,'Reviewer',null),
 (3,'mall_admin','official',true,'Owner',13),(4,'mall_admin','partial',false,'Pending',13),(5,'store_admin','official',false,'Store',13),
 (6,'super_admin','partial',false,'Pending admin',null);`)
 await db.exec(readFileSync(join(__dirname,'../database_schema/25_account_management.sql'),'utf8'))
 await db.exec(readFileSync(join(__dirname,'../database_schema/26_account_management_repair.sql'),'utf8'))
 await db.exec("SELECT setval(pg_get_serial_sequence('admin','admin_id'),10)")
 const create = async (role,extra={}) => (await db.query('SELECT create_managed_admin($1,$2,$3) result',[2,'00000000-0000-4000-8000-000000000001',{role,name:'New admin',email:'new@example.com',...extra}])).rows[0].result
 assert.equal((await create('super_admin')).mall_id,null)
 assert.equal((await create('mall_admin',{mall_id:13})).mall_id,13)
 await assert.rejects(create('mall_admin',{mall_id:13,is_primary:true}),/already has/)
 await assert.rejects(create('mall_admin',{mall_id:999}),/existing mall/)
 const change = async (actor,target,action,data={}) => (await db.query('SELECT manage_super_admin_account($1,$2,$3,$4) result',[actor,target,action,data])).rows[0].result
 await assert.rejects(change(3,2,'edit',{name:'Changed'}),/Super Admin/)
 assert.equal((await change(2,3,'edit',{name:'Changed'})).admin_full_name,'Changed')
 await assert.rejects(change(2,3,'deactivate'),/primary Super Admin/)
 assert.equal((await change(2,2,'edit',{name:'Own profile'})).admin_full_name,'Own profile')
 await assert.rejects(change(1,5,'deactivate'),/not found/)
 await assert.rejects(change(1,1,'deactivate'),/own account/)
 await assert.rejects(change(1,2,'edit',{name:'   '}),/valid name/)
 await assert.rejects(change(1,3,'edit',{mall_id:99}),/Invalid profile fields/)
 assert.equal((await change(1,3,'edit',{name:'Mall owner',contact_num:'+63 912 345 6789'})).mall_id,13)
 const inactive=await change(1,4,'deactivate')
 assert.equal(inactive.admin_is_deactivated,true)
 assert.equal(inactive.admin_account_status,'partial')
 await assert.rejects(change(1,4,'resend-invite'),/not available/)
 await change(1,4,'check-reactivate')
 assert.equal((await db.query('SELECT admin_is_deactivated FROM admin WHERE admin_id=4')).rows[0].admin_is_deactivated,true)
 assert.equal((await change(1,4,'reactivate')).admin_account_status,'partial')
 await change(1,4,'resend-invite')
 await assert.rejects(change(1,4,'resend-invite'),/one minute/)
 await assert.rejects(change(1,4,'reset-password'),/not available/)
 await assert.rejects(change(1,3,'resend-invite'),/not available/)
 await change(1,3,'reset-password')
 assert.equal((await db.query("SELECT count(*)::int n FROM audit_log WHERE audit_log_action='resend-invite'")).rows[0].n,1)
 await db.exec("UPDATE admin SET admin_is_deactivated=true WHERE admin_id=1")
 await assert.rejects(change(1,2,'edit',{name:'Changed'}),/Active Super Admin/)
 } finally { await db.close() }
})

function appWith(db, actor={id:1,role:'super_admin',isPrimary:true}) {
 const app = Fastify()
 routes(app,{supabase:db,requireAuth:()=>async req=>{req.admin=actor},requireSuperAdmin:async()=>{},
 requirePrimarySuperAdmin:async(req,reply)=>{if(!req.admin.isPrimary) return reply.code(403).send({message:'Access denied.'})}})
 return app
}
test('directory loads both admin roles, mall names and all batches, excluding store admins',async()=>{
 const calls=[]
 const db={from(table){const query={select(){return query},in(field,roles){assert.deepEqual(roles,['super_admin','mall_admin']);return query},order(){return query},async range(start,end){calls.push([start,end]);return {data:start===0?Array.from({length:500},(_,i)=>({admin_id:i+1,admin_role:'super_admin'})):[{admin_id:501,admin_role:'mall_admin',mall_id:13,mall:{mall_name:'Example Mall'}}]}}};return query}}
 const app=appWith(db)
 try {const response=await app.inject('/api/admin-accounts');assert.equal(response.statusCode,200);assert.equal(response.json().length,501);assert.equal(response.json()[500].mall,'Example Mall');assert.equal(calls.length,2)} finally {await app.close()}
})
test('invalid forms and invalid mall creation fail before side effects',async()=>{
 const app=appWith({}, {id:2,role:'super_admin',isPrimary:false})
 try {
 assert.equal((await app.inject({method:'POST',url:'/api/admin-accounts',payload:{email:'someone@example.com',name:'Name',role:'mall_admin'}})).statusCode,400)
 assert.equal((await app.inject({method:'PATCH',url:'/api/admin-accounts/2',payload:{name:'   '}})).statusCode,400)
 assert.equal((await app.inject({method:'PATCH',url:'/api/admin-accounts/-1',payload:{name:'Name'}})).statusCode,400)
 } finally {await app.close()}
})
test('reactivation does not grant database access when Auth restore fails',async()=>{
 const actions=[]
 const db={rpc:async(name,args)=>{actions.push(args.p_action);return {data:{admin_auth_user_id:'auth'}}},auth:{admin:{updateUserById:async()=>({error:{code:'offline'}})}}}
 const app=appWith(db)
 try {const response=await app.inject({method:'POST',url:'/api/admin-accounts/2/reactivate'});assert.equal(response.statusCode,503);assert.deepEqual(actions,['check-reactivate'])} finally {await app.close()}
})

test('creation saves the profile before preparing delivery and keeps it visible if delivery fails',async()=>{
 const calls=[]
 const db={
  from(table) {
   return {
    select() { return { eq() { return { maybeSingle: async () => ({data:null}) } } } },
    insert(values) {
     calls.push(table)
     if (table === 'audit_log') return Promise.resolve({})
     return { select() { return { single: async () => ({data:{...values,admin_id:20}}) } } }
    }
   }
  },
  rpc:async(name,args)=>{calls.push(name);return name === 'create_managed_admin' ? {data:{admin_id:20,admin_role:args.p_data.role,admin_email:args.p_data.email,admin_account_status:'partial'}} : {}},
  auth:{admin:{createUser:async()=>{calls.push('identity');return {data:{user:{id:'new-auth'}}}},
   generateLink:async()=>{calls.push('link');return {error:{code:'offline'}}},deleteUser:async()=>{throw Error('Saved account must not be deleted')}}}
 }
 const app=appWith(db)
 try {const response=await app.inject({method:'POST',url:'/api/admin-accounts',payload:{email:'new@example.com',name:'New account'}})
 assert.equal(response.statusCode,201);assert.equal(response.json().status,'partial');assert.match(response.json().warning,/delivery was not confirmed/)
 assert.ok(calls.indexOf('create_managed_admin')<calls.indexOf('link'))
 } finally {await app.close()}
})
test('deactivation reports Auth failure after database access is revoked',async()=>{
 const calls=[]
 const app=appWith({rpc:async()=>{calls.push('database');return {data:{admin_id:2,admin_auth_user_id:'auth'}}},auth:{admin:{updateUserById:async()=>{calls.push('auth');return {error:{code:'offline'}}}}}})
 try {const response=await app.inject({method:'POST',url:'/api/admin-accounts/2/deactivate'});assert.equal(response.statusCode,200);assert.match(response.json().warning,/Auth ban/);assert.deepEqual(calls,['database','auth'])} finally {await app.close()}
})


test('account emails embed local branding, escape links, and close failed transports',async()=>{
 const mailer=require('nodemailer')
 const original=mailer.createTransport
 const oldUser=process.env.SMTP_USER,oldPass=process.env.SMTP_PASS
 process.env.SMTP_USER='sender@example.com';process.env.SMTP_PASS='test-only'
 let closed=0,mail,fail=false
 mailer.createTransport=()=>({sendMail:async value=>{mail=value;if(fail)throw Error('SMTP unavailable');return {accepted:['recipient@example.com']}},close(){closed++}})
 try {
  await routes.sendInviteEmail('recipient@example.com','https://example.com/setup?one=1&two=2')
  assert.equal(mail.attachments.length,2)
  assert.match(mail.html,/one=1&amp;two=2/)
  assert.match(mail.html,/cid:account-navar-icon-png.png@navar/)
  assert.equal(closed,1)
  fail=true
  await assert.rejects(routes.sendInviteEmail('recipient@example.com','https://example.com/reset',true),/SMTP unavailable/)
  assert.equal(closed,2)
 }finally{
  mailer.createTransport=original
  if(oldUser===undefined)delete process.env.SMTP_USER;else process.env.SMTP_USER=oldUser
  if(oldPass===undefined)delete process.env.SMTP_PASS;else process.env.SMTP_PASS=oldPass
 }
})

for (const primary of [false,true]) test(`mall admin creation and resend use the correct password page (primary=${primary})`,async()=>{
 const mailer=require('nodemailer'),original=mailer.createTransport
 const previous={SMTP_USER:process.env.SMTP_USER,SMTP_PASS:process.env.SMTP_PASS,MALL_ADMIN_ORIGIN:process.env.MALL_ADMIN_ORIGIN}
 Object.assign(process.env,{SMTP_USER:'sender@example.test',SMTP_PASS:'test-only',MALL_ADMIN_ORIGIN:'http://localhost:5174'})
 const calls=[]
 let message,linkOptions
 mailer.createTransport=()=>({sendMail:async mail=>{calls.push('send');message=mail;return {accepted:[mail.to]}},close(){}})
 const db={
  from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:null})}}}}}},
  rpc:async(name,args)=>{
   calls.push(name)
   if(name==='manage_super_admin_account') return {data:{admin_role:'mall_admin',admin_is_primary:primary,admin_auth_user_id:'mall-auth',admin_email:'mall@example.test'}}
   assert.equal(name,'create_managed_admin','Mall setup must not use Super Admin password requests')
   assert.equal(args.p_data.role,'mall_admin');assert.equal(args.p_data.mall_id,13);assert.equal(args.p_data.is_primary,primary)
   return {data:{admin_id:50,admin_role:'mall_admin',mall_id:13,admin_full_name:args.p_data.name,admin_email:args.p_data.email,admin_account_status:'partial'}}
  },
  auth:{admin:{createUser:async()=>{calls.push('identity');return {data:{user:{id:'mall-auth'}}}},
   generateLink:async args=>{calls.push('link');linkOptions=args;return {data:{user:{id:'mall-auth'},properties:{action_link:'https://auth.example.test/verify?token=test'}}}},
   deleteUser:async()=>assert.fail('Saved mall account must be preserved')}}
 }
 const app=appWith(db)
 try{
  const response=await app.inject({method:'POST',url:'/api/admin-accounts',payload:{role:'mall_admin',email:'mall@example.test',name:'Mall Admin',contact_num:'09123456789',mall_id:13,is_primary:primary}})
  assert.equal(response.statusCode,201)
  assert.equal(response.json().role,'mall_admin');assert.equal(response.json().mallId,13)
  assert.equal(response.json().status,'partial');assert.equal(response.json().warning,null)
  assert.deepEqual(calls,['identity','create_managed_admin','link','send'])
  assert.equal(linkOptions.options.redirectTo,'http://localhost:5174'+(primary?'/complete-setup':'/reset-password'))
  assert.equal(message.to,'mall@example.test');assert.match(message.text,/auth.example.test/)
  const resent=await app.inject({method:'POST',url:'/api/admin-accounts/50/resend-invite'})
  assert.equal(resent.statusCode,200)
  assert.equal(linkOptions.options.redirectTo,'http://localhost:5174'+(primary?'/complete-setup':'/reset-password'))
 }finally{
  await app.close();mailer.createTransport=original
  for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}
 }
})
