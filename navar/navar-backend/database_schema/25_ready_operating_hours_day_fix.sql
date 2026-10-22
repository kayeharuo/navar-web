-- Standardize all operating-hour day values to full English names.
-- The application now saves these full names for new and edited malls.
BEGIN;

UPDATE public.operating_hours
SET opthrs_day_of_week = CASE lower(trim(opthrs_day_of_week))
  WHEN 'mon' THEN 'Monday' WHEN 'monday' THEN 'Monday'
  WHEN 'tue' THEN 'Tuesday' WHEN 'tues' THEN 'Tuesday' WHEN 'tuesday' THEN 'Tuesday'
  WHEN 'wed' THEN 'Wednesday' WHEN 'wednesday' THEN 'Wednesday'
  WHEN 'thu' THEN 'Thursday' WHEN 'thur' THEN 'Thursday' WHEN 'thurs' THEN 'Thursday' WHEN 'thursday' THEN 'Thursday'
  WHEN 'fri' THEN 'Friday' WHEN 'friday' THEN 'Friday'
  WHEN 'sat' THEN 'Saturday' WHEN 'saturday' THEN 'Saturday'
  WHEN 'sun' THEN 'Sunday' WHEN 'sunday' THEN 'Sunday'
  ELSE opthrs_day_of_week
END;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.operating_hours
    WHERE opthrs_day_of_week NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')
  ) THEN
    RAISE EXCEPTION 'Unknown operating-hours day value remains. Review it before enforcing full day names.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='operating_hours_day_full_name') THEN
    ALTER TABLE public.operating_hours ADD CONSTRAINT operating_hours_day_full_name
      CHECK (opthrs_day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'));
  END IF;
END $$;

COMMIT;

-- Verification: no abbreviated or unknown day values should remain.
SELECT opthrs_day_of_week, count(*) AS row_count
FROM public.operating_hours
GROUP BY opthrs_day_of_week
ORDER BY CASE opthrs_day_of_week
  WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
  WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7
END;

SELECT app_private.application_requirements_ready(16) AS ready_requirements_pass;
