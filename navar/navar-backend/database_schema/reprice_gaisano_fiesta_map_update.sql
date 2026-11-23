BEGIN;
-- This owner-only correction is explicitly requested for the existing manual
-- map-update payment. Keep the immutable-payment guard enabled for normal use.
-- The exclusive lock prevents any concurrent payment write during the repair.
LOCK TABLE public.contract_payment_request IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.contract_payment_request DISABLE TRIGGER freeze_payment_amount;
DO $correction$
DECLARE target bigint; s public.mall_service_request; p public.contract_payment_request; receipt app_private.map_manual_payment_receipt; calculated jsonb; before_record jsonb; actor bigint;
BEGIN
 SELECT mall_id INTO STRICT target FROM public.mall WHERE lower(mall_name)='gaisano fiesta mall';
 PERFORM 1 FROM public.mall WHERE mall_id=target FOR UPDATE;
 SELECT sr.* INTO STRICT s FROM public.mall_service_request sr JOIN public.contract_payment_request pr ON pr.request_id=sr.payment_request_id JOIN public.application a ON a.application_id=sr.application_id
 WHERE sr.mall_id=target AND sr.kind='map_update' AND sr.status<>'cancelled' AND pr.status='paid' AND a.application_version>1
 ORDER BY a.application_version DESC,a.application_attempt DESC,sr.service_id DESC LIMIT 1 FOR UPDATE OF sr;
 SELECT * INTO STRICT p FROM public.contract_payment_request WHERE request_id=s.payment_request_id;
 SELECT * INTO STRICT receipt FROM app_private.map_manual_payment_receipt WHERE request_id=p.request_id;
 IF p.mall_id<>target OR receipt.mall_id<>target OR p.fee_type<>'map_update' OR p.paymongo_payment_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.mall_payment_checkout WHERE request_id=p.request_id) OR p.payment_reference NOT LIKE 'manual_map:%' OR p.fulfilled_at IS NULL OR p.reconciliation_reason IS NOT NULL THEN RAISE EXCEPTION 'Only the matching fulfilled manual map-update payment may be corrected.';END IF;
 calculated:=app_private.map_update_floor_quote(target,s.inputs->'floorIds',s.service_id);
 IF (calculated->>'contract_id')::bigint<>s.contract_id OR (calculated->>'amount_cent')::bigint<=0 THEN RAISE EXCEPTION 'Subscription or payable amount changed; review the correction.';END IF;
 IF s.quote->>'rate_version'='map-floor-percentage' AND (s.quote->>'amount_cent')::bigint=(calculated->>'amount_cent')::bigint AND p.amount_cent=(calculated->>'amount_cent')::bigint AND receipt.amount_cent=p.amount_cent THEN RETURN;END IF;
 before_record:=jsonb_build_object('service',to_jsonb(s),'payment_request',to_jsonb(p),'manual_receipt',to_jsonb(receipt));
 UPDATE public.mall_service_request SET quote=coalesce(quote,'{}')||calculated WHERE service_id=s.service_id;
 UPDATE public.contract_payment_request SET amount_cent=(calculated->>'amount_cent')::bigint,
  details=coalesce(details,'{}')||jsonb_build_object('pricing',calculated,'pricing_adjustment',jsonb_build_object('reason','User-requested onboarding-based map update pricing','previous_amount_cent',p.amount_cent,'adjusted_at',now())) WHERE request_id=p.request_id;
 UPDATE app_private.map_manual_payment_receipt SET amount_cent=(calculated->>'amount_cent')::bigint WHERE request_id=p.request_id;
 UPDATE public.payment SET payment_amount=(calculated->>'amount_cent')::numeric/100 WHERE payment_ref_num=p.payment_reference AND (mall_id=target OR contract_id=p.contract_id);
 actor:=receipt.actor_id;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id,audit_log_target_type,audit_log_target_id,audit_log_target_name,audit_log_metadata)
 VALUES('subscription_management','map_update_payment_repriced','Recalculated the manual map-update payment from original onboarding cost per floor using the subscription tier percentage.',now(),actor,target,'contract_payment_request',p.request_id::text,'Gaisano Fiesta Mall map update',jsonb_build_object('before',before_record,'after_pricing',calculated));
 IF NOT EXISTS(SELECT 1 FROM public.contract_payment_request r JOIN app_private.map_manual_payment_receipt m USING(request_id) JOIN public.mall_service_request service ON service.payment_request_id=r.request_id WHERE r.request_id=p.request_id AND r.amount_cent=m.amount_cent AND r.amount_cent=(service.quote->>'amount_cent')::bigint AND r.status='paid' AND r.fulfilled_at IS NOT NULL) THEN RAISE EXCEPTION 'Payment correction verification failed.';END IF;
END $correction$;
ALTER TABLE public.contract_payment_request ENABLE TRIGGER freeze_payment_amount;
COMMIT;
