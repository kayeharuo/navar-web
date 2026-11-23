BEGIN;
-- Any newer application version supersedes older conversations immediately.
CREATE OR REPLACE FUNCTION app_private.newer_thread_version_exists(p_mall bigint,p_version integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.application WHERE mall_id=p_mall AND application_version>p_version);
$$;

CREATE OR REPLACE FUNCTION public.thread_write_state(p_kind text,p_id bigint,p_actor bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE subject record; who public.admin; locked boolean;
BEGIN
 SELECT * INTO subject FROM app_private.thread_subject(p_kind,p_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Thread subject not found.';END IF;
 SELECT * INTO who FROM public.admin WHERE admin_id=p_actor AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF who.admin_id IS NULL OR who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM subject.subject_mall_id) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 IF auth.uid() IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' AND who.admin_auth_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 locked:=app_private.newer_thread_version_exists(subject.subject_mall_id,subject.subject_version);
 IF p_kind IN ('application','ar') THEN
  locked:=locked OR EXISTS(SELECT 1 FROM public.application newer JOIN public.application source ON source.application_id=subject.subject_application_id
   WHERE newer.mall_id=source.mall_id AND newer.application_version=source.application_version AND newer.application_attempt>source.application_attempt);
 END IF;
 RETURN jsonb_build_object('readOnly',locked,'version',subject.subject_version,'mallId',subject.subject_mall_id);
END $$;

-- Keep per-attempt source records and immutable snapshots. Current readers share
-- all messages for the mall/version, while writes remain bound to the latest
-- attempt. Future rejection snapshots capture that shared conversation cutoff.
DO $migration$
DECLARE definition text; needle text;
BEGIN
 IF to_regprocedure('app_private.capture_application_review(bigint,bigint,text,timestamp with time zone,integer,boolean)') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.capture_application_review(bigint,bigint,text,timestamp with time zone,integer,boolean)'::regprocedure) INTO definition;
  needle:='WHERE t.application_id=p_application AND m.message_sent_at<=p_at';
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected review message cutoff not found';END IF;
  definition:=replace(definition,needle,'WHERE t.application_id IN (SELECT peer.application_id FROM public.application peer JOIN public.application source ON source.application_id=p_application AND peer.mall_id=source.mall_id AND peer.application_version=source.application_version) AND m.message_sent_at<=p_at');
  EXECUTE definition;
 END IF;
 SELECT pg_get_functiondef('public.guard_workflow_message()'::regprocedure) INTO definition;
 EXECUTE replace(definition,'A newer version exists. This thread is read-only.','A newer version or attempt exists. This thread is read-only.');
END $migration$;
REVOKE ALL ON FUNCTION public.thread_write_state(text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_write_state(text,bigint,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
