BEGIN;
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.save_system_subscription_tiers(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'trim(to_char(row_data.s_tier_map_update_rate*100,''FM990.99''))','rtrim(rtrim(to_char(row_data.s_tier_map_update_rate*100,''FM990.00''),''0''),''.'')');
 EXECUTE definition;
END $migration$;
COMMIT;
