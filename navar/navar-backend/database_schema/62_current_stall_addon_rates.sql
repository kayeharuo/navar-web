BEGIN;
-- New add-on applications use current configured tier prices/allowances. Their
-- saved quote is then fixed; do not rewrite previous contracts or payments.
DO $$DECLARE name text;ddl text;BEGIN
 FOREACH name IN ARRAY ARRAY['public.prepare_my_stall_expansion(jsonb)','public.get_my_stall_expansions()'] LOOP
  SELECT pg_get_functiondef(name::regprocedure) INTO ddl;
  ddl:=replace(ddl,'COALESCE((c.tier_snapshot->>''s_tier_additional_stall_fee'')::numeric,s_tier_additional_stall_fee)','s_tier_additional_stall_fee');
  ddl:=replace(ddl,'COALESCE((c.tier_snapshot->>''free_stalls_per_year'')::integer,free_stalls_per_year,s_tier_free_extra_stalls_per_year,0)','COALESCE(free_stalls_per_year,s_tier_free_extra_stalls_per_year,0)');
  IF name LIKE '%prepare_my%' THEN
   ddl:=replace(ddl,'free_limit integer;','free_limit integer;rate_version text;');
   ddl:=replace(ddl,'q:=jsonb_build_object(', 'SELECT version INTO rate_version FROM public.navar_rate_card WHERE is_current ORDER BY created_at DESC LIMIT 1; rate_version:=COALESCE(rate_version,''current''); q:=jsonb_build_object(''rate_version'',rate_version,');
   ddl:=replace(ddl,'''v4.1-draft-2026-11-21''','rate_version');
  END IF;
  EXECUTE ddl;
 END LOOP;
END $$;
COMMIT;
