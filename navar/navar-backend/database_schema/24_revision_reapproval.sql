-- User-approved rule: the super admin may approve the SAME application directly
-- from For Revision after coordinating edits in its thread. Never increments attempts.
-- Run after migration 23. Do not rerun migration 23.
BEGIN;
DO $$
DECLARE definition text; old_guard text; new_guard text;
BEGIN
  definition := pg_get_functiondef('public.workflow_action(bigint,bigint,text,text,text)'::regprocedure);
  old_guard := 'IF a.application_status<>''submitted'' THEN RAISE EXCEPTION ''Only submitted applications can be approved''; END IF;';
  new_guard := 'IF a.application_status NOT IN (''submitted'',''for_revision'') THEN RAISE EXCEPTION ''Only submitted or For Revision applications can be approved''; END IF;';
  IF position(old_guard IN definition) > 0 THEN
    -- Preserve the deployed function, permissions, locks, role checks, audit events,
    -- AR resume logic and all unrelated workflow behavior.
    EXECUTE replace(definition, old_guard, new_guard);
  ELSIF position(new_guard IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected workflow_action definition. Review before changing approval rules.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.workflow_action(bigint,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_action(bigint,bigint,text,text,text) TO service_role;
COMMIT;
