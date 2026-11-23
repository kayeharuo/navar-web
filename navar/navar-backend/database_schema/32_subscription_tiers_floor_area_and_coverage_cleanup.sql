-- Fixed annual subscription tiers, onboarding agreement state, and per-floor area.
-- Tier capacity columns remain temporarily for older onboarding RPC compatibility,
-- but their limits are no longer enforced and are set to effectively unlimited.

ALTER TABLE public.floor
  ADD COLUMN IF NOT EXISTS floor_area_sqm numeric(12,2);

ALTER TABLE public.floor
  DROP CONSTRAINT IF EXISTS floor_area_sqm_positive;

ALTER TABLE public.floor
  ADD CONSTRAINT floor_area_sqm_positive
  CHECK (floor_area_sqm IS NULL OR floor_area_sqm > 0);

DROP TRIGGER IF EXISTS enforce_mall_profile_floor_limit ON public.mall;
DROP TRIGGER IF EXISTS enforce_floor_row_limit ON public.floor;

-- Remove the retired mall coverage field from RPC bodies before dropping it.
DO $$
DECLARE
  function_ddl text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO function_ddl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'manage_super_admin_inquiry';
  IF function_ddl IS NOT NULL THEN
    function_ddl := replace(function_ddl,
      'mall_coverage_area=NULLIF(p_data->>''mallCoverageArea'',''''),mall_beacon_major=',
      'mall_beacon_major=');
    EXECUTE function_ddl;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO function_ddl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'provision_inquiry_mall_legacy';
  IF function_ddl IS NOT NULL THEN
    function_ddl := replace(function_ddl,
      'mall_name,mall_state,mall_city,mall_coverage_area,mall_created_at,mall_updated_at',
      'mall_name,mall_state,mall_city,mall_created_at,mall_updated_at');
    function_ddl := replace(function_ddl,
      'i.inquiry_mall_name,i.inquiry_mall_state,i.inquiry_mall_city,i.inquiry_coverage_area,now(),now()',
      'i.inquiry_mall_name,i.inquiry_mall_state,i.inquiry_mall_city,now(),now()');
    EXECUTE function_ddl;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO function_ddl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'save_my_onboarding_before_floor_confirmation';
  IF function_ddl IS NOT NULL THEN
    function_ddl := replace(function_ddl,
      ',mall_coverage_area=p_data->>''mall_coverage_area'',mall_updated_at=',
      ',mall_updated_at=');
    EXECUTE function_ddl;
  END IF;
END $$;

ALTER TABLE public.mall DROP CONSTRAINT IF EXISTS ck_mall_coverage_area;
ALTER TABLE public.mall DROP COLUMN IF EXISTS mall_coverage_area;

ALTER TABLE public.subscription_tier
  ADD COLUMN IF NOT EXISTS s_tier_analytics_tools text,
  ADD COLUMN IF NOT EXISTS s_tier_included_onsite_visits integer,
  ADD COLUMN IF NOT EXISTS s_tier_extra_onsite_visit_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS s_tier_beacon_replacement_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS s_tier_free_extra_stalls_per_year integer,
  ADD COLUMN IF NOT EXISTS s_tier_map_update_pricing text;

UPDATE public.subscription_tier
SET
  s_tier_annual_fee = CASE s_tier_key WHEN 'basic' THEN 25000 WHEN 'standard' THEN 33000 WHEN 'premium' THEN 47000 END,
  s_tier_max_floors = 2147483647,
  s_tier_max_gfa = 1.0e15,
  s_tier_included_tenant_count = 2147483647,
  s_tier_beacon_allocation = 2147483647,
  s_tier_map_updates_per_year = CASE s_tier_key WHEN 'premium' THEN 1 ELSE 0 END,
  s_tier_analytics_level = CASE s_tier_key WHEN 'basic' THEN '30 days history' WHEN 'standard' THEN '12 months history' WHEN 'premium' THEN 'Full history' END,
  s_tier_analytics_tools = CASE s_tier_key WHEN 'basic' THEN 'Summary dashboard' WHEN 'standard' THEN 'CSV export and date filters' WHEN 'premium' THEN 'All chart tabs' END,
  s_tier_ar_priority = CASE s_tier_key WHEN 'basic' THEN 'Standard' WHEN 'standard' THEN 'Priority' WHEN 'premium' THEN 'Dedicated slot' END,
  s_tier_included_onsite_visits = CASE s_tier_key WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 4 END,
  s_tier_extra_onsite_visit_fee = 2250,
  s_tier_beacon_replacement_fee = 940,
  s_tier_additional_stall_fee = CASE s_tier_key WHEN 'basic' THEN 1400 ELSE 1100 END,
  s_tier_free_extra_stalls_per_year = CASE s_tier_key WHEN 'premium' THEN 10 ELSE 0 END,
  s_tier_map_update_pricing = CASE s_tier_key WHEN 'basic' THEN '₱32,000 example price' WHEN 'standard' THEN '₱26,000 example price' WHEN 'premium' THEN 'First update each year free up to one floor, then ₱26,000 example price' END,
  s_tier_updated_at = now()
WHERE s_tier_key IN ('basic', 'standard', 'premium');

UPDATE public.contract
SET contract_status = 'Onboarding', contract_updated_at = now()
WHERE contract_is_current AND (contract_status IS NULL OR lower(contract_status) = 'pending');

COMMENT ON COLUMN public.floor.floor_area_sqm IS 'Total floor area in square metres used for onboarding estimates.';
COMMENT ON COLUMN public.subscription_tier.s_tier_max_floors IS 'Deprecated compatibility field; subscription tiers no longer limit floors.';
COMMENT ON COLUMN public.subscription_tier.s_tier_max_gfa IS 'Deprecated compatibility field; subscription tiers no longer limit mall area.';
COMMENT ON COLUMN public.subscription_tier.s_tier_included_tenant_count IS 'Deprecated compatibility field; subscription tiers no longer limit stores or tenants.';
COMMENT ON COLUMN public.subscription_tier.s_tier_beacon_allocation IS 'Deprecated compatibility field; subscription tiers no longer limit beacons.';
