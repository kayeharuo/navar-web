BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('navar-images', 'navar-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE public.admin
  ADD COLUMN IF NOT EXISTS admin_profile_picture_path TEXT;

ALTER TABLE public.mall
  ADD COLUMN IF NOT EXISTS mall_logo_path TEXT;

ALTER TABLE public.brand
  ADD COLUMN IF NOT EXISTS brand_logo_path TEXT;

ALTER TABLE public.inquiry
  ADD COLUMN IF NOT EXISTS inquiry_mall_logo_path TEXT;

ALTER TABLE public.mall
  ADD COLUMN IF NOT EXISTS mall_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mall_longitude DOUBLE PRECISION;

COMMIT;