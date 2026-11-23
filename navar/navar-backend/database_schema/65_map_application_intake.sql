BEGIN;
CREATE TABLE public.map_application_floor_source (
 application_id bigint NOT NULL REFERENCES public.application(application_id) ON DELETE CASCADE,
 floor_id bigint NOT NULL REFERENCES public.floor(floor_id),
 source_plan_id bigint REFERENCES public.application_floor_plan(app_floor_plan_id),
 changed boolean NOT NULL, reused_image boolean NOT NULL,
 PRIMARY KEY(application_id,floor_id)
);
ALTER TABLE public.map_application_floor_source ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.map_application_floor_source FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.map_application_floor_source TO service_role;
CREATE TABLE app_private.map_intake_submission (
 token uuid PRIMARY KEY,mall_id bigint NOT NULL REFERENCES public.mall(mall_id),
 application_id bigint NOT NULL UNIQUE REFERENCES public.application(application_id),
 source_application_id bigint NOT NULL REFERENCES public.application(application_id),
 created_by bigint NOT NULL REFERENCES public.admin(admin_id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.map_intake_submission ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.map_intake_submission FROM PUBLIC,anon,authenticated;
GRANT SELECT ON app_private.map_intake_submission TO service_role;
CREATE TABLE app_private.map_manual_payment_receipt (
 request_id bigint PRIMARY KEY REFERENCES public.contract_payment_request(request_id),
 mall_id bigint NOT NULL REFERENCES public.mall(mall_id),actor_id bigint NOT NULL REFERENCES public.admin(admin_id),
 amount_cent bigint NOT NULL CHECK(amount_cent>0),recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.map_manual_payment_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.map_manual_payment_receipt FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.map_intake_eligibility(p_mall bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.contract; a public.application; d public.ar_development; reason text:=''; retry boolean;
BEGIN
 SELECT * INTO c FROM public.contract WHERE mall_id=p_mall AND contract_is_current;
 SELECT * INTO a FROM public.application WHERE mall_id=p_mall ORDER BY application_version DESC,application_attempt DESC LIMIT 1;
 SELECT x.* INTO d FROM public.ar_development x JOIN public.application ap USING(application_id) WHERE ap.mall_id=p_mall ORDER BY ap.application_version DESC,ap.application_attempt DESC,x.ar_development_id DESC LIMIT 1;
 retry:=a.application_status IN ('rejected','rejected_final') AND a.application_accepted_at IS NULL;
 IF c.contract_id IS NULL OR c.contract_status<>'active' OR c.contract_start IS NULL OR c.contract_end IS NULL OR c.contract_start>now() OR c.contract_end<=now() OR EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN reason:='An active subscription is required.';
 ELSIF d.ar_development_id IS NULL OR d.ar_development_status<>'live' THEN reason:='The latest AR development must be Live.';
 ELSIF EXISTS(SELECT 1 FROM public.application ap WHERE ap.mall_id=p_mall AND (ap.application_status IN ('pending','disputed','submitted','for_revision','draft') OR (ap.application_status='approved' AND NOT EXISTS(SELECT 1 FROM public.ar_development x WHERE x.application_id=ap.application_id AND x.ar_development_status IN ('live','unpublished'))))) THEN reason:='Another application or AR development is already in progress.';
 ELSIF EXISTS(SELECT 1 FROM public.stall_expansion WHERE mall_id=p_mall AND status NOT IN ('completed','cancelled')) THEN reason:='Complete the ongoing stall application first.';
 END IF;
 RETURN jsonb_build_object('allowed',reason='','reason',reason,'sourceApplicationId',d.application_id,'sourceDevelopmentId',d.ar_development_id,'sourceMapRevision',d.ar_development_map_revision,'nextVersion',CASE WHEN retry THEN a.application_version ELSE a.application_version+1 END,'attempt',CASE WHEN retry THEN a.application_attempt+1 ELSE 1 END);
END $$;

-- Every new structural attempt checks the current Live AR and active subscription,
-- including retry attempts. There is no timer and no hard free-allowance cap.
CREATE OR REPLACE FUNCTION public.enforce_application_version_rule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.application; eligibility jsonb;
BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=NEW.mall_id FOR UPDATE;
 SELECT * INTO previous FROM public.application WHERE mall_id=NEW.mall_id ORDER BY application_version DESC,application_attempt DESC LIMIT 1;
 IF previous.application_id IS NULL THEN
  IF NEW.application_version<>1 OR NEW.application_attempt<>1 THEN RAISE EXCEPTION 'First application must be version 1 attempt 1'; END IF;
  RETURN NEW;
 END IF;
 eligibility:=app_private.map_intake_eligibility(NEW.mall_id);
 IF NOT (eligibility->>'allowed')::boolean THEN RAISE EXCEPTION '%',eligibility->>'reason';END IF;
 IF NEW.application_version IS DISTINCT FROM (eligibility->>'nextVersion')::integer OR NEW.application_attempt IS DISTINCT FROM (eligibility->>'attempt')::integer THEN RAISE EXCEPTION 'The application version changed. Refresh before submitting.';END IF;
 RETURN NEW;
END $$;

-- Preserve the deployed workflow body while removing the obsolete maximum quota.
DO $$DECLARE definition text; first_pos integer; last_pos integer; needle text;
BEGIN
 SELECT pg_get_functiondef('app_private.workflow_action_before_v3(bigint,bigint,text,text,text)'::regprocedure) INTO definition;
 first_pos:=strpos(definition,'  IF c.pricing_model<>''v3'' AND c.contract_map_updates_per_year IS NOT NULL AND (');
 needle:='THEN RAISE EXCEPTION ''No map updates left''; END IF;';
 last_pos:=strpos(definition,needle);
 IF first_pos=0 OR last_pos<first_pos THEN RAISE EXCEPTION 'Expected legacy quota block not found';END IF;
 definition:=overlay(definition placing '' from first_pos for last_pos+length(needle)-first_pos);
 EXECUTE definition;
END $$;

CREATE FUNCTION app_private.save_map_intake_floors(p_application bigint,p_source bigint,p_floors jsonb,p_revision boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.application; f jsonb; original public.application_floor_plan; entry jsonb; bytes bytea; mime text; changed_ids jsonb; reuse boolean; old_origin public.map_application_floor_source;
BEGIN
 SELECT * INTO STRICT a FROM public.application WHERE application_id=p_application;
 IF jsonb_typeof(p_floors) IS DISTINCT FROM 'array' OR jsonb_array_length(p_floors)<>(SELECT count(*) FROM public.floor WHERE mall_id=a.mall_id) OR jsonb_array_length(p_floors) NOT BETWEEN 1 AND 100 OR
 (SELECT count(DISTINCT value->>'floorId') FROM jsonb_array_elements(p_floors))<>jsonb_array_length(p_floors) THEN RAISE EXCEPTION 'Include every existing floor exactly once.';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_floors) x WHERE NOT EXISTS(SELECT 1 FROM public.floor WHERE mall_id=a.mall_id AND floor_id=(x->>'floorId')::bigint)) THEN RAISE EXCEPTION 'A floor does not belong to this mall.';END IF;
 SELECT jsonb_agg((value->>'floorId')::bigint ORDER BY (value->>'floorId')::bigint) INTO changed_ids FROM jsonb_array_elements(p_floors) WHERE value->>'changed'='true';
 IF changed_ids IS NULL THEN RAISE EXCEPTION 'Identify at least one changed floor and describe the structural update.';END IF;
 IF p_revision AND changed_ids IS DISTINCT FROM (SELECT jsonb_agg((value)::bigint ORDER BY (value)::bigint) FROM public.mall_service_request s,jsonb_array_elements_text(s.inputs->'floorIds') WHERE s.application_id=p_application AND s.kind='map_update' AND s.status<>'cancelled') THEN RAISE EXCEPTION 'Revision must keep the quoted changed floors. Contact Super Admin to reconcile additional floor charges.';END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_floors) LOOP
  SELECT * INTO original FROM public.application_floor_plan WHERE application_id=p_source AND floor_id=(f->>'floorId')::bigint ORDER BY app_floor_plan_id DESC LIMIT 1;
  IF original.app_floor_plan_id IS NULL THEN RAISE EXCEPTION 'The source floor plan is missing. Restore it before submitting.';END IF;
  IF coalesce(length(btrim(f->>'referenceLine')),0) NOT BETWEEN 1 AND 2000 OR coalesce((f->>'meterLength')::numeric,0)<=0 OR coalesce(length(btrim(f->>'accessibilityRoute')),0) NOT BETWEEN 1 AND 5000 OR coalesce(length(btrim(f->>'emergencyRoute')),0) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Each floor needs a scale reference, positive meter length, accessibility route and emergency route.';END IF;
  IF jsonb_typeof(f->'entryPoints') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'entryPoints') NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->'entryPoints') ep WHERE coalesce(length(btrim(ep->>'label')),0) NOT BETWEEN 1 AND 500 OR length(coalesce(ep->>'description',''))>2000) THEN RAISE EXCEPTION 'Every floor needs at least one named entry point.';END IF;
  reuse:=f->'image' IS NULL OR f->'image'='null'::jsonb;
  IF f->>'changed' IS DISTINCT FROM 'true' AND NOT reuse THEN RAISE EXCEPTION 'Mark a floor as changed before replacing its plan.';END IF;
  IF f->>'changed' IS DISTINCT FROM 'true' AND (
   f->>'referenceLine' IS DISTINCT FROM original.app_floor_plan_reference_line OR (f->>'meterLength')::numeric IS DISTINCT FROM original.app_floor_plan_meter_length OR
   f->>'accessibilityRoute' IS DISTINCT FROM original.app_floor_plan_accessibility_route OR f->>'emergencyRoute' IS DISTINCT FROM original.app_floor_plan_emergency_route OR
   f->'entryPoints' IS DISTINCT FROM (SELECT coalesce(jsonb_agg(jsonb_build_object('label',app_entry_point_label,'description',coalesce(app_entry_point_description,'')) ORDER BY app_entry_point_id),'[]') FROM public.application_entry_point WHERE application_id=p_source AND floor_id=original.floor_id)
  ) THEN RAISE EXCEPTION 'Mark edited floor details as changed.';END IF;
  SELECT * INTO old_origin FROM public.map_application_floor_source WHERE application_id=p_application AND floor_id=original.floor_id;
  IF NOT reuse THEN
   bytes:=decode(f->'image'->>'content','base64');
   mime:=CASE WHEN substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex') THEN 'image/png' WHEN substring(bytes from 1 for 3)=decode('ffd8ff','hex') THEN 'image/jpeg' END;
   IF bytes IS NULL OR mime IS NULL OR length(bytes)>10485760 OR coalesce(length(f->'image'->>'fileName'),0) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Choose a valid PNG or JPEG plan up to 10 MB.';END IF;
  END IF;
  -- Upsert a separate version-owned record; never mutate the source plan.
  IF EXISTS(SELECT 1 FROM public.application_floor_plan WHERE application_id=p_application AND floor_id=original.floor_id) AND p_application<>p_source THEN RAISE EXCEPTION 'This floor already has an application plan.';END IF;
  IF p_revision THEN
   UPDATE public.application_floor_plan SET app_floor_plan_image=CASE WHEN reuse THEN original.app_floor_plan_image ELSE bytes END,
    app_floor_plan_storage_path=CASE WHEN reuse THEN original.app_floor_plan_storage_path END,
    app_floor_plan_reference_line=f->>'referenceLine',app_floor_plan_meter_length=(f->>'meterLength')::numeric,
    app_floor_plan_accessibility_route=f->>'accessibilityRoute',app_floor_plan_emergency_route=f->>'emergencyRoute',
    app_floor_plan_file_name=CASE WHEN reuse THEN original.app_floor_plan_file_name ELSE f->'image'->>'fileName' END,
    plan_filename=CASE WHEN reuse THEN original.plan_filename ELSE f->'image'->>'fileName' END,
    app_floor_plan_mime_type=CASE WHEN reuse THEN original.app_floor_plan_mime_type ELSE mime END,
    app_floor_plan_file_size=CASE WHEN reuse THEN original.app_floor_plan_file_size ELSE length(bytes) END,
    plan_calibration=CASE WHEN reuse AND f->>'referenceLine'=original.app_floor_plan_reference_line AND (f->>'meterLength')::numeric=original.app_floor_plan_meter_length THEN original.plan_calibration END,
    accessible_routes=CASE WHEN reuse AND f->>'accessibilityRoute'=original.app_floor_plan_accessibility_route THEN original.accessible_routes END,
    emergency_routes=CASE WHEN reuse AND f->>'emergencyRoute'=original.app_floor_plan_emergency_route THEN original.emergency_routes END,app_floor_plan_updated_at=now()
   WHERE application_id=p_application AND floor_id=original.floor_id;
  ELSE
   INSERT INTO public.application_floor_plan(application_id,floor_id,app_floor_plan_image,app_floor_plan_reference_line,app_floor_plan_meter_length,app_floor_plan_accessibility_route,app_floor_plan_emergency_route,app_floor_plan_created_at,app_floor_plan_updated_at,app_floor_plan_storage_path,app_floor_plan_file_name,app_floor_plan_mime_type,app_floor_plan_file_size,plan_filename,plan_calibration,accessible_routes,emergency_routes)
   VALUES(p_application,original.floor_id,CASE WHEN reuse THEN original.app_floor_plan_image ELSE bytes END,f->>'referenceLine',(f->>'meterLength')::numeric,f->>'accessibilityRoute',f->>'emergencyRoute',now(),now(),CASE WHEN reuse THEN original.app_floor_plan_storage_path END,CASE WHEN reuse THEN original.app_floor_plan_file_name ELSE f->'image'->>'fileName' END,CASE WHEN reuse THEN original.app_floor_plan_mime_type ELSE mime END,CASE WHEN reuse THEN original.app_floor_plan_file_size ELSE length(bytes) END,CASE WHEN reuse THEN original.plan_filename ELSE f->'image'->>'fileName' END,
    CASE WHEN reuse AND f->>'referenceLine'=original.app_floor_plan_reference_line AND (f->>'meterLength')::numeric=original.app_floor_plan_meter_length THEN original.plan_calibration END,
    CASE WHEN reuse AND f->>'accessibilityRoute'=original.app_floor_plan_accessibility_route THEN original.accessible_routes END,CASE WHEN reuse AND f->>'emergencyRoute'=original.app_floor_plan_emergency_route THEN original.emergency_routes END);
  END IF;
  INSERT INTO public.map_application_floor_source(application_id,floor_id,source_plan_id,changed,reused_image) VALUES(p_application,original.floor_id,CASE WHEN p_revision THEN old_origin.source_plan_id ELSE original.app_floor_plan_id END,(f->>'changed')::boolean,CASE WHEN p_revision AND reuse THEN coalesce(old_origin.reused_image,true) ELSE reuse END)
  ON CONFLICT(application_id,floor_id) DO UPDATE SET changed=EXCLUDED.changed,reused_image=EXCLUDED.reused_image;
  DELETE FROM public.application_entry_point WHERE application_id=p_application AND floor_id=original.floor_id;
  FOR entry IN SELECT value FROM jsonb_array_elements(f->'entryPoints') LOOP
   INSERT INTO public.application_entry_point(application_id,floor_id,app_entry_point_label,app_entry_point_description,app_entry_point_created_at,app_entry_point_updated_at) VALUES(p_application,original.floor_id,btrim(entry->>'label'),nullif(btrim(entry->>'description'),''),now(),now());
  END LOOP;
 END LOOP;
 RETURN changed_ids;
END $$;

-- Preserve existing owner-review/stall behavior beneath the new structural intake.
ALTER FUNCTION public.workflow_action(bigint,bigint,text,text,text) RENAME TO workflow_before_map_intake;
ALTER FUNCTION public.workflow_before_map_intake(bigint,bigint,text,text,text) SET SCHEMA app_private;
CREATE FUNCTION public.workflow_action(p_id bigint,p_actor bigint,p_action text,p_text text DEFAULT '',p_target text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.mall_service_request; a public.application; c public.contract; t public.subscription_tier; who public.admin; r jsonb; used integer; units integer; fee bigint; request_id_value bigint;
BEGIN
 SELECT * INTO s FROM public.mall_service_request WHERE application_id=p_id AND kind='map_update' AND inputs->>'workflow'='version_intake' ORDER BY service_id DESC LIMIT 1;
 IF s.service_id IS NULL THEN RETURN app_private.workflow_before_map_intake(p_id,p_actor,p_action,p_text,p_target);END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=s.mall_id FOR UPDATE;
 SELECT * INTO s FROM public.mall_service_request WHERE service_id=s.service_id FOR UPDATE;
 SELECT * INTO a FROM public.application WHERE application_id=p_id;
 SELECT * INTO who FROM public.admin WHERE admin_id=p_actor AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF who.admin_id IS NULL OR who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM s.mall_id) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contract WHERE mall_id=s.mall_id AND contract_is_current;
 IF p_action IN ('accept','approve','ar_status','publish','dispute') AND (c.contract_id IS NULL OR c.contract_status<>'active' OR c.contract_start IS NULL OR c.contract_start>now() OR c.contract_end IS NULL OR c.contract_end<=now() OR EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL)) THEN RAISE EXCEPTION 'An active subscription is required.';END IF;
 IF p_action='accept' THEN
  IF s.status<>'requested' THEN RAISE EXCEPTION 'The application has already been accepted or cancelled.';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application ap USING(application_id) WHERE ap.mall_id=s.mall_id AND d.ar_development_status='live' AND ap.application_version<a.application_version) THEN RAISE EXCEPTION 'The current AR must remain Live during application review.';END IF;
  IF (SELECT count(*) FROM public.application_floor_plan WHERE application_id=p_id)<>(SELECT count(*) FROM public.floor WHERE mall_id=s.mall_id) THEN RAISE EXCEPTION 'A plan is required for every existing floor.';END IF;
  r:=app_private.workflow_action_before_v3(p_id,p_actor,p_action,p_text,p_target);
  SELECT * INTO STRICT t FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;
  SELECT coalesce(sum(allowance_units),0) INTO used FROM public.mall_service_request WHERE mall_id=s.mall_id AND kind='map_update' AND status<>'cancelled' AND allowance_start=coalesce(c.allowance_start,c.contract_start) AND service_id<>s.service_id;
  units:=CASE WHEN t.s_tier_key='premium' AND jsonb_array_length(s.inputs->'floorIds')=1 AND used<t.s_tier_map_updates_per_year THEN 1 ELSE 0 END;
  fee:=CASE WHEN units=1 THEN 0 ELSE round(t.s_tier_map_update_fee_per_floor*100)::bigint*jsonb_array_length(s.inputs->'floorIds') END;
  IF fee<0 OR fee IS NULL THEN RAISE EXCEPTION 'Configure a valid map-update price.';END IF;
  IF fee>0 THEN INSERT INTO public.contract_payment_request(contract_id,mall_id,fee_type,amount_cent,pricing_model,details) VALUES(c.contract_id,s.mall_id,'map_update',fee,'v3',jsonb_build_object('service_id',s.service_id,'application_id',p_id,'actor_id',s.created_by)) RETURNING request_id INTO request_id_value;END IF;
  UPDATE public.mall_service_request SET quote=jsonb_build_object('amount_cent',fee,'allowance_units',units,'floorIds',s.inputs->'floorIds','unit_fee',t.s_tier_map_update_fee_per_floor,'contract_id',c.contract_id,'tier',t.s_tier_key),contract_id=c.contract_id,approved_by=p_actor,allowance_start=coalesce(c.allowance_start,c.contract_start),allowance_end=coalesce(c.allowance_end,c.contract_end),allowance_units=units,payment_request_id=request_id_value,priority=CASE t.s_tier_key WHEN 'premium' THEN 2 WHEN 'standard' THEN 1 ELSE 0 END,status=CASE WHEN fee=0 THEN 'queued' ELSE 'awaiting_payment' END,queued_at=CASE WHEN fee=0 THEN now() END WHERE service_id=s.service_id;
  RETURN r||jsonb_build_object('message',CASE WHEN fee=0 THEN 'Request accepted. The update is included in the subscription and can proceed to application review.' ELSE 'Request accepted. The mall must complete the quoted map-update payment before application approval.' END);
 ELSIF p_action='reject' THEN
  r:=app_private.workflow_action_before_v3(p_id,p_actor,p_action,p_text,p_target);
  IF EXISTS(SELECT 1 FROM public.application WHERE application_id=p_id AND application_status='rejected_final') THEN UPDATE public.mall_service_request SET status='cancelled' WHERE service_id=s.service_id AND status='requested';END IF;
  RETURN r||jsonb_build_object('message','The decision and explanation were sent to the mall.');
 END IF;
 IF p_action='approve' AND s.status NOT IN ('queued','in_progress') THEN RAISE EXCEPTION 'Complete the map-update payment before approving this application.';END IF;
 IF p_action='ar_status' AND p_target='node_mapping' AND EXISTS(SELECT 1 FROM public.ar_development WHERE application_id=p_id AND ar_development_status='pending') THEN
  IF who.admin_role<>'super_admin' THEN RAISE EXCEPTION 'Super Admin access required.' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application ap USING(application_id) WHERE ap.application_version=1 AND ap.application_status='approved' AND d.ar_development_status='pending') THEN RAISE EXCEPTION 'First builds have priority. Start the pending version 1 builds first.';END IF;
  IF s.status NOT IN ('queued','in_progress') THEN RAISE EXCEPTION 'Complete the map-update payment before starting mapping.';END IF;
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
  UPDATE public.mall_service_request SET status='in_progress' WHERE service_id=s.service_id;
 END IF;
 r:=app_private.workflow_before_map_intake(p_id,p_actor,p_action,p_text,p_target);
 IF p_action='publish' THEN UPDATE public.mall_service_request SET status='completed',completed_at=now() WHERE service_id=s.service_id AND status IN ('queued','in_progress');END IF;
 RETURN r;
END $$;

-- The legacy structural path must also permit the full two disputes.
DO $$DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('app_private.workflow_before_map_intake(bigint,bigint,text,text,text)'::regprocedure) INTO definition;
 IF strpos(definition,'application_dispute_count>=1')>0 THEN EXECUTE replace(definition,'application_dispute_count>=1','application_dispute_count>=2');END IF;
END $$;

CREATE FUNCTION public.map_application_portal(p_actor bigint,p_mall bigint,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who public.admin; acting public.admin; a public.application; live_app public.application; d public.ar_development; s public.mall_service_request; c public.contract; t public.subscription_tier; pay public.contract_payment_request;
 eligibility jsonb; result jsonb; changed jsonb; old_uid text:=current_setting('request.jwt.claim.sub',true); app_id bigint; source_id bigint; submission_token uuid; tid bigint; txt text; revision_source bigint;
BEGIN
 SELECT * INTO who FROM public.admin WHERE admin_id=p_actor AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF who.admin_id IS NULL OR who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM p_mall) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 IF who.admin_role='mall_admin' THEN acting:=who;ELSE SELECT * INTO acting FROM public.admin WHERE mall_id=p_mall AND admin_role='mall_admin' AND admin_account_status='official' AND NOT admin_is_deactivated ORDER BY admin_is_primary DESC,admin_id LIMIT 1;END IF;
 IF acting.admin_id IS NULL THEN RAISE EXCEPTION 'An active Mall Admin is required.';END IF;
 PERFORM set_config('request.jwt.claim.sub',acting.admin_auth_user_id::text,true);
 IF p_action<>'context' THEN PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;END IF;
 eligibility:=app_private.map_intake_eligibility(p_mall);
 SELECT * INTO a FROM public.application WHERE mall_id=p_mall ORDER BY application_version DESC,application_attempt DESC LIMIT 1;
 SELECT ap.* INTO live_app FROM public.application ap JOIN public.ar_development x USING(application_id) WHERE ap.mall_id=p_mall AND x.ar_development_status='live' ORDER BY ap.application_version DESC,ap.application_attempt DESC LIMIT 1;
 SELECT * INTO d FROM public.ar_development WHERE application_id=a.application_id ORDER BY ar_development_id DESC LIMIT 1;
 SELECT * INTO s FROM public.mall_service_request WHERE application_id=a.application_id AND kind='map_update' ORDER BY service_id DESC LIMIT 1;
 SELECT * INTO c FROM public.contract WHERE mall_id=p_mall AND contract_is_current;
 SELECT * INTO t FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;
 IF p_action='context' THEN
  source_id:=CASE WHEN a.application_version>1 AND a.application_status NOT IN ('rejected','rejected_final') AND d.ar_development_status IS DISTINCT FROM 'live' THEN a.application_id ELSE live_app.application_id END;
  SELECT jsonb_build_object('mallName',(SELECT mall_name FROM public.mall WHERE mall_id=p_mall),'actingAdmin',acting.admin_full_name,'eligibility',eligibility,'latest',to_jsonb(a),'development',to_jsonb(d),'liveApplicationId',live_app.application_id,'sourceApplicationId',source_id,'service',to_jsonb(s),'unitFee',t.s_tier_map_update_fee_per_floor,'tier',t.s_tier_key,'includedAvailable',greatest(0,coalesce(t.s_tier_map_updates_per_year,0)-(SELECT coalesce(sum(allowance_units),0) FROM public.mall_service_request WHERE mall_id=p_mall AND kind='map_update' AND status<>'cancelled' AND allowance_start=coalesce(c.allowance_start,c.contract_start))),
   'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',application_id,'version',application_version,'attempt',application_attempt,'status',application_status,'disputes',application_dispute_count,'reason',application_reason_notes) ORDER BY application_version DESC,application_attempt DESC),'[]') FROM public.application WHERE mall_id=p_mall AND application_version>1),
   'floors',(SELECT coalesce(jsonb_agg(jsonb_build_object('floorId',f.floor_id,'label',f.floor_label,'sourcePlanId',fp.app_floor_plan_id,'fileName',coalesce(fp.app_floor_plan_file_name,fp.plan_filename,'Floor plan'),'referenceLine',coalesce(fp.app_floor_plan_reference_line,''),'meterLength',fp.app_floor_plan_meter_length,'accessibilityRoute',coalesce(fp.app_floor_plan_accessibility_route,''),'emergencyRoute',coalesce(fp.app_floor_plan_emergency_route,''),'changed',coalesce(origin.changed,false),'reusedImage',coalesce(origin.reused_image,true),
    'entryPoints',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',app_entry_point_label,'description',coalesce(app_entry_point_description,'')) ORDER BY app_entry_point_id),'[]') FROM public.application_entry_point WHERE application_id=source_id AND floor_id=f.floor_id)) ORDER BY f.floor_num,f.floor_id),'[]') FROM public.floor f LEFT JOIN public.application_floor_plan fp ON fp.floor_id=f.floor_id AND fp.application_id=source_id LEFT JOIN public.map_application_floor_source origin ON origin.application_id=source_id AND origin.floor_id=f.floor_id WHERE f.mall_id=p_mall)) INTO result;
 ELSIF p_action='submit' THEN
  submission_token:=(p_data->>'token')::uuid;
  SELECT application_id INTO app_id FROM app_private.map_intake_submission WHERE map_intake_submission.token=submission_token AND mall_id=p_mall;
  IF app_id IS NOT NULL THEN result:=jsonb_build_object('id',app_id,'message','This application has already been submitted.');
  ELSE
   IF submission_token IS NULL OR NOT (eligibility->>'allowed')::boolean THEN RAISE EXCEPTION '%',coalesce(eligibility->>'reason','A submission token is required.');END IF;
   IF (p_data->>'sourceApplicationId')::bigint IS DISTINCT FROM live_app.application_id OR (p_data->>'sourceMapRevision')::integer IS DISTINCT FROM (eligibility->>'sourceMapRevision')::integer THEN RAISE EXCEPTION 'The Live map changed. Reload its details before submitting.' USING ERRCODE='40001';END IF;
   IF coalesce(length(btrim(p_data->>'reasonCategory')),0) NOT BETWEEN 1 AND 100 OR coalesce(length(btrim(p_data->>'reasonNotes')),0) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'A reason category and explanation are required.';END IF;
   INSERT INTO public.application(mall_id,application_version,application_attempt,application_status,application_reason_category,application_reason_notes,application_created_at,application_updated_at) VALUES(p_mall,(eligibility->>'nextVersion')::integer,(eligibility->>'attempt')::integer,'pending',btrim(p_data->>'reasonCategory'),btrim(p_data->>'reasonNotes'),now(),now()) RETURNING application_id INTO app_id;
   changed:=app_private.save_map_intake_floors(app_id,live_app.application_id,p_data->'floors');
   IF a.application_status IN ('rejected','rejected_final') THEN UPDATE public.mall_service_request SET status='cancelled' WHERE application_id=a.application_id AND kind='map_update' AND status='requested';END IF;
   INSERT INTO public.mall_service_request(mall_id,kind,status,inputs,contract_id,created_by,application_id) VALUES(p_mall,'map_update','requested',jsonb_build_object('floorIds',changed,'structuralReview',true,'workflow','version_intake'),c.contract_id,acting.admin_id,app_id);
   INSERT INTO app_private.map_intake_submission(token,mall_id,application_id,source_application_id,created_by) VALUES(submission_token,p_mall,app_id,live_app.application_id,acting.admin_id);
   PERFORM public.ensure_application_thread(app_id);
   PERFORM public.workflow_event(app_id,acting.admin_id,'application_submitted','A new structural map application was submitted for Accept or Reject review.');
   result:=jsonb_build_object('id',app_id,'message','Application submitted. Super Admin will accept the request or send a rejection explanation. Any map-update charge is issued after acceptance.');
  END IF;
 ELSE
  IF (p_data->>'id')::bigint IS DISTINCT FROM a.application_id OR a.application_version<2 THEN RAISE EXCEPTION 'Only the latest version request can be changed.';END IF;
  IF p_data->>'updatedAt' IS NOT NULL AND (p_data->>'updatedAt')::timestamptz IS DISTINCT FROM a.application_updated_at THEN RAISE EXCEPTION 'The application changed. Refresh before continuing.' USING ERRCODE='40001';END IF;
  IF p_action='pay' THEN
   IF who.admin_role<>'super_admin' OR p_data->>'acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Super Admin payment confirmation is required.' USING ERRCODE='42501';END IF;
   IF c.contract_status<>'active' OR c.contract_id IS DISTINCT FROM s.contract_id OR c.contract_start>now() OR c.contract_end<=now() OR EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN RAISE EXCEPTION 'The subscription changed or is no longer active.';END IF;
   SELECT * INTO pay FROM public.contract_payment_request WHERE request_id=s.payment_request_id FOR UPDATE;
   IF pay.status='paid' AND pay.fulfilled_at IS NOT NULL THEN result:=jsonb_build_object('message','Payment is already recorded.');
   ELSE
    IF s.status<>'awaiting_payment' OR pay.status IS DISTINCT FROM 'pending' OR pay.amount_cent IS DISTINCT FROM (s.quote->>'amount_cent')::bigint OR s.allowance_end<=now() THEN RAISE EXCEPTION 'This application has no payable accepted quote.';END IF;
    IF pay.paymongo_payment_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.mall_payment_checkout WHERE request_id=pay.request_id) THEN RAISE EXCEPTION 'Reconcile the existing provider checkout first.';END IF;
    INSERT INTO app_private.map_manual_payment_receipt(request_id,mall_id,actor_id,amount_cent) VALUES(pay.request_id,p_mall,p_actor,pay.amount_cent);
    UPDATE public.contract_payment_request SET status='paid',paid_at=now(),confirmed_at=now(),confirmation_message='Manual payment recorded by Super Admin.',payment_reference='manual_map:'||gen_random_uuid() WHERE request_id=pay.request_id;
    PERFORM public.fulfill_v3_payment(pay.request_id);
    IF NOT EXISTS(SELECT 1 FROM public.contract_payment_request WHERE request_id=pay.request_id AND fulfilled_at IS NOT NULL AND reconciliation_reason IS NULL) THEN RAISE EXCEPTION 'Payment fulfillment failed. No payment changes were saved.';END IF;
    result:=jsonb_build_object('message','Map-update payment recorded. Super Admin can now finish reviewing the application.');
   END IF;
  ELSIF p_action='dispute' THEN
   IF coalesce(length(btrim(p_data->>'notes')),0) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'A dispute explanation is required.';END IF;
   result:=public.workflow_action(a.application_id,acting.admin_id,'dispute',btrim(p_data->>'notes'));
  ELSIF p_action='revise' THEN
   IF a.application_status<>'for_revision' OR d.ar_development_ready_at IS NOT NULL THEN RAISE EXCEPTION 'Only an application awaiting revision can be edited before Ready.';END IF;
   IF coalesce(length(btrim(p_data->>'notes')),0) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Explain the corrections in the application thread.';END IF;
   changed:=app_private.save_map_intake_floors(a.application_id,a.application_id,p_data->'floors',true);
   UPDATE public.application SET application_updated_at=now() WHERE application_id=a.application_id;
   tid:=public.ensure_application_thread(a.application_id);
   INSERT INTO public.thread_message(thread_id,message_sender,message_sender_type,message_content,message_sent_at) VALUES(tid,acting.admin_id,'mall_admin',btrim(p_data->>'notes'),now());
   result:=jsonb_build_object('message','Corrections saved in the same application. Super Admin can review and approve them directly.');
  ELSIF p_action='message' THEN
   IF d.ar_development_status IN ('live','unpublished') THEN RAISE EXCEPTION 'This application is read-only.';END IF;
   txt:=btrim(p_data->>'notes');IF coalesce(length(txt),0) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Enter a message.';END IF;
   tid:=public.ensure_application_thread(a.application_id);INSERT INTO public.thread_message(thread_id,message_sender,message_sender_type,message_content,message_sent_at) VALUES(tid,acting.admin_id,'mall_admin',txt,now());result:=jsonb_build_object('message','Message sent.');
  ELSIF p_action='confirm' THEN
   IF p_data->>'acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Review the Ready AR and confirm approval.';END IF;
   IF d.ar_development_status='live' AND d.ar_development_mall_approved_at IS NOT NULL THEN
    result:=jsonb_build_object('message','The AR is already Live.','published',true);
   ELSE
    IF d.ar_development_status IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'The AR must be Ready before confirmation.';END IF;
    IF d.ar_development_mall_approved_at IS NULL THEN PERFORM public.workflow_action(a.application_id,acting.admin_id,'mall_approve','acknowledged');END IF;
    IF c.contract_id IS NOT NULL AND c.contract_status='active' AND c.contract_start<=now() AND c.contract_end>now() AND NOT EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN
     PERFORM public.workflow_action(a.application_id,acting.admin_id,'publish');
     result:=jsonb_build_object('message','AR confirmed and published using the existing subscription. No annual subscription payment was charged.','published',true);
    ELSE result:=jsonb_build_object('message','AR confirmation recorded. Publication is waiting for an active subscription. The existing update payment is retained.','waiting',true);
    END IF;
   END IF;
  ELSE RAISE EXCEPTION 'Unknown map application action.';END IF;
 END IF;
 IF p_action<>'context' THEN INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id) VALUES('application_management','map_portal_'||p_action,'Map application '||p_action||'. Mall Admin #'||acting.admin_id||'. Initiated by admin #'||p_actor||'.',now(),p_actor,p_mall);END IF;
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_uid,''),true);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION app_private.map_intake_eligibility(bigint),app_private.save_map_intake_floors(bigint,bigint,jsonb,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.workflow_action(bigint,bigint,text,text,text),public.map_application_portal(bigint,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_action(bigint,bigint,text,text,text),public.map_application_portal(bigint,bigint,text,jsonb) TO service_role;
COMMIT;
