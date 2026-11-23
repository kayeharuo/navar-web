BEGIN;

ALTER TABLE public.stall_expansion ADD COLUMN submitted_at timestamptz;
ALTER TABLE public.stall_expansion_item ADD COLUMN contact_person text, ADD COLUMN contact_num text, ADD COLUMN email text;

CREATE OR REPLACE FUNCTION public.prepare_my_stall_expansion(p_floors jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE a public.admin%ROWTYPE;c public.contract%ROWTYPE;d public.ar_development%ROWTYPE;v jsonb;tier text;qty integer:=0;used integer;free integer;fee bigint;sid bigint;app bigint;eid bigint;rid bigint;q jsonb;starts timestamptz;ends timestamptz;unit_fee numeric;free_limit integer;

BEGIN

 a:=app_private.stall_expansion_admin();PERFORM 1 FROM public.mall WHERE mall_id=a.mall_id FOR UPDATE;

 IF EXISTS(SELECT 1 FROM public.stall_expansion WHERE mall_id=a.mall_id AND status NOT IN ('cancelled','completed')) THEN RAISE EXCEPTION 'Finish or cancel the existing stall application first.';END IF;

 SELECT * INTO c FROM public.contract WHERE mall_id=a.mall_id AND contract_is_current AND lower(contract_status)='active' AND contract_start<=now() AND contract_end>now();

 SELECT lower(COALESCE(c.tier_snapshot->>'s_tier_key',s_tier_key)),COALESCE((c.tier_snapshot->>'s_tier_additional_stall_fee')::numeric,s_tier_additional_stall_fee),COALESCE((c.tier_snapshot->>'free_stalls_per_year')::integer,free_stalls_per_year,s_tier_free_extra_stalls_per_year,0) INTO tier,unit_fee,free_limit FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;

 SELECT x.* INTO d FROM public.ar_development x JOIN public.application ap USING(application_id) WHERE ap.mall_id=a.mall_id AND x.ar_development_status='live' ORDER BY x.ar_development_id DESC LIMIT 1;

 IF EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN RAISE EXCEPTION 'An active subscription without suspension is required.';END IF;
 IF c.contract_id IS NULL OR d.ar_development_id IS NULL OR tier IS NULL OR tier NOT IN ('basic','standard','premium') THEN RAISE EXCEPTION 'A live AR and an active Basic, Standard or Premium subscription are required.';END IF;

 IF EXISTS(SELECT 1 FROM public.application ap JOIN public.application current_ap ON current_ap.application_id=d.application_id WHERE ap.mall_id=a.mall_id AND ap.application_version>current_ap.application_version) THEN RAISE EXCEPTION 'Finish the existing map-update application before requesting more stalls.';END IF;

 IF p_floors IS NULL OR jsonb_typeof(p_floors)<>'array' OR jsonb_array_length(p_floors) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose the affected floors and stall counts.';END IF;

 FOR v IN SELECT value FROM jsonb_array_elements(p_floors) LOOP

  IF (v->>'quantity') IS NULL OR (v->>'quantity')!~'^[1-9][0-9]{0,3}$' OR (v->>'quantity')::integer>1000 OR NOT EXISTS(SELECT 1 FROM public.floor WHERE floor_id=(v->>'floor_id')::bigint AND mall_id=a.mall_id) THEN RAISE EXCEPTION 'Each affected floor must belong to your mall and have 1 to 1,000 stalls.';END IF;

  qty:=qty+(v->>'quantity')::integer;

 END LOOP;

 IF qty>1000 OR (SELECT count(DISTINCT value->>'floor_id') FROM jsonb_array_elements(p_floors))<>jsonb_array_length(p_floors) THEN RAISE EXCEPTION 'Choose each floor once, with no more than 1,000 stalls in total.';END IF;

 starts:=COALESCE(c.allowance_start,c.contract_start);ends:=COALESCE(c.allowance_end,c.contract_end);

 SELECT COALESCE(sum(allowance_units),0) INTO used FROM public.mall_service_request WHERE mall_id=a.mall_id AND kind='stall_addon' AND allowance_start=starts AND status<>'cancelled';

 IF unit_fee IS NULL OR unit_fee<0 THEN RAISE EXCEPTION 'Configure stall pricing before requesting stalls.';END IF;
 free:=LEAST(qty,GREATEST(0,free_limit-used));

 fee:=(qty-free)*round(unit_fee*100)::bigint;

 q:=jsonb_build_object('quantity',qty,'allowance_units',free,'paid_units',qty-free,'amount_cent',fee,'unit_fee',unit_fee,'tier',tier,'contract_id',c.contract_id);

 INSERT INTO public.stall_application(s_application_status,s_application_created_at,s_application_updated_at,mall_id) VALUES('draft',now(),now(),a.mall_id) RETURNING s_application_id INTO app;

 INSERT INTO public.mall_service_request(mall_id,kind,status,inputs,quote,contract_id,created_by,stall_application_id,application_id,allowance_start,allowance_end,allowance_units,priority,queued_at)

 VALUES(a.mall_id,'stall_addon',CASE WHEN fee=0 THEN 'queued' ELSE 'awaiting_payment' END,jsonb_build_object('quantity',qty,'workflow','paid_stall_application'),q,c.contract_id,a.admin_id,app,d.application_id,starts,ends,free,CASE tier WHEN 'premium' THEN 2 WHEN 'standard' THEN 1 ELSE 0 END,NULL) RETURNING service_id INTO sid;

 INSERT INTO public.stall_expansion(mall_id,service_id,stall_application_id,development_id,status,pricing_version) VALUES(a.mall_id,sid,app,d.ar_development_id,CASE WHEN fee=0 THEN 'draft' ELSE 'awaiting_payment' END,'v4.1-draft-2026-11-21') RETURNING id INTO eid;

 INSERT INTO public.stall_expansion_floor(expansion_id,floor_id,quantity) SELECT eid,(value->>'floor_id')::bigint,(value->>'quantity')::integer FROM jsonb_array_elements(p_floors);

 IF fee>0 THEN
  INSERT INTO public.contract_payment_request(contract_id,mall_id,fee_type,amount_cent,pricing_model,details)
  VALUES(c.contract_id,a.mall_id,'stall_addon',fee,'v3',jsonb_build_object('service_id',sid,'actor_id',a.admin_id,'payment_source','manual_admin','rate_version','v4.1-draft-2026-11-21')) RETURNING request_id INTO rid;
  UPDATE public.mall_service_request SET payment_request_id=rid WHERE service_id=sid;
 ELSE UPDATE public.mall_service_request SET queued_at=now() WHERE service_id=sid;END IF;
 INSERT INTO public.thread(thread_source,thread_created_at,s_application_id) VALUES('stall_application',now(),app);
 RETURN jsonb_build_object('id',eid,'quote',q,'requestId',rid);

END $function$;


CREATE OR REPLACE FUNCTION public.save_my_stall_expansion_floor(p_id bigint, p_revision integer, p_floor bigint, p_items jsonb, p_file jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE e public.stall_expansion%ROWTYPE;f public.stall_expansion_floor%ROWTYPE;v jsonb;n integer:=0;bytes bytea;mime text;

BEGIN

 e:=app_private.lock_my_stall_expansion(p_id,p_revision);

 IF e.status NOT IN ('draft','revision') THEN RAISE EXCEPTION 'Verified payment or a free allowance is required. Submitted applications are read-only.';END IF;

 SELECT * INTO f FROM public.stall_expansion_floor WHERE expansion_id=e.id AND floor_id=p_floor;

 IF f.floor_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<>f.quantity THEN RAISE EXCEPTION 'Provide exactly the purchased number of stalls for this floor.';END IF;

 IF (SELECT count(DISTINCT lower(trim(value->>'name'))) FROM jsonb_array_elements(p_items))<>f.quantity
 OR EXISTS(SELECT 1 FROM public.stall_expansion_item old WHERE old.expansion_id=e.id AND old.floor_id<>p_floor AND lower(trim(old.name)) IN(SELECT lower(trim(value->>'name')) FROM jsonb_array_elements(p_items))) THEN RAISE EXCEPTION 'Use a different name for each stall in this mall.';END IF;
 DELETE FROM public.stall_expansion_item WHERE expansion_id=e.id AND floor_id=p_floor;

 FOR v IN SELECT value FROM jsonb_array_elements(p_items) LOOP

  IF length(trim(COALESCE(v->>'name',''))) NOT BETWEEN 1 AND 100 OR length(trim(COALESCE(v->>'location',''))) NOT BETWEEN 1 AND 2000 OR NOT EXISTS(SELECT 1 FROM public.brand WHERE brand_id=(v->>'brand_id')::bigint) THEN RAISE EXCEPTION 'Each stall needs a name, brand and location description.';END IF;

  IF EXISTS(SELECT 1 FROM public.store WHERE mall_id=e.mall_id AND lower(trim(store_name))=lower(trim(v->>'name'))) THEN RAISE EXCEPTION 'A store or stall with this name already exists.';END IF;

  n:=n+1;INSERT INTO public.stall_expansion_item(expansion_id,floor_id,position,name,brand_id,location) VALUES(e.id,p_floor,n,trim(v->>'name'),(v->>'brand_id')::bigint,trim(v->>'location'));

 END LOOP;

 IF p_file IS NOT NULL AND NOT (p_file ? 'content') THEN

  IF f.plan IS NULL THEN RAISE EXCEPTION 'Upload a floor plan first.';END IF;

  p_file:=p_file||jsonb_build_object('content',encode(f.plan,'base64'),'name',f.filename,'mime',f.mime);

 END IF;

 IF p_file IS NOT NULL THEN

  bytes:=decode(p_file->>'content','base64');mime:=p_file->>'mime';

  IF bytes IS NULL OR octet_length(bytes) NOT BETWEEN 1 AND 2097152 OR length(trim(COALESCE(p_file->>'name',''))) NOT BETWEEN 1 AND 255 OR

   NOT COALESCE(((mime='image/png' AND substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) OR (mime='image/jpeg' AND substring(bytes from 1 for 3)=decode('ffd8ff','hex')) OR (mime='application/pdf' AND substring(bytes from 1 for 5)=decode('255044462d','hex'))),false) THEN RAISE EXCEPTION 'Upload one PNG, JPEG or PDF of at most 2 MB.';END IF;

  IF NULLIF(p_file->>'meter_length','') IS NOT NULL AND (p_file->>'meter_length')!~'^[1-9][0-9]{0,4}$' THEN RAISE EXCEPTION 'Scale distance must be a positive whole number.';END IF;

  UPDATE public.stall_expansion_floor SET plan=bytes,filename=p_file->>'name',mime=p_file->>'mime',reference_line=trim(p_file->>'reference_line'),meter_length=NULLIF(p_file->>'meter_length','')::integer WHERE expansion_id=e.id AND floor_id=p_floor;

 END IF;

 UPDATE public.stall_expansion SET revision=revision+1,updated_at=now() WHERE id=e.id;

 RETURN jsonb_build_object('revision',e.revision+1);

END $function$;


CREATE OR REPLACE FUNCTION public.submit_my_stall_expansion(p_id bigint, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE e public.stall_expansion%ROWTYPE;

BEGIN

 e:=app_private.lock_my_stall_expansion(p_id,p_revision);

 IF NOT EXISTS(SELECT 1 FROM public.contract WHERE mall_id=e.mall_id AND contract_is_current AND lower(contract_status)='active' AND contract_start<=now() AND contract_end>now() AND NOT EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=public.contract.contract_id AND suspension_lifted_at IS NULL)) THEN RAISE EXCEPTION 'An active subscription is required for submission.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mall_service_request s LEFT JOIN public.contract_payment_request r ON r.request_id=s.payment_request_id WHERE s.service_id=e.service_id AND s.status='queued' AND (s.payment_request_id IS NULL OR (r.status='paid' AND r.fulfilled_at IS NOT NULL AND r.reconciliation_reason IS NULL))) THEN RAISE EXCEPTION 'Payment must be completed before submission.';END IF;
 IF e.status NOT IN ('draft','revision') THEN RAISE EXCEPTION 'Only a paid or free draft can be submitted.';END IF;

 IF EXISTS(SELECT 1 FROM public.stall_expansion_floor f WHERE expansion_id=e.id AND ((SELECT count(*) FROM public.stall_expansion_item i WHERE i.expansion_id=e.id AND i.floor_id=f.floor_id)<>f.quantity)) THEN RAISE EXCEPTION 'Save the exact number of purchased stalls and a location description for each stall before submitting.';END IF;

 UPDATE public.stall_expansion SET status='submitted',submitted_at=COALESCE(submitted_at,now()),revision=revision+1,updated_at=now() WHERE id=e.id;

 UPDATE public.stall_application SET s_application_status='pending',s_application_updated_at=now() WHERE s_application_id=e.stall_application_id;

 RETURN jsonb_build_object('submitted',true);

END $function$;


CREATE OR REPLACE FUNCTION app_private.activate_stall_expansion_v3(p_id bigint, p_actor bigint, p_action text, p_revision integer, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE e public.stall_expansion%ROWTYPE;s public.mall_service_request%ROWTYPE;d public.ar_development%ROWTYPE;i record;f record;storeid bigint;

BEGIN

 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Super Admin access required.' USING ERRCODE='42501';END IF;

 SELECT * INTO STRICT e FROM public.stall_expansion WHERE id=p_id;

 PERFORM 1 FROM public.mall WHERE mall_id=e.mall_id FOR UPDATE;

 SELECT * INTO e FROM public.stall_expansion WHERE id=p_id FOR UPDATE;

 IF e.status IN ('approved','completed') AND p_action='approve' THEN RETURN jsonb_build_object('approved',true);END IF;

 IF p_revision IS NULL OR e.revision<>p_revision THEN RAISE EXCEPTION 'Application changed. Refresh before reviewing.' USING ERRCODE='40001';END IF;

 IF e.status<>'submitted' THEN RAISE EXCEPTION 'Only submitted applications can be reviewed.';END IF;

 IF p_action='revision' THEN

  IF length(trim(COALESCE(p_note,''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Explain the required corrections.';END IF;

  UPDATE public.stall_expansion SET status='revision',review_note=trim(p_note),revision=revision+1,updated_at=now() WHERE id=e.id;

  UPDATE public.stall_application SET s_application_status='for_revision',s_application_updated_at=now() WHERE s_application_id=e.stall_application_id;

 ELSIF p_action='approve' THEN

  SELECT * INTO s FROM public.mall_service_request WHERE service_id=e.service_id FOR UPDATE;

  IF s.status<>'queued' OR (s.payment_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contract_payment_request WHERE request_id=s.payment_request_id AND status='paid' AND fulfilled_at IS NOT NULL AND reconciliation_reason IS NULL)) THEN RAISE EXCEPTION 'Verified payment or included allowance required.';END IF;

  IF NOT EXISTS(SELECT 1 FROM public.contract WHERE mall_id=e.mall_id AND contract_is_current AND lower(contract_status)='active' AND contract_end>now() AND contract_start<=now()) THEN RAISE EXCEPTION 'An active subscription is required before approval.';END IF;

  SELECT * INTO d FROM public.ar_development WHERE ar_development_id=e.development_id FOR UPDATE;

  IF d.ar_development_status<>'live' OR EXISTS(SELECT 1 FROM public.application ap JOIN public.application current_ap ON current_ap.application_id=d.application_id WHERE ap.mall_id=e.mall_id AND ap.application_version>current_ap.application_version) THEN RAISE EXCEPTION 'The published map changed. Reconcile this application before approval.';END IF;

  IF EXISTS(SELECT 1 FROM public.stall_expansion_floor f1 WHERE expansion_id=e.id AND ((SELECT count(*) FROM public.stall_expansion_item i1 WHERE i1.expansion_id=e.id AND i1.floor_id=f1.floor_id)<>f1.quantity)) THEN RAISE EXCEPTION 'Incomplete stall details.';END IF;

  IF EXISTS(SELECT 1 FROM public.stall_expansion_item i1 JOIN public.store st ON st.mall_id=e.mall_id AND lower(trim(st.store_name))=lower(trim(i1.name)) WHERE i1.expansion_id=e.id) THEN RAISE EXCEPTION 'A stall name is now in use. Request corrections.';END IF;

  UPDATE public.stall_expansion SET status='approved',revision=revision+1,updated_at=now(),review_note=NULL WHERE id=e.id;

  UPDATE public.mall_service_request SET status='in_progress',approved_by=p_actor WHERE service_id=e.service_id;

  FOR i IN SELECT * FROM public.stall_expansion_item WHERE expansion_id=e.id ORDER BY floor_id,position LOOP

   INSERT INTO public.store(store_name,store_unit_count,store_status,store_created_at,store_updated_at,brand_id,store_has_cr,mall_id,store_type,store_description,onboarding_floor_id,v3_service_id,store_contact_person,store_contact_num,store_email)

   VALUES(i.name,0,'unmapped',now(),now(),i.brand_id,false,e.mall_id,'stall',i.location,i.floor_id,e.service_id,i.contact_person,i.contact_num,i.email) RETURNING store_id INTO storeid;

   INSERT INTO public.stall(stall_description,stall_created_at,stall_updated_at,floor_id,s_application_id,store_id) VALUES(i.location,now(),now(),i.floor_id,e.stall_application_id,storeid);

  END LOOP;

  FOR f IN SELECT * FROM public.stall_expansion_floor WHERE expansion_id=e.id AND plan IS NOT NULL LOOP

   INSERT INTO public.stall_floor_plan(s_floor_plan_image,s_floor_plan_created_at,s_floor_plan_updated_at,floor_id,s_application_id) VALUES(f.plan,now(),now(),f.floor_id,e.stall_application_id);

   UPDATE public.stall_expansion_floor SET previous_plans=(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM public.application_floor_plan p WHERE p.application_id=d.application_id AND p.floor_id=f.floor_id) WHERE expansion_id=e.id AND floor_id=f.floor_id;

   UPDATE public.application_floor_plan SET app_floor_plan_image=f.plan,app_floor_plan_storage_path=NULL,app_floor_plan_file_name=f.filename,app_floor_plan_mime_type=f.mime,app_floor_plan_file_size=octet_length(f.plan),plan_filename=f.filename,app_floor_plan_reference_line=COALESCE(f.reference_line,''),app_floor_plan_meter_length=COALESCE(f.meter_length,0),plan_calibration=NULL,app_floor_plan_updated_at=now() WHERE application_id=d.application_id AND floor_id=f.floor_id;

   IF NOT FOUND THEN

   INSERT INTO public.application_floor_plan(app_floor_plan_image,app_floor_plan_reference_line,app_floor_plan_meter_length,app_floor_plan_accessibility_route,app_floor_plan_emergency_route,app_floor_plan_created_at,app_floor_plan_updated_at,application_id,floor_id,app_floor_plan_file_name,app_floor_plan_mime_type,app_floor_plan_file_size,plan_filename)

   VALUES(f.plan,COALESCE(f.reference_line,''),COALESCE(f.meter_length,0),'Requires review after stall additions','Requires review after stall additions',now(),now(),d.application_id,f.floor_id,f.filename,f.mime,octet_length(f.plan),f.filename);

   END IF;

   UPDATE public.floor_calibration SET calibration_ref_start_x=NULL,calibration_ref_start_y=NULL,calibration_ref_end_x=NULL,calibration_ref_end_y=NULL,calibration_real_meters=NULL,calibration_pixel_per_meter=NULL,calibration_updated_at=now() WHERE ar_development_id=d.ar_development_id AND floor_id=f.floor_id;

  END LOOP;

  UPDATE public.stall_application SET s_application_status='approved',s_application_updated_at=now() WHERE s_application_id=e.stall_application_id;

  UPDATE public.ar_development SET ar_development_status='node_mapping',ar_development_unpublish_reason='Additional stalls approved',ar_development_map_revision=ar_development_map_revision+1,ar_development_mall_approved_at=NULL,ar_development_ready_at=NULL,ar_development_reminder_count=0,ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;

  PERFORM public.workflow_event(d.application_id,p_actor,'stall_expansion_approved','Additional stalls approved. AR unpublished and returned to node mapping.',d.ar_development_id);

 ELSE RAISE EXCEPTION 'Choose approve or revision.';END IF;

 RETURN jsonb_build_object('status',(SELECT status FROM public.stall_expansion WHERE id=e.id));

END $function$;


CREATE OR REPLACE FUNCTION public.review_stall_expansion(p_id bigint, p_actor bigint, p_action text, p_revision integer, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE c public.contract%ROWTYPE;tier text;qty integer;used integer;free integer;fee bigint;rid bigint;e public.stall_expansion%ROWTYPE;s public.mall_service_request%ROWTYPE;d public.ar_development%ROWTYPE;i record;f record;storeid bigint;

BEGIN

 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Super Admin access required.' USING ERRCODE='42501';END IF;

 SELECT * INTO STRICT e FROM public.stall_expansion WHERE id=p_id;

 PERFORM 1 FROM public.mall WHERE mall_id=e.mall_id FOR UPDATE;

 SELECT * INTO e FROM public.stall_expansion WHERE id=p_id FOR UPDATE;

 IF e.pricing_version='v3' OR EXISTS(SELECT 1 FROM public.mall_service_request WHERE service_id=e.service_id AND inputs->>'workflow'='paid_stall_application') THEN RETURN app_private.activate_stall_expansion_v3(p_id,p_actor,p_action,p_revision,p_note);END IF;

 IF e.status='awaiting_payment' AND p_action='approve' THEN RETURN jsonb_build_object('status',e.status);END IF;

 IF e.status IN ('approved','completed') AND p_action='approve' THEN RETURN jsonb_build_object('approved',true);END IF;

 IF p_revision IS NULL OR e.revision<>p_revision THEN RAISE EXCEPTION 'Application changed. Refresh before reviewing.' USING ERRCODE='40001';END IF;

 IF e.status<>'submitted' THEN RAISE EXCEPTION 'Only submitted applications can be reviewed.';END IF;

 IF p_action='revision' THEN

  IF length(trim(COALESCE(p_note,''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Explain the required corrections.';END IF;

  UPDATE public.stall_expansion SET status='revision',review_note=trim(p_note),revision=revision+1,updated_at=now() WHERE id=e.id;

  UPDATE public.stall_application SET s_application_status='for_revision',s_application_updated_at=now() WHERE s_application_id=e.stall_application_id;

 ELSIF p_action='approve' THEN

  SELECT * INTO s FROM public.mall_service_request WHERE service_id=e.service_id FOR UPDATE;

  IF NOT EXISTS(SELECT 1 FROM public.contract WHERE mall_id=e.mall_id AND contract_is_current AND contract_status='active' AND contract_end>now() AND contract_start<=now()) THEN RAISE EXCEPTION 'An active subscription is required before approval.';END IF;

  SELECT * INTO d FROM public.ar_development WHERE ar_development_id=e.development_id FOR UPDATE;

  IF d.ar_development_status<>'live' OR EXISTS(SELECT 1 FROM public.application ap JOIN public.application current_ap ON current_ap.application_id=d.application_id WHERE ap.mall_id=e.mall_id AND ap.application_version>current_ap.application_version) THEN RAISE EXCEPTION 'The published map changed. Reconcile this application before approval.';END IF;

  IF EXISTS(SELECT 1 FROM public.stall_expansion_floor f1 WHERE expansion_id=e.id AND (plan IS NULL OR (SELECT count(*) FROM public.stall_expansion_item i1 WHERE i1.expansion_id=e.id AND i1.floor_id=f1.floor_id)<>f1.quantity)) THEN RAISE EXCEPTION 'Incomplete stall details or floor plans.';END IF;

  IF EXISTS(SELECT 1 FROM public.stall_expansion_item i1 JOIN public.store st ON st.mall_id=e.mall_id AND lower(trim(st.store_name))=lower(trim(i1.name)) WHERE i1.expansion_id=e.id) THEN RAISE EXCEPTION 'A stall name is now in use. Request corrections.';END IF;

  SELECT * INTO c FROM public.contract WHERE mall_id=e.mall_id AND contract_is_current;

  SELECT lower(COALESCE(c.tier_snapshot->>'s_tier_key',s_tier_key)) INTO tier FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;

  IF tier NOT IN ('basic','standard','premium') OR tier IS NULL THEN RAISE EXCEPTION 'Supported subscription required.';END IF;

  SELECT sum(quantity) INTO qty FROM public.stall_expansion_floor WHERE expansion_id=e.id;

  SELECT COALESCE(sum(allowance_units),0) INTO used FROM public.mall_service_request WHERE mall_id=e.mall_id AND kind='stall_addon' AND allowance_start=COALESCE(c.allowance_start,c.contract_start) AND status<>'cancelled' AND service_id<>s.service_id;

  free:=CASE WHEN tier='premium' THEN LEAST(qty,GREATEST(0,10-used)) ELSE 0 END;

  fee:=(qty-free)*(CASE WHEN tier='basic' THEN 110000 ELSE 100000 END)::bigint;

  UPDATE public.mall_service_request SET contract_id=c.contract_id,approved_by=p_actor,allowance_start=COALESCE(c.allowance_start,c.contract_start),allowance_end=COALESCE(c.allowance_end,c.contract_end),allowance_units=free,

    quote=jsonb_build_object('quantity',qty,'allowance_units',free,'paid_units',qty-free,'amount_cent',fee,'unit_fee',CASE WHEN tier='basic' THEN 1100 ELSE 1000 END,'tier',tier,'contract_id',c.contract_id,'rate_version',e.pricing_version),status=CASE WHEN fee=0 THEN 'queued' ELSE 'awaiting_payment' END,queued_at=CASE WHEN fee=0 THEN now() END WHERE service_id=s.service_id;

  IF fee=0 THEN RETURN app_private.activate_stall_expansion_v3(p_id,p_actor,p_action,p_revision,p_note);END IF;

  INSERT INTO public.contract_payment_request(contract_id,mall_id,fee_type,amount_cent,pricing_model,details) VALUES(c.contract_id,e.mall_id,'stall_addon',fee,'v3',jsonb_build_object('service_id',s.service_id,'actor_id',p_actor,'rate_version',e.pricing_version)) RETURNING request_id INTO rid;

  UPDATE public.mall_service_request SET payment_request_id=rid WHERE service_id=s.service_id;

  UPDATE public.stall_expansion SET status='awaiting_payment',revision=revision+1,updated_at=now() WHERE id=e.id;

  UPDATE public.stall_application SET s_application_status='awaiting_payment',s_application_updated_at=now() WHERE s_application_id=e.stall_application_id;

 ELSE RAISE EXCEPTION 'Choose approve or revision.';END IF;

 RETURN jsonb_build_object('status',(SELECT status FROM public.stall_expansion WHERE id=e.id));

END $function$;


-- Preserve the newer public owner-review wrapper when installed.
DO $$DECLARE ddl text;target regprocedure;BEGIN
 target:=COALESCE(to_regprocedure('app_private.workflow_before_owner_review(bigint,bigint,text,text,text)'),to_regprocedure('public.workflow_action(bigint,bigint,text,text,text)'));
 SELECT pg_get_functiondef(target) INTO ddl;
 IF position('public.stall_expansion' IN ddl)=0 THEN RAISE EXCEPTION 'Unexpected stall publication implementation';END IF;
 ddl:=replace(ddl,'admin_role=''super_admin'' AND admin_account_status','(admin_role=''super_admin'' OR(admin_role=''mall_admin'' AND mall_id=e.mall_id)) AND admin_account_status');
 ddl:=replace(ddl,'contract_status=''active'' AND contract_end>now()','lower(contract_status)=''active'' AND contract_start<=now() AND contract_end>now()');
 EXECUTE ddl;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_stall_expansions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE a public.admin%ROWTYPE;c public.contract%ROWTYPE;tier text;unit_fee numeric;free_limit integer;used integer;starts timestamptz;ends timestamptz;

BEGIN

 a:=app_private.stall_expansion_admin();

 SELECT * INTO c FROM public.contract WHERE mall_id=a.mall_id AND contract_is_current;

 SELECT lower(COALESCE(c.tier_snapshot->>'s_tier_key',s_tier_key)),COALESCE((c.tier_snapshot->>'s_tier_additional_stall_fee')::numeric,s_tier_additional_stall_fee),COALESCE((c.tier_snapshot->>'free_stalls_per_year')::integer,free_stalls_per_year,s_tier_free_extra_stalls_per_year,0) INTO tier,unit_fee,free_limit FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;

 starts:=COALESCE(c.allowance_start,c.contract_start);ends:=COALESCE(c.allowance_end,c.contract_end);

 SELECT COALESCE(sum(allowance_units),0) INTO used FROM public.mall_service_request WHERE mall_id=a.mall_id AND kind='stall_addon' AND allowance_start=starts AND status<>'cancelled';

 RETURN jsonb_build_object('mall_id',a.mall_id,'tier',tier,'unit_fee',unit_fee,

 'free_remaining',GREATEST(0,free_limit-used),'allowance_end',ends,

 'eligible',COALESCE(lower(c.contract_status)='active' AND c.contract_start<=now() AND c.contract_end>now() AND tier IN ('basic','standard','premium') AND EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application ap USING(application_id) WHERE ap.mall_id=a.mall_id AND d.ar_development_status='live'),false),

 'floors',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',floor_id,'label',floor_label) ORDER BY floor_num,floor_id) FROM public.floor WHERE mall_id=a.mall_id),'[]'::jsonb),

 'brands',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',brand_id,'name',brand_name) ORDER BY brand_name,brand_id) FROM public.brand),'[]'::jsonb),

 'applications',COALESCE((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object(

 'quote',s.quote,'payment',CASE WHEN r.request_id IS NULL THEN NULL ELSE jsonb_build_object('id',r.request_id,'status',r.status,'reconciliation_reason',r.reconciliation_reason,'fulfillment_error',r.fulfillment_error) END,

 'floors',(SELECT jsonb_agg((to_jsonb(f)-'plan'-'previous_plans')||jsonb_build_object('has_plan',f.plan IS NOT NULL,'items',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY position) FROM public.stall_expansion_item i WHERE i.expansion_id=e.id AND i.floor_id=f.floor_id),'[]'::jsonb)) ORDER BY f.floor_id) FROM public.stall_expansion_floor f WHERE f.expansion_id=e.id)

 ) ORDER BY e.id DESC) FROM public.stall_expansion e JOIN public.mall_service_request s USING(service_id) LEFT JOIN public.contract_payment_request r ON r.request_id=s.payment_request_id WHERE e.mall_id=a.mall_id),'[]'::jsonb));

END $function$;


DO $$DECLARE ddl text;needle text;target regprocedure;BEGIN
 target:=COALESCE(to_regprocedure('app_private.fulfill_payment_before_owner_review(bigint)'),to_regprocedure('public.fulfill_v3_payment(bigint)'));
 SELECT pg_get_functiondef(target) INTO ddl;
 needle:='IF e.id IS NULL OR e.pricing_version=''v3'' THEN';
 IF position(needle IN ddl)=0 THEN RAISE EXCEPTION 'Unexpected stall payment fulfillment wrapper';END IF;
 ddl:=replace(ddl,needle,'IF e.id IS NULL OR e.pricing_version=''v3'' OR EXISTS(SELECT 1 FROM public.mall_service_request WHERE service_id=e.service_id AND inputs->>''workflow''=''paid_stall_application'') THEN');
 EXECUTE ddl;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;