ALTER TABLE public.mall
  ADD COLUMN IF NOT EXISTS mall_barangay text;

COMMENT ON COLUMN public.mall.mall_barangay IS
  'Barangay recorded for the mall address.';
