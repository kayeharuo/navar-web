-- Run after 25. Super Admin audit entries have no mall; keep those entries without inventing a mall ID.
BEGIN;
ALTER TABLE public.audit_log ALTER COLUMN mall_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.manage_super_admin_account(p_actor bigint,p_target bigint,p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.admin%ROWTYPE; t public.admin%ROWTYPE;
BEGIN
 -- Serialize lifecycle changes so the permission checks and updates are one transaction.
 PERFORM pg_advisory_xact_lock(73120525);
 SELECT * INTO a FROM public.admin WHERE admin_id=p_actor FOR UPDATE;
 IF a.admin_id IS NULL OR a.admin_role<>'super_admin' OR a.admin_account_status<>'official' OR a.admin_is_deactivated THEN
  RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.admin WHERE admin_id=p_target FOR UPDATE;
 IF t.admin_id IS NULL OR t.admin_role NOT IN ('super_admin','mall_admin') THEN
  RAISE EXCEPTION 'Account not found.' USING ERRCODE='P0002'; END IF;
 IF NOT a.admin_is_primary AND p_action<>'edit' THEN
  RAISE EXCEPTION 'Only the primary Super Admin can manage other accounts.' USING ERRCODE='42501'; END IF;
 IF p_action='edit' THEN
  IF jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN ('name','job_title','contact_num')) THEN
   RAISE EXCEPTION 'Invalid profile fields.' USING ERRCODE='22023'; END IF;
  IF (p_data ? 'name' AND (jsonb_typeof(p_data->'name')<>'string' OR length(btrim(p_data->>'name')) NOT BETWEEN 1 AND 100))
    OR (p_data ? 'job_title' AND (jsonb_typeof(p_data->'job_title')<>'string' OR length(p_data->>'job_title')>100))
    OR (p_data ? 'contact_num' AND (jsonb_typeof(p_data->'contact_num')<>'string' OR (p_data->>'contact_num') !~ '^(|[+]?[0-9][0-9 ()-]{6,19})$')) THEN
   RAISE EXCEPTION 'Enter a valid name, job title and contact number.' USING ERRCODE='22023'; END IF;
  UPDATE public.admin SET admin_full_name=CASE WHEN p_data ? 'name' THEN btrim(p_data->>'name') ELSE admin_full_name END,
   admin_job_title=CASE WHEN p_data ? 'job_title' THEN nullif(btrim(p_data->>'job_title'),'') ELSE admin_job_title END,
   admin_contact_num=CASE WHEN p_data ? 'contact_num' THEN nullif(btrim(p_data->>'contact_num'),'') ELSE admin_contact_num END,
   admin_updated_at=now() WHERE admin_id=t.admin_id RETURNING * INTO t;
 ELSIF p_action IN ('deactivate','reactivate','check-reactivate') THEN
  IF t.admin_id=a.admin_id OR (t.admin_role='super_admin' AND t.admin_is_primary) THEN
   RAISE EXCEPTION 'Your own account and primary Super Admin accounts cannot be deactivated here.' USING ERRCODE='22023'; END IF;
  IF p_action='deactivate' AND t.admin_is_deactivated THEN
   RAISE EXCEPTION 'This account is already deactivated.' USING ERRCODE='22023'; END IF;
  IF p_action<>'deactivate' AND NOT t.admin_is_deactivated THEN
   RAISE EXCEPTION 'This account is already active.' USING ERRCODE='22023'; END IF;
  IF p_action='check-reactivate' THEN RETURN to_jsonb(t); END IF;
  UPDATE public.admin SET admin_is_deactivated=(p_action='deactivate'),
   admin_deactivated_on=CASE WHEN p_action='deactivate' THEN now() ELSE admin_deactivated_on END,
   admin_updated_at=now() WHERE admin_id=t.admin_id RETURNING * INTO t;
 ELSIF p_action IN ('resend-invite','reset-password') THEN
  IF t.admin_is_deactivated OR t.admin_id=a.admin_id OR
   (p_action='resend-invite' AND t.admin_account_status<>'partial') OR
   (p_action='reset-password' AND t.admin_account_status<>'official') THEN
   RAISE EXCEPTION 'This email action is not available for the current account state.' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_account_email_attempt WHERE admin_id=t.admin_id AND attempted_at>now()-interval '1 minute') THEN
   RAISE EXCEPTION 'Please wait one minute before requesting another email.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.admin_account_email_attempt VALUES(t.admin_id,now()) ON CONFLICT(admin_id) DO UPDATE SET attempted_at=excluded.attempted_at;
 ELSE RAISE EXCEPTION 'Unknown account action.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('account_management',p_action,'Account '||t.admin_id,now(),a.admin_id,t.mall_id);
 RETURN to_jsonb(t);
END; $$;
REVOKE ALL ON FUNCTION public.manage_super_admin_account(bigint,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_super_admin_account(bigint,bigint,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_managed_admin(p_actor bigint,p_auth uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.admin%ROWTYPE; t public.admin%ROWTYPE; m bigint; r text:=p_data->>'role';
BEGIN
 SELECT * INTO a FROM public.admin WHERE admin_id=p_actor;
 IF a.admin_id IS NULL OR a.admin_role<>'super_admin' OR a.admin_account_status<>'official' OR a.admin_is_deactivated THEN RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 IF r NOT IN ('super_admin','mall_admin') OR r IS NULL THEN RAISE EXCEPTION 'Choose an account role.' USING ERRCODE='22023'; END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NULL OR length(p_data->>'name')>100 OR nullif(btrim(p_data->>'email'),'') IS NULL THEN RAISE EXCEPTION 'Name and email are required.' USING ERRCODE='22023'; END IF;
 IF r='mall_admin' THEN
  m:=(p_data->>'mall_id')::bigint;
  IF NOT EXISTS(SELECT 1 FROM public.mall WHERE mall_id=m) THEN RAISE EXCEPTION 'Select an existing mall.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('navar-accounts:'||m,0));
  IF coalesce((p_data->>'is_primary')::boolean,false) AND EXISTS(SELECT 1 FROM public.admin WHERE mall_id=m AND admin_role='mall_admin' AND admin_is_primary AND NOT admin_is_deactivated) THEN
   RAISE EXCEPTION 'This mall already has an active primary administrator.' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.admin(admin_role,admin_email,admin_full_name,admin_job_title,admin_contact_num,admin_is_primary,admin_is_deactivated,admin_account_status,admin_auth_user_id,mall_id,store_id,admin_created_at,admin_updated_at)
 VALUES(r,lower(btrim(p_data->>'email')),btrim(p_data->>'name'),nullif(btrim(p_data->>'job_title'),''),nullif(btrim(p_data->>'contact_num'),''),r='mall_admin' AND coalesce((p_data->>'is_primary')::boolean,false),false,'partial',p_auth,m,null,now(),now()) RETURNING * INTO t;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('account_management','admin_account_created','Account '||t.admin_id,now(),a.admin_id,t.mall_id);
 RETURN to_jsonb(t);
END $$;
REVOKE ALL ON FUNCTION public.create_managed_admin(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_managed_admin(bigint,uuid,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
