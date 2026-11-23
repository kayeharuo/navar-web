BEGIN;
DROP INDEX IF EXISTS public.audit_log_request_action_unique_idx;
CREATE UNIQUE INDEX audit_log_request_target_action_unique_idx
 ON public.audit_log (audit_log_request_id, audit_log_action, audit_log_target_type, audit_log_target_id)
 WHERE audit_log_request_id IS NOT NULL AND audit_log_target_type IS NOT NULL AND audit_log_target_id IS NOT NULL;
COMMIT;
