CREATE OR REPLACE FUNCTION public.schedule_subscription_downgrade(p_mall bigint,p_actor bigint,p_tier text,p_test boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.contract;t public.subscription_tier;who public.admin;starts timestamptz;id bigint;
BEGIN
 SELECT * INTO STRICT who FROM public.admin WHERE admin_id=p_actor AND NOT admin_is_deactivated AND admin_account_status='official';
 IF NOT (who.admin_role='mall_admin' AND who.mall_id=p_mall) AND NOT(p_test AND who.admin_role='super_admin' AND EXISTS(SELECT 1 FROM public.mall WHERE mall_id=p_mall AND is_subscription_test)) THEN RAISE EXCEPTION 'Access denied'; END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contract WHERE mall_id=p_mall AND contract_is_current FOR UPDATE;
 SELECT * INTO STRICT t FROM public.subscription_tier WHERE s_tier_key=p_tier;
 IF c.contract_end<=now() OR t.s_tier_annual_fee>=c.contract_annual_fee OR EXISTS(SELECT 1 FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL) THEN RAISE EXCEPTION 'Choose a lower tier on an active subscription'; END IF;
 IF EXISTS(SELECT 1 FROM public.contract_payment_request WHERE mall_id=p_mall AND status='pending' AND fee_type IN ('renewal','reinstatement','upgrade')) OR EXISTS(SELECT 1 FROM public.contract WHERE previous_contract_id=c.contract_id AND scheduled AND change_type IN ('renewal','reinstatement')) THEN RAISE EXCEPTION 'Resolve the existing payment or paid renewal before changing the scheduled tier'; END IF;
 UPDATE public.contract SET scheduled=false,contract_status='superseded',contract_updated_at=now() WHERE mall_id=p_mall AND scheduled AND change_type='downgrade';
 starts:=((c.contract_end AT TIME ZONE 'Asia/Manila')::date+1)::timestamp AT TIME ZONE 'Asia/Manila';
 id:=app_private.create_v3_contract(p_mall,p_actor,to_jsonb(t),c.capacity_snapshot,c.contract_onboarding_fee::numeric,starts,starts+interval '1 year'-interval '1 millisecond','downgrade',c.contract_id,starts,starts+interval '1 year'-interval '1 millisecond',true);
 UPDATE public.contract SET is_test=p_test WHERE contract_id=id;
 PERFORM public.emit_subscription_event('downgrade:'||id,p_mall,'tier_scheduled','Subscription tier change scheduled','The '||t.s_tier_label||' tier is scheduled for renewal. It does not change the current term or mark the renewal paid.');
 RETURN id;
END $$;
REVOKE ALL ON FUNCTION public.schedule_subscription_downgrade(bigint,bigint,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_subscription_downgrade(bigint,bigint,text,boolean) TO service_role;

-- A queued lower tier is used unless the payer explicitly chooses another tier.
DO $$ DECLARE ddl text; BEGIN
 SELECT pg_get_functiondef('public.prepare_subscription_payment(bigint,bigint,text,text,boolean)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'SELECT * INTO t FROM public.subscription_tier WHERE s_tier_key=COALESCE(p_tier,o.selected_tier_key,',
  'SELECT * INTO t FROM public.subscription_tier WHERE s_tier_key=COALESCE(p_tier,(SELECT tier_snapshot->>''s_tier_key'' FROM public.contract WHERE mall_id=p_mall AND scheduled AND change_type=''downgrade'' ORDER BY contract_start LIMIT 1),o.selected_tier_key,');
 EXECUTE ddl;
END $$;
