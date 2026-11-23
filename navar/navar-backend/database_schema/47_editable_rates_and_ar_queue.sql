-- New estimates use the active card. Prior cards and finalized quote/contract snapshots remain intact.
ALTER TABLE public.navar_rate_card ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;
UPDATE public.navar_rate_card SET is_current=true WHERE version=(SELECT version FROM public.navar_rate_card ORDER BY created_at DESC,version DESC LIMIT 1)
 AND NOT EXISTS(SELECT 1 FROM public.navar_rate_card WHERE is_current);
CREATE UNIQUE INDEX IF NOT EXISTS navar_one_current_rate_card ON public.navar_rate_card(is_current) WHERE is_current;

CREATE OR REPLACE FUNCTION public.save_system_pricing(p_updates jsonb,p_rates jsonb,p_expected_version text,p_version text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE active public.navar_rate_card; key text; value numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('navar_current_pricing',0));
 SELECT * INTO STRICT active FROM public.navar_rate_card WHERE is_current FOR UPDATE;
 IF active.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Pricing changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_rates) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid onboarding rates'; END IF;
 FOREACH key IN ARRAY ARRAY['beaconCost','installCost','mapping','testing','pairing','training','travel','contingency','margin','spareRate','rentCap','extraVisit','defaultConnectors','defaultHallwayRate','hallwaySqmPerBeacon','roundingIncrement','quoteExpiryDays'] LOOP
  IF jsonb_typeof(p_rates->key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid rate: %',key; END IF;
  value := (p_rates->>key)::numeric;
  IF value<0 OR (key IN ('contingency','spareRate','rentCap','defaultHallwayRate') AND value>1)
   OR (key='margin' AND value>=1) OR (key IN ('hallwaySqmPerBeacon','roundingIncrement','quoteExpiryDays') AND value<=0)
   OR (key IN ('defaultConnectors','quoteExpiryDays') AND value<>trunc(value)) THEN RAISE EXCEPTION 'Invalid rate: %',key; END IF;
 END LOOP;
 IF jsonb_typeof(p_rates->'suggestedTierStoreLimits') IS DISTINCT FROM 'array' OR jsonb_array_length(p_rates->'suggestedTierStoreLimits')<>2 THEN RAISE EXCEPTION 'Invalid store limits'; END IF;
 FOR key IN SELECT jsonb_array_elements_text(p_rates->'suggestedTierStoreLimits') LOOP
  IF key::numeric<=0 OR key::numeric<>trunc(key::numeric) THEN RAISE EXCEPTION 'Invalid store limits'; END IF;
 END LOOP;
 IF (p_rates->'suggestedTierStoreLimits'->>0)::numeric >= (p_rates->'suggestedTierStoreLimits'->>1)::numeric THEN RAISE EXCEPTION 'Invalid store limits'; END IF;
 PERFORM public.save_system_subscription_tiers(p_updates);
 IF (active.rates-'version') IS DISTINCT FROM (p_rates-'version') THEN
  UPDATE public.navar_rate_card SET is_current=false WHERE version=active.version;
  INSERT INTO public.navar_rate_card(version,rates,tiers,is_current)
   VALUES(p_version,jsonb_set(p_rates,'{version}',to_jsonb(p_version)),active.tiers,true);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_system_pricing(jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_system_pricing(jsonb,jsonb,text,text) TO service_role;

ALTER TABLE public.application ADD COLUMN IF NOT EXISTS application_approved_at timestamptz;
CREATE OR REPLACE FUNCTION public.track_application_approval_time()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.application_status='approved' AND (TG_OP='INSERT' OR OLD.application_status IS DISTINCT FROM 'approved') THEN
  NEW.application_approved_at:=now();
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS application_approval_time ON public.application;
CREATE TRIGGER application_approval_time BEFORE INSERT OR UPDATE OF application_status ON public.application
 FOR EACH ROW EXECUTE FUNCTION public.track_application_approval_time();
REVOKE ALL ON FUNCTION public.track_application_approval_time() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.track_application_approval_time() TO service_role;
-- Original AR creation is the best available ordering fallback for older approved applications.
-- Do not manufacture an exact historical approval timestamp.

-- Quote floor snapshots use the same edited assumptions as the estimate.
DO $$ DECLARE ddl text; BEGIN
 IF to_regprocedure('public.prepare_subscription_test_mall(bigint,bigint,jsonb,jsonb)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.prepare_subscription_test_mall(bigint,bigint,jsonb,jsonb)'::regprocedure) INTO ddl;
  ddl:=replace(ddl,'(f->>''areaSqm'')::numeric*0.3','(f->>''areaSqm'')::numeric*COALESCE((p_estimate->''rateSnapshot''->>''defaultHallwayRate'')::numeric,0.3)');
  ddl:=replace(ddl,'COALESCE((f->>''connectors'')::integer,4)','COALESCE((f->>''connectors'')::integer,(p_estimate->''rateSnapshot''->>''defaultConnectors'')::integer,4)');
  ddl:=replace(ddl,'finalized_at,is_test)','finalized_at,is_test,expires_at)');
  ddl:=replace(ddl,'now(),true) RETURNING','now(),true,now()+make_interval(days=>COALESCE((p_estimate->''rateSnapshot''->>''quoteExpiryDays'')::integer,30))) RETURNING');
  EXECUTE ddl;
 END IF;
END $$;
