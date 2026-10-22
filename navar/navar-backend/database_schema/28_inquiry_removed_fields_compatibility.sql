-- Keep/restore job title; remove only unused mall logo columns. Run in Supabase SQL Editor.
BEGIN;
ALTER TABLE public.inquiry ADD COLUMN IF NOT EXISTS inquiry_contact_job_title varchar(100);
DO $$
DECLARE routine record; definition text;
BEGIN
 FOR routine IN
  SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN
   ('provision_inquiry_mall','manage_super_admin_inquiry',
    'review_super_admin_inquiry','review_super_admin_inquiry_before_followup')
 LOOP
  definition:=pg_get_functiondef(routine.oid);
  -- Repair the previous migration's replacement in the owner-account INSERT.
  IF position('provision_inquiry_mall' in definition)>0 THEN
   definition:=regexp_replace(definition,'NULL::text([[:space:]]*,[[:space:]]*true[[:space:]]*,[[:space:]]*false)', 'i.inquiry_contact_job_title\1','gi');
  END IF;
  definition:=replace(definition,'i.inquiry_mall_logo','NULL::bytea');
  EXECUTE definition;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.submit_public_inquiry(p_data jsonb, p_token text, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing public.inquiry%ROWTYPE;
  tier_key text := NULLIF(p_data->>'tierKey','');
BEGIN
  IF p_token !~ '^[a-f0-9]{64}$' OR p_token IS NULL OR p_status IS NULL OR length(p_status) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Invalid submission';
  END IF;
  -- Transaction-scoped lock makes simultaneous retries safe across backend instances.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_token, 0));
  SELECT * INTO existing FROM public.inquiry WHERE inquiry_email_token = p_token LIMIT 1;
  IF FOUND THEN
    IF lower(existing.inquiry_contact_email) <> lower(p_data->>'email')
       OR existing.inquiry_mall_name <> p_data->>'mallName' THEN
      RAISE EXCEPTION 'Request reference already used';
    END IF;
    RETURN;
  END IF;
  IF tier_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subscription_tier WHERE s_tier_key = tier_key
  ) THEN RAISE EXCEPTION 'Selected tier no longer exists'; END IF;
  INSERT INTO public.inquiry (
    inquiry_email_token,inquiry_mall_name,inquiry_mall_state,inquiry_mall_city,
    inquiry_mall_zip_code,inquiry_mall_address,inquiry_mall_floor_count,
    inquiry_mall_description,inquiry_contact_person,inquiry_contact_num,inquiry_contact_email,
    inquiry_contact_job_title,inquiry_interested_tier,inquiry_status,
    inquiry_created_at,inquiry_updated_at,mall_id,inquiry_coverage_area
  ) VALUES (
    p_token,p_data->>'mallName',p_data->>'province',p_data->>'city',
    p_data->>'zipCode',p_data->>'address',(p_data->>'floorCount')::integer,
    p_data->>'description',p_data->>'contactName',p_data->>'phone',lower(p_data->>'email'),
    p_data->>'jobTitle',tier_key,p_status,now(),now(),NULL,p_data->>'coverageArea'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_inquiry(jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_inquiry(jsonb,text,text) TO service_role;
-- Stop rather than silently discard a newly populated logo.
DO $$
DECLARE logo_column text; populated boolean;
BEGIN
 FOREACH logo_column IN ARRAY ARRAY['inquiry_mall_logo','inquiry_mall_logo_path'] LOOP
  IF EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='inquiry' AND c.column_name=logo_column) THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.inquiry WHERE %I IS NOT NULL)',logo_column) INTO populated;
   IF populated THEN RAISE EXCEPTION 'Column % contains logo data; migrate it before removing.',logo_column; END IF;
   EXECUTE format('ALTER TABLE public.inquiry DROP COLUMN %I',logo_column);
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
