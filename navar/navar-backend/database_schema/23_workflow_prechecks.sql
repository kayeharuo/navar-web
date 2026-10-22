-- Read-only checks: each result must be empty before migration 23.
WITH refs AS (
 SELECT start_node_id node_id, ar_development_id FROM public.edge
 UNION SELECT end_node_id, ar_development_id FROM public.edge
 UNION SELECT node_id, ar_development_id FROM public.beacon_node_assigment
) SELECT node_id, array_agg(DISTINCT ar_development_id) versions
FROM refs GROUP BY node_id HAVING count(DISTINCT ar_development_id)>1;

SELECT DISTINCT f.mall_id FROM public.node n JOIN public.floor f USING(floor_id)
WHERE NOT EXISTS (SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=f.mall_id);

WITH proposed AS (
 SELECT n.node_id, (SELECT d.ar_development_id FROM public.ar_development d
 JOIN public.application a USING(application_id) WHERE a.mall_id=f.mall_id
 ORDER BY (lower(d.ar_development_status)='live') DESC, d.ar_development_version DESC, d.ar_development_id DESC LIMIT 1) ar_id
 FROM public.node n JOIN public.floor f USING(floor_id)
), refs AS (
 SELECT 'edge start' source, edge_id id, start_node_id node_id, ar_development_id FROM public.edge
 UNION ALL SELECT 'edge end', edge_id, end_node_id, ar_development_id FROM public.edge
 UNION ALL SELECT 'assignment', assignment_id, node_id, ar_development_id FROM public.beacon_node_assigment
) SELECT r.*, p.ar_id proposed_ar_id FROM refs r JOIN proposed p USING(node_id) WHERE r.ar_development_id IS DISTINCT FROM p.ar_id;

SELECT mall_id, application_version, count(*) FROM public.application GROUP BY 1,2 HAVING count(*)>1;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.ar_development'::regclass AND contype='c';

-- Save this result as the first section of your rollback SQL before applying 23.
-- It preserves actual tier values rather than assuming they were 2/4/8.
SELECT 'UPDATE public.subscription_tier SET s_tier_map_updates_per_year=' || coalesce(s_tier_map_updates_per_year::text,'NULL') || ' WHERE s_tier_id=' || s_tier_id || ';' AS rollback_tier_sql
FROM public.subscription_tier;
SELECT ar_development_status,count(*) FROM public.ar_development GROUP BY 1;
SELECT ar_development_id FROM public.ar_development WHERE ar_development_status NOT IN ('pending','node_mapping','testing','suspended','on_hold','ready','live','unpublished');
