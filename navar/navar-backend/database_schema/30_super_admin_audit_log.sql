-- Structured, append-only audit events for the Super Admin interface.
BEGIN;

ALTER TABLE public.audit_log
 ADD COLUMN IF NOT EXISTS audit_log_target_type text,
 ADD COLUMN IF NOT EXISTS audit_log_target_id text,
 ADD COLUMN IF NOT EXISTS audit_log_target_name text,
 ADD COLUMN IF NOT EXISTS audit_log_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS audit_log_request_id text,
 ADD COLUMN IF NOT EXISTS audit_log_actor_name text,
 ADD COLUMN IF NOT EXISTS audit_log_actor_role text;

CREATE INDEX IF NOT EXISTS audit_log_performed_at_idx ON public.audit_log (audit_log_performed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_module_performed_at_idx ON public.audit_log (audit_log_module, audit_log_performed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_performed_at_idx ON public.audit_log (audit_log_performed_by, audit_log_performed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_mall_performed_at_idx ON public.audit_log (mall_id, audit_log_performed_at DESC) WHERE mall_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON public.audit_log (audit_log_target_type, audit_log_target_id) WHERE audit_log_target_type IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_log_request_target_action_unique_idx ON public.audit_log (audit_log_request_id, audit_log_action, audit_log_target_type, audit_log_target_id) WHERE audit_log_request_id IS NOT NULL AND audit_log_target_type IS NOT NULL AND audit_log_target_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_super_admin_audit_event(
 p_actor bigint, p_module text, p_action text, p_details text DEFAULT NULL,
 p_mall bigint DEFAULT NULL, p_target_type text DEFAULT NULL, p_target_id text DEFAULT NULL,
 p_target_name text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_request_id text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE actor public.admin%ROWTYPE; result bigint;
BEGIN
 SELECT * INTO actor FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin'
  AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF actor.admin_id IS NULL THEN RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_module),'') IS NULL OR nullif(btrim(p_action),'') IS NULL THEN
  RAISE EXCEPTION 'Audit module and action are required.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,
  audit_log_performed_by,mall_id,audit_log_target_type,audit_log_target_id,audit_log_target_name,
  audit_log_metadata,audit_log_request_id,audit_log_actor_name,audit_log_actor_role)
 VALUES(btrim(p_module),btrim(p_action),p_details,now(),actor.admin_id,p_mall,p_target_type,p_target_id,p_target_name,
  coalesce(p_metadata,'{}'::jsonb),p_request_id,actor.admin_full_name,actor.admin_role)
 RETURNING audit_log_id INTO result;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_super_admin_audit_event(bigint,text,text,text,bigint,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_super_admin_audit_event(bigint,text,text,text,bigint,text,text,text,jsonb,text) TO service_role;

-- Audit records are append-only through application code.
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
