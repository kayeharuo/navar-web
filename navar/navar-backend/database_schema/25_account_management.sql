-- Account management lifecycle and email reservations. Run after 24 and shared mall migrations.
-- Does not create accounts, send email, or change existing account records.
BEGIN;
ALTER TABLE public.audit_log ALTER COLUMN mall_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS public.admin_account_email_attempt (
 admin_id bigint PRIMARY KEY REFERENCES public.admin(admin_id), attempted_at timestamptz NOT NULL
);
ALTER TABLE public.admin_account_email_attempt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_account_email_attempt FROM PUBLIC,anon,authenticated;

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
COMMIT;
