BEGIN;
DO $$DECLARE actor bigint;fid bigint;bid bigint;eid bigint;rev integer;app bigint;before_contracts bigint;before_annual bigint;r jsonb;refused boolean:=false;BEGIN
 SELECT admin_id INTO actor FROM public.admin WHERE admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated ORDER BY admin_id LIMIT 1;
 SELECT min(floor_id) INTO fid FROM public.floor WHERE mall_id=12;SELECT min(brand_id) INTO bid FROM public.brand;
 SELECT count(*) INTO before_contracts FROM public.contract WHERE mall_id=12;
 SELECT count(*) INTO before_annual FROM public.contract_payment_request WHERE mall_id=12 AND fee_type='subscription';
 r:=public.stall_application_portal(actor,12,'prepare',jsonb_build_object('floors',jsonb_build_array(jsonb_build_object('floor_id',fid,'quantity',1))));eid:=(r->>'id')::bigint;
 SELECT revision,stall_application_id INTO rev,app FROM public.stall_expansion WHERE id=eid;
 BEGIN
  PERFORM public.stall_application_portal(actor,12,'submit',jsonb_build_object('id',eid,'revision',rev));
 EXCEPTION WHEN SQLSTATE 'P0001' THEN refused:=true;END;
 IF NOT refused THEN RAISE EXCEPTION 'Submission allowed before payment';END IF;
 PERFORM public.stall_application_portal(actor,12,'pay',jsonb_build_object('id',eid,'acknowledged',true));
 SELECT revision INTO rev FROM public.stall_expansion WHERE id=eid;
 PERFORM public.stall_application_portal(actor,12,'save-floor',jsonb_build_object('id',eid,'revision',rev,'floor_id',fid,'items',jsonb_build_array(jsonb_build_object('name','Verification stall '||eid,'brand_id',bid,'location','Beside the corridor on this floor'))));
 SELECT revision INTO rev FROM public.stall_expansion WHERE id=eid;
 PERFORM public.stall_application_portal(actor,12,'submit',jsonb_build_object('id',eid,'revision',rev));
 PERFORM public.stall_application_portal(actor,12,'message',jsonb_build_object('id',eid,'content','Please review the additional stall location.'));
 SELECT revision INTO rev FROM public.stall_expansion WHERE id=eid;
 PERFORM public.review_stall_expansion(eid,actor,'approve',rev,'');
 IF NOT EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=17 AND ar_development_status='node_mapping') THEN RAISE EXCEPTION 'Approval did not reopen node mapping';END IF;
 PERFORM public.workflow_action(16,actor,'ar_status','','testing');
 PERFORM public.workflow_action(16,actor,'ar_status','','ready');
 PERFORM public.stall_application_portal(actor,12,'confirm',jsonb_build_object('id',eid,'acknowledged',true));
 IF NOT EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=17 AND ar_development_status='live') THEN RAISE EXCEPTION 'Confirmation did not publish';END IF;
 IF before_contracts<>(SELECT count(*) FROM public.contract WHERE mall_id=12) OR before_annual<>(SELECT count(*) FROM public.contract_payment_request WHERE mall_id=12 AND fee_type='subscription') THEN RAISE EXCEPTION 'Stall update created an annual subscription';END IF;
END $$;
SELECT true AS paid_stall_workflow_without_floor_plan_and_without_annual_repayment_verified;
ROLLBACK;