BEGIN;
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.thread_write_state(text,bigint,bigint)'::regprocedure) INTO definition;
 IF strpos(definition,'who.admin_auth_user_id IS DISTINCT FROM auth.uid()')>0 THEN RETURN;END IF;
 IF strpos(definition,$needle$ locked:=app_private.newer_thread_version_exists(subject.subject_mall_id,subject.subject_version);$needle$)=0 THEN RAISE EXCEPTION 'Expected thread permission state branch not found';END IF;
 EXECUTE replace(definition,$needle$ locked:=app_private.newer_thread_version_exists(subject.subject_mall_id,subject.subject_version);$needle$,$insert$ IF auth.uid() IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' AND who.admin_auth_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 locked:=app_private.newer_thread_version_exists(subject.subject_mall_id,subject.subject_version);$insert$);
END $migration$;
COMMIT;
