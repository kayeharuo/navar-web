BEGIN;
CREATE TEMP TABLE separation_test_results(check_name text,passed boolean);
DO $$DECLARE uid uuid; mail text; role_name text; rejected boolean; n int;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['super_admin','mall_admin','store_admin'] LOOP
  uid:=gen_random_uuid();mail:='profile-separation-'||uid||'@example.invalid';
  INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(uid,mail,now(),'{"role":"user","platform":"mobile"}'::jsonb);
  IF EXISTS(SELECT 1 FROM public.app_user WHERE user_auth_user_id=uid) THEN RAISE EXCEPTION 'Auth still auto-creates profiles';END IF;
  INSERT INTO public.admin(admin_role,admin_email,admin_full_name,admin_is_primary,admin_is_deactivated,admin_deactivated_on,admin_created_at,admin_updated_at,mall_id,store_id,admin_account_status,admin_auth_user_id)
  VALUES(role_name,mail,'Rollback-only profile verification',false,true,now(),now(),now(),CASE WHEN role_name<>'super_admin' THEN 12 END,CASE WHEN role_name='store_admin' THEN 38 END,'official',uid);
  rejected:=false;
  BEGIN
   INSERT INTO public.app_user(user_role,user_name,user_email,user_created_at,user_auth_user_id) VALUES('user','Should be blocked',mail,now(),uid);
  EXCEPTION WHEN check_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Admin mobile insert was not blocked: %',role_name;END IF;
  INSERT INTO separation_test_results VALUES(role_name||'_excluded_from_mobile',true);
 END LOOP;
 uid:=gen_random_uuid();mail:='mobile-separation-'||uid||'@example.invalid';
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(uid,mail,now());
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM public.register_app_user('Rollback-only mobile user',NULL,NULL);
 IF NOT EXISTS(SELECT 1 FROM public.app_user WHERE user_auth_user_id=uid) THEN RAISE EXCEPTION 'Mobile registration failed'; END IF;
 INSERT INTO separation_test_results VALUES('mobile_registration_works',true);
 rejected:=false;
 BEGIN
  INSERT INTO public.admin(admin_role,admin_email,admin_full_name,admin_is_primary,admin_is_deactivated,admin_created_at,admin_updated_at,admin_account_status,admin_auth_user_id)
  VALUES('super_admin',mail,'Should be blocked',false,false,now(),now(),'official',uid);
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Mobile identity was allowed in admin';END IF;
 INSERT INTO separation_test_results VALUES('mobile_cannot_become_web_admin',true);
END $$;
SELECT * FROM separation_test_results;
ROLLBACK;