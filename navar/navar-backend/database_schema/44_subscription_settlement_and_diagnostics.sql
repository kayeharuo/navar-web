CREATE OR REPLACE FUNCTION public.application_readiness_issues(p_application bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH target AS (SELECT a.*,m.mall_address,m.mall_city,m.mall_state,m.mall_logo,m.mall_logo_path FROM public.application a JOIN public.mall m USING(mall_id) WHERE application_id=p_application),
 issues AS (
  SELECT 'Application must be approved' issue FROM target WHERE lower(application_status)<>'approved'
  UNION ALL SELECT 'Mall address, city, province or logo is missing' FROM target WHERE COALESCE(length(trim(mall_address)),0)=0 OR COALESCE(length(trim(mall_city)),0)=0 OR COALESCE(length(trim(mall_state)),0)=0 OR (COALESCE(octet_length(mall_logo),0)=0 AND COALESCE(length(mall_logo_path),0)=0)
  UNION ALL SELECT 'Missing or invalid operating hours for '||day FROM target t CROSS JOIN unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) day
   WHERE (SELECT count(*) FROM public.operating_hours h WHERE h.mall_id=t.mall_id AND h.opthrs_is_mall AND lower(trim(h.opthrs_day_of_week))=lower(day))<>1
   OR NOT EXISTS(SELECT 1 FROM public.operating_hours h WHERE h.mall_id=t.mall_id AND h.opthrs_is_mall AND lower(trim(h.opthrs_day_of_week))=lower(day) AND (h.opthrs_is_closed OR (h.opthrs_open_time IS NOT NULL AND h.opthrs_close_time IS NOT NULL AND h.opthrs_open_time<>h.opthrs_close_time)))
  UNION ALL SELECT f.floor_label||': upload exactly one floor plan with a valid scale reference' FROM public.floor f JOIN target t USING(mall_id)
   WHERE (SELECT count(*) FROM public.application_floor_plan p WHERE p.floor_id=f.floor_id AND p.application_id=p_application)<>1
   OR NOT EXISTS(SELECT 1 FROM public.application_floor_plan p WHERE p.floor_id=f.floor_id AND p.application_id=p_application AND (COALESCE(octet_length(p.app_floor_plan_image),0)>0 OR COALESCE(length(p.app_floor_plan_storage_path),0)>0) AND p.app_floor_plan_meter_length>0 AND length(trim(p.app_floor_plan_reference_line))>0 AND p.app_floor_plan_reference_line!~* '^sample')
  UNION ALL SELECT f.floor_label||': accessibility and emergency route descriptions are required' FROM public.floor f JOIN target t USING(mall_id)
   WHERE NOT EXISTS(SELECT 1 FROM public.application_floor_plan p WHERE p.floor_id=f.floor_id AND p.application_id=p_application AND length(trim(p.app_floor_plan_accessibility_route))>0 AND length(trim(p.app_floor_plan_emergency_route))>0 AND p.app_floor_plan_accessibility_route!~* '^sample' AND p.app_floor_plan_emergency_route!~* '^sample')
  UNION ALL SELECT f.floor_label||': entry point labels and descriptions are required' FROM public.floor f JOIN target t USING(mall_id)
   WHERE NOT EXISTS(SELECT 1 FROM public.application_entry_point e WHERE e.application_id=p_application AND e.floor_id=f.floor_id)
    OR EXISTS(SELECT 1 FROM public.application_entry_point e WHERE e.application_id=p_application AND e.floor_id=f.floor_id AND (COALESCE(length(trim(e.app_entry_point_label)),0)=0 OR COALESCE(length(trim(e.app_entry_point_description)),0)=0 OR e.app_entry_point_label~* '^sample' OR e.app_entry_point_description~* '^sample'))
 ) SELECT COALESCE(jsonb_agg(issue),'[]') FROM issues;
$$;
CREATE OR REPLACE FUNCTION app_private.application_requirements_ready(p_application bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.application WHERE application_id=p_application)
 AND EXISTS(SELECT 1 FROM public.floor f JOIN public.application a USING(mall_id) WHERE a.application_id=p_application)
 AND public.application_readiness_issues(p_application)='[]'::jsonb;
$$;
REVOKE ALL ON FUNCTION public.application_readiness_issues(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.application_readiness_issues(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_subscription_payment(p_request bigint,p_session text,p_payment text,p_amount bigint,p_paid_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.contract_payment_request;s public.suspension;c public.contract;pc public.mall_payment_checkout;
BEGIN
 SELECT * INTO STRICT r FROM public.contract_payment_request WHERE request_id=p_request;
 PERFORM 1 FROM public.mall WHERE mall_id=r.mall_id FOR UPDATE;
 SELECT * INTO STRICT pc FROM public.mall_payment_checkout WHERE request_id=p_request AND session_id=p_session;
 IF NOT EXISTS(SELECT 1 FROM public.mall WHERE mall_id=r.mall_id AND is_subscription_test) OR pc.livemode THEN RAISE EXCEPTION 'This bridge accepts test payments for explicitly marked test malls only'; END IF;
 PERFORM public.confirm_verified_mall_payment(p_session,p_payment,p_amount,false,p_paid_at);
 SELECT * INTO STRICT r FROM public.contract_payment_request WHERE request_id=p_request;
 IF r.reconciliation_reason IS NOT NULL THEN RETURN jsonb_build_object('fulfilled',false,'message',r.reconciliation_reason); END IF;
 IF r.fulfilled_at IS NULL THEN PERFORM public.fulfill_v3_payment(p_request);SELECT * INTO STRICT r FROM public.contract_payment_request WHERE request_id=p_request;END IF;
 IF r.fulfilled_at IS NULL THEN RETURN jsonb_build_object('fulfilled',false,'message',r.fulfillment_error); END IF;
 IF r.fee_type='onboarding' THEN
  UPDATE public.mall_onboarding SET completed_at=COALESCE(completed_at,now()) WHERE mall_id=r.mall_id;
 ELSE
  UPDATE public.contract SET is_test=true WHERE contract_id=r.contract_id;
 END IF;
 IF r.fee_type='reinstatement' THEN
  SELECT * INTO s FROM public.suspension WHERE contract_id=(r.details->>'previous_contract_id')::bigint AND suspension_lifted_at IS NULL FOR UPDATE;
  IF s.suspension_id IS NOT NULL THEN
   UPDATE public.suspension SET suspension_lifted_at=now(),suspension_resolution='Verified TEST PayMongo annual, reinstatement and penalty payment',suspension_lifted_by=(r.details->>'actor_id')::bigint WHERE suspension_id=s.suspension_id;
   UPDATE public.contract SET contract_status='active' WHERE contract_id=s.contract_id AND contract_is_current;
   UPDATE public.ar_development SET ar_development_status='live',ar_development_unpublish_reason=NULL,ar_development_updated_at=now()
    WHERE ar_development_id=ANY(s.affected_ar_ids) AND ar_development_unpublish_reason='subscription:'||s.suspension_id AND ar_development_mall_approved_at IS NOT NULL;
  END IF;
 END IF;
 PERFORM public.emit_subscription_event('payment:'||r.request_id,r.mall_id,'payment','TEST payment confirmed',
  'PayMongo confirmed a TEST '||r.fee_type||' payment of PHP '||(r.amount_cent/100.0)||'. No real money moved. Reference: '||p_payment);
 RETURN jsonb_build_object('fulfilled',true,'testOnly',true);
END $$;
REVOKE ALL ON FUNCTION public.settle_subscription_payment(bigint,text,text,bigint,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_subscription_payment(bigint,text,text,bigint,timestamptz) TO service_role;

-- Mirror inquiry delivery attempts without storing invitation or password tokens.
CREATE OR REPLACE FUNCTION public.log_inquiry_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE recipient text; mid bigint; attempt bigint; state text;
BEGIN
 IF NEW.i_message_sender_type NOT IN ('admin','super_admin') THEN RETURN NEW; END IF;
 SELECT inquiry_contact_email,mall_id INTO recipient,mid FROM public.inquiry WHERE inquiry_id=NEW.inquiry_id;
 state:=CASE WHEN NEW.i_message_delivery_status='sent' THEN 'sent' WHEN NEW.i_message_delivery_status IN ('pending','sending','failed') THEN NEW.i_message_delivery_status ELSE 'unconfirmed' END;
 IF TG_OP='UPDATE' AND NEW.i_message_delivery_status IS NOT DISTINCT FROM OLD.i_message_delivery_status THEN RETURN NEW; END IF;
 SELECT email_log_id INTO attempt FROM public.email_log WHERE email_log_source_type='inquiry' AND email_log_source_id=NEW.i_message_id::text AND email_log_status IN ('pending','sending','queued') ORDER BY email_log_id DESC LIMIT 1;
 IF attempt IS NULL THEN
  INSERT INTO public.email_log(email_log_type,email_log_to_email,email_log_subject,email_log_body,email_log_status,email_log_sent_at,email_log_triggered_by,mall_id,email_log_source_type,email_log_source_id)
  VALUES('inquiry_'||COALESCE(NEW.i_message_kind,'reply'),recipient,'NavAR inquiry',NEW.i_message_message,state,CASE WHEN state='sent' THEN now() ELSE NULL END,NEW.i_message_admin_id,mid,'inquiry',NEW.i_message_id::text);
 ELSE
  UPDATE public.email_log SET email_log_status=state,email_log_sent_at=CASE WHEN state='sent' THEN now() ELSE NULL END,
   email_log_fail_reason=CASE WHEN state IN ('failed','unconfirmed') THEN 'Review the inquiry delivery status and sending mailbox before retrying.' ELSE NULL END WHERE email_log_id=attempt;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS log_inquiry_delivery ON public.inquiry_message;
CREATE TRIGGER log_inquiry_delivery AFTER INSERT OR UPDATE OF i_message_delivery_status ON public.inquiry_message FOR EACH ROW EXECUTE FUNCTION public.log_inquiry_delivery();

-- Import known historical statuses without resending any email.
INSERT INTO public.email_log(email_log_type,email_log_to_email,email_log_subject,email_log_body,email_log_status,email_log_sent_at,email_log_triggered_by,mall_id,email_log_source_type,email_log_source_id,email_log_created_at)
 SELECT 'inquiry_'||COALESCE(msg.i_message_kind,'reply'),i.inquiry_contact_email,'NavAR inquiry',msg.i_message_message,
 CASE WHEN msg.i_message_delivery_status IN ('sent','failed','pending','sending') THEN msg.i_message_delivery_status ELSE 'unconfirmed' END,
 CASE WHEN msg.i_message_delivery_status='sent' THEN msg.i_message_delivered_at ELSE NULL END,msg.i_message_admin_id,i.mall_id,'inquiry',msg.i_message_id::text,msg.i_message_sent_at
 FROM public.inquiry_message msg JOIN public.inquiry i USING(inquiry_id)
 WHERE msg.i_message_sender_type IN ('admin','super_admin') AND NOT EXISTS(SELECT 1 FROM public.email_log l WHERE l.email_log_source_type='inquiry' AND l.email_log_source_id=msg.i_message_id::text);

CREATE OR REPLACE FUNCTION public.save_test_application_details(p_mall bigint,p_actor bigint,p_rows jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.ar_development;item record;entry bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.mall WHERE mall_id=p_mall AND is_subscription_test) OR NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Explicit test mall required'; END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
 SELECT x.* INTO STRICT d FROM public.ar_development x JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall ORDER BY a.application_version DESC,x.ar_development_id DESC LIMIT 1;
 IF d.ar_development_status NOT IN ('testing','node_mapping','pending') THEN RAISE EXCEPTION 'Application details are locked after Ready'; END IF;
 FOR item IN SELECT key,value FROM jsonb_each(p_rows) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.floor WHERE floor_id=item.key::bigint AND mall_id=p_mall) THEN RAISE EXCEPTION 'Invalid floor'; END IF;
  IF COALESCE(length(trim(item.value->>'accessibility')),0)=0 OR COALESCE(length(trim(item.value->>'emergency')),0)=0 OR COALESCE(length(trim(item.value->>'entryLabel')),0)=0 OR COALESCE(length(trim(item.value->>'entryDescription')),0)=0 THEN RAISE EXCEPTION 'Complete all four details for each entered floor'; END IF;
  UPDATE public.application_floor_plan SET app_floor_plan_accessibility_route=item.value->>'accessibility',app_floor_plan_emergency_route=item.value->>'emergency',app_floor_plan_updated_at=now() WHERE floor_id=item.key::bigint AND application_id=d.application_id;
  SELECT app_entry_point_id INTO entry FROM public.application_entry_point WHERE floor_id=item.key::bigint AND application_id=d.application_id ORDER BY app_entry_point_id LIMIT 1;
  IF entry IS NULL THEN
   INSERT INTO public.application_entry_point(app_entry_point_label,app_entry_point_description,app_entry_point_created_at,app_entry_point_updated_at,application_id,floor_id)
    VALUES(item.value->>'entryLabel',item.value->>'entryDescription',now(),now(),d.application_id,item.key::bigint);
  ELSE
   UPDATE public.application_entry_point SET app_entry_point_label=item.value->>'entryLabel',app_entry_point_description=item.value->>'entryDescription',app_entry_point_updated_at=now() WHERE app_entry_point_id=entry;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_test_application_details(bigint,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_test_application_details(bigint,bigint,jsonb) TO service_role;
