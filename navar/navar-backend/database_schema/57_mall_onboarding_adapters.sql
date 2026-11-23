BEGIN;
CREATE FUNCTION app_private.mall_onboarding_offer(p_mall bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('terms',o.offer,'mall_id',o.mall_id,'onboarding_fee',o.onboarding_fee_cent/100.0)
 FROM public.mall_onboarding o WHERE o.mall_id=p_mall;
$$;
REVOKE ALL ON FUNCTION app_private.mall_onboarding_offer(bigint) FROM PUBLIC,anon,authenticated;

DO $$DECLARE ddl text;updated text;BEGIN
 IF to_regprocedure('app_private.get_my_onboarding_before_floor_prefill()') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.get_my_onboarding_before_floor_prefill()'::regprocedure) INTO ddl;
  ddl:=regexp_replace(ddl,'(?s)IF s\.contract_id IS NULL THEN.*?ELSE SELECT \* INTO c FROM public\.contract WHERE contract_id=s\.contract_id AND mall_id=a\.mall_id; END IF;','');
  ddl:=replace(ddl,'r.contract_id=s.contract_id','r.mall_id=a.mall_id');
  ddl:=regexp_replace(ddl,'(?s)offer_snapshot:=jsonb_build_object\(''terms'',s\.offer.*?;', 'offer_snapshot:=app_private.mall_onboarding_offer(a.mall_id);');
  IF position('SET contract_id=c.contract_id' IN ddl)>0 THEN RAISE EXCEPTION 'Legacy getter still links onboarding to a subscription';END IF;
  EXECUTE ddl;
 END IF;
 IF to_regprocedure('app_private.save_my_onboarding_before_floor_confirmation(text,jsonb,integer)') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.save_my_onboarding_before_floor_confirmation(text,jsonb,integer)'::regprocedure) INTO ddl;
  ddl:=replace(ddl,'''contract_id'',s.contract_id','''mall_id'',a.mall_id');EXECUTE ddl;
 END IF;
 -- The first subscription is linked through contract.mall_id, not onboarding.
 -- Legacy checkout confirmation must also find onboarding by mall ownership.
 IF to_regprocedure('app_private.confirm_verified_mall_payment_before_v3(text,text,bigint,boolean,timestamp with time zone)') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.confirm_verified_mall_payment_before_v3(text,text,bigint,boolean,timestamp with time zone)'::regprocedure) INTO ddl;
  ddl:=replace(ddl,'SELECT * INTO STRICT c FROM public.contract WHERE contract_id=r.contract_id;',
   'IF r.fee_type<>''onboarding'' THEN SELECT * INTO STRICT c FROM public.contract WHERE contract_id=r.contract_id; END IF;');
  ddl:=replace(ddl,'p_amount<>round((CASE r.fee_type WHEN ''onboarding'' THEN c.contract_onboarding_fee ELSE c.contract_annual_fee END)::numeric*100)::bigint','p_amount IS DISTINCT FROM r.amount_cent');
  ddl:=replace(ddl,'SELECT * INTO s FROM public.mall_onboarding WHERE mall_id=c.mall_id;','SELECT * INTO s FROM public.mall_onboarding WHERE mall_id=r.mall_id;');
  ddl:=replace(ddl,'s.contract_id IS DISTINCT FROM c.contract_id OR s.prepayment_acceptance IS NULL','s.mall_id IS NULL OR s.prepayment_acceptance IS NULL');
  ddl:=replace(ddl,'WHERE contract_id=c.contract_id AND fee_type=''onboarding''','WHERE mall_id=c.mall_id AND fee_type=''onboarding''');
  EXECUTE ddl;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_onboarding_checkout()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin%ROWTYPE;s public.mall_onboarding%ROWTYPE;d jsonb;link text;
BEGIN
 a:=app_private.onboarding_admin();d:=public.get_my_onboarding();
 SELECT * INTO s FROM public.mall_onboarding WHERE mall_id=a.mall_id;
 IF d->>'stage'<>'payment' OR s.prepayment_acceptance->>'fingerprint' IS DISTINCT FROM d->>'fingerprint' THEN RAISE EXCEPTION 'Review and accept the current terms before payment.';END IF;
 SELECT r.checkout_url INTO link FROM public.contract_payment_request r JOIN public.mall_payment_checkout pc USING(request_id)
 WHERE r.mall_id=a.mall_id AND r.fee_type='onboarding' AND r.status='pending' AND pc.amount_cent=r.amount_cent
 ORDER BY r.request_id DESC LIMIT 1;
 IF link IS NULL OR link !~ '^https://checkout[.]paymongo[.]com/' THEN RAISE EXCEPTION 'Super Admin has not issued a verified PayMongo checkout yet.';END IF;
 RETURN link;
END $$;
REVOKE ALL ON FUNCTION public.get_my_onboarding_checkout() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_checkout() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.guard_onboarding_checkout_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.contract_payment_request%ROWTYPE;s public.mall_onboarding%ROWTYPE;snapshot jsonb;
BEGIN
 SELECT * INTO STRICT r FROM public.contract_payment_request WHERE request_id=NEW.request_id FOR UPDATE;
 IF r.pricing_model='v3' OR r.fee_type<>'onboarding' THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(r.mall_id);
 SELECT * INTO STRICT s FROM public.mall_onboarding WHERE mall_id=r.mall_id;
 snapshot:=app_private.mall_onboarding_offer(r.mall_id);
 IF r.status<>'pending' OR s.completed_at IS NOT NULL OR NEW.amount_cent IS DISTINCT FROM r.amount_cent
 OR s.prepayment_acceptance->>'fingerprint' IS DISTINCT FROM md5(snapshot::text) THEN
  RAISE EXCEPTION 'The offer changed. Reload and accept the current terms before checkout.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.guard_onboarding_checkout_claim() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.change_my_onboarding_tier_before_v3(p_tier bigint,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin%ROWTYPE;s public.mall_onboarding%ROWTYPE;t public.subscription_tier%ROWTYPE;
BEGIN
 a:=app_private.onboarding_admin();PERFORM pg_advisory_xact_lock(a.mall_id);
 SELECT * INTO STRICT s FROM public.mall_onboarding WHERE mall_id=a.mall_id FOR UPDATE;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Progress changed. Reload before changing your tier.' USING ERRCODE='40001';END IF;
 SELECT * INTO STRICT t FROM public.subscription_tier WHERE s_tier_id=p_tier;
 -- This is a preference only. It does not change the one-time onboarding fee
 -- or create/start an annual subscription.
 UPDATE public.mall_onboarding SET selected_tier_key=t.s_tier_key,revision=revision+1 WHERE mall_id=a.mall_id;
 RETURN public.get_my_onboarding();
END $$;
REVOKE ALL ON FUNCTION app_private.change_my_onboarding_tier_before_v3(bigint,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.complete_my_manual_onboarding_payment()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin%ROWTYPE;s public.mall_onboarding%ROWTYPE;r public.contract_payment_request%ROWTYPE;d jsonb;reference text;
BEGIN
 a:=app_private.onboarding_admin();PERFORM pg_advisory_xact_lock(a.mall_id);d:=public.get_my_onboarding();
 SELECT * INTO STRICT s FROM public.mall_onboarding WHERE mall_id=a.mall_id FOR UPDATE;
 SELECT * INTO STRICT r FROM public.contract_payment_request WHERE mall_id=a.mall_id AND fee_type='onboarding' ORDER BY request_id DESC LIMIT 1 FOR UPDATE;
 IF r.status='paid' THEN RETURN d;END IF;
 IF r.pricing_model='v3' THEN RAISE EXCEPTION 'Use the current onboarding payment workflow.';END IF;
 IF r.status<>'pending' OR d->>'stage'<>'payment' OR s.prepayment_acceptance->>'fingerprint' IS DISTINCT FROM d->>'fingerprint' THEN RAISE EXCEPTION 'Review and accept the current terms before payment.';END IF;
 IF r.checkout_url IS NOT NULL OR EXISTS(SELECT 1 FROM public.mall_payment_checkout WHERE request_id=r.request_id) THEN RAISE EXCEPTION 'An existing checkout must be reconciled before recording a manual payment.';END IF;
 reference:='manual_'||r.request_id;
 INSERT INTO public.mall_payment_checkout(request_id,session_id,amount_cent,livemode,payment_id,confirmed_at,payment_source)
 VALUES(r.request_id,reference,r.amount_cent,false,reference,now(),'manual');
 UPDATE public.contract_payment_request SET status='paid',payment_reference=reference,paid_at=now() WHERE request_id=r.request_id;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('Onboarding','Manual onboarding payment','Recorded one-time mall onboarding payment. Request '||r.request_id,now(),a.admin_id,a.mall_id);
 RETURN public.get_my_onboarding();
END $$;
REVOKE ALL ON FUNCTION public.complete_my_manual_onboarding_payment() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_my_manual_onboarding_payment() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
