BEGIN;
CREATE FUNCTION app_private.mall_establishment_capacity(p_mall bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH basis AS (
  SELECT m.mall_id,q.quote_id,q.raw_inputs->'floors' quote_floors,
   coalesce((q.capacity->>'stores')::integer,m.quoted_store_count) stores,
   coalesce((q.capacity->>'tenants')::integer,m.quoted_tenant_count) tenants
  FROM public.mall m LEFT JOIN public.mall_onboarding o USING(mall_id) LEFT JOIN public.onboarding_quote q ON q.quote_id=o.quote_id WHERE m.mall_id=p_mall
 ), extra AS (
  SELECT coalesce(sum((s.inputs->>'quantity')::integer),0)::integer slots
  FROM public.mall_service_request s JOIN public.stall_expansion e ON e.service_id=s.service_id
  WHERE s.mall_id=p_mall AND s.kind='stall_addon' AND e.status IN ('approved','completed') AND s.status IN ('in_progress','completed')
   AND (((s.quote->>'amount_cent')::bigint=0 AND s.payment_request_id IS NULL) OR EXISTS(SELECT 1 FROM public.contract_payment_request r WHERE r.request_id=s.payment_request_id AND r.status='paid' AND r.fulfilled_at IS NOT NULL AND r.reconciliation_reason IS NULL AND r.amount_cent=(s.quote->>'amount_cent')::bigint))
 ) SELECT jsonb_build_object('storeCount',stores,'tenantCount',tenants,'quoteId',quote_id,'quoteFloors',quote_floors,'approvedExtraStalls',slots,'totalCapacity',stores+slots) FROM basis CROSS JOIN extra;
$$;
CREATE FUNCTION public.mall_capacity_state(p_mall bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT app_private.mall_establishment_capacity(p_mall)$$;
REVOKE ALL ON FUNCTION app_private.mall_establishment_capacity(bigint),public.mall_capacity_state(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mall_capacity_state(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_store_capacity_and_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE capacity integer; active_count integer;
BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=NEW.mall_id FOR UPDATE;
 IF coalesce(lower(NEW.store_status),'unmapped')<>'inactive' AND
  (TG_OP='INSERT' OR coalesce(lower(OLD.store_status),'unmapped')='inactive' OR OLD.mall_id IS DISTINCT FROM NEW.mall_id) THEN
  capacity:=(app_private.mall_establishment_capacity(NEW.mall_id)->>'totalCapacity')::integer;
  IF capacity IS NULL THEN RAISE EXCEPTION 'Set the mall onboarding store capacity before adding stores or stalls.';END IF;
  SELECT count(*) INTO active_count FROM public.store WHERE mall_id=NEW.mall_id AND coalesce(lower(store_status),'unmapped')<>'inactive' AND store_id<>NEW.store_id;
  IF active_count>=capacity THEN RAISE EXCEPTION 'Store capacity reached (% total stores and stalls). Deactivate an existing establishment or approve additional capacity first.',capacity;END IF;
 END IF;
 IF NEW.store_type='stall' AND (TG_OP='INSERT' OR NEW.store_status IS DISTINCT FROM OLD.store_status) THEN
  PERFORM public.emit_subscription_event('stall:'||NEW.store_id||':'||NEW.store_updated_at,NEW.mall_id,'stall_changed','Stall '||CASE WHEN lower(NEW.store_status)='inactive' THEN 'deactivated' ELSE 'added or updated' END,
   NEW.store_name||' was '||CASE WHEN lower(NEW.store_status)='inactive' THEN 'deactivated' ELSE 'added or updated' END||'. Review its application, allowance and any fee before approval.',false);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_store_capacity_and_events ON public.store;
CREATE TRIGGER enforce_store_capacity_and_events AFTER INSERT OR UPDATE OF store_status,store_type,mall_id ON public.store FOR EACH ROW EXECUTE FUNCTION public.enforce_store_capacity_and_events();
REVOKE ALL ON FUNCTION public.enforce_store_capacity_and_events() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
