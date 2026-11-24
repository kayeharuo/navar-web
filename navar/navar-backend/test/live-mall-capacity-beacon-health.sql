BEGIN;
DO $verify$
DECLARE source record; replacement record; mid bigint; capacity integer; used integer; blocked boolean:=false;
BEGIN
 SELECT a.*,b.mall_id INTO STRICT source FROM public.beacon_node_assignment a JOIN public.beacon b USING(beacon_id) JOIN public.ar_development d USING(ar_development_id)
 WHERE b.mall_id=(SELECT mall_id FROM public.mall WHERE lower(mall_name)='sm seaside city cebu') AND b.beacon_status='placed' AND d.ar_development_status='live' ORDER BY a.assignment_id LIMIT 1;
 PERFORM 1 FROM public.mall WHERE mall_id=source.mall_id FOR UPDATE;
 SELECT a.* INTO STRICT replacement FROM public.beacon_node_assignment a JOIN public.beacon b USING(beacon_id) WHERE b.mall_id=source.mall_id AND a.ar_development_id=source.ar_development_id AND b.beacon_status='placed' AND a.beacon_id<>source.beacon_id ORDER BY a.assignment_id LIMIT 1;
 UPDATE public.beacon SET beacon_status='faulty' WHERE beacon_id=source.beacon_id;
 IF EXISTS(SELECT 1 FROM public.node n JOIN public.beacon_node_assignment a USING(node_id) WHERE a.beacon_id=source.beacon_id AND n.node_is_active) THEN RAISE EXCEPTION 'A faulty beacon left a linked node active';END IF;
 UPDATE public.beacon SET beacon_status='placed' WHERE beacon_id=source.beacon_id;
 IF NOT (SELECT node_is_active FROM public.node WHERE node_id=source.node_id) THEN RAISE EXCEPTION 'Beacon recovery did not restore the node';END IF;
 UPDATE public.beacon SET beacon_status='deactivated' WHERE beacon_id=source.beacon_id;
 UPDATE public.beacon_node_assignment SET node_id=source.node_id WHERE assignment_id=replacement.assignment_id;
 IF EXISTS(SELECT 1 FROM public.beacon_node_assignment WHERE beacon_id=source.beacon_id AND node_id=source.node_id) THEN RAISE EXCEPTION 'Retired beacon kept the transferred assignment';END IF;
 IF NOT (SELECT node_is_active FROM public.node WHERE node_id=source.node_id) THEN RAISE EXCEPTION 'Replacement beacon did not restore the node';END IF;
 UPDATE public.beacon SET beacon_status='faulty' WHERE beacon_id=replacement.beacon_id;
 UPDATE public.beacon SET beacon_status='placed' WHERE beacon_id=source.beacon_id;
 IF (SELECT node_is_active FROM public.node WHERE node_id=source.node_id) THEN RAISE EXCEPTION 'Reactivating the old beacon incorrectly changed the replacement node';END IF;
 SELECT mall_id INTO STRICT mid FROM public.mall WHERE lower(mall_name)='gaisano fiesta mall';
 capacity:=(public.mall_capacity_state(mid)->>'totalCapacity')::integer;
 SELECT count(*) INTO used FROM public.store WHERE mall_id=mid AND store_status<>'inactive';
 IF used>=capacity THEN
  BEGIN
   UPDATE public.store SET mall_id=mid WHERE store_id=(SELECT store_id FROM public.store WHERE mall_id<>mid AND store_status<>'inactive' AND store_type='store' ORDER BY store_id LIMIT 1);
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'Store capacity reached%' THEN RAISE;END IF;blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'The combined store/stall capacity limit was bypassed';END IF;
 END IF;
END $verify$;
SELECT 'Fault, recovery, replacement transfer and combined capacity checks passed; transaction rolled back.' AS verification;
ROLLBACK;
