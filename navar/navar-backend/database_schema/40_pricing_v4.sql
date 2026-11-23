-- V4 draft pricing. Existing quote, payment and contract snapshots are untouched.
-- Legacy capacity/onboarding columns remain while older callers still read them.
ALTER TABLE public.subscription_tier
  ADD COLUMN IF NOT EXISTS s_tier_map_update_fee_per_floor numeric(12,2) NOT NULL DEFAULT 0 CHECK (s_tier_map_update_fee_per_floor >= 0),
  ADD COLUMN IF NOT EXISTS included_visits_per_year integer NOT NULL DEFAULT 0 CHECK (included_visits_per_year >= 0),
  ADD COLUMN IF NOT EXISTS free_stalls_per_year integer NOT NULL DEFAULT 0 CHECK (free_stalls_per_year >= 0);

UPDATE public.subscription_tier SET
  s_tier_annual_fee = CASE s_tier_key WHEN 'basic' THEN 25000 WHEN 'standard' THEN 33000 ELSE 47000 END,
  s_tier_grace_period_days = CASE s_tier_key WHEN 'basic' THEN 15 WHEN 'standard' THEN 30 ELSE 45 END,
  s_tier_reinstatement_rate = CASE s_tier_key WHEN 'basic' THEN 0.20 WHEN 'standard' THEN 0.15 ELSE 0.10 END,
  s_tier_max_admin_account = CASE s_tier_key WHEN 'basic' THEN 2 WHEN 'standard' THEN 4 ELSE 8 END,
  s_tier_included_onsite_visits = CASE s_tier_key WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 ELSE 4 END,
  included_visits_per_year = CASE s_tier_key WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 ELSE 4 END,
  s_tier_free_extra_stalls_per_year = CASE s_tier_key WHEN 'premium' THEN 10 ELSE 0 END,
  free_stalls_per_year = CASE s_tier_key WHEN 'premium' THEN 10 ELSE 0 END,
  s_tier_map_updates_per_year = CASE s_tier_key WHEN 'premium' THEN 1 ELSE 0 END,
  s_tier_extra_onsite_visit_fee = 2250,
  s_tier_beacon_replacement_fee = 800,
  s_tier_additional_stall_fee = CASE s_tier_key WHEN 'basic' THEN 1100 ELSE 1000 END,
  s_tier_map_update_fee_per_floor = CASE s_tier_key WHEN 'basic' THEN 28000 ELSE 25000 END,
  s_tier_map_update_pricing = CASE s_tier_key WHEN 'basic' THEN '₱28,000 per floor' WHEN 'standard' THEN '₱25,000 per floor' ELSE 'First update each year free (up to one floor), then ₱25,000 per floor' END,
  s_tier_analytics_level = CASE s_tier_key WHEN 'basic' THEN '30 days history' WHEN 'standard' THEN '12 months history' ELSE 'Full history' END,
  s_tier_analytics_tools = CASE s_tier_key WHEN 'basic' THEN 'Summary dashboard' WHEN 'standard' THEN 'CSV export and date filters' ELSE 'All chart tabs' END,
  s_tier_ar_priority = CASE s_tier_key WHEN 'basic' THEN 'Standard' WHEN 'standard' THEN 'Priority' ELSE 'Dedicated slot' END,
  s_tier_remote_response_sla = CASE s_tier_key WHEN 'basic' THEN 'Within 5 business days' WHEN 'standard' THEN 'Within 2 business days' ELSE 'Next business day' END,
  s_tier_onsite_dispatch_sla = CASE s_tier_key WHEN 'basic' THEN 'Within 6 business days' WHEN 'standard' THEN 'Within 4 business days' ELSE 'Within 48 hrs' END,
  s_tier_updated_at = now()
WHERE s_tier_key IN ('basic', 'standard', 'premium');

COMMENT ON COLUMN public.subscription_tier.s_tier_map_updates_per_year IS 'Free map updates per year, each covering up to one floor.';
COMMENT ON COLUMN public.subscription_tier.s_tier_map_update_fee_per_floor IS 'Fixed PHP price per updated floor after the free allowance.';
COMMENT ON COLUMN public.subscription_tier.s_tier_ar_priority IS 'Queue for paid map updates after launch; initial builds are first come, first served.';

CREATE TABLE IF NOT EXISTS public.navar_rate_card (
  version text PRIMARY KEY,
  rates jsonb NOT NULL,
  tiers jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.navar_rate_card ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.navar_rate_card FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.navar_rate_card TO service_role;

INSERT INTO public.navar_rate_card(version,rates,tiers) VALUES ('v4-draft-2026-11-20','{"version":"v4-draft-2026-11-20","beaconCost":740,"installCost":60,"mapping":4,"testing":1.5,"pairing":125,"training":5000,"travel":5000,"contingency":0.05,"margin":0.1,"spareRate":0.05,"rentCap":0.01,"extraVisit":2250,"defaultConnectors":4,"defaultHallwayRate":0.3,"hallwaySqmPerBeacon":60,"roundingIncrement":1000,"quoteExpiryDays":30,"suggestedTierStoreLimits":[60,200],"confirmedRates":["beaconCost"]}'::jsonb,'{"basic":{"key":"basic","label":"Basic","annual":25000,"graceDays":15,"reinstatementRate":0.2,"adminLimit":2,"historyDays":30,"analytics":"summary","queue":"Standard","visits":1,"freeStalls":0,"stallFee":1100,"freeMapUpdates":0,"mapUpdateFeePerFloor":28000,"beaconReplacementFee":800,"extraVisitFee":2250,"remoteResponse":"Within 5 business days","onsiteDispatch":"Within 6 business days"},"standard":{"key":"standard","label":"Standard","annual":33000,"graceDays":30,"reinstatementRate":0.15,"adminLimit":4,"historyDays":365,"analytics":"export","queue":"Priority","visits":2,"freeStalls":0,"stallFee":1000,"freeMapUpdates":0,"mapUpdateFeePerFloor":25000,"beaconReplacementFee":800,"extraVisitFee":2250,"remoteResponse":"Within 2 business days","onsiteDispatch":"Within 4 business days"},"premium":{"key":"premium","label":"Premium","annual":47000,"graceDays":45,"reinstatementRate":0.1,"adminLimit":8,"historyDays":null,"analytics":"full","queue":"Dedicated slot","visits":4,"freeStalls":10,"stallFee":1000,"freeMapUpdates":1,"mapUpdateFeePerFloor":25000,"beaconReplacementFee":800,"extraVisitFee":2250,"remoteResponse":"Next business day","onsiteDispatch":"Within 48 hrs"}}'::jsonb) ON CONFLICT(version) DO NOTHING;

-- A single RPC is a transaction: every tier saves or none do.
CREATE OR REPLACE FUNCTION public.save_system_subscription_tiers(p_updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb;
  row_data public.subscription_tier;
BEGIN
  IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Tier updates must be a list.'; END IF;
  IF jsonb_array_length(p_updates) <> 3 OR
    (SELECT count(DISTINCT value->>'s_tier_key') FROM jsonb_array_elements(p_updates) WHERE value->>'s_tier_key' IN ('basic','standard','premium')) <> 3
  THEN RAISE EXCEPTION 'Provide exactly the three subscription tiers.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_updates) ORDER BY value->>'s_tier_key' LOOP
    row_data := jsonb_populate_record(NULL::public.subscription_tier, item);
    IF row_data.s_tier_annual_fee IS NULL OR row_data.s_tier_annual_fee <= 0 OR
       row_data.s_tier_grace_period_days IS NULL OR row_data.s_tier_grace_period_days < 0 OR
       row_data.s_tier_reinstatement_rate IS NULL OR row_data.s_tier_reinstatement_rate NOT BETWEEN 0 AND 1 OR
       row_data.s_tier_max_admin_account IS NULL OR row_data.s_tier_max_admin_account < 1 OR
       row_data.s_tier_included_onsite_visits IS NULL OR row_data.s_tier_included_onsite_visits < 0 OR
       row_data.s_tier_free_extra_stalls_per_year IS NULL OR row_data.s_tier_free_extra_stalls_per_year < 0 OR
       row_data.s_tier_map_updates_per_year IS NULL OR row_data.s_tier_map_updates_per_year < 0 OR
       row_data.s_tier_extra_onsite_visit_fee IS NULL OR row_data.s_tier_extra_onsite_visit_fee < 0 OR
       row_data.s_tier_beacon_replacement_fee IS NULL OR row_data.s_tier_beacon_replacement_fee < 0 OR
       row_data.s_tier_additional_stall_fee IS NULL OR row_data.s_tier_additional_stall_fee < 0 OR
       row_data.s_tier_map_update_fee_per_floor IS NULL OR row_data.s_tier_map_update_fee_per_floor < 0
    THEN RAISE EXCEPTION 'Invalid tier pricing or allowances.'; END IF;
    UPDATE public.subscription_tier SET
      s_tier_annual_fee = row_data.s_tier_annual_fee,
      s_tier_grace_period_days = row_data.s_tier_grace_period_days,
      s_tier_reinstatement_rate = row_data.s_tier_reinstatement_rate,
      s_tier_max_admin_account = row_data.s_tier_max_admin_account,
      s_tier_analytics_level = row_data.s_tier_analytics_level,
      s_tier_analytics_tools = row_data.s_tier_analytics_tools,
      s_tier_ar_priority = row_data.s_tier_ar_priority,
      s_tier_remote_response_sla = row_data.s_tier_remote_response_sla,
      s_tier_onsite_dispatch_sla = row_data.s_tier_onsite_dispatch_sla,
      s_tier_included_onsite_visits = row_data.s_tier_included_onsite_visits,
      included_visits_per_year = row_data.s_tier_included_onsite_visits,
      s_tier_free_extra_stalls_per_year = row_data.s_tier_free_extra_stalls_per_year,
      free_stalls_per_year = row_data.s_tier_free_extra_stalls_per_year,
      s_tier_map_updates_per_year = row_data.s_tier_map_updates_per_year,
      s_tier_extra_onsite_visit_fee = row_data.s_tier_extra_onsite_visit_fee,
      s_tier_beacon_replacement_fee = row_data.s_tier_beacon_replacement_fee,
      s_tier_additional_stall_fee = row_data.s_tier_additional_stall_fee,
      s_tier_map_update_fee_per_floor = row_data.s_tier_map_update_fee_per_floor,
      s_tier_map_update_pricing = row_data.s_tier_map_update_pricing,
      s_tier_updated_at = now()
    WHERE s_tier_key = row_data.s_tier_key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription tier is missing.'; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_system_subscription_tiers(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_system_subscription_tiers(jsonb) TO service_role;
