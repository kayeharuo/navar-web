BEGIN;
LOCK TABLE public.contract,public.mall_onboarding,public.contract_payment_request,public.payment IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE app_private.onboarding_contract_archive (
 contract_id bigint PRIMARY KEY, mall_id bigint NOT NULL, reason text NOT NULL,
 record jsonb NOT NULL, archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.onboarding_contract_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.onboarding_contract_archive FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO app_private.onboarding_contract_archive(contract_id,mall_id,reason,record)
 SELECT contract_id,mall_id,CASE WHEN lower(contract_status)='onboarding' OR contract_start IS NULL THEN 'Onboarding-only contract removed' ELSE 'Historical onboarding fee snapshot preserved' END,to_jsonb(c)
 FROM public.contract c;
CREATE TEMP TABLE onboarding_contracts_to_remove ON COMMIT DROP AS
 SELECT contract_id,mall_id FROM public.contract WHERE lower(contract_status)='onboarding'
 OR (contract_start IS NULL AND COALESCE(change_type,'initial')='initial');
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.contract_payment_request r JOIN onboarding_contracts_to_remove x USING(contract_id) WHERE r.fee_type<>'onboarding')
 OR EXISTS(SELECT 1 FROM public.payment p JOIN onboarding_contracts_to_remove x USING(contract_id) WHERE lower(p.payment_type)<>'onboarding')
 OR EXISTS(SELECT 1 FROM public.suspension s JOIN onboarding_contracts_to_remove x USING(contract_id))
 OR EXISTS(SELECT 1 FROM public.mall_service_request s JOIN onboarding_contracts_to_remove x USING(contract_id)) THEN
  RAISE EXCEPTION 'An onboarding contract has subscription/service dependencies. Review before removing it.';
 END IF;
END $$;

ALTER TABLE public.payment ADD COLUMN mall_id bigint REFERENCES public.mall(mall_id);
ALTER TABLE public.payment ALTER COLUMN contract_id DROP NOT NULL;
CREATE INDEX payment_mall_id_idx ON public.payment(mall_id);
UPDATE public.payment p SET mall_id=c.mall_id FROM public.contract c WHERE c.contract_id=p.contract_id;
UPDATE public.payment p SET mall_id=w.mall_id FROM public.wallet w WHERE p.wallet_id=w.wallet_id AND p.mall_id IS NULL;
UPDATE public.payment p SET mall_id=s.mall_id FROM public.stall_application s WHERE p.s_application_id=s.s_application_id AND p.mall_id IS NULL;
UPDATE public.contract_payment_request r SET mall_id=c.mall_id FROM public.contract c WHERE r.contract_id=c.contract_id AND r.mall_id IS NULL;

ALTER TABLE public.mall_onboarding ADD COLUMN onboarding_fee_cent bigint CHECK(onboarding_fee_cent>=0);
INSERT INTO public.mall_onboarding(mall_id)
 SELECT DISTINCT mall_id FROM public.contract ON CONFLICT(mall_id) DO NOTHING;
UPDATE public.mall_onboarding o SET onboarding_fee_cent=COALESCE(
 (SELECT q.amount_cent FROM public.onboarding_quote q WHERE q.quote_id=o.quote_id),
 (SELECT r.amount_cent FROM public.contract_payment_request r WHERE r.mall_id=o.mall_id AND r.fee_type='onboarding' AND r.amount_cent IS NOT NULL ORDER BY (r.status='paid') DESC,r.request_id DESC LIMIT 1),
 (SELECT round(p.payment_amount::numeric*100)::bigint FROM public.payment p WHERE p.mall_id=o.mall_id AND lower(p.payment_type)='onboarding' ORDER BY p.payment_paid_at,p.payment_id LIMIT 1),
 (SELECT round(c.contract_onboarding_fee::numeric*100)::bigint FROM public.contract c WHERE c.mall_id=o.mall_id ORDER BY c.contract_version,c.contract_id LIMIT 1));
UPDATE public.mall_onboarding o SET selected_tier_key=t.s_tier_key FROM public.contract c JOIN public.subscription_tier t USING(s_tier_id)
 WHERE c.contract_is_current AND c.mall_id=o.mall_id AND o.selected_tier_key IS NULL;
UPDATE public.contract_payment_request SET contract_id=NULL,fulfilled_at=CASE WHEN status='paid' AND paid_at IS NOT NULL AND reconciliation_reason IS NULL THEN COALESCE(fulfilled_at,paid_at) ELSE fulfilled_at END WHERE fee_type='onboarding';
UPDATE public.payment SET contract_id=NULL WHERE lower(payment_type)='onboarding';
UPDATE public.mall_onboarding SET contract_id=NULL WHERE contract_id IS NOT NULL;
UPDATE public.contract c SET previous_contract_id=NULL FROM onboarding_contracts_to_remove x WHERE c.previous_contract_id=x.contract_id;
DELETE FROM public.contract c USING onboarding_contracts_to_remove x WHERE c.contract_id=x.contract_id;
UPDATE public.contract SET contract_onboarding_fee=0 WHERE contract_onboarding_fee IS DISTINCT FROM 0;
ALTER TABLE public.contract ALTER COLUMN contract_onboarding_fee SET DEFAULT 0;
ALTER TABLE public.contract ADD CONSTRAINT contract_subscription_dates_required CHECK(contract_start IS NOT NULL AND contract_end IS NOT NULL AND contract_end>contract_start);
ALTER TABLE public.contract ADD CONSTRAINT contract_not_onboarding CHECK(lower(contract_status)<>'onboarding');
ALTER TABLE public.contract ADD CONSTRAINT contract_no_onboarding_fee CHECK(contract_onboarding_fee=0);
ALTER TABLE public.mall_onboarding ADD CONSTRAINT onboarding_has_no_contract CHECK(contract_id IS NULL);
ALTER TABLE public.contract_payment_request ADD CONSTRAINT onboarding_request_has_no_contract CHECK(fee_type<>'onboarding' OR (contract_id IS NULL AND mall_id IS NOT NULL));
ALTER TABLE public.payment ADD CONSTRAINT onboarding_payment_has_no_contract CHECK(lower(payment_type)<>'onboarding' OR (contract_id IS NULL AND mall_id IS NOT NULL));
CREATE UNIQUE INDEX one_paid_onboarding_per_mall ON public.contract_payment_request(mall_id)
 WHERE fee_type='onboarding' AND status='paid' AND reconciliation_reason IS NULL;
COMMENT ON COLUMN public.mall_onboarding.contract_id IS 'Deprecated compatibility column; always NULL. Onboarding belongs only to mall_id.';
COMMENT ON COLUMN public.contract.contract_onboarding_fee IS 'Deprecated compatibility column; always zero. One-time onboarding fees belong to mall_onboarding/onboarding_quote.';

-- Compatibility with callers still supplying an old contract ID: resolve mall
-- ownership, then clear the subscription link before storing onboarding payments.
CREATE FUNCTION app_private.onboarding_payment_mall_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid bigint;fee text;
BEGIN
 IF TG_TABLE_NAME='payment' THEN fee:=lower(NEW.payment_type);ELSE fee:=NEW.fee_type;END IF;
 IF fee<>'onboarding' THEN RETURN NEW;END IF;
 IF NEW.contract_id IS NOT NULL THEN
  SELECT mall_id INTO mid FROM public.contract WHERE contract_id=NEW.contract_id;
  IF mid IS NULL OR (NEW.mall_id IS NOT NULL AND NEW.mall_id<>mid) THEN RAISE EXCEPTION 'Onboarding payment mall does not match the supplied subscription.';END IF;
 END IF;
 NEW.mall_id:=COALESCE(NEW.mall_id,mid);
 IF NEW.mall_id IS NULL THEN RAISE EXCEPTION 'Onboarding payment requires a mall.';END IF;
 NEW.contract_id:=NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.onboarding_payment_mall_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER onboarding_payment_mall_owner BEFORE INSERT OR UPDATE ON public.contract_payment_request FOR EACH ROW EXECUTE FUNCTION app_private.onboarding_payment_mall_owner();
CREATE TRIGGER onboarding_payment_mall_owner BEFORE INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION app_private.onboarding_payment_mall_owner();

CREATE FUNCTION app_private.sync_mall_onboarding_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.onboarding_quote%ROWTYPE;
BEGIN
 IF NEW.quote_id IS NOT NULL THEN
  SELECT * INTO STRICT q FROM public.onboarding_quote WHERE quote_id=NEW.quote_id;
  IF q.mall_id IS NOT NULL AND q.mall_id<>NEW.mall_id THEN RAISE EXCEPTION 'Onboarding quote belongs to another mall.';END IF;
  IF NEW.onboarding_fee_cent IS NULL OR (TG_OP='UPDATE' AND NEW.quote_id IS DISTINCT FROM OLD.quote_id) THEN NEW.onboarding_fee_cent:=q.amount_cent;END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.sync_mall_onboarding_fee() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_mall_onboarding_fee BEFORE INSERT OR UPDATE OF quote_id,onboarding_fee_cent ON public.mall_onboarding FOR EACH ROW EXECUTE FUNCTION app_private.sync_mall_onboarding_fee();

-- Patch the installed implementations, retaining newer stall-expansion wrappers.
DO $$DECLARE ddl text; old text; updated text; signature text;BEGIN
 signature:='app_private.create_v3_contract(bigint,bigint,jsonb,jsonb,numeric,timestamp with time zone,timestamp with time zone,text,bigint,timestamp with time zone,timestamp with time zone,boolean)';
 SELECT pg_get_functiondef(signature::regprocedure) INTO ddl;
 ddl:=replace(ddl,'BEGIN','BEGIN p_onboarding:=0; IF p_start IS NULL OR p_end IS NULL THEN RAISE EXCEPTION ''Subscription dates are required; onboarding does not create a contract.'';END IF;');
 EXECUTE ddl;
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname IN ('public','app_private') AND p.prokind='f' AND p.proname IN ('workflow_action_before_stall_expansion','workflow_action') LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO ddl;
  ddl:=replace(ddl,'UPDATE public.mall_onboarding SET contract_id=c WHERE mall_id=a.mall_id;','');EXECUTE ddl;
 END LOOP;
 -- Legacy provisioning still creates the mall, owner and onboarding payment,
 -- but no provisional subscription contract.
 IF to_regprocedure('app_private.provision_inquiry_mall_legacy(bigint,bigint,uuid,bigint,jsonb)') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.provision_inquiry_mall_legacy(bigint,bigint,uuid,bigint,jsonb)'::regprocedure) INTO ddl;
  updated:=regexp_replace(ddl,'(?s)IF p_tier IS NOT NULL THEN\s+INSERT INTO public\.contract\(.*?END IF;',
   'IF p_tier IS NOT NULL THEN INSERT INTO public.contract_payment_request(mall_id,fee_type,amount_cent,pricing_model) VALUES(m,''onboarding'',round(t.s_tier_onboarding_fee::numeric*100)::bigint,''legacy'') RETURNING request_id INTO r; END IF;');
  IF updated=ddl THEN RAISE EXCEPTION 'Unexpected legacy provisioning function';END IF;
  ddl:=replace(updated,'INSERT INTO public.mall_onboarding(mall_id,contract_id,offered_by,offer)','INSERT INTO public.mall_onboarding(mall_id,onboarding_fee_cent,selected_tier_key,offered_by,offer)');
  ddl:=replace(ddl,'VALUES(m,c,p_actor,jsonb_build_object','VALUES(m,round(t.s_tier_onboarding_fee::numeric*100)::bigint,t.s_tier_key,p_actor,jsonb_build_object');
  ddl:=replace(ddl,'''contract_id'',c,','');EXECUTE ddl;
 END IF;
 IF to_regprocedure('public.provision_inquiry_mall(bigint,bigint,uuid,bigint,jsonb)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.provision_inquiry_mall(bigint,bigint,uuid,bigint,jsonb)'::regprocedure) INTO ddl;
  ddl:=replace(ddl,'INSERT INTO public.mall_admin_account(admin_id) VALUES(a);','INSERT INTO public.mall_admin_account(admin_id) VALUES(a) ON CONFLICT(admin_id) DO NOTHING;');
  EXECUTE ddl;
 END IF;
 -- The modern preparer can see an active subscription while accepting a
 -- one-time onboarding payment. It must still store only mall ownership.
 SELECT pg_get_functiondef('public.prepare_subscription_payment(bigint,bigint,text,text,boolean)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'VALUES(c.contract_id,p_mall,q.quote_id,p_fee,','VALUES(CASE WHEN p_fee=''onboarding'' THEN NULL ELSE c.contract_id END,p_mall,q.quote_id,p_fee,');
 EXECUTE ddl;
END $$;

CREATE OR REPLACE FUNCTION app_private.activate_verified_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.pricing_model='v3' THEN RETURN NEW;END IF;
 IF NEW.paid_at IS NULL OR NOT EXISTS(SELECT 1 FROM public.mall_payment_checkout pc WHERE pc.request_id=NEW.request_id AND pc.payment_id=NEW.payment_reference AND pc.confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'A registered verified checkout is required.';
 END IF;
 -- Onboarding settlement must never create, start or edit a subscription.
 IF NEW.fee_type='onboarding' THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contract WHERE contract_id=NEW.contract_id AND contract_start IS NOT NULL AND contract_end IS NOT NULL) THEN
  RAISE EXCEPTION 'Use subscription checkout after AR approval.';
 END IF;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
