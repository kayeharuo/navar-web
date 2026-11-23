BEGIN;
-- Preserve mall confirmation if the subscription lapses before publication.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.map_application_portal(bigint,bigint,text,jsonb)'::regprocedure) INTO definition;
 IF position($old$   PERFORM public.workflow_action(a.application_id,acting.admin_id,'mall_approve','acknowledged');
   PERFORM public.workflow_action(a.application_id,acting.admin_id,'publish');
   result:=jsonb_build_object('message','AR confirmed and published using the existing subscription. No annual subscription payment was charged.');$old$ IN definition)=0 THEN
  IF position('AR confirmation recorded. Publication is waiting for an active subscription.' IN definition)>0 THEN RETURN;END IF;
  RAISE EXCEPTION 'Expected map confirmation branch not found';
 END IF;
 EXECUTE replace(definition,$old$   PERFORM public.workflow_action(a.application_id,acting.admin_id,'mall_approve','acknowledged');
   PERFORM public.workflow_action(a.application_id,acting.admin_id,'publish');
   result:=jsonb_build_object('message','AR confirmed and published using the existing subscription. No annual subscription payment was charged.');$old$,$new$   IF d.ar_development_status='live' AND d.ar_development_mall_approved_at IS NOT NULL THEN
    result:=jsonb_build_object('message','The AR is already Live.','published',true);
   ELSE
    IF d.ar_development_status IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'The AR must be Ready before confirmation.';END IF;
    IF d.ar_development_mall_approved_at IS NULL THEN PERFORM public.workflow_action(a.application_id,acting.admin_id,'mall_approve','acknowledged');END IF;
    IF c.contract_id IS NOT NULL AND c.contract_status='active' AND c.contract_start<=now() AND c.contract_end>now() AND NOT EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN
     PERFORM public.workflow_action(a.application_id,acting.admin_id,'publish');
     result:=jsonb_build_object('message','AR confirmed and published using the existing subscription. No annual subscription payment was charged.','published',true);
    ELSE result:=jsonb_build_object('message','AR confirmation recorded. Publication is waiting for an active subscription. The existing update payment is retained.','waiting',true);
    END IF;
   END IF;$new$);
END $migration$;
COMMIT;
