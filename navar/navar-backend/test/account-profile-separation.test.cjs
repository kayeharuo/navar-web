const {test}=require('node:test')
const assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const sql=readFileSync(join(__dirname,'../database_schema/51_separate_web_and_mobile_profiles.sql'),'utf8')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
async function fixture(){
 const db=new PGlite()
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA app_private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE TABLE public.admin(admin_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,admin_auth_user_id uuid,admin_email text,admin_role text);
 CREATE TABLE public.tenant_account(tenant_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,auth_user_id uuid);
 CREATE TABLE public.app_user(user_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id),user_role text NOT NULL,user_email text NOT NULL,user_name text NOT NULL,user_gender text,user_dob date,user_created_at timestamptz,user_deleted_at timestamptz,user_last_login timestamptz);
 CREATE TABLE public.mobile_history(user_id bigint REFERENCES public.app_user(user_id) ON DELETE CASCADE);
 CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO public.app_user(user_auth_user_id,user_role,user_name,user_email) VALUES(NEW.id,'user','Automatic profile',NEW.email); RETURN NEW; END$$;
 CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
 GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
 GRANT ALL ON public.app_user TO authenticated,service_role;
 GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;
 CREATE POLICY old_broad_access ON public.app_user FOR ALL TO authenticated USING(true) WITH CHECK(true);`)
 for(let n=1;n<=5;n++) await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[id(n),`profile${n}@example.test`])
 for(let n=1;n<=3;n++) await db.query('INSERT INTO admin(admin_auth_user_id,admin_email,admin_role) VALUES($1,$2,$3)',[id(n),`profile${n}@example.test`,['super_admin','mall_admin','store_admin'][n-1]])
 await db.query('INSERT INTO tenant_account(auth_user_id) VALUES($1)',[id(4)])
 const register=readFileSync(join(__dirname,'../database_schema/05_lock_down_public_schema.sql'),'utf8').match(/CREATE OR REPLACE FUNCTION public.register_app_user\([\s\S]*?GRANT EXECUTE ON FUNCTION public.register_app_user\(text, text, date\) TO authenticated;/)[0]
 await db.exec(register)
 return db
}
test('web profiles are separated from mobile profiles for all admin roles and tenant accounts',async()=>{
 const db=await fixture()
 try{
  await db.exec(sql)
  await db.exec(readFileSync(join(__dirname,'../database_schema/52_mobile_profiles_without_email_confirmation.sql'),'utf8'))
  assert.equal((await db.query('select count(*)::int n from app_user')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from app_private.web_profile_cleanup_archive')).rows[0].n,4)
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,5)
  assert.equal((await db.query('select count(*)::int n from admin')).rows[0].n,3)
  for(let n=1;n<=3;n++) await assert.rejects(db.query("insert into app_user(user_auth_user_id,user_email,user_name,user_role) values($1,$2,'Wrong mobile profile','user')",[id(n),`profile${n}@example.test`]),/cannot have a mobile/)
  await assert.rejects(db.query("insert into app_user(user_auth_user_id,user_email,user_name,user_role) values($1,'profile4@example.test','Tenant mobile','user')",[id(4)]),/cannot have a mobile/)
  for(let n=6;n<=8;n++){
   await db.query('insert into auth.users values($1,$2,now())',[id(n),`profile${n}@example.test`])
   assert.equal((await db.query('select count(*)::int n from app_user where user_auth_user_id=$1',[id(n)])).rows[0].n,0)
   await db.query('insert into admin(admin_auth_user_id,admin_email,admin_role) values($1,$2,$3)',[id(n),`profile${n}@example.test`,['super_admin','mall_admin','store_admin'][n-6]])
  }
  await assert.rejects(db.query("insert into admin(admin_auth_user_id,admin_email,admin_role) values($1,'profile5@example.test','store_admin')",[id(5)]),/already belongs to a mobile/)
  await assert.rejects(db.query('insert into tenant_account(auth_user_id) values($1)',[id(5)]),/already belongs to a mobile/)
  await assert.rejects(db.query('update app_user set user_auth_user_id=$1,user_email=$2 where user_auth_user_id=$3',[id(1),'profile1@example.test',id(5)]),/cannot have a mobile/)
  await db.query('insert into auth.users values($1,$2,now())',[id(9),'mobile@example.test'])
  await db.query("select set_config('test.uid',$1,false)",[id(9)])
  await db.exec('SET ROLE authenticated')
  await db.query("select public.register_app_user('Mobile user',NULL,NULL)")
  await assert.rejects(db.query("update app_user set user_role='tester' where user_auth_user_id=auth.uid()"),/permission denied/)
  await db.query("update app_user set user_name='Updated mobile name' where user_auth_user_id=auth.uid()")
  const changed=await db.query("update app_user set user_name='Other user' where user_auth_user_id=$1 returning user_id",[id(5)])
  assert.equal(changed.rows.length,0)
  await db.exec('RESET ROLE')
  await db.query('insert into auth.users values($1,$2,now())',[id(11),'direct-mobile@example.test'])
  await db.query("select set_config('test.uid',$1,false)",[id(11)])
  await db.exec('SET ROLE authenticated')
  await assert.rejects(db.query("insert into app_user(user_auth_user_id,user_email,user_name,user_role) values(auth.uid(),'direct-mobile@example.test','Forged tester','tester')"),/row-level security/)
  await db.query("insert into app_user(user_auth_user_id,user_email,user_name,user_role) values(auth.uid(),'direct-mobile@example.test','Direct mobile','user')")
  await db.exec('RESET ROLE')
  await db.query('insert into auth.users values($1,$2,NULL)',[id(10),'unconfirmed@example.test'])
  await db.query("insert into app_user(user_auth_user_id,user_email,user_name,user_role) values($1,'unconfirmed@example.test','Unconfirmed','user')",[id(10)])
  await db.query('insert into auth.users values($1,$2,NULL)',[id(12),'unconfirmed-rpc@example.test'])
  await db.query("select set_config('test.uid',$1,false)",[id(12)])
  await db.exec('SET ROLE authenticated')
  await db.query("select public.register_app_user('Unconfirmed RPC mobile',NULL,NULL)")
  await db.exec('RESET ROLE')
  await db.query("select set_config('test.uid',$1,false)",[id(1)])
  await db.exec('SET ROLE authenticated')
  await assert.rejects(db.query("select public.register_app_user('Admin mobile',NULL,NULL)"),/cannot register here/)
 }finally{await db.close()}
})
test('cleanup aborts without deleting profiles or cascading mobile history',async()=>{
 const db=await fixture()
 try{
  await db.exec('insert into mobile_history select user_id from app_user limit 1')
  await assert.rejects(db.exec(sql),/dependent data/)
  await db.exec('ROLLBACK')
  assert.equal((await db.query('select count(*)::int n from app_user')).rows[0].n,5)
  assert.equal((await db.query('select count(*)::int n from mobile_history')).rows[0].n,1)
 }finally{await db.close()}
})
