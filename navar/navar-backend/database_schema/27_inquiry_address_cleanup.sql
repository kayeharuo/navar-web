-- Run in the shared Supabase project's SQL Editor after migration 24.
-- Public submissions currently save "<street>, Barangay <name>" in
-- inquiry_mall_address. A stored generated column exposes barangay without
-- changing that contract or losing addresses when an owner submits corrections.
BEGIN;

ALTER TABLE public.inquiry
  ADD COLUMN IF NOT EXISTS inquiry_mall_barangay text GENERATED ALWAYS AS (
    NULLIF(btrim(substring(inquiry_mall_address FROM '(?i)(?:^|,)[[:space:]]*Barangay[[:space:]]+([^,]+)')), '')
  ) STORED;

COMMENT ON COLUMN public.inquiry.inquiry_mall_barangay IS
  'Barangay extracted from the saved address; automatically updated on submission and correction. NULL when not recorded. Do not insert this generated field directly.';
COMMENT ON COLUMN public.inquiry.inquiry_mall_address IS
  'Submitted address, including Barangay when supplied. Retained intact for existing submission, correction and mall-provisioning flows.';

-- Never discard a populated path, including one added since the schema audit.
DO $$
DECLARE has_paths boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='inquiry'
               AND column_name='inquiry_mall_logo_path') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.inquiry WHERE inquiry_mall_logo_path IS NOT NULL)' INTO has_paths;
    IF has_paths THEN
      RAISE EXCEPTION 'inquiry_mall_logo_path contains data; migrate those paths before removing the column.';
    END IF;
    ALTER TABLE public.inquiry DROP COLUMN inquiry_mall_logo_path;
  END IF;
END $$;

-- Keep inquiry_mall_zip_code: submission, details, corrections and provisioning.
-- Keep inquiry_mall_logo and inquiry_contact_job_title: existing SQL routines
-- still reference them. Keep tokens, review fields and revision history too.
NOTIFY pgrst, 'reload schema';
COMMIT;
