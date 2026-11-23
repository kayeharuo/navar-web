const {test}=require('node:test'),assert=require('node:assert/strict')
const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path')
const {hasNewerThreadVersion,threadIsSuperseded}=require('../modules/applicationManagement/threadPolicy')

test('current application, Live AR and completed/cancelled stall threads close for any newer version and earlier attempts are read-only',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE SCHEMA app_private;CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
   CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE TABLE mall(mall_id bigint PRIMARY KEY);INSERT INTO mall VALUES(1),(2);
   CREATE TABLE admin(admin_id bigint PRIMARY KEY,admin_role text,admin_account_status text,admin_is_deactivated boolean,mall_id bigint,admin_auth_user_id uuid);
   INSERT INTO admin VALUES(1,'super_admin','official',false,NULL,'00000000-0000-4000-8000-000000000001'),(2,'mall_admin','official',false,1,'00000000-0000-4000-8000-000000000002'),(3,'mall_admin','official',false,2,'00000000-0000-4000-8000-000000000003');
   CREATE TABLE application(application_id bigint PRIMARY KEY,mall_id bigint,application_version int,application_attempt int,application_status text,application_accepted_at timestamptz,application_created_at timestamptz DEFAULT now());
   INSERT INTO application(application_id,mall_id,application_version,application_attempt,application_status) VALUES(10,1,1,1,'approved'),(11,1,2,1,'pending');
   CREATE TABLE ar_development(ar_development_id bigint PRIMARY KEY,application_id bigint,ar_development_status text);INSERT INTO ar_development VALUES(20,10,'live');
   CREATE TABLE stall_application(s_application_id bigint PRIMARY KEY,mall_id bigint,s_application_created_at timestamptz DEFAULT now());INSERT INTO stall_application VALUES(8,1,now());
   CREATE TABLE stall_expansion(id bigint PRIMARY KEY,stall_application_id bigint,development_id bigint,status text);INSERT INTO stall_expansion VALUES(1,8,20,'completed');
   CREATE TABLE thread(thread_id bigint PRIMARY KEY,application_id bigint,ar_development_id bigint,s_application_id bigint);
   INSERT INTO thread VALUES(1,10,NULL,NULL),(2,NULL,20,NULL),(3,NULL,NULL,8),(4,11,NULL,NULL);
   CREATE TABLE thread_message(message_id bigint GENERATED ALWAYS AS IDENTITY,thread_id bigint,message_sender bigint,message_content text);
   CREATE FUNCTION public.workflow_event(bigint,bigint,text,text,bigint DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$BEGIN RETURN;END$$;
   CREATE FUNCTION public.guard_workflow_message() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
   CREATE FUNCTION app_private.guard_stall_thread_message() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
   CREATE TRIGGER guard_workflow_message BEFORE INSERT ON thread_message FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_message();
   CREATE TRIGGER guard_stall_thread_message BEFORE INSERT ON thread_message FOR EACH ROW EXECUTE FUNCTION app_private.guard_stall_thread_message();
   CREATE FUNCTION public.stall_application_portal(p_actor bigint,p_mall bigint,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql AS $$DECLARE e public.stall_expansion;acting public.admin;BEGIN
    SELECT * INTO e FROM public.stall_expansion WHERE id=1;SELECT * INTO acting FROM public.admin WHERE admin_id=p_actor;
    IF e.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This application thread is read-only.';END IF;
    RETURN '{}';END$$;
   CREATE FUNCTION public.map_application_portal(p_actor bigint,p_mall bigint,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql AS $$DECLARE a public.application;d public.ar_development;acting public.admin;BEGIN
    SELECT * INTO a FROM public.application WHERE mall_id=p_mall ORDER BY application_version DESC,application_attempt DESC LIMIT 1;SELECT * INTO acting FROM public.admin WHERE admin_id=p_actor;SELECT * INTO d FROM ar_development LIMIT 1;
  IF (p_data->>'id')::bigint IS DISTINCT FROM a.application_id THEN RAISE EXCEPTION 'Wrong target';END IF;
    IF d.ar_development_status IN ('live','unpublished') THEN RAISE EXCEPTION 'This application is read-only.';END IF;
    RETURN jsonb_build_object('id',a.application_id);END$$;`)
  await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema/69_version_based_thread_permissions.sql'),'utf8'))
  await db.exec(fs.readFileSync(path.join(__dirname,'../database_schema/71_latest_attempt_thread_permissions.sql'),'utf8'))
  // Even a pending version immediately closes all older version conversations.
  for(const thread of [1,2,3])await assert.rejects(()=>db.query('INSERT INTO thread_message(thread_id,message_sender,message_content) VALUES($1,2,$2)',[thread,'Older version']),/newer version/)
  await db.exec('DELETE FROM application WHERE application_id=11')
  // Without a newer version, workflow status does not close conversations.
  for(const thread of [1,2,3])await db.query('INSERT INTO thread_message(thread_id,message_sender,message_content) VALUES($1,2,$2)',[thread,'Current conversation'])
  await db.exec("UPDATE ar_development SET ar_development_status='unpublished';UPDATE stall_expansion SET status='cancelled';UPDATE application SET application_status='rejected_final' WHERE application_id=10")
  for(const thread of [1,2,3])await db.query('INSERT INTO thread_message(thread_id,message_sender,message_content) VALUES($1,1,$2)',[thread,'Status does not lock the thread'])
  await db.exec("INSERT INTO application(application_id,mall_id,application_version,application_attempt,application_status) VALUES(11,1,2,1,'rejected_final')")
  for(const thread of [1,2,3])await assert.rejects(()=>db.query('INSERT INTO thread_message(thread_id,message_sender,message_content) VALUES($1,2,$2)',[thread,'Old version']),/newer version/)
  await assert.rejects(()=>db.query("SELECT public.thread_write_state('application',11,3)"),/Access denied/)
  // A new attempt shares history but closes writes through preceding attempts.
  await db.exec("INSERT INTO application(application_id,mall_id,application_version,application_attempt,application_status,application_accepted_at) VALUES(12,1,2,2,'submitted',now())")
  await assert.rejects(()=>db.query("INSERT INTO thread_message(thread_id,message_sender,message_content) VALUES(4,2,'Earlier attempt')"),/newer version or attempt/)
  await assert.rejects(()=>db.query("SELECT public.map_application_portal(2,1,'message','{\"id\":11}') AS result"),/read-only/)
  const state=(await db.query("SELECT public.thread_write_state('application',11,2) AS result")).rows[0].result
  assert.equal(state.readOnly,true)
  await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false),set_config('request.jwt.claim.role','authenticated',false)")
  await assert.rejects(()=>db.query("SELECT public.thread_write_state('application',11,1)"),/Access denied/)
  assert.equal((await db.query("SELECT public.thread_write_state('application',12,2) AS result")).rows[0].result.readOnly,false)
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.thread_write_state(text,bigint,bigint)','EXECUTE') AS allowed")).rows[0].allowed,false)
 }finally{await db.close()}
})

test('API thread flags match latest-version and attempt rules without unlocking map editing',()=>{
 assert.equal(hasNewerThreadVersion([{application_version:2,application_status:'pending'}],1),true)
 assert.equal(hasNewerThreadVersion([{application_version:2,application_status:'rejected_final'}],1),true)
 assert.equal(hasNewerThreadVersion([{application_version:2,application_status:'submitted'}],1),true)
 assert.equal(hasNewerThreadVersion([{application_version:2,application_attempt:2,application_status:'approved'}],2),false)
 assert.equal(hasNewerThreadVersion([{application_version:3,application_accepted_at:'2026-11-23'}],2),true)
 assert.equal(threadIsSuperseded([{application_version:2,application_attempt:2}],{application_version:2,application_attempt:1}),true)
 assert.equal(threadIsSuperseded([{application_version:2,application_attempt:2}],{application_version:2,application_attempt:2}),false)
})
