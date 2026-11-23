BEGIN;
-- Patch only the service wording, preserving subsequent notification changes.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('app_private.monitor_workflow_change()'::regprocedure) INTO definition;
 IF position($old$PERFORM app_private.notify_super_admins('service:'||id||':'||status||':'||txid_current(),mid,'application',label||' request updated','Request #'||id||' is now '||replace(status,'_',' ')||'. Review its application and payment.','/application-management',id);$old$ IN definition)=0 THEN RAISE EXCEPTION 'Expected service notification branch not found'; END IF;
 EXECUTE replace(definition,$old$PERFORM app_private.notify_super_admins('service:'||id||':'||status||':'||txid_current(),mid,'application',label||' request updated','Request #'||id||' is now '||replace(status,'_',' ')||'. Review its application and payment.','/application-management',id);$old$,$new$IF n->>'kind'='stall_addon' AND status='in_progress' THEN
    PERFORM app_private.notify_super_admins('service:'||id||':'||status||':'||txid_current(),mid,'application','Stall application approved','The stall application is approved. Payment was completed before submission. AR development has returned to Node Mapping.','/application-management/stall-applications?type=stall&applicationId='||(n->>'stall_application_id'),(n->>'stall_application_id')::bigint);
   ELSE
    PERFORM app_private.notify_super_admins('service:'||id||':'||status||':'||txid_current(),mid,'application',label||' request updated','Request #'||id||' is now '||replace(status,'_',' ')||'. View the request for details.','/application-management',id);
   END IF;$new$);
END $migration$;
-- Correct existing approval notices without generating duplicate alerts or changing read state.
UPDATE public.admin_notification a SET
 admin_notif_title='Stall application approved',
 admin_notif_message=m.mall_name||': The stall application is approved. Payment was completed before submission. AR development has returned to Node Mapping.',
 admin_notif_action_url='/application-management/stall-applications?type=stall&applicationId='||s.stall_application_id,
 admin_notif_source_id=s.stall_application_id
FROM public.mall_service_request s JOIN public.mall m ON m.mall_id=s.mall_id
WHERE s.kind='stall_addon' AND a.workflow_event_key LIKE 'service:'||s.service_id||':in_progress:%'
 AND a.admin_notif_message LIKE '%Review its application and payment.%';
UPDATE app_private.workflow_monitor_event e SET title='Stall application approved',
 message='The stall application is approved. Payment was completed before submission. AR development has returned to Node Mapping.'
FROM public.mall_service_request s WHERE s.kind='stall_addon' AND e.event_key LIKE 'service:'||s.service_id||':in_progress:%';
COMMIT;
