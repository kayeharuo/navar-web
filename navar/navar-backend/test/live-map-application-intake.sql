-- Run after migration 65. All requests, payments and notifications roll back.
BEGIN;
SAVEPOINT before_intake;
DO $$
DECLARE actor bigint; other_actor bigint; ctx jsonb; payload jsonb; r jsonb; app_id bigint; retry_id bigint; token uuid:=gen_random_uuid(); denied boolean:=false; service public.mall_service_request; old_entries bigint; original_plan bigint; source_application bigint; source_ar bigint; new_ar bigint; contracts_before bigint; annual_before bigint;
BEGIN
 SELECT min(admin_id) INTO actor FROM public.admin WHERE admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated;
 SELECT min(admin_id) INTO other_actor FROM public.admin WHERE mall_id=5 AND admin_role='mall_admin' AND admin_account_status='official' AND NOT admin_is_deactivated;
 ctx:=public.map_application_portal(actor,12,'context');
 IF NOT (ctx->'eligibility'->>'allowed')::boolean THEN RAISE EXCEPTION 'Gaisano Fiesta is not eligible: %',ctx->'eligibility';END IF;
 source_application:=(ctx->>'liveApplicationId')::bigint;source_ar:=(ctx->'eligibility'->>'sourceDevelopmentId')::bigint;
 SELECT count(*) INTO contracts_before FROM public.contract WHERE mall_id=12;SELECT count(*) INTO annual_before FROM public.contract_payment_request WHERE mall_id=12 AND fee_type='subscription';
 SELECT count(*) INTO old_entries FROM public.application_entry_point WHERE application_id=source_application;
 original_plan:=(ctx->'floors'->0->>'sourcePlanId')::bigint;
 SELECT jsonb_build_object('token',token,'sourceApplicationId',source_application,'sourceMapRevision',ctx->'eligibility'->'sourceMapRevision','reasonCategory','Structural layout change','reasonNotes','Rolled-back verification of changed corridor geometry.','floors',jsonb_agg(value||jsonb_build_object('changed',ordinality=1))) INTO payload FROM jsonb_array_elements(ctx->'floors') WITH ORDINALITY;
 IF other_actor IS NOT NULL THEN BEGIN PERFORM public.map_application_portal(other_actor,12,'context');EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Cross-mall access allowed';END IF;END IF;
 r:=public.map_application_portal(actor,12,'submit',payload);app_id:=(r->>'id')::bigint;
 IF (public.map_application_portal(actor,12,'submit',payload)->>'id')::bigint<>app_id THEN RAISE EXCEPTION 'Duplicate submission created a new application';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.application WHERE application_id=app_id AND application_version=2 AND application_status='pending') OR EXISTS(SELECT 1 FROM public.ar_development WHERE application_id=app_id) THEN RAISE EXCEPTION 'Request did not enter Pending without AR';END IF;
 IF (SELECT count(*) FROM public.application_floor_plan WHERE application_id=app_id)<>jsonb_array_length(ctx->'floors') OR (SELECT count(*) FROM public.application_entry_point WHERE application_id=app_id)<>old_entries THEN RAISE EXCEPTION 'Full plan/entry-point copy failed';END IF;
 IF EXISTS(SELECT 1 FROM public.application_floor_plan n JOIN public.map_application_floor_source o ON o.application_id=n.application_id AND o.floor_id=n.floor_id JOIN public.application_floor_plan old ON old.app_floor_plan_id=o.source_plan_id WHERE n.application_id=app_id AND (n.app_floor_plan_id=old.app_floor_plan_id OR n.app_floor_plan_image IS DISTINCT FROM old.app_floor_plan_image)) THEN RAISE EXCEPTION 'Reused images were not safely copied';END IF;
 PERFORM public.workflow_action(app_id,actor,'reject','First review explanation');
 PERFORM public.map_application_portal(actor,12,'dispute',jsonb_build_object('id',app_id,'notes','First dispute explanation'));
 PERFORM public.workflow_action(app_id,actor,'reject','Second review explanation');
 IF NOT EXISTS(SELECT 1 FROM public.application WHERE application_id=app_id AND application_status='rejected' AND application_dispute_count=1) THEN RAISE EXCEPTION 'Second dispute was prematurely blocked';END IF;
 PERFORM public.map_application_portal(actor,12,'dispute',jsonb_build_object('id',app_id,'notes','Second dispute explanation'));
 PERFORM public.workflow_action(app_id,actor,'reject','Final review explanation');
 IF NOT EXISTS(SELECT 1 FROM public.application WHERE application_id=app_id AND application_status='rejected_final' AND application_dispute_count=2) THEN RAISE EXCEPTION 'Final rejection failed';END IF;
 denied:=false;BEGIN PERFORM public.map_application_portal(actor,12,'dispute',jsonb_build_object('id',app_id,'notes','Third dispute'));EXCEPTION WHEN SQLSTATE 'P0001' THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Third dispute allowed';END IF;
 payload:=payload||jsonb_build_object('token',gen_random_uuid());r:=public.map_application_portal(actor,12,'submit',payload);retry_id:=(r->>'id')::bigint;
 IF NOT EXISTS(SELECT 1 FROM public.application WHERE application_id=retry_id AND application_version=2 AND application_attempt=2) THEN RAISE EXCEPTION 'Retry numbering failed';END IF;
 PERFORM public.workflow_action(retry_id,actor,'accept');
 SELECT * INTO STRICT service FROM public.mall_service_request WHERE application_id=retry_id;
 IF service.status<>'awaiting_payment' OR (service.quote->>'amount_cent')::bigint<>2800000 OR jsonb_array_length(service.inputs->'floorIds')<>1 THEN RAISE EXCEPTION 'Changed-floor quote incorrect: %',service.quote;END IF;
 denied:=false;BEGIN PERFORM public.workflow_action(retry_id,actor,'approve');EXCEPTION WHEN SQLSTATE 'P0001' THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Unpaid request approved';END IF;
 PERFORM public.map_application_portal(actor,12,'pay',jsonb_build_object('id',retry_id,'acknowledged',true));
 PERFORM public.workflow_action(retry_id,actor,'revision','Clarify the corridor entry point');
 ctx:=public.map_application_portal(actor,12,'context');
 PERFORM public.map_application_portal(actor,12,'revise',jsonb_build_object('id',retry_id,'updatedAt',ctx->'latest'->'application_updated_at','floors',ctx->'floors','notes','Clarified the requested application details.'));
 PERFORM public.workflow_action(retry_id,actor,'approve');
 IF NOT EXISTS(SELECT 1 FROM public.ar_development WHERE application_id=retry_id AND ar_development_status='pending') THEN RAISE EXCEPTION 'Approval did not create Pending AR';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ar_development WHERE application_id=source_application AND ar_development_status='live') THEN RAISE EXCEPTION 'Submission or approval hid the previous Live AR';END IF;
 IF (SELECT count(*) FROM public.application_entry_point WHERE application_id=source_application)<>old_entries OR NOT EXISTS(SELECT 1 FROM public.application_floor_plan WHERE app_floor_plan_id=original_plan) THEN RAISE EXCEPTION 'Source application was modified';END IF;
 -- Seed a separate version-owned graph only as a rollback fixture. The portal
 -- copies application details, not a production map, automatically.
 -- A service without an approved Pending development is not in the AR queue.
 INSERT INTO public.mall_service_request(mall_id,kind,status,inputs,contract_id,created_by,application_id,priority,queued_at)
 SELECT 12,'map_update','queued','{}'::jsonb,contract_id,actor,source_application,2,now()-interval '1 day' FROM public.contract WHERE mall_id=12 AND contract_is_current;
 SELECT ar_development_id INTO new_ar FROM public.ar_development WHERE application_id=retry_id;
 PERFORM public.workflow_action(retry_id,actor,'ar_status','','node_mapping');
 CREATE TEMP TABLE intake_group_map AS SELECT transition_group_id old_id,gen_random_uuid() new_id FROM public.transition_group WHERE ar_development_id=source_ar;
 INSERT INTO public.transition_group SELECT (jsonb_populate_record(NULL::public.transition_group,to_jsonb(g)||jsonb_build_object('transition_group_id',m.new_id,'ar_development_id',new_ar))).* FROM public.transition_group g JOIN intake_group_map m ON m.old_id=g.transition_group_id;
 CREATE TEMP TABLE intake_node_map AS SELECT node_id old_id,nextval(pg_get_serial_sequence('public.node','node_id')) new_id FROM public.node WHERE ar_development_id=source_ar;
 INSERT INTO public.node OVERRIDING SYSTEM VALUE SELECT (jsonb_populate_record(NULL::public.node,to_jsonb(n)||jsonb_build_object('node_id',m.new_id,'ar_development_id',new_ar,'transition_group_id',g.new_id))).* FROM public.node n JOIN intake_node_map m ON m.old_id=n.node_id LEFT JOIN intake_group_map g ON g.old_id=n.transition_group_id;
 INSERT INTO public.edge OVERRIDING SYSTEM VALUE SELECT (jsonb_populate_record(NULL::public.edge,to_jsonb(e)||jsonb_build_object('edge_id',nextval(pg_get_serial_sequence('public.edge','edge_id')),'ar_development_id',new_ar,'start_node_id',sm.new_id,'end_node_id',em.new_id))).* FROM public.edge e JOIN intake_node_map sm ON sm.old_id=e.start_node_id JOIN intake_node_map em ON em.old_id=e.end_node_id WHERE e.ar_development_id=source_ar;
 INSERT INTO public.floor_calibration OVERRIDING SYSTEM VALUE SELECT (jsonb_populate_record(NULL::public.floor_calibration,to_jsonb(fc)||jsonb_build_object('calibration_id',nextval(pg_get_serial_sequence('public.floor_calibration','calibration_id')),'ar_development_id',new_ar))).* FROM public.floor_calibration fc WHERE fc.ar_development_id=source_ar;
 INSERT INTO public.beacon_node_assignment OVERRIDING SYSTEM VALUE SELECT (jsonb_populate_record(NULL::public.beacon_node_assignment,to_jsonb(b)||jsonb_build_object('assignment_id',nextval(pg_get_serial_sequence('public.beacon_node_assignment','assignment_id')),'ar_development_id',new_ar,'node_id',m.new_id))).* FROM public.beacon_node_assignment b JOIN intake_node_map m ON m.old_id=b.node_id WHERE b.ar_development_id=source_ar;
 PERFORM public.workflow_action(retry_id,actor,'ar_status','','testing');
 PERFORM public.workflow_action(retry_id,actor,'ar_status','','ready');
 UPDATE public.contract SET contract_status='grace' WHERE mall_id=12 AND contract_is_current;
 r:=public.map_application_portal(actor,12,'confirm',jsonb_build_object('id',retry_id,'acknowledged',true));
 IF r->>'waiting' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=new_ar AND ar_development_status='ready' AND ar_development_mall_approved_at IS NOT NULL) THEN RAISE EXCEPTION 'Confirmation was lost while waiting for subscription recovery';END IF;
 UPDATE public.contract SET contract_status='active' WHERE mall_id=12 AND contract_is_current;
 PERFORM public.map_application_portal(actor,12,'confirm',jsonb_build_object('id',retry_id,'acknowledged',true));
 IF NOT EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=new_ar AND ar_development_status='live') OR NOT EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=source_ar AND ar_development_status='unpublished' AND ar_development_unpublish_reason='superseded') THEN RAISE EXCEPTION 'Publication did not switch versions';END IF;
 IF contracts_before<>(SELECT count(*) FROM public.contract WHERE mall_id=12) OR annual_before<>(SELECT count(*) FROM public.contract_payment_request WHERE mall_id=12 AND fee_type='subscription') THEN RAISE EXCEPTION 'Update created another annual subscription';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_notification WHERE mall_id=12 AND admin_notif_title='Map application submitted') THEN RAISE EXCEPTION 'Submission notification missing';END IF;
END $$;
SELECT true AS reuse_two_disputes_retry_payment_and_revision_verified;
ROLLBACK TO SAVEPOINT before_intake;
-- Paid-tier free allowance is not a hard cap: Basic has zero free updates but
-- the first test above successfully accepted its paid application.
SELECT app_private.map_intake_eligibility(12)->>'allowed' AS mall_remains_eligible_after_rollback;
ROLLBACK;
