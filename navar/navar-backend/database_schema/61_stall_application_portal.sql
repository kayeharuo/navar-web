BEGIN;
CREATE TABLE app_private.stall_payment_receipt (
 request_id bigint PRIMARY KEY REFERENCES public.contract_payment_request(request_id),
 mall_id bigint NOT NULL REFERENCES public.mall(mall_id),
 actor_id bigint NOT NULL REFERENCES public.admin(admin_id),
 amount_cent bigint NOT NULL CHECK(amount_cent>0),recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.stall_payment_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.stall_payment_receipt FROM PUBLIC,anon,authenticated;
GRANT SELECT ON app_private.stall_payment_receipt TO service_role;

CREATE FUNCTION public.stall_application_portal(p_actor bigint,p_mall bigint,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who public.admin%ROWTYPE;acting public.admin%ROWTYPE;e public.stall_expansion%ROWTYPE;s public.mall_service_request%ROWTYPE;
 r public.contract_payment_request%ROWTYPE;c public.contract%ROWTYPE;d public.ar_development%ROWTYPE;
 old_uid text:=current_setting('request.jwt.claim.sub',true);result jsonb;tid bigint;ref text;txt text;
BEGIN
 SELECT * INTO who FROM public.admin WHERE admin_id=p_actor AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF who.admin_id IS NULL OR who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM p_mall) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 IF who.admin_role='mall_admin' THEN acting:=who;
 ELSE SELECT * INTO acting FROM public.admin WHERE mall_id=p_mall AND admin_role='mall_admin' AND admin_account_status='official' AND NOT admin_is_deactivated ORDER BY admin_is_primary DESC,admin_id LIMIT 1;END IF;
 IF acting.admin_id IS NULL THEN RAISE EXCEPTION 'An active Mall Admin is required for this mall.';END IF;
 PERFORM set_config('request.jwt.claim.sub',acting.admin_auth_user_id::text,true);
 IF p_action='context' THEN
  result:=public.get_my_stall_expansions();
  SELECT * INTO c FROM public.contract WHERE mall_id=p_mall AND contract_is_current;
  SELECT x.* INTO d FROM public.ar_development x JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall ORDER BY a.application_version DESC,x.ar_development_id DESC LIMIT 1;
  result:=result||jsonb_build_object('mall_name',(SELECT mall_name FROM public.mall WHERE mall_id=p_mall),'acting_admin',jsonb_build_object('id',acting.admin_id,'name',acting.admin_full_name),'development',to_jsonb(d),'subscription_active',c.contract_id IS NOT NULL AND lower(c.contract_status)='active' AND c.contract_start<=now() AND c.contract_end>now() AND NOT EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL));
  result:=result||jsonb_build_object('eligible',COALESCE((result->>'eligible')::boolean,false) AND COALESCE((result->>'subscription_active')::boolean,false));
 ELSIF p_action='prepare' THEN
  result:=public.prepare_my_stall_expansion(p_data->'floors');
 ELSIF p_action IN ('pay','save-floor','submit','cancel','confirm','message') THEN
  SELECT * INTO e FROM public.stall_expansion WHERE id=(p_data->>'id')::bigint AND mall_id=p_mall;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Stall application not found.' USING ERRCODE='42501';END IF;
  PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
  SELECT * INTO e FROM public.stall_expansion WHERE id=e.id FOR UPDATE;
  SELECT * INTO s FROM public.mall_service_request WHERE service_id=e.service_id FOR UPDATE;
  IF p_action='pay' THEN
   IF who.admin_role<>'super_admin' OR p_data->>'acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Super Admin payment confirmation is required.' USING ERRCODE='42501';END IF;
   SELECT * INTO c FROM public.contract WHERE mall_id=p_mall AND contract_is_current AND lower(contract_status)='active' AND contract_start<=now() AND contract_end>now();
   IF c.contract_id IS NULL OR c.contract_id IS DISTINCT FROM s.contract_id OR EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN RAISE EXCEPTION 'The subscription changed or is no longer active. Reconcile the application before payment.';END IF;
   IF s.payment_request_id IS NULL THEN result:=jsonb_build_object('message','These stalls are included in the subscription. Complete their details next.');
   ELSE
    SELECT * INTO STRICT r FROM public.contract_payment_request WHERE request_id=s.payment_request_id FOR UPDATE;
    IF r.status='paid' AND r.fulfilled_at IS NOT NULL THEN result:=jsonb_build_object('message','Payment is already recorded.','requestId',r.request_id);
    ELSE
     IF e.status<>'awaiting_payment' OR r.status<>'pending' OR r.amount_cent IS DISTINCT FROM (s.quote->>'amount_cent')::bigint OR r.mall_id<>p_mall OR now()>s.allowance_end THEN RAISE EXCEPTION 'This payment cannot be recorded. Refresh the application.';END IF;
     IF EXISTS(SELECT 1 FROM public.mall_payment_checkout WHERE request_id=r.request_id) OR r.paymongo_payment_id IS NOT NULL THEN RAISE EXCEPTION 'Reconcile the existing provider checkout first.';END IF;
     ref:='manual_stall:'||gen_random_uuid()::text;
     INSERT INTO app_private.stall_payment_receipt(request_id,mall_id,actor_id,amount_cent) VALUES(r.request_id,p_mall,p_actor,r.amount_cent);
     UPDATE public.contract_payment_request SET status='paid',paid_at=now(),payment_reference=ref,confirmation_message='Manual payment recorded by Super Admin.',confirmed_at=now() WHERE request_id=r.request_id;
     result:=public.fulfill_v3_payment(r.request_id);
     IF NOT EXISTS(SELECT 1 FROM public.contract_payment_request WHERE request_id=r.request_id AND fulfilled_at IS NOT NULL AND reconciliation_reason IS NULL) THEN RAISE EXCEPTION 'Payment could not complete its workflow. No payment changes were saved.';END IF;
     result:=jsonb_build_object('message','Payment recorded. Add the purchased stalls and their location descriptions.','requestId',r.request_id);
    END IF;
   END IF;
  ELSIF p_action='save-floor' THEN
   result:=public.save_my_stall_expansion_floor(e.id,(p_data->>'revision')::integer,(p_data->>'floor_id')::bigint,p_data->'items',NULLIF(p_data->'file','null'::jsonb));
  ELSIF p_action='submit' THEN
   result:=public.submit_my_stall_expansion(e.id,(p_data->>'revision')::integer)||jsonb_build_object('message','Stall application submitted. Super Admins have been notified.');
  ELSIF p_action='cancel' THEN result:=public.cancel_my_stall_expansion(e.id,(p_data->>'revision')::integer);
  ELSIF p_action='confirm' THEN
   IF p_data->>'acknowledged' IS DISTINCT FROM 'true' OR e.status<>'approved' THEN RAISE EXCEPTION 'Review the approved application and confirm the Ready AR.';END IF;
   SELECT * INTO d FROM public.ar_development WHERE ar_development_id=e.development_id FOR UPDATE;
   IF d.ar_development_status<>'ready' THEN RAISE EXCEPTION 'The AR must be Ready before mall confirmation.';END IF;
   PERFORM public.workflow_action(d.application_id,acting.admin_id,'mall_approve','acknowledged');
   PERFORM public.workflow_action(d.application_id,acting.admin_id,'publish');
   result:=jsonb_build_object('message','AR confirmed and published. The existing subscription continues; no annual payment was charged.','published',true);
  ELSE
   IF e.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This application thread is read-only.';END IF;
   txt:=trim(COALESCE(p_data->>'content',''));IF length(txt) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Enter a message of up to 10,000 characters.';END IF;
   SELECT thread_id INTO STRICT tid FROM public.thread WHERE s_application_id=e.stall_application_id ORDER BY thread_id LIMIT 1;
   INSERT INTO public.thread_message(thread_id,message_sender,message_sender_type,message_content,message_sent_at) VALUES(tid,acting.admin_id,'mall_admin',txt,now());
   result:=jsonb_build_object('message','Message sent.');
  END IF;
 ELSE RAISE EXCEPTION 'Unknown stall application action.';END IF;
 IF p_action<>'context' THEN
  INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
  VALUES('application_management','stall_portal_'||p_action,'Stall application action: '||p_action||'. Mall Admin #'||acting.admin_id||'. Initiated by admin #'||p_actor||'.',now(),p_actor,p_mall);
 END IF;
 PERFORM set_config('request.jwt.claim.sub',COALESCE(old_uid,''),true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.stall_application_portal(bigint,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stall_application_portal(bigint,bigint,text,jsonb) TO service_role;

CREATE FUNCTION app_private.guard_stall_thread_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid bigint;state text;
BEGIN
 SELECT a.mall_id,e.status INTO mid,state FROM public.thread t JOIN public.stall_application a ON a.s_application_id=t.s_application_id LEFT JOIN public.stall_expansion e ON e.stall_application_id=a.s_application_id WHERE t.thread_id=NEW.thread_id;
 IF mid IS NULL THEN RETURN NEW;END IF;
 IF state IN ('completed','cancelled') THEN RAISE EXCEPTION 'This application thread is read-only.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=NEW.message_sender AND admin_account_status='official' AND NOT admin_is_deactivated AND (admin_role='super_admin' OR (admin_role='mall_admin' AND mall_id=mid))) THEN RAISE EXCEPTION 'Access denied.' USING ERRCODE='42501';END IF;
 IF length(NEW.message_content)>10000 THEN RAISE EXCEPTION 'Message is too long.';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.guard_stall_thread_message() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_stall_thread_message BEFORE INSERT ON public.thread_message FOR EACH ROW EXECUTE FUNCTION app_private.guard_stall_thread_message();
NOTIFY pgrst,'reload schema';
COMMIT;
