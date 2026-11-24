-- One-time, owner-run cleanup. Preserve every record for the three protected malls.
BEGIN;
LOCK TABLE public.mall,public.application,public.ar_development,public.contract IN SHARE ROW EXCLUSIVE MODE;
DO $cleanup$
DECLARE item record; payload jsonb;
BEGIN
 IF (SELECT count(*) FROM public.mall WHERE (mall_id,mall_name) IN
  ((5,'SM Seaside City Cebu'),(12,'Gaisano Fiesta Mall'),(21,'Robinsons Galleria')))<>3
 THEN RAISE EXCEPTION 'Protected mall identities changed';END IF;
 FOR item IN SELECT a.* FROM public.application a JOIN public.mall m USING(mall_id)
  WHERE a.application_status='approved' AND a.mall_id NOT IN (5,12,21)
   AND lower(m.mall_name) NOT IN ('gaisano fiesta mall','sm seaside city cebu','robinsons galleria')
   AND NOT EXISTS(SELECT 1 FROM public.ar_development d WHERE d.application_id=a.application_id)
 LOOP
  IF item.application_id NOT IN (10,15) THEN RAISE EXCEPTION 'Unexpected application %. Review before cleanup.',item.application_id;END IF;
  IF EXISTS(SELECT 1 FROM public.mall_service_request WHERE application_id=item.application_id)
    OR EXISTS(SELECT 1 FROM public.map_application_floor_source s JOIN public.application_floor_plan p ON p.app_floor_plan_id=s.source_plan_id WHERE p.application_id=item.application_id AND s.application_id<>item.application_id)
    OR EXISTS(SELECT 1 FROM public.application_floor_plan p JOIN public.application_floor_plan source ON source.app_floor_plan_id=p.app_floor_plan_reused_from WHERE source.application_id=item.application_id AND p.application_id<>item.application_id)
  THEN RAISE EXCEPTION 'Application % has dependent workflow/history outside its submission.',item.application_id;END IF;
  payload:=jsonb_build_object('application',to_jsonb(item),
   'floorPlans',(SELECT jsonb_agg(to_jsonb(p)) FROM public.application_floor_plan p WHERE application_id=item.application_id),
   'entryPoints',(SELECT jsonb_agg(to_jsonb(p)) FROM public.application_entry_point p WHERE application_id=item.application_id),
   'floorSources',(SELECT jsonb_agg(to_jsonb(p)) FROM public.map_application_floor_source p WHERE application_id=item.application_id),
   'reviewHistory',(SELECT jsonb_agg(to_jsonb(p)) FROM public.application_review_history p WHERE application_id=item.application_id),
   'intake',(SELECT jsonb_agg(to_jsonb(p)) FROM app_private.map_intake_submission p WHERE application_id=item.application_id));
  INSERT INTO app_private.workflow_cleanup_archive(mall_id,record_type,record_id,reason,payload)
   VALUES(item.mall_id,'application',item.application_id,'Approved application without AR: preserve application and reset submission to Draft.',payload);
  DELETE FROM public.map_application_floor_source WHERE application_id=item.application_id;
  DELETE FROM public.application_entry_point WHERE application_id=item.application_id;
  DELETE FROM public.application_floor_plan WHERE application_id=item.application_id;
  DELETE FROM public.application_review_history WHERE application_id=item.application_id;
  DELETE FROM app_private.map_intake_submission WHERE application_id=item.application_id;
  UPDATE public.application SET application_status='draft',application_accepted_at=NULL,application_approved_at=NULL,
   application_reason_category=NULL,application_reason_notes=NULL,application_dispute_count=0,application_updated_at=now()
   WHERE application_id=item.application_id;
 END LOOP;
 FOR item IN SELECT c.* FROM public.contract c JOIN public.mall m USING(mall_id)
  WHERE c.mall_id NOT IN (5,12,21) AND lower(m.mall_name) NOT IN ('gaisano fiesta mall','sm seaside city cebu','robinsons galleria')
   AND NOT EXISTS(SELECT 1 FROM public.application a JOIN public.ar_development d USING(application_id)
    WHERE a.mall_id=c.mall_id AND d.ar_development_status='live')
 LOOP
  IF item.contract_id NOT IN (6,9,12) THEN RAISE EXCEPTION 'Unexpected subscription %. Review before cleanup.',item.contract_id;END IF;
  IF EXISTS(SELECT 1 FROM public.payment WHERE contract_id=item.contract_id)
   OR EXISTS(SELECT 1 FROM public.contract_payment_request WHERE contract_id=item.contract_id)
   OR EXISTS(SELECT 1 FROM public.mall_service_request WHERE contract_id=item.contract_id)
   OR EXISTS(SELECT 1 FROM public.contract WHERE previous_contract_id=item.contract_id)
   OR EXISTS(SELECT 1 FROM public.mall_onboarding WHERE contract_id=item.contract_id)
  THEN RAISE EXCEPTION 'Subscription % has unexpected linked records. Review before cleanup.',item.contract_id;END IF;
  INSERT INTO app_private.workflow_cleanup_archive(mall_id,record_type,record_id,reason,payload)
   VALUES(item.mall_id,'subscription',item.contract_id,'User requested removal of subscriptions for malls without any Live AR.',
    jsonb_build_object('contract',to_jsonb(item),'suspensions',(SELECT jsonb_agg(to_jsonb(s)) FROM public.suspension s WHERE contract_id=item.contract_id)));
  DELETE FROM public.suspension WHERE contract_id=item.contract_id;
  DELETE FROM public.contract WHERE contract_id=item.contract_id;
 END LOOP;
 UPDATE public.mall SET mall_description='Gaisano Grand Mall Minglanilla, Cebu.',mall_updated_at=now()
  WHERE mall_id=20 AND mall_name='Gaisano Grand Mall Minglanilla' AND mall_description LIKE 'Internally entered for onboarding.%';
END $cleanup$;
COMMIT;
