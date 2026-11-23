-- Subscription lifecycle and delivery history. Backend-only entry points.
ALTER TABLE public.mall ADD COLUMN IF NOT EXISTS initial_tier_key text CHECK (initial_tier_key IN ('basic','standard','premium'));
ALTER TABLE public.mall ADD COLUMN IF NOT EXISTS is_subscription_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.onboarding_quote ALTER COLUMN inquiry_id DROP NOT NULL;
ALTER TABLE public.onboarding_quote ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_log ALTER COLUMN email_log_sent_at DROP NOT NULL;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_sender text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_provider_id text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_source_type text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_source_id text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_attempt_of bigint REFERENCES public.email_log;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_log_claimed_at timestamptz;
ALTER TABLE public.suspension ADD COLUMN IF NOT EXISTS suspension_created_by bigint REFERENCES public.admin;
ALTER TABLE public.suspension ADD COLUMN IF NOT EXISTS suspension_resolution text;
ALTER TABLE public.suspension ADD COLUMN IF NOT EXISTS affected_ar_ids bigint[] NOT NULL DEFAULT '{}';
-- notif_recipient belongs to a mobile app_user, not an admin account.
ALTER TABLE public.notification ADD COLUMN IF NOT EXISTS notif_admin_recipient bigint REFERENCES public.admin;
CREATE UNIQUE INDEX IF NOT EXISTS suspension_one_open_per_contract ON public.suspension(contract_id) WHERE suspension_lifted_at IS NULL;
CREATE TABLE IF NOT EXISTS public.subscription_event (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  mall_id bigint NOT NULL REFERENCES public.mall,
  kind text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_event FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.subscription_event TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.subscription_event_event_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.emit_subscription_event(p_key text,p_mall bigint,p_kind text,p_title text,p_message text,p_email boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE event bigint; recipient public.admin;
BEGIN
 INSERT INTO public.subscription_event(event_key,mall_id,kind,title,message) VALUES(p_key,p_mall,p_kind,p_title,p_message)
 ON CONFLICT(event_key) DO NOTHING RETURNING event_id INTO event;
 IF event IS NULL THEN RETURN; END IF;
 FOR recipient IN SELECT * FROM public.admin WHERE NOT admin_is_deactivated AND admin_account_status='official'
 AND (admin_role='super_admin' OR (admin_role='mall_admin' AND mall_id=p_mall)) LOOP
  INSERT INTO public.admin_notification(admin_notif_type,admin_notif_title,admin_notif_message,admin_notif_action_url,admin_notif_action_label,
   admin_notif_source_type,admin_notif_source_id,admin_notif_source_label,admin_notif_is_read,admin_notif_is_archived,admin_notif_created_at,admin_id,mall_id)
  VALUES('subscription',p_title,p_message,CASE WHEN recipient.admin_role='super_admin' THEN '/subscription-management' ELSE '/subscription' END,
   'View subscription','subscription',event,'Subscription',false,false,now(),recipient.admin_id,p_mall);
  IF recipient.admin_role='mall_admin' THEN
   INSERT INTO public.notification(notif_type,notif_title,notif_message,notif_action_url,notif_action_label,notif_is_read,notif_is_archived,notif_created_at,notif_target_role,mall_id,notif_admin_recipient)
   VALUES('subscription',p_title,p_message,'/subscription','View subscription',false,false,now(),'mall_admin',p_mall,recipient.admin_id);
   IF p_email THEN
    INSERT INTO public.email_log(email_log_type,email_log_to_email,email_log_subject,email_log_body,email_log_status,email_log_sent_at,mall_id,email_log_source_type,email_log_source_id)
    VALUES('subscription_'||p_kind,recipient.admin_email,p_title,p_message,'queued',NULL,p_mall,'subscription',event::text);
   END IF;
  END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.manage_subscription_suspension(p_mall bigint,p_actor bigint,p_action text,p_reason text DEFAULT NULL,p_notes text DEFAULT '',p_penalty numeric DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.contract;s public.suspension;ids bigint[]; sid bigint;
BEGIN
 IF p_actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND NOT admin_is_deactivated AND admin_account_status='official') THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_actor IS NULL AND (p_action<>'suspend' OR p_reason<>'Non-Payment') THEN RAISE EXCEPTION 'Actor required'; END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contract WHERE mall_id=p_mall AND contract_is_current FOR UPDATE;
 SELECT * INTO s FROM public.suspension WHERE contract_id=c.contract_id AND suspension_lifted_at IS NULL FOR UPDATE;
 IF p_action='suspend' THEN
  IF s.suspension_id IS NOT NULL THEN RETURN to_jsonb(s); END IF;
  IF c.contract_start IS NULL THEN RAISE EXCEPTION 'A subscription must start before suspension'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('Non-Payment','Operational','Breach of Contract','Other') OR p_penalty IS NULL OR p_penalty<0 THEN RAISE EXCEPTION 'Invalid suspension'; END IF;
  IF p_reason IN ('Breach of Contract','Other') AND length(trim(p_notes))=0 THEN RAISE EXCEPTION 'Explain the suspension'; END IF;
  IF p_reason='Non-Payment' AND (c.contract_end AT TIME ZONE 'Asia/Manila')::date+c.contract_grace_period_days >= (now() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'The grace period has not ended'; END IF;
  SELECT array_agg(d.ar_development_id) INTO ids FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall AND d.ar_development_status='live';
  INSERT INTO public.suspension(suspension_reason,suspension_penalty_amount,suspension_notes,suspension_suspended_at,contract_id,suspension_created_by,affected_ar_ids)
   VALUES(p_reason,p_penalty,p_notes,now(),c.contract_id,p_actor,COALESCE(ids,'{}')) RETURNING suspension_id INTO sid;
  UPDATE public.contract SET contract_status='Suspended',contract_updated_at=now() WHERE contract_id=c.contract_id;
  UPDATE public.ar_development SET ar_development_status='unpublished',ar_development_unpublish_reason='subscription:'||sid,ar_development_updated_at=now() WHERE ar_development_id=ANY(COALESCE(ids,'{}'));
  PERFORM public.emit_subscription_event('suspension:'||sid,p_mall,'suspended','Subscription suspended: '||p_reason,
   CASE WHEN p_reason='Operational' THEN 'AR is unpublished for an operational pause. Contact NavAR to restore it; the subscription clock continues.'
   ELSE 'AR is unpublished. Renew the annual subscription and settle the reinstatement fee'||CASE WHEN p_penalty>0 THEN ' and PHP '||p_penalty||' penalty' ELSE '' END||'. The next annual period starts the day after the previous expiry, not the payment date.' END||' '||p_notes);
  RETURN jsonb_build_object('id',sid);
 ELSIF p_action='lift' THEN
  IF s.suspension_id IS NULL THEN RAISE EXCEPTION 'No open suspension'; END IF;
  IF s.suspension_reason<>'Operational' THEN RAISE EXCEPTION 'Verified subscription, reinstatement and penalty payment is required'; END IF;
  IF (c.contract_end AT TIME ZONE 'Asia/Manila')::date+c.contract_grace_period_days < (now() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'Renewal and reinstatement payment is required'; END IF;
  UPDATE public.suspension SET suspension_lifted_at=now(),suspension_lifted_by=p_actor,suspension_resolution='Operational pause lifted; no fee' WHERE suspension_id=s.suspension_id;
  UPDATE public.contract SET contract_status=CASE WHEN contract_end<now() THEN 'Grace Period' ELSE 'active' END,contract_updated_at=now() WHERE contract_id=c.contract_id;
  UPDATE public.ar_development SET ar_development_status='live',ar_development_unpublish_reason=NULL,ar_development_updated_at=now()
   WHERE ar_development_id=ANY(s.affected_ar_ids) AND ar_development_unpublish_reason='subscription:'||s.suspension_id
   AND ar_development_mall_approved_at IS NOT NULL;
  PERFORM public.emit_subscription_event('lift:'||s.suspension_id,p_mall,'restored','Subscription suspension lifted','The operational suspension has been lifted. Your subscription dates are unchanged.');
  RETURN jsonb_build_object('restored',true);
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
END $$;

-- Unit membership determines store-entrance labels. Preserve historical published versions.
CREATE OR REPLACE FUNCTION public.sync_store_node_label() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE label text;
BEGIN
 IF NEW.store_id IS NOT NULL THEN
  SELECT store_name INTO label FROM public.store WHERE store_id=NEW.store_id;
  UPDATE public.node n SET node_label=label,store_id=NEW.store_id,node_updated_at=now()
   FROM public.ar_development d WHERE n.ar_development_id=d.ar_development_id AND n.unit_id=NEW.unit_id AND n.node_type='STORE_ENTRANCE'
   AND d.ar_development_status <> 'unpublished';
  UPDATE public.ar_development d SET ar_development_map_revision=ar_development_map_revision+1
   WHERE d.ar_development_id IN (SELECT ar_development_id FROM public.node WHERE unit_id=NEW.unit_id AND node_type='STORE_ENTRANCE')
   AND d.ar_development_status <> 'unpublished';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_store_node_label ON public.unit;
CREATE TRIGGER sync_store_node_label AFTER UPDATE OF store_id ON public.unit FOR EACH ROW WHEN(NEW.store_id IS DISTINCT FROM OLD.store_id) EXECUTE FUNCTION public.sync_store_node_label();

CREATE OR REPLACE FUNCTION public.enforce_store_capacity_and_events() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE capacity integer; active_count integer;
BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=NEW.mall_id FOR UPDATE;
 IF NEW.store_type='store' AND lower(NEW.store_status)<>'inactive' AND (TG_OP='INSERT' OR lower(OLD.store_status)='inactive') THEN
  SELECT quoted_store_count INTO capacity FROM public.mall WHERE mall_id=NEW.mall_id;
  IF capacity IS NULL AND EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=NEW.mall_id AND d.ar_development_status IN ('live','unpublished')) THEN RAISE EXCEPTION 'Complete the contracted store capacity before adding another store'; END IF;
  SELECT count(*) INTO active_count FROM public.store WHERE mall_id=NEW.mall_id AND store_type='store' AND lower(store_status)<>'inactive' AND store_id<>NEW.store_id;
  IF capacity IS NOT NULL AND active_count>=capacity THEN RAISE EXCEPTION 'Store capacity reached. Deactivate a former tenant and reuse its slot, or request an expansion quote.'; END IF;
 END IF;
 IF NEW.store_type='stall' AND (TG_OP='INSERT' OR NEW.store_status IS DISTINCT FROM OLD.store_status) THEN
  PERFORM public.emit_subscription_event('stall:'||NEW.store_id||':'||NEW.store_updated_at,NEW.mall_id,'stall_changed','Stall '||CASE WHEN lower(NEW.store_status)='inactive' THEN 'deactivated' ELSE 'added or updated' END,
   NEW.store_name||' was '||CASE WHEN lower(NEW.store_status)='inactive' THEN 'deactivated' ELSE 'added or updated' END||'. Review its application, allowance and any fee before approval.',false);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_store_capacity_and_events ON public.store;
CREATE TRIGGER enforce_store_capacity_and_events AFTER INSERT OR UPDATE OF store_status ON public.store FOR EACH ROW EXECUTE FUNCTION public.enforce_store_capacity_and_events();

-- Service RPC for a legacy mall's explicit TEST quote; no paid status is fabricated.
CREATE OR REPLACE FUNCTION public.prepare_subscription_test_mall(p_mall bigint,p_actor bigint,p_inputs jsonb,p_estimate jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE q bigint; f jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Access denied'; END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=p_mall FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.contract WHERE mall_id=p_mall AND contract_start IS NOT NULL) THEN RAISE EXCEPTION 'Test preparation is limited to malls without a started subscription'; END IF;
 IF EXISTS(SELECT 1 FROM public.mall_onboarding WHERE mall_id=p_mall AND quote_id IS NOT NULL) THEN RAISE EXCEPTION 'A quote already exists. Keep its snapshot and use the quote revision workflow.'; END IF;
 IF EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=p_mall AND d.ar_development_status IN ('live','unpublished')) THEN RAISE EXCEPTION 'Do not convert a published mall into a test fixture'; END IF;
 UPDATE public.mall SET is_subscription_test=true,quoted_store_count=(p_inputs->>'stores')::integer,quoted_tenant_count=(p_inputs->>'tenants')::integer WHERE mall_id=p_mall;
 UPDATE public.contract SET contract_is_current=false,contract_status='superseded',contract_notes=COALESCE(contract_notes,'')||' Legacy provisional contract retained; replaced by explicit test quote.' WHERE mall_id=p_mall AND contract_start IS NULL;
 INSERT INTO public.onboarding_quote(inquiry_id,revision,mall_id,status,raw_inputs,breakdown,rate_version,amount_cent,capacity,requires_review,review_acknowledged_by,created_by,finalized_by,finalized_at,is_test)
 VALUES(NULL,1,p_mall,'finalized',p_inputs,p_estimate,p_estimate->>'rateVersion',(p_estimate->>'amountCent')::bigint,p_estimate->'capacity',(p_estimate->>'requiresReview')::boolean,p_actor,p_actor,p_actor,now(),true) RETURNING quote_id INTO q;
 FOR f IN SELECT value FROM jsonb_array_elements(p_inputs->'floors') LOOP
  INSERT INTO public.onboarding_quote_floor VALUES(q,(f->>'floorNum')::integer,(f->>'areaSqm')::numeric,COALESCE((f->>'hallwaySqm')::numeric,(f->>'areaSqm')::numeric*0.3),COALESCE((f->>'connectors')::integer,4),f->>'hallwaySqm' IS NULL,f->>'connectors' IS NULL);
 END LOOP;
 INSERT INTO public.mall_onboarding(mall_id,quote_id,pricing_model,profile_completed_at,completed_at,legacy_approved,offer)
 VALUES(p_mall,q,'v3',now(),NULL,true,jsonb_build_object('testOnly',true,'quote',p_estimate,'note','Synthetic quote inputs for subscription testing; onboarding payment has not been recorded.'))
 ON CONFLICT(mall_id) DO UPDATE SET quote_id=q,pricing_model='v3',contract_id=NULL,profile_completed_at=now(),completed_at=NULL,offer=EXCLUDED.offer;
 RETURN q;
END $$;

-- Keep the established payment flow but correct its reinstatement anchor.
DO $$ DECLARE ddl text; BEGIN
 SELECT pg_get_functiondef('app_private.prepare_v3_payment_before_cancellation(text,text)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'''start'',CASE WHEN p_fee=''reinstatement'' THEN now() ELSE c.contract_end END',
  '''start'',((c.contract_end AT TIME ZONE ''Asia/Manila'')::date+1)::timestamp AT TIME ZONE ''Asia/Manila''');
 ddl:=replace(ddl,'OR lower(c.contract_status) IN (''suspended'',''terminated'',''cancelled'')','OR lower(c.contract_status) IN (''terminated'',''cancelled'')');
 EXECUTE ddl;
 SELECT pg_get_functiondef('public.fulfill_v3_payment(bigint)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'CASE WHEN r.fee_type=''reinstatement'' THEN GREATEST((r.details->>''start'')::timestamptz,r.paid_at) ELSE (r.details->>''start'')::timestamptz END','(r.details->>''start'')::timestamptz');
 EXECUTE ddl;
END $$;

-- Entry points use service_role only; triggers execute with their caller's permissions.
REVOKE ALL ON FUNCTION public.emit_subscription_event(text,bigint,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.manage_subscription_suspension(bigint,bigint,text,text,text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.prepare_subscription_test_mall(bigint,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emit_subscription_event(text,bigint,text,text,text,boolean),public.manage_subscription_suspension(bigint,bigint,text,text,text,numeric),public.prepare_subscription_test_mall(bigint,bigint,jsonb,jsonb) TO service_role;
