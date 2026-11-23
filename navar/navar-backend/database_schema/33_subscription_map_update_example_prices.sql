UPDATE public.subscription_tier
SET
  s_tier_map_update_pricing = CASE s_tier_key
    WHEN 'basic' THEN '₱32,000 example price'
    WHEN 'standard' THEN '₱26,000 example price'
    WHEN 'premium' THEN 'First update each year free up to one floor, then ₱26,000 example price'
  END,
  s_tier_updated_at = now()
WHERE s_tier_key IN ('basic', 'standard', 'premium');
