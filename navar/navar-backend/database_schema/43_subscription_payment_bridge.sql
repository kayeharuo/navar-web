-- Payment preparation for verified backend identities; never accepts an amount from the browser.
CREATE OR REPLACE FUNCTION public.prepare_subscription_payment(p_mall bigint,p_actor bigint,p_fee text,p_tier text DEFAULT NULL,p_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.contract;t public.subscription_tier;o public.mall_onboarding;q public.onboarding_quote;d public.ar_development;s public.suspension;r public.contract_payment_request;
 amount bigint; detail jsonb; start_at timestamptz;who public.admin;
BEGIN
 SELECT * INTO STRICT who FROM public.admin WHERE admin_id=p_actor AND NOT admin_is_deactivated AND admin_account_status='official';
 IF NOT (who.admin_role='mall_admin' AND who.mall_id=p_mall) AND NOT (p_test AND who.admin_role='super_admin' AND EXISTS(SELECT 1 FROM public.mall WHERE mall_id=p_mall AND is_subscription_test)) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_test IS DISTINCT FROM (SELECT is_subscription_test FROM public.mall WHERE mall_id=p_mall) THEN RAISE EXCEPTION 'Payment mode does not match this mall'; END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
 SELECT * INTO c FROM public.contract WHERE mall_id=p_mall AND contract_is_current FOR UPDATE;
 SELECT * INTO o FROM public.mall_onboarding WHERE mall_id=p_mall;
 SELECT * INTO q FROM public.onboarding_quote WHERE quote_id=o.quote_id;
 SELECT * INTO t FROM public.subscription_tier WHERE s_tier_key=COALESCE(p_tier,o.selected_tier_key,(SELECT s_tier_key FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id));
 IF p_fee<>'onboarding' AND t.s_tier_id IS NULL THEN RAISE EXCEPTION 'Choose a subscription tier'; END IF;
 SELECT * INTO s FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL;
 detail:=jsonb_build_object('tier',to_jsonb(t),'actor_id',p_actor,'is_test',p_test);
 IF p_fee='onboarding' THEN
  IF q.quote_id IS NULL OR q.status<>'finalized' OR q.expires_at<=now() THEN RAISE EXCEPTION 'A valid finalized onboarding quote is required'; END IF;
  amount:=q.amount_cent;
 ELSIF p_fee='subscription' THEN
  IF c.contract_start IS NOT NULL THEN RAISE EXCEPTION 'Subscription has already started'; END IF;
  IF q.status IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Verified onboarding payment is required first'; END IF;
  SELECT x.* INTO d FROM public.ar_development x JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall ORDER BY a.application_version DESC,x.ar_development_id DESC LIMIT 1;
  IF d.ar_development_status IS DISTINCT FROM 'ready' OR d.ar_development_mall_approved_at IS NULL THEN RAISE EXCEPTION 'Review and approve the Ready AR first'; END IF;
  IF EXISTS(SELECT 1 FROM public.contract_payment_request WHERE mall_id=p_mall AND fee_type='subscription' AND status='paid') THEN RAISE EXCEPTION 'Subscription payment already exists; retry publication'; END IF;
  amount:=round(t.s_tier_annual_fee*100)::bigint; detail:=detail||jsonb_build_object('application_id',d.application_id);
 ELSIF p_fee IN ('renewal','reinstatement','upgrade') THEN
  IF c.contract_start IS NULL OR c.contract_end IS NULL THEN RAISE EXCEPTION 'No current annual period'; END IF;
  IF EXISTS(SELECT 1 FROM public.contract WHERE previous_contract_id=c.contract_id AND scheduled AND change_type IN ('renewal','reinstatement')) THEN RAISE EXCEPTION 'A paid renewal is already scheduled'; END IF;
  IF c.cancellation_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Subscription is scheduled for cancellation'; END IF;
  IF p_fee='upgrade' THEN
   IF c.contract_end<=now() OR t.s_tier_annual_fee<=c.contract_annual_fee OR s.suspension_id IS NOT NULL THEN RAISE EXCEPTION 'Choose a higher tier on an active subscription'; END IF;
   amount:=round((t.s_tier_annual_fee-c.contract_annual_fee)*ceil(extract(epoch FROM c.contract_end-now())/86400)/365*100)::bigint;
   detail:=detail||jsonb_build_object('previous_contract_id',c.contract_id,'end',c.contract_end);
  ELSE
   IF c.contract_end>now()+interval '30 days' AND s.suspension_id IS NULL THEN RAISE EXCEPTION 'Renewal opens 30 days before expiry'; END IF;
   IF p_fee='renewal' AND (s.suspension_id IS NOT NULL AND s.suspension_reason<>'Operational' OR (c.contract_end AT TIME ZONE 'Asia/Manila')::date+c.contract_grace_period_days<(now() AT TIME ZONE 'Asia/Manila')::date) THEN RAISE EXCEPTION 'Reinstatement payment is required'; END IF;
   IF p_fee='reinstatement' AND (s.suspension_id IS NULL OR s.suspension_reason='Operational') AND (c.contract_end AT TIME ZONE 'Asia/Manila')::date+c.contract_grace_period_days >= (now() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'Reinstatement is not due'; END IF;
   start_at:=((c.contract_end AT TIME ZONE 'Asia/Manila')::date+1)::timestamp AT TIME ZONE 'Asia/Manila';
   amount:=round((t.s_tier_annual_fee + CASE WHEN p_fee='reinstatement' THEN c.contract_annual_fee*c.contract_reinstatement_rate+COALESCE(s.suspension_penalty_amount,0) ELSE 0 END)*100)::bigint;
   detail:=detail||jsonb_build_object('previous_contract_id',c.contract_id,'start',start_at,'suspension_id',s.suspension_id,'annualCent',round(t.s_tier_annual_fee*100),'reinstatementCent',CASE WHEN p_fee='reinstatement' THEN round(c.contract_annual_fee*c.contract_reinstatement_rate*100) ELSE 0 END,'penaltyCent',CASE WHEN p_fee='reinstatement' THEN round(COALESCE(s.suspension_penalty_amount,0)*100) ELSE 0 END);
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported payment type'; END IF;
 SELECT * INTO r FROM public.contract_payment_request WHERE mall_id=p_mall AND fee_type=p_fee AND status='pending' ORDER BY request_id DESC LIMIT 1;
 IF r.request_id IS NOT NULL THEN
  IF r.amount_cent<>amount OR r.details->'tier'->>'s_tier_key' IS DISTINCT FROM detail->'tier'->>'s_tier_key' THEN RAISE EXCEPTION 'Resolve the existing payment request before changing terms'; END IF;
  RETURN to_jsonb(r);
 END IF;
 INSERT INTO public.contract_payment_request(contract_id,mall_id,quote_id,fee_type,amount_cent,pricing_model,details,confirmation_message,confirmed_at)
 VALUES(c.contract_id,p_mall,q.quote_id,p_fee,amount,'v3',detail,'AR and payment reviewed through authenticated workflow',now()) RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_test_ar(p_mall bigint,p_actor bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.ar_development;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND NOT admin_is_deactivated) OR NOT EXISTS(SELECT 1 FROM public.mall WHERE mall_id=p_mall AND is_subscription_test) THEN RAISE EXCEPTION 'Explicit test mall required'; END IF;
 SELECT x.* INTO STRICT d FROM public.ar_development x JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall ORDER BY a.application_version DESC,x.ar_development_id DESC LIMIT 1 FOR UPDATE OF x;
 IF d.ar_development_status<>'ready' THEN RAISE EXCEPTION 'Finish the readiness checks first'; END IF;
 UPDATE public.ar_development SET ar_development_mall_approved_at=now(),ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('subscription_management','test_ar_acknowledgment','Super admin simulated mall review for a TEST fixture; not a real mall-admin approval. AR #'||d.ar_development_id,now(),p_actor,p_mall);
END $$;

-- The legacy release trigger expected a contract before the v3 publish creates it.
-- Verified v3 first payment is the guard; subsequent release checks use the current contract.
CREATE OR REPLACE FUNCTION app_private.enforce_ar_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid bigint;c public.contract;
BEGIN
 IF lower(NEW.ar_development_status) NOT IN ('ready','live') THEN RETURN NEW; END IF;
 IF NOT app_private.application_requirements_ready(NEW.application_id) THEN RAISE EXCEPTION 'Approve the application and complete every profile, floor plan, scale, route and entry-point requirement before marking AR ready.'; END IF;
 IF NEW.ar_development_status='live' THEN
  IF NEW.ar_development_mall_approved_at IS NULL THEN RAISE EXCEPTION 'Mall review is required'; END IF;
  SELECT mall_id INTO mid FROM public.application WHERE application_id=NEW.application_id;
  IF EXISTS(SELECT 1 FROM public.suspension s JOIN public.contract active_contract USING(contract_id) WHERE active_contract.mall_id=mid AND active_contract.contract_is_current AND s.suspension_lifted_at IS NULL) THEN RAISE EXCEPTION 'Subscription is suspended'; END IF;
  SELECT * INTO c FROM public.contract WHERE mall_id=mid AND contract_is_current;
  IF c.contract_start IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.contract_payment_request r JOIN public.mall_payment_checkout pc USING(request_id)
    WHERE r.mall_id=mid AND r.pricing_model='v3' AND r.fee_type='subscription' AND r.status='paid' AND r.reconciliation_reason IS NULL
    AND (r.details->>'application_id')::bigint=NEW.application_id AND pc.payment_id=r.payment_reference AND pc.confirmed_at IS NOT NULL
    AND (pc.livemode OR EXISTS(SELECT 1 FROM public.mall WHERE mall_id=mid AND is_subscription_test))) THEN RAISE EXCEPTION 'Verified subscription payment is required'; END IF;
  ELSIF (c.contract_end AT TIME ZONE 'Asia/Manila')::date+c.contract_grace_period_days < (now() AT TIME ZONE 'Asia/Manila')::date
    OR c.contract_start>now() OR lower(c.contract_status) IN ('suspended','terminated','cancelled') THEN RAISE EXCEPTION 'An active or grace-period subscription is required';
  END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$ DECLARE ddl text; BEGIN
 IF to_regprocedure('app_private.enforce_v3_store_slot()') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.enforce_v3_store_slot()'::regprocedure) INTO ddl;
  ddl:=replace(ddl,'IF NEW.store_type<>''stall'' THEN RAISE EXCEPTION ''After publication, replace an existing store in its slot or request an expansion quote.'';END IF;',
   'IF NEW.store_type<>''stall'' THEN RETURN NEW;END IF;');
  EXECUTE ddl;
 END IF;
 SELECT pg_get_functiondef('app_private.guard_onboarding_checkout_claim()'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'IF r.fee_type<>''onboarding'' THEN RETURN NEW; END IF;','IF r.pricing_model=''v3'' THEN RETURN NEW; END IF; IF r.fee_type<>''onboarding'' THEN RETURN NEW; END IF;');
 EXECUTE ddl;
 SELECT pg_get_functiondef('app_private.create_v3_contract(bigint,bigint,jsonb,jsonb,numeric,timestamp with time zone,timestamp with time zone,text,bigint,timestamp with time zone,timestamp with time zone,boolean)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;',
  'PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE; IF p_change=''initial'' THEN p_start:=date_trunc(''day'',p_start AT TIME ZONE ''Asia/Manila'') AT TIME ZONE ''Asia/Manila'';p_end:=p_start+interval ''1 year''-interval ''1 millisecond'';END IF;');
 EXECUTE ddl;
 SELECT pg_get_functiondef('public.fulfill_v3_payment(bigint)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'starts+interval ''1 year''','starts+interval ''1 year''-interval ''1 millisecond''');
 EXECUTE ddl;
 SELECT pg_get_functiondef('app_private.v3_subscription_payment_issue(public.contract_payment_request,timestamp with time zone)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'OR lower(c.contract_status) IN (''suspended'',''terminated'',''cancelled'')','OR lower(c.contract_status) IN (''terminated'',''cancelled'') OR (lower(c.contract_status)=''suspended'' AND r.fee_type<>''reinstatement'')');
 ddl:=replace(ddl,'c.contract_end IS DISTINCT FROM (r.details->>''start'')::timestamptz','(((c.contract_end AT TIME ZONE ''Asia/Manila'')::date+1)::timestamp AT TIME ZONE ''Asia/Manila'') IS DISTINCT FROM (r.details->>''start'')::timestamptz');
 EXECUTE ddl;
END $$;

REVOKE ALL ON FUNCTION public.prepare_subscription_payment(bigint,bigint,text,text,boolean),public.acknowledge_test_ar(bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_subscription_payment(bigint,bigint,text,text,boolean),public.acknowledge_test_ar(bigint,bigint) TO service_role;
