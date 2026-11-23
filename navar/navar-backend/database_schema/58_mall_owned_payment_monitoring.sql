BEGIN;
-- Legacy payment rows now carry mall_id directly, including onboarding receipts
-- with no contract. Preserve that ownership when constructing notifications.
DO $$DECLARE ddl text;needle text;BEGIN
 IF to_regprocedure('app_private.monitor_workflow_change()') IS NOT NULL THEN
  SELECT pg_get_functiondef('app_private.monitor_workflow_change()'::regprocedure) INTO ddl;
  needle:='SELECT mall_id INTO mid FROM public.contract WHERE contract_id=(rowdata->>''contract_id'')::bigint;';
  ddl:=replace(ddl,needle,'IF mid IS NULL THEN '||needle||' END IF;');
  EXECUTE ddl;
 END IF;
END $$;
COMMIT;
