-- READ ONLY: inspect the exact failing entry; this does not change workflow state.
SELECT d.ar_development_id, d.application_id,
       a.application_status, a.application_version, a.application_attempt,
       d.ar_development_status, d.ar_development_mall_approved_at,
       d.ar_development_ready_at, d.ar_development_resume_status,
       EXISTS (
         SELECT 1 FROM public.application newer
         WHERE newer.mall_id = a.mall_id
           AND (newer.application_version, newer.application_attempt)
             > (a.application_version, a.application_attempt)
       ) AS newer_application_exists,
       (SELECT count(*) FROM public.ar_development siblings
        WHERE siblings.application_id = a.application_id) AS linked_ar_count,
       (SELECT max(siblings.ar_development_id) FROM public.ar_development siblings
        WHERE siblings.application_id = a.application_id) AS workflow_selected_ar_id
FROM public.ar_development d
JOIN public.application a USING (application_id)
WHERE d.ar_development_id = 17;

-- Include user-defined triggers: a deployed trigger can also reject the transition.
SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) AS trigger_definition,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgrelid IN ('public.ar_development'::regclass, 'public.thread'::regclass)
  AND NOT t.tgisinternal;

-- Per-requirement report for the application linked to AR #17.
-- Any row with passed=false identifies a reason Ready is blocked.
WITH target AS (
  SELECT a.*, m.mall_address, m.mall_city, m.mall_state, m.mall_logo
  FROM public.ar_development d
  JOIN public.application a USING (application_id)
  JOIN public.mall m USING (mall_id)
  WHERE d.ar_development_id = 17
), checks AS (
  SELECT 'application'::text category, 'approved status'::text item,
         lower(application_status) = 'approved' passed,
         application_status::text details
  FROM target
  UNION ALL SELECT 'mall profile', 'address', COALESCE(length(trim(mall_address)), 0) > 0, COALESCE(mall_address, '<missing>') FROM target
  UNION ALL SELECT 'mall profile', 'city', COALESCE(length(trim(mall_city)), 0) > 0, COALESCE(mall_city, '<missing>') FROM target
  UNION ALL SELECT 'mall profile', 'state', COALESCE(length(trim(mall_state)), 0) > 0, COALESCE(mall_state, '<missing>') FROM target
  UNION ALL SELECT 'mall profile', 'logo bytes', COALESCE(octet_length(mall_logo), 0) > 0, COALESCE(octet_length(mall_logo), 0)::text FROM target
  UNION ALL SELECT 'mall profile', 'has floors', EXISTS(SELECT 1 FROM public.floor f WHERE f.mall_id=t.mall_id),
         (SELECT count(*)::text FROM public.floor f WHERE f.mall_id=t.mall_id) FROM target t
  UNION ALL
  SELECT 'operating hours', day,
         (SELECT count(*) FROM public.operating_hours h WHERE h.mall_id=t.mall_id AND h.opthrs_is_mall AND h.opthrs_day_of_week=day) = 1
         AND EXISTS(SELECT 1 FROM public.operating_hours h WHERE h.mall_id=t.mall_id AND h.opthrs_is_mall AND h.opthrs_day_of_week=day
           AND (h.opthrs_is_closed OR (h.opthrs_open_time IS NOT NULL AND h.opthrs_close_time IS NOT NULL AND h.opthrs_open_time<>h.opthrs_close_time))),
         'rows='||(SELECT count(*) FROM public.operating_hours h WHERE h.mall_id=t.mall_id AND h.opthrs_is_mall AND h.opthrs_day_of_week=day)
  FROM target t CROSS JOIN unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) day
), floor_checks AS (
  SELECT 'floor'::text category, f.floor_label||' / exactly one plan' item,
         count(p.*)=1 passed, 'plans='||count(p.*) details
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id
  LEFT JOIN public.application_floor_plan p ON p.floor_id=f.floor_id AND p.application_id=t.application_id
  GROUP BY f.floor_id,f.floor_label
  UNION ALL
  SELECT 'floor plan', f.floor_label||' / image', COALESCE(octet_length(p.app_floor_plan_image),0)>0,
         'bytes='||COALESCE(octet_length(p.app_floor_plan_image),0)
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id LEFT JOIN public.application_floor_plan p ON p.floor_id=f.floor_id AND p.application_id=t.application_id
  UNION ALL
  SELECT 'floor plan', f.floor_label||' / scale', COALESCE(p.app_floor_plan_meter_length,0)>0 AND COALESCE(length(trim(p.app_floor_plan_reference_line)),0)>0 AND p.app_floor_plan_reference_line !~* '^sample',
         'meters='||COALESCE(p.app_floor_plan_meter_length::text,'<missing>')||'; reference='||COALESCE(p.app_floor_plan_reference_line,'<missing>')
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id LEFT JOIN public.application_floor_plan p ON p.floor_id=f.floor_id AND p.application_id=t.application_id
  UNION ALL
  SELECT 'floor plan', f.floor_label||' / accessibility route', COALESCE(length(trim(p.app_floor_plan_accessibility_route)),0)>0 AND p.app_floor_plan_accessibility_route !~* '^sample', COALESCE(p.app_floor_plan_accessibility_route,'<missing>')
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id LEFT JOIN public.application_floor_plan p ON p.floor_id=f.floor_id AND p.application_id=t.application_id
  UNION ALL
  SELECT 'floor plan', f.floor_label||' / emergency route', COALESCE(length(trim(p.app_floor_plan_emergency_route)),0)>0 AND p.app_floor_plan_emergency_route !~* '^sample', COALESCE(p.app_floor_plan_emergency_route,'<missing>')
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id LEFT JOIN public.application_floor_plan p ON p.floor_id=f.floor_id AND p.application_id=t.application_id
  UNION ALL
  SELECT 'entry points', f.floor_label||' / valid entry point',
         EXISTS(SELECT 1 FROM public.application_entry_point e WHERE e.floor_id=f.floor_id AND e.application_id=t.application_id)
         AND NOT EXISTS(SELECT 1 FROM public.application_entry_point e WHERE e.floor_id=f.floor_id AND e.application_id=t.application_id
           AND (COALESCE(length(trim(e.app_entry_point_label)),0)=0 OR COALESCE(length(trim(e.app_entry_point_description)),0)=0 OR e.app_entry_point_label~*'^sample' OR e.app_entry_point_description~*'^sample')),
         'rows='||(SELECT count(*) FROM public.application_entry_point e WHERE e.floor_id=f.floor_id AND e.application_id=t.application_id)
  FROM target t JOIN public.floor f ON f.mall_id=t.mall_id
)
SELECT category,item,COALESCE(passed,false) passed,details FROM checks
UNION ALL
SELECT category,item,COALESCE(passed,false),details FROM floor_checks
ORDER BY passed,category,item;

-- This should become true after every failed row above is corrected.
SELECT app_private.application_requirements_ready(application_id) AS ready_requirements_pass
FROM public.ar_development WHERE ar_development_id=17;
