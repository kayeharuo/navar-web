BEGIN;

-- Normalize only actual status fields. Geographic state names, labels, messages,
-- snapshots and archived JSON documents are deliberately not rewritten.
CREATE FUNCTION app_private.normalize_business_statuses()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE field text; values_json jsonb := to_jsonb(NEW);
BEGIN
 FOREACH field IN ARRAY TG_ARGV LOOP
  IF values_json->>field IS NOT NULL THEN
   values_json := jsonb_set(values_json, ARRAY[field], to_jsonb(lower(values_json->>field)));
  END IF;
 END LOOP;
 NEW := jsonb_populate_record(NEW, values_json);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.normalize_business_statuses() FROM PUBLIC,anon,authenticated;

DO $$
DECLARE t record; tr record; enabled_triggers text[];
 arguments text; has_changes boolean;
BEGIN
 FOR t IN
  SELECT c.table_name,
   string_agg(format('%I=lower(%I)',c.column_name,c.column_name),', ' ORDER BY c.column_name) assignments,
   string_agg(format('%I IS DISTINCT FROM lower(%I)',c.column_name,c.column_name),' OR ' ORDER BY c.column_name) predicate,
   string_agg(quote_literal(c.column_name),', ' ORDER BY c.column_name) arguments,
   string_agg(format('(%I IS NULL OR %I=lower(%I))',c.column_name,c.column_name,c.column_name),' AND ' ORDER BY c.column_name) lowercase_check
  FROM information_schema.columns c JOIN information_schema.tables b USING(table_schema,table_name)
  WHERE c.table_schema='public' AND b.table_type='BASE TABLE'
   AND c.column_name LIKE '%status%' AND c.data_type IN ('text','character varying') AND c.is_generated='NEVER'
  GROUP BY c.table_name ORDER BY c.table_name
 LOOP
  -- An exclusive transactional table lock prevents concurrent writes while the
  -- casing-only repair suppresses workflow guards and notification side effects.
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t.table_name);
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s)',t.table_name,t.predicate) INTO has_changes;
  IF has_changes THEN
   enabled_triggers := ARRAY[]::text[];
   FOR tr IN SELECT tgname FROM pg_trigger WHERE tgrelid=format('public.%I',t.table_name)::regclass AND NOT tgisinternal AND tgenabled IN ('O','A') LOOP
    enabled_triggers := array_append(enabled_triggers,tr.tgname);
    -- Keep original enabled/always mode for exact restoration below.
   END LOOP;
   FOR tr IN SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid=format('public.%I',t.table_name)::regclass AND NOT tgisinternal AND tgname=ANY(enabled_triggers) LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',t.table_name,tr.tgname);
    enabled_triggers := array_replace(enabled_triggers,tr.tgname,tr.tgname::text||':'||tr.tgenabled::text);
   END LOOP;
   EXECUTE format('UPDATE public.%I SET %s WHERE %s',t.table_name,t.assignments,t.predicate);
   FOREACH arguments IN ARRAY enabled_triggers LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE %s TRIGGER %I',t.table_name,
     CASE WHEN right(arguments,1)='A' THEN 'ALWAYS' ELSE '' END,left(arguments,length(arguments)-2));
   END LOOP;
  END IF;
  EXECUTE format('CREATE TRIGGER "00_normalize_business_statuses" BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.normalize_business_statuses(%s)',t.table_name,t.arguments);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT business_status_lowercase CHECK (%s)',t.table_name,t.lowercase_check);
 END LOOP;
END $$;

COMMIT;
