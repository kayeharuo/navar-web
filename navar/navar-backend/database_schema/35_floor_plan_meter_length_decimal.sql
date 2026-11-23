-- Preserve fractional real-world distances used to calibrate floor plans.
ALTER TABLE public.application_floor_plan
  ALTER COLUMN app_floor_plan_meter_length TYPE numeric(12, 3)
  USING app_floor_plan_meter_length::numeric(12, 3);
