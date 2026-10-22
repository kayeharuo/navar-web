-- Read-only, after migration 23.
SELECT count(*) unversioned_nodes FROM public.node WHERE ar_development_id IS NULL;
SELECT e.edge_id FROM public.edge e JOIN public.node s ON s.node_id=e.start_node_id JOIN public.node t ON t.node_id=e.end_node_id
 WHERE e.ar_development_id<>s.ar_development_id OR e.ar_development_id<>t.ar_development_id;
SELECT b.assignment_id FROM public.beacon_node_assigment b JOIN public.node n USING(node_id) WHERE b.ar_development_id<>n.ar_development_id;
SELECT ar_development_id FROM public.ar_development WHERE ar_development_status='suspended';
SELECT s_tier_key,s_tier_map_updates_per_year FROM public.subscription_tier;
SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.node'::regclass,'public.ar_development'::regclass,'public.edge'::regclass);
SELECT has_function_privilege('anon','public.workflow_action(bigint,bigint,text,text,text)','EXECUTE') anon_can_execute,
 has_function_privilege('authenticated','public.workflow_action(bigint,bigint,text,text,text)','EXECUTE') authenticated_can_execute;
