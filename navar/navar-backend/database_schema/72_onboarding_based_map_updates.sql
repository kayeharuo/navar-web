BEGIN;
ALTER TABLE public.subscription_tier ADD COLUMN s_tier_map_update_rate numeric(5,4) CHECK(s_tier_map_update_rate>0 AND s_tier_map_update_rate<=1);
UPDATE public.subscription_tier SET s_tier_map_update_rate=CASE s_tier_key WHEN 'basic' THEN 0.50 WHEN 'standard' THEN 0.40 WHEN 'premium' THEN 0.30 END,
 s_tier_map_update_fee_per_floor=0,
 s_tier_map_update_pricing=CASE WHEN s_tier_map_updates_per_year>0 THEN 'First '||s_tier_map_updates_per_year||' update(s) each year free (up to one floor each), then ' ELSE '' END||
 CASE s_tier_key WHEN 'basic' THEN '50%' WHEN 'standard' THEN '40%' WHEN 'premium' THEN '30%' END||' of original onboarding cost per floor',s_tier_updated_at=now()
 WHERE s_tier_key IN ('basic','standard','premium');
COMMENT ON COLUMN public.subscription_tier.s_tier_map_update_rate IS 'Fraction of original onboarding amount divided by original onboarding floor count, per payable updated floor.';
COMMENT ON COLUMN public.subscription_tier.s_tier_map_update_fee_per_floor IS 'Deprecated fixed PHP rate. Zero for percentage pricing; use s_tier_map_update_rate.';

ALTER TABLE public.mall_onboarding ADD COLUMN onboarding_floor_count integer CHECK(onboarding_floor_count>0);
UPDATE public.mall_onboarding o SET onboarding_floor_count=coalesce(
 (SELECT nullif((q.capacity->>'floors')::integer,0) FROM public.onboarding_quote q WHERE q.quote_id=o.quote_id),
 (SELECT nullif((c.capacity_snapshot->>'floors')::integer,0) FROM public.contract c WHERE c.mall_id=o.mall_id ORDER BY c.contract_start,c.contract_id LIMIT 1),
 (SELECT nullif(count(DISTINCT p.floor_id),0)::integer FROM public.application_floor_plan p JOIN public.application a USING(application_id) WHERE a.mall_id=o.mall_id AND a.application_version=1))
 WHERE o.completed_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.contract_payment_request r WHERE r.mall_id=o.mall_id AND r.fee_type='onboarding' AND r.status='paid' AND r.reconciliation_reason IS NULL);
COMMENT ON COLUMN public.mall_onboarding.onboarding_floor_count IS 'Original onboarding floor count, frozen once recorded. Later floor additions do not dilute map-update pricing.';

CREATE FUNCTION app_private.capture_original_onboarding_floors() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.onboarding_floor_count IS NOT NULL THEN
  IF NEW.onboarding_floor_count IS DISTINCT FROM OLD.onboarding_floor_count THEN RAISE EXCEPTION 'Original onboarding floor count is immutable.';END IF;
  RETURN NEW;
 END IF;
 IF NEW.completed_at IS NOT NULL AND NEW.onboarding_floor_count IS NULL THEN
  SELECT nullif((capacity->>'floors')::integer,0) INTO NEW.onboarding_floor_count FROM public.onboarding_quote WHERE quote_id=NEW.quote_id;
  IF NEW.onboarding_floor_count IS NULL THEN
   SELECT nullif(count(DISTINCT p.floor_id),0)::integer INTO NEW.onboarding_floor_count FROM public.application_floor_plan p JOIN public.application a USING(application_id) WHERE a.mall_id=NEW.mall_id AND a.application_version=1;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_original_onboarding_floors BEFORE INSERT OR UPDATE ON public.mall_onboarding FOR EACH ROW EXECUTE FUNCTION app_private.capture_original_onboarding_floors();

CREATE OR REPLACE FUNCTION app_private.map_floor_pricing(p_mall bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH original AS (
  SELECT o.onboarding_floor_count floors,coalesce(r.amount_cent,CASE WHEN o.completed_at IS NOT NULL THEN o.onboarding_fee_cent END) cents,r.request_id
  FROM public.mall_onboarding o LEFT JOIN LATERAL (
   SELECT amount_cent,request_id FROM public.contract_payment_request WHERE mall_id=p_mall AND fee_type='onboarding' AND status='paid' AND reconciliation_reason IS NULL ORDER BY paid_at NULLS LAST,request_id LIMIT 1
  ) r ON true WHERE o.mall_id=p_mall
 ), plan AS (
  SELECT c.*,t.s_tier_key tier,t.s_tier_map_update_rate rate,t.s_tier_map_updates_per_year allowance
  FROM public.contract c JOIN public.subscription_tier t USING(s_tier_id) WHERE c.mall_id=p_mall AND c.contract_is_current
 )
 SELECT jsonb_build_object('onboarding_cent',cents,'original_floors',floors,'onboarding_request_id',request_id,'tier',tier,'rate',rate,'percent',rate*100,
  'unit_fee_cent',round(cents::numeric/floors*rate)::bigint,'unit_fee',round(cents::numeric/floors*rate)/100,'rate_version','map-floor-percentage',
  'single_floor_included',tier='premium' AND allowance>(SELECT coalesce(sum(allowance_units),0) FROM public.mall_service_request WHERE mall_id=p_mall AND kind='map_update' AND status<>'cancelled' AND allowance_start=coalesce(plan.allowance_start,plan.contract_start)))
 FROM original CROSS JOIN plan WHERE cents>0 AND floors>0 AND rate>0 AND rate<=1;
$$;

CREATE FUNCTION app_private.map_update_floor_quote(p_mall bigint,p_floors jsonb,p_exclude_service bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE basis jsonb; c public.contract; allowance integer; used integer; units integer; quantity integer;
BEGIN
 IF jsonb_typeof(p_floors) IS DISTINCT FROM 'array' OR jsonb_array_length(p_floors)<1 THEN RAISE EXCEPTION 'Choose at least one floor to remap.';END IF;
 quantity:=jsonb_array_length(p_floors);
 IF (SELECT count(DISTINCT value::bigint) FROM jsonb_array_elements_text(p_floors))<>quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_floors) x WHERE NOT EXISTS(SELECT 1 FROM public.floor WHERE floor_id=x.value::bigint AND mall_id=p_mall)) THEN RAISE EXCEPTION 'Choose distinct floors belonging to this mall.';END IF;
 basis:=app_private.map_floor_pricing(p_mall);
 IF basis IS NULL THEN RAISE EXCEPTION 'Confirm the original onboarding payment and floor count before quoting a map update.';END IF;
 SELECT * INTO STRICT c FROM public.contract WHERE mall_id=p_mall AND contract_is_current;
 SELECT s_tier_map_updates_per_year INTO allowance FROM public.subscription_tier WHERE s_tier_id=c.s_tier_id;
 SELECT coalesce(sum(allowance_units),0) INTO used FROM public.mall_service_request WHERE mall_id=p_mall AND kind='map_update' AND status<>'cancelled' AND allowance_start=coalesce(c.allowance_start,c.contract_start) AND (p_exclude_service IS NULL OR service_id<>p_exclude_service);
 -- Existing benefit: one included single-floor request, rather than a discount
 -- against a larger multi-floor request.
 units:=CASE WHEN basis->>'tier'='premium' AND quantity=1 AND used<allowance THEN 1 ELSE 0 END;
 RETURN basis||jsonb_build_object('contract_id',c.contract_id,'floorIds',p_floors,'allowance_units',units,'payable_floors',quantity-units,'amount_cent',(basis->>'unit_fee_cent')::bigint*(quantity-units));
END $$;

-- Update the existing version-intake workflow without changing its review,
-- payment verification, queue, or publication behavior.
DO $migration$
DECLARE definition text; needle text;
BEGIN
 SELECT pg_get_functiondef('app_private.workflow_before_review_history(bigint,bigint,text,text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'request_id_value bigint;','request_id_value bigint; calculated_quote jsonb;');
 needle:='fee:=CASE WHEN units=1 THEN 0 ELSE round(t.s_tier_map_update_fee_per_floor*100)::bigint*jsonb_array_length(s.inputs->''floorIds'') END;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected version-intake price calculation not found';END IF;
 definition:=replace(definition,needle,'calculated_quote:=app_private.map_update_floor_quote(s.mall_id,s.inputs->''floorIds'',s.service_id); units:=(calculated_quote->>''allowance_units'')::integer; fee:=(calculated_quote->>''amount_cent'')::bigint;');
 needle:='quote=jsonb_build_object(''amount_cent'',fee,''allowance_units'',units,''floorIds'',s.inputs->''floorIds'',''unit_fee'',t.s_tier_map_update_fee_per_floor,''contract_id'',c.contract_id,''tier'',t.s_tier_key)';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected version-intake quote snapshot not found';END IF;
 definition:=replace(definition,needle,'quote=calculated_quote');
 definition:=replace(definition,'jsonb_build_object(''service_id'',s.service_id,''application_id'',p_id,''actor_id'',s.created_by)','jsonb_build_object(''service_id'',s.service_id,''application_id'',p_id,''actor_id'',s.created_by,''pricing'',calculated_quote)');
 EXECUTE definition;

 SELECT pg_get_functiondef('public.map_application_portal(bigint,bigint,text,jsonb)'::regprocedure) INTO definition;
 needle:='''unitFee'',t.s_tier_map_update_fee_per_floor';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected portal price field not found';END IF;
 EXECUTE replace(definition,needle,'''unitFee'',(app_private.map_floor_pricing(p_mall)->>''unit_fee'')::numeric,''pricingBasis'',app_private.map_floor_pricing(p_mall)');

 -- The older service entry point must use the same authoritative calculation,
 -- regardless of client-supplied rate versions or quote amounts.
 SELECT pg_get_functiondef('app_private.manage_v3_service_before_stall_expansion(bigint,bigint,text,jsonb,boolean)'::regprocedure) INTO definition;
 IF strpos(definition,'s.inputs->>''rate_version''=''map-floor-percentage''')>0 THEN
  definition:=regexp_replace(definition,'IF s.kind=''map_update'' AND s.inputs->>''rate_version''=''map-floor-percentage'' THEN.*?ELSIF s.inputs->>''rate_version''=',
   'IF s.kind=''map_update'' THEN p_quote:=app_private.map_update_floor_quote(s.mall_id,s.inputs->''floorIds'',s.service_id); ELSIF s.inputs->>''rate_version''=','s');
 ELSE
  needle:='IF s.inputs->>''rate_version''=''v4.1-draft-2026-11-21'' THEN';
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected legacy service pricing branch not found';END IF;
  definition:=replace(definition,needle,'IF s.kind=''map_update'' THEN p_quote:=app_private.map_update_floor_quote(s.mall_id,s.inputs->''floorIds'',s.service_id); ELS'||needle);
 END IF;
 EXECUTE definition;

 SELECT pg_get_functiondef('public.save_system_subscription_tiers(jsonb)'::regprocedure) INTO definition;
 needle:='row_data.s_tier_map_update_fee_per_floor IS NULL OR row_data.s_tier_map_update_fee_per_floor < 0';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected tier price validation not found';END IF;
 definition:=replace(definition,needle,'row_data.s_tier_map_update_rate IS NULL OR row_data.s_tier_map_update_rate <= 0 OR row_data.s_tier_map_update_rate > 1');
 definition:=replace(definition,'s_tier_map_update_fee_per_floor = row_data.s_tier_map_update_fee_per_floor,','s_tier_map_update_fee_per_floor = 0, s_tier_map_update_rate = row_data.s_tier_map_update_rate,');
 definition:=replace(definition,'s_tier_map_update_pricing = row_data.s_tier_map_update_pricing,','s_tier_map_update_pricing = CASE WHEN row_data.s_tier_map_updates_per_year>0 THEN ''First ''||row_data.s_tier_map_updates_per_year||'' update(s) each year free (up to one floor each), then '' ELSE '''' END||rtrim(rtrim(to_char(row_data.s_tier_map_update_rate*100,''FM990.00''),''0''),''.'')||''% of original onboarding cost per floor'',');
 EXECUTE definition;
END $migration$;

-- Preserve previous cards and publish a revised reference card for new estimates.
WITH active AS (SELECT * FROM public.navar_rate_card WHERE is_current), retired AS (
 UPDATE public.navar_rate_card SET is_current=false WHERE is_current RETURNING version
)
INSERT INTO public.navar_rate_card(version,rates,tiers,is_current)
 SELECT 'map-floor-percentage-2026-11-23',jsonb_set(active.rates,'{version}','"map-floor-percentage-2026-11-23"'),
 (SELECT jsonb_object_agg(key,(value-'mapUpdateFeePerFloor')||jsonb_build_object('mapUpdateRate',t.s_tier_map_update_rate,'mapUpdatePricing',t.s_tier_map_update_pricing)) FROM jsonb_each(active.tiers) JOIN public.subscription_tier t ON t.s_tier_key=key),true
 FROM active CROSS JOIN (SELECT count(*) FROM retired) committed;

REVOKE ALL ON FUNCTION app_private.capture_original_onboarding_floors(),app_private.map_floor_pricing(bigint),app_private.map_update_floor_quote(bigint,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.map_floor_pricing(bigint),app_private.map_update_floor_quote(bigint,jsonb,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
