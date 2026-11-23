BEGIN;
-- Separate evidence for explicit admin simulations. No PayMongo payment or
-- checkout IDs are fabricated, and these records never verify a production mall.
CREATE TABLE IF NOT EXISTS public.subscription_test_payment (
 request_id bigint PRIMARY KEY REFERENCES public.contract_payment_request(request_id),
 mall_id bigint NOT NULL REFERENCES public.mall(mall_id),
 actor_id bigint NOT NULL REFERENCES public.admin(admin_id),
 amount_cent bigint NOT NULL CHECK(amount_cent>0),
 simulated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_test_payment_mall ON public.subscription_test_payment(mall_id);
ALTER TABLE public.subscription_test_payment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_test_payment FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.subscription_test_payment TO service_role;

CREATE OR REPLACE FUNCTION public.is_simulated_subscription_payment(p_request bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.subscription_test_payment s
  JOIN public.contract_payment_request r USING(request_id)
  JOIN public.mall m ON m.mall_id=s.mall_id AND m.mall_id=r.mall_id
  JOIN public.onboarding_quote q ON q.quote_id=r.quote_id AND q.mall_id=m.mall_id
  JOIN public.admin a ON a.admin_id=s.actor_id
  WHERE r.request_id=p_request AND m.is_subscription_test AND q.is_test
   AND r.pricing_model='v3' AND r.status='paid' AND r.reconciliation_reason IS NULL
   AND r.payment_reference LIKE 'manual_test:%' AND r.amount_cent=s.amount_cent
   AND r.paymongo_payment_id IS NULL AND r.paid_at IS NOT NULL
   AND a.admin_role='super_admin' AND a.admin_account_status='official'
 );
$$;
CREATE OR REPLACE FUNCTION public.has_simulated_subscription_payment(p_mall bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.contract_payment_request r WHERE r.mall_id=p_mall
  AND r.fee_type='subscription' AND public.is_simulated_subscription_payment(r.request_id));
$$;
REVOKE ALL ON FUNCTION public.is_simulated_subscription_payment(bigint),public.has_simulated_subscription_payment(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_simulated_subscription_payment(bigint),public.has_simulated_subscription_payment(bigint) TO service_role;

-- Preserve the existing release guard, adding one narrowly verified test case
-- before the first contract is created. Fail rather than patch unknown code.
DO $patch$
DECLARE ddl text; needle text := 'IF c.contract_start IS NULL THEN';
BEGIN
 SELECT pg_get_functiondef('app_private.enforce_ar_release()'::regprocedure) INTO ddl;
 IF position('public.is_simulated_subscription_payment' IN ddl)=0 THEN
  IF position(needle IN ddl)=0 THEN RAISE EXCEPTION 'Unexpected AR release guard; manual test payments were not installed.'; END IF;
  ddl:=replace(ddl,needle,
   'IF c.contract_start IS NULL AND NOT EXISTS(SELECT 1 FROM public.contract_payment_request test_payment WHERE test_payment.mall_id=mid AND test_payment.fee_type=''subscription'' AND (test_payment.details->>''application_id'')::bigint=NEW.application_id AND public.is_simulated_subscription_payment(test_payment.request_id)) THEN');
  EXECUTE ddl;
 END IF;
END $patch$;

CREATE OR REPLACE FUNCTION public.simulate_subscription_payment(
 p_mall bigint,p_actor bigint,p_fee text,p_tier text DEFAULT NULL,p_acknowledged boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.contract_payment_request; existing public.contract_payment_request;
 q public.onboarding_quote; c public.contract; s public.suspension;
 result jsonb; current_id bigint; receipt text;
BEGIN
 IF p_acknowledged IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm this is a simulated payment, with no real money collected.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN
  RAISE EXCEPTION 'Super Admin access required.' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall AND is_subscription_test FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment simulation is available only for explicitly marked test malls.'; END IF;
 SELECT quote.* INTO q FROM public.mall_onboarding o JOIN public.onboarding_quote quote ON quote.quote_id=o.quote_id WHERE o.mall_id=p_mall;
 IF q.quote_id IS NULL OR NOT q.is_test THEN RAISE EXCEPTION 'Prepare an explicit TEST onboarding quote first.'; END IF;
 IF p_fee NOT IN ('onboarding','subscription','renewal','reinstatement','upgrade') THEN RAISE EXCEPTION 'Unsupported simulated payment type.'; END IF;
 SELECT contract_id INTO current_id FROM public.contract WHERE mall_id=p_mall AND contract_is_current;
 -- Repeated clicks must not create duplicate onboarding, initial annual fees,
 -- or renewal payments for the same preceding contract term.
 SELECT x.* INTO existing FROM public.contract_payment_request x
  WHERE x.mall_id=p_mall AND x.quote_id=q.quote_id AND x.fee_type=p_fee
   AND public.is_simulated_subscription_payment(x.request_id)
   AND (p_fee IN ('onboarding','subscription') OR (x.details->>'previous_contract_id')::bigint=current_id)
  ORDER BY x.request_id DESC LIMIT 1;
 IF existing.request_id IS NOT NULL THEN
  IF existing.fulfilled_at IS NULL THEN
   result:=public.fulfill_v3_payment(existing.request_id);
   SELECT * INTO existing FROM public.contract_payment_request WHERE request_id=existing.request_id;
   IF existing.fulfilled_at IS NULL THEN RAISE EXCEPTION 'Simulated payment fulfillment failed: %',existing.fulfillment_error; END IF;
  END IF;
  RETURN jsonb_build_object('requestId',existing.request_id,'fulfilled',true,'simulated',true,'testOnly',true,'alreadyPaid',true,'message','This simulated payment is already recorded.');
 END IF;
 r:=jsonb_populate_record(NULL::public.contract_payment_request,public.prepare_subscription_payment(p_mall,p_actor,p_fee,p_tier,true));
 IF EXISTS(SELECT 1 FROM public.mall_payment_checkout WHERE request_id=r.request_id) THEN RAISE EXCEPTION 'Resolve the existing provider checkout before simulating this payment.'; END IF;
 receipt:='manual_test:'||gen_random_uuid()::text;
 INSERT INTO public.subscription_test_payment(request_id,mall_id,actor_id,amount_cent) VALUES(r.request_id,p_mall,p_actor,r.amount_cent);
 UPDATE public.contract_payment_request SET status='paid',paid_at=now(),payment_reference=receipt,paymongo_payment_id=NULL,
  confirmation_message='MANUAL TEST SIMULATION: no PayMongo transaction and no real money collected.',confirmed_at=now()
  WHERE request_id=r.request_id;
 result:=public.fulfill_v3_payment(r.request_id);
 SELECT * INTO r FROM public.contract_payment_request WHERE request_id=r.request_id;
 IF r.fulfilled_at IS NULL OR r.reconciliation_reason IS NOT NULL THEN RAISE EXCEPTION 'Simulated payment fulfillment failed: %',COALESCE(r.fulfillment_error,r.reconciliation_reason,'Unknown workflow issue'); END IF;
 IF p_fee='onboarding' THEN
  UPDATE public.mall_onboarding SET completed_at=COALESCE(completed_at,now()) WHERE mall_id=p_mall;
 ELSE
  UPDATE public.contract SET is_test=true WHERE contract_id=r.contract_id;
 END IF;
 IF p_fee='reinstatement' THEN
  SELECT * INTO s FROM public.suspension WHERE contract_id=(r.details->>'previous_contract_id')::bigint AND suspension_lifted_at IS NULL FOR UPDATE;
  IF s.suspension_id IS NOT NULL THEN
   UPDATE public.suspension SET suspension_lifted_at=now(),suspension_resolution='MANUAL TEST payment simulation; no real funds collected.',suspension_lifted_by=p_actor WHERE suspension_id=s.suspension_id;
   UPDATE public.ar_development SET ar_development_status='live',ar_development_unpublish_reason=NULL,ar_development_updated_at=now()
    WHERE ar_development_id=ANY(s.affected_ar_ids) AND ar_development_unpublish_reason='subscription:'||s.suspension_id AND ar_development_mall_approved_at IS NOT NULL;
  END IF;
 END IF;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('subscription_management','manual_test_payment','SIMULATED '||p_fee||' payment, request #'||r.request_id||'. No provider transaction or real money collected.',now(),p_actor,p_mall);
 PERFORM public.emit_subscription_event('manual_test_payment:'||r.request_id,p_mall,'payment','TEST payment simulated',
  'Super Admin simulated a '||p_fee||' payment. No real money moved.',false);
 RETURN jsonb_build_object('requestId',r.request_id,'fulfilled',true,'simulated',true,'testOnly',true,'message',
  CASE WHEN p_fee='subscription' THEN 'TEST subscription paid and AR published. No real money was collected.' ELSE 'TEST '||p_fee||' payment recorded. No real money was collected.' END);
END $$;
REVOKE ALL ON FUNCTION public.simulate_subscription_payment(bigint,bigint,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_subscription_payment(bigint,bigint,text,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
