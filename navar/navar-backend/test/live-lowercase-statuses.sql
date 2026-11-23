BEGIN;
DO $$
DECLARE status_column record; remaining bigint; checked integer:=0;
 notifications_before bigint; notifications_after bigint; target bigint; stored text;
BEGIN
 FOR status_column IN
  SELECT c.table_name,c.column_name FROM information_schema.columns c
  JOIN information_schema.tables t USING(table_schema,table_name)
  WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
   AND c.column_name LIKE '%status%' AND c.data_type IN ('text','character varying')
 LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS DISTINCT FROM lower(%I)',status_column.table_name,status_column.column_name,status_column.column_name) INTO remaining;
  IF remaining<>0 THEN RAISE EXCEPTION 'Uppercase statuses remain in %.%',status_column.table_name,status_column.column_name;END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',status_column.table_name)::regclass AND tgname='00_normalize_business_statuses' AND tgenabled='O') THEN
   RAISE EXCEPTION 'Normalizer missing for %',status_column.table_name;
  END IF;
  checked:=checked+1;
 END LOOP;
 IF checked=0 THEN RAISE EXCEPTION 'No status columns verified';END IF;
 SELECT count(*) INTO notifications_before FROM public.admin_notification;
 SELECT inquiry_id INTO target FROM public.inquiry WHERE inquiry_status IS NOT NULL ORDER BY inquiry_id LIMIT 1;
 IF target IS NOT NULL THEN
  UPDATE public.inquiry SET inquiry_status=upper(inquiry_status) WHERE inquiry_id=target RETURNING inquiry_status INTO stored;
  IF stored IS DISTINCT FROM lower(stored) THEN RAISE EXCEPTION 'Future inquiry write was not normalized';END IF;
 END IF;
 SELECT count(*) INTO notifications_after FROM public.admin_notification;
 IF notifications_after<>notifications_before THEN RAISE EXCEPTION 'Casing-only write produced a notification';END IF;
END $$;
SELECT true AS all_business_statuses_lowercase_and_future_writes_verified;
ROLLBACK;
