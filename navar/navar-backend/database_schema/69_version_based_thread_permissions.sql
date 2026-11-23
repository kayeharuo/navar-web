BEGIN;
-- Accepted versions are final; a rejected/provisional request does not close
-- the current version's conversations. Attempts within one version stay open.
CREATE FUNCTION app_private.newer_thread_version_exists(p_mall bigint,p_version integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.application WHERE mall_id=p_mall AND application_version>p_version
  AND (application_accepted_at IS NOT NULL OR application_status IN ('submitted','for_revision','approved')));
$$;

CREATE FUNCTION app_private.thread_subject(p_kind text,p_id bigint)
RETURNS TABLE(subject_mall_id bigint,subject_version integer,subject_application_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_kind='application' THEN RETURN QUERY SELECT mall_id,application_version,application_id FROM public.application WHERE application_id=p_id;
 ELSIF p_kind='ar' THEN RETURN QUERY SELECT a.mall_id,a.application_version,a.application_id FROM public.ar_development d JOIN public.application a USING(application_id) WHERE d.ar_development_id=p_id;
 ELSIF p_kind='stall' THEN
  RETURN QUERY SELECT st.mall_id,coalesce(a.application_version,(SELECT max(ap.application_version) FROM public.application ap WHERE ap.mall_id=st.mall_id AND ap.application_created_at<=st.s_application_created_at AND ((ap.application_accepted_at IS NOT NULL AND ap.application_accepted_at<=st.s_application_created_at) OR (ap.application_accepted_at IS NULL AND ap.application_status='approved'))),1),a.application_id
   FROM public.stall_application st LEFT JOIN public.stall_expansion e ON e.stall_application_id=st.s_application_id LEFT JOIN public.ar_development d ON d.ar_development_id=e.development_id LEFT JOIN public.application a ON a.application_id=d.application_id
   WHERE st.s_application_id=p_id ORDER BY e.id DESC NULLS LAST LIMIT 1;
 END IF;
END $$;

CREATE FUNCTION public.thread_write_state(p_kind text,p_id bigint,p_actor bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE subject record; who public.admin; locked boolean;
BEGIN
 SELECT * INTO subject FROM app_private.thread_subject(p_kind,p_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Thread subject not found.';END IF;
 SELECT * INTO who FROM public.admin WHERE admin_id=p_actor AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF who.admin_id IS NULL OR who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM subject.subject_mall_id) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 IF auth.uid() IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' AND who.admin_auth_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 locked:=app_private.newer_thread_version_exists(subject.subject_mall_id,subject.subject_version);
 RETURN jsonb_build_object('readOnly',locked,'version',subject.subject_version,'mallId',subject.subject_mall_id);
END $$;

CREATE OR REPLACE FUNCTION public.guard_workflow_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.thread; subject record; kind text; source_id bigint;
BEGIN
 SELECT * INTO STRICT t FROM public.thread WHERE thread_id=NEW.thread_id;
 IF t.application_id IS NULL AND t.ar_development_id IS NULL THEN RETURN NEW;END IF;
 kind:=CASE WHEN t.ar_development_id IS NOT NULL THEN 'ar' ELSE 'application' END;
 source_id:=coalesce(t.ar_development_id,t.application_id);
 SELECT * INTO STRICT subject FROM app_private.thread_subject(kind,source_id);
 PERFORM 1 FROM public.mall WHERE mall_id=subject.subject_mall_id FOR UPDATE;
 IF (public.thread_write_state(kind,source_id,NEW.message_sender)->>'readOnly')::boolean THEN RAISE EXCEPTION 'A newer version exists. This thread is read-only.';END IF;
 IF length(NEW.message_content)>10000 THEN RAISE EXCEPTION 'Message too long';END IF;
 PERFORM public.workflow_event(subject.subject_application_id,NEW.message_sender,'thread_message','A new thread message was posted.',t.ar_development_id);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_private.guard_stall_thread_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st bigint; subject record;
BEGIN
 SELECT s_application_id INTO st FROM public.thread WHERE thread_id=NEW.thread_id;
 IF st IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO STRICT subject FROM app_private.thread_subject('stall',st);
 PERFORM 1 FROM public.mall WHERE mall_id=subject.subject_mall_id FOR UPDATE;
 IF (public.thread_write_state('stall',st,NEW.message_sender)->>'readOnly')::boolean THEN RAISE EXCEPTION 'A newer version exists. This thread is read-only.';END IF;
 IF length(NEW.message_content)>10000 THEN RAISE EXCEPTION 'Message too long';END IF;
 RETURN NEW;
END $$;

-- Keep both assisted and ordinary mall clients on the same policy.
DO $$DECLARE definition text; needle text;
BEGIN
 SELECT pg_get_functiondef('public.stall_application_portal(bigint,bigint,text,jsonb)'::regprocedure) INTO definition;
 needle:='IF e.status IN (''completed'',''cancelled'') THEN RAISE EXCEPTION ''This application thread is read-only.'';END IF;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected stall message gate not found';END IF;
 EXECUTE replace(definition,needle,'IF (public.thread_write_state(''stall'',e.stall_application_id,acting.admin_id)->>''readOnly'')::boolean THEN RAISE EXCEPTION ''A newer version exists. This thread is read-only.'';END IF;');
 SELECT pg_get_functiondef('public.map_application_portal(bigint,bigint,text,jsonb)'::regprocedure) INTO definition;
 needle:='IF d.ar_development_status IN (''live'',''unpublished'') THEN RAISE EXCEPTION ''This application is read-only.'';END IF;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected map message gate not found';END IF;
 definition:=replace(definition,needle,'IF (public.thread_write_state(''application'',a.application_id,acting.admin_id)->>''readOnly'')::boolean THEN RAISE EXCEPTION ''A newer version exists. This thread is read-only.'';END IF;');
 needle:='  IF (p_data->>''id'')::bigint IS DISTINCT FROM a.application_id';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected map action target check not found';END IF;
 definition:=replace(definition,needle,'  IF p_action=''message'' THEN SELECT * INTO a FROM public.application WHERE application_id=(p_data->>''id'')::bigint AND mall_id=p_mall;END IF;'||chr(10)||needle);
 EXECUTE definition;
END $$;

REVOKE ALL ON FUNCTION app_private.newer_thread_version_exists(bigint,integer),app_private.thread_subject(text,bigint),public.thread_write_state(text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_write_state(text,bigint,bigint) TO service_role;
COMMIT;
