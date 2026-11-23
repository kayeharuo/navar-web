BEGIN;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.workflow_action(bigint,bigint,text,text,text)'::regprocedure) INTO definition;
 IF position($old$  PERFORM public.manage_v3_service(s.service_id,p_actor,'start');$old$ IN definition)=0 THEN
  IF position('A paid service still waiting for application approval' IN definition)>0 THEN RETURN;END IF;
  -- Whitespace-independent check for fresh deployments of migration 65.
  IF position('paid service still waiting for application approval' IN definition)>0 THEN RETURN;END IF;
  RAISE EXCEPTION 'Expected map queue branch not found';
 END IF;
 EXECUTE replace(definition,$old$  PERFORM public.manage_v3_service(s.service_id,p_actor,'start');$old$,$new$  IF s.status NOT IN ('queued','in_progress') THEN RAISE EXCEPTION 'Complete the map-update payment before starting mapping.';END IF;
  -- Match the AR queue: only approved Pending developments participate. A
  -- paid service still waiting for application approval must not block work.
  IF EXISTS(
   SELECT 1 FROM public.ar_development other JOIN public.application ap ON ap.application_id=other.application_id
   LEFT JOIN public.contract oc ON oc.mall_id=ap.mall_id AND oc.contract_is_current
   LEFT JOIN public.subscription_tier ot ON ot.s_tier_id=oc.s_tier_id
   WHERE other.ar_development_status='pending' AND ap.application_status='approved' AND ap.application_version>1 AND ap.application_id<>p_id
   AND (CASE ot.s_tier_key WHEN 'premium' THEN 0 WHEN 'standard' THEN 1 WHEN 'basic' THEN 2 ELSE 3 END,coalesce(ap.application_approved_at,other.ar_development_created_at),other.ar_development_id)
    <(coalesce((SELECT CASE s_tier_key WHEN 'premium' THEN 0 WHEN 'standard' THEN 1 WHEN 'basic' THEN 2 ELSE 3 END FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id),3),coalesce(a.application_approved_at,(SELECT ar_development_created_at FROM public.ar_development WHERE application_id=p_id ORDER BY ar_development_id DESC LIMIT 1)),(SELECT ar_development_id FROM public.ar_development WHERE application_id=p_id ORDER BY ar_development_id DESC LIMIT 1))
  ) THEN RAISE EXCEPTION 'An earlier or higher-priority map update is queued.';END IF;
  UPDATE public.mall_service_request SET status='in_progress' WHERE service_id=s.service_id;$new$);
END $migration$;
COMMIT;
