-- Run against NavAR after migrations 48 and 49. All permanent writes below
-- are contained in a subtransaction that is deliberately rolled back.
CREATE TEMP TABLE navar_snapshot_verification(result jsonb);
DO $verify$
DECLARE
 arid integer; mid bigint; actor bigint; sid bigint; rev integer; brev bigint;
 floorid integer; result jsonb; payload jsonb; base_payload jsonb; beacons jsonb;
 trial jsonb; beaconid bigint; newnode bigint; before_hash text; after_hash text;
 original_links jsonb; report jsonb := '[]'; marker text := gen_random_uuid()::text;
BEGIN
 SELECT md5(jsonb_build_array(
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY node_id) FROM public.node t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY edge_id) FROM public.edge t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY beacon_id) FROM public.beacon t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY battery_id) FROM public.battery t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY assignment_id) FROM public.beacon_node_assignment t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY ar_development_id) FROM public.ar_development t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY mall_id) FROM public.mall t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY snapshot_id) FROM public.node_map_snapshot t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY ar_development_id) FROM public.node_map_editor_identity t)
 )::text) INTO before_hash;
 BEGIN
  SELECT d.ar_development_id,a.mall_id,d.ar_development_map_revision
   INTO arid,mid,rev FROM public.ar_development d JOIN public.application a USING(application_id)
   WHERE d.ar_development_status IN ('node_mapping','testing','ready')
    AND d.ar_development_mall_approved_at IS NULL
    AND EXISTS(SELECT 1 FROM public.node n WHERE n.ar_development_id=d.ar_development_id)
    AND NOT EXISTS(SELECT 1 FROM public.application newer WHERE newer.mall_id=a.mall_id AND (newer.application_version,newer.application_attempt)>(a.application_version,a.application_attempt))
   ORDER BY (SELECT count(*) FROM public.node n WHERE n.ar_development_id=d.ar_development_id) LIMIT 1;
  IF arid IS NULL THEN RAISE EXCEPTION 'No eligible non-published map is available for verification.'; END IF;
  SELECT admin_id INTO actor FROM public.admin WHERE admin_role='super_admin' AND NOT admin_is_deactivated LIMIT 1;
  SELECT mall_beacon_revision INTO brev FROM public.mall WHERE mall_id=mid FOR UPDATE;
  PERFORM 1 FROM public.ar_development WHERE ar_development_id=arid FOR UPDATE;
  SELECT jsonb_build_object(
   'floor_ids',COALESCE((SELECT jsonb_agg(floor_id) FROM public.floor WHERE mall_id=mid),'[]'),
   'nodes',COALESCE((SELECT jsonb_agg(jsonb_build_object('client_id','db'||node_id,'node_id',node_id,
    'floor_id',floor_id,'type',node_type,'label',node_label,'transition_group_id',transition_group_id,
    'node_is_emergency',node_is_emergency,'x',node_x_coordinate,'y',node_y_coordinate,
    'pixel_x',node_pixel_x,'pixel_y',node_pixel_y,'is_store_entrance',node_is_store_entrance,'store_id',store_id,'unit_id',unit_id)
    ORDER BY node_id) FROM public.node WHERE ar_development_id=arid),'[]'),
   'edges',COALESCE((SELECT jsonb_agg(jsonb_build_object('from_client_id','db'||start_node_id,'to_client_id','db'||end_node_id,
    'distance',edge_distance,'path_type',edge_path_type,'is_cross_floor',edge_is_cross_floor,'direction',edge_direction)) FROM public.edge WHERE ar_development_id=arid),'[]'),
   'transition_groups',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',transition_group_id,'name',transition_group_name,'type',transition_group_type)) FROM public.transition_group WHERE ar_development_id=arid),'[]'),
   'calibrations',COALESCE((SELECT jsonb_agg(jsonb_build_object('floor_id',floor_id,'ref_start_x',calibration_ref_start_x,'ref_start_y',calibration_ref_start_y,
    'ref_end_x',calibration_ref_end_x,'ref_end_y',calibration_ref_end_y,'real_meters',calibration_real_meters,'pixels_per_meter',calibration_pixel_per_meter,
    'path_loss_exponent',calibration_path_loss_exponent,'ref_label',calibration_ref_label)) FROM public.floor_calibration WHERE ar_development_id=arid),'[]')
  ) INTO base_payload;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('clientId','beacon-'||b.beacon_id,'dbId',b.beacon_id,'beaconCode',b.beacon_code,
   'label',b.beacon_label,'location',b.beacon_location,'minor',b.beacon_minor,'txPower',b.beacon_tx_power,
   'dateInstalled',b.beacon_installed_at,'lastMaintenanceDate',b.beacon_maintained_at,
   'batteryBrand',COALESCE((SELECT battery_brand FROM public.battery WHERE beacon_id=b.beacon_id AND battery_status='current' LIMIT 1),'Verification'),
   'batteryInstallDate',COALESCE((SELECT battery_installed_at FROM public.battery WHERE beacon_id=b.beacon_id AND battery_status='current' LIMIT 1),now()),
   'nodeId',(SELECT 'db'||node_id FROM public.beacon_node_assignment WHERE beacon_id=b.beacon_id AND ar_development_id=arid)
  ) ORDER BY b.beacon_id),'[]') INTO beacons FROM public.beacon b WHERE b.mall_id=mid;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY assignment_id),'[]') INTO original_links FROM public.beacon_node_assignment t WHERE ar_development_id<>arid;
  INSERT INTO public.node_map_snapshot(ar_development_id,name,payload,created_by)
   VALUES(arid,'Verification '||marker,jsonb_build_object('saveBody',base_payload,'beacons',beacons),actor) RETURNING snapshot_id INTO sid;
  report:=report || jsonb_build_array('snapshot insert/read');
  -- Existing maps are not in Node Mapping. Confirm the guard before temporarily
  -- enabling editing inside this rolled-back transaction only.
  IF (SELECT ar_development_status FROM public.ar_development WHERE ar_development_id=arid)<>'node_mapping' THEN
   BEGIN
    PERFORM public.apply_node_map_snapshot(arid,rev,base_payload,beacons,brev,sid,true,actor);
    RAISE EXCEPTION 'Status guard failed';
   EXCEPTION WHEN SQLSTATE 'NM422' THEN NULL; END;
   report:=report || jsonb_build_array('locked status rejected');
  END IF;
  UPDATE public.ar_development SET ar_development_status='node_mapping' WHERE ar_development_id=arid;
  SELECT (base_payload->'nodes'->0->>'floor_id')::integer INTO floorid;
  payload:=jsonb_set(base_payload,'{nodes}',base_payload->'nodes'||jsonb_build_array(jsonb_build_object(
   'client_id','verify-new','floor_id',floorid,'type','WALKWAY','label','Verification node',
   'x',1,'y',1,'pixel_x',10,'pixel_y',10,'is_store_entrance',false,'node_is_emergency',false)));
  payload:=jsonb_set(payload,'{edges}',COALESCE(payload->'edges','[]')||jsonb_build_array(jsonb_build_object(
   'from_client_id','verify-new','to_client_id',base_payload->'nodes'->0->>'client_id',
   'distance',1,'path_type','normal','is_cross_floor',false,'direction','both')));
  beacons:=beacons || jsonb_build_array(jsonb_build_object('clientId','verify-beacon','beaconCode','VERIFY-'||marker,
   'label','Verification beacon','location','Verification only','minor',65535,'txPower',-30,
   'dateInstalled',now(),'lastMaintenanceDate',now(),'batteryBrand','Verification','batteryInstallDate',now(),'nodeId','verify-new'));
  result:=public.apply_node_map_snapshot(arid,rev,payload,beacons,brev,sid,true,actor);
  newnode:=(result->'node_ids'->>'verify-new')::bigint;
  beaconid:=(result->'beacon_ids'->>'verify-beacon')::bigint;
  IF NOT EXISTS(SELECT 1 FROM public.beacon_node_assignment WHERE beacon_id=beaconid AND node_id=newnode AND ar_development_id=arid) THEN RAISE EXCEPTION 'New beacon assignment missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.battery WHERE beacon_id=beaconid AND battery_status='current') THEN RAISE EXCEPTION 'New beacon battery missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.node_map_editor_identity WHERE ar_development_id=arid AND (node_ids->>'verify-new')::bigint=newnode AND (beacon_ids->>'verify-beacon')::bigint=beaconid) THEN RAISE EXCEPTION 'Identity mapping missing'; END IF;
  report:=report || jsonb_build_array('real map and beacon creation applied atomically','current battery saved','stable identities saved');
  SELECT jsonb_agg(CASE WHEN value->>'clientId'='verify-beacon' THEN value||jsonb_build_object('dbId',beaconid) ELSE value END) INTO beacons FROM jsonb_array_elements(beacons);
  payload:=jsonb_set(payload,'{nodes}',(SELECT jsonb_agg(CASE WHEN value->>'client_id'='verify-new' THEN value||jsonb_build_object('node_id',newnode) ELSE value END) FROM jsonb_array_elements(payload->'nodes')));
  BEGIN
   PERFORM public.apply_node_map_snapshot(arid,rev+1,payload,beacons,brev,sid,true,actor);
   RAISE EXCEPTION 'Stale beacon revision was accepted';
  EXCEPTION WHEN SQLSTATE 'NM409' THEN NULL; END;
  report:=report || jsonb_build_array('stale beacon revision rejected');
  brev:=(result->>'beacon_revision')::bigint; rev:=(result->>'revision')::integer;
  BEGIN
   PERFORM public.apply_node_map_snapshot(arid,rev-1,payload,beacons,brev,sid,true,actor);
   RAISE EXCEPTION 'Stale map revision was accepted';
  EXCEPTION WHEN SQLSTATE 'NM409' THEN NULL; END;
  report:=report || jsonb_build_array('stale map revision rejected');
  SELECT jsonb_agg(CASE WHEN value->>'clientId'='verify-beacon' THEN value||'{"nodeId":"deleted-node"}'::jsonb ELSE value END) INTO trial FROM jsonb_array_elements(beacons);
  BEGIN
   PERFORM public.apply_node_map_snapshot(arid,rev,payload,trial,brev,sid,true,actor);
   RAISE EXCEPTION 'Deleted node reference was accepted';
  EXCEPTION WHEN SQLSTATE 'NM422' THEN
   IF SQLERRM NOT LIKE '%deleted node%' THEN RAISE; END IF;
  END;
  IF (SELECT ar_development_map_revision FROM public.ar_development WHERE ar_development_id=arid)<>rev THEN RAISE EXCEPTION 'Failed beacon save changed map revision'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.beacon_node_assignment WHERE beacon_id=beaconid AND node_id=newnode) THEN RAISE EXCEPTION 'Failed save lost assignment'; END IF;
  report:=report || jsonb_build_array('deleted node rejected','failed beacon save rolled back geometry and assignments');
  SELECT jsonb_agg(CASE WHEN value->>'clientId'='verify-beacon' THEN value||'{"nodeId":null,"label":"Edited verification beacon","batteryBrand":"Edited verification battery"}'::jsonb ELSE value END) INTO trial FROM jsonb_array_elements(beacons);
  BEGIN
   PERFORM public.apply_node_map_snapshot(arid,rev,base_payload,trial,brev,sid,false,actor);
   RAISE EXCEPTION 'Assignment removal did not require confirmation';
  EXCEPTION WHEN SQLSTATE 'NM422' THEN
   IF SQLERRM NOT LIKE 'Confirm removal%' THEN RAISE; END IF;
  END;
  report:=report || jsonb_build_array('assignment removal requires confirmation');
  result:=public.apply_node_map_snapshot(arid,rev,base_payload,trial,brev,sid,true,actor);
  IF EXISTS(SELECT 1 FROM public.node WHERE node_id=newnode) OR EXISTS(SELECT 1 FROM public.beacon_node_assignment WHERE beacon_id=beaconid AND ar_development_id=arid) THEN RAISE EXCEPTION 'Confirmed deletion did not clear assignment'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.beacon WHERE beacon_id=beaconid AND beacon_label='Edited verification beacon') THEN RAISE EXCEPTION 'Beacon details were not updated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.battery WHERE beacon_id=beaconid AND battery_brand='Edited verification battery') THEN RAISE EXCEPTION 'Battery details were not updated'; END IF;
  IF original_links IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY assignment_id),'[]') FROM public.beacon_node_assignment t WHERE ar_development_id<>arid) THEN RAISE EXCEPTION 'Assignments of another AR version changed'; END IF;
  report:=report || jsonb_build_array('confirmed node deletion clears assignment','beacon and battery details updated','other AR version assignments unchanged');
  IF EXISTS(SELECT 1 FROM public.beacon_node_assignment WHERE beacon_id=beaconid AND ar_development_id=arid) THEN RAISE EXCEPTION 'Edge-connected neighbor inherited the deleted node beacon'; END IF;
  report:=report || jsonb_build_array('edge-connected neighbor never inherits deleted node beacon');
  RAISE EXCEPTION 'Rollback verification fixtures' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
 END;
 SELECT md5(jsonb_build_array(
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY node_id) FROM public.node t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY edge_id) FROM public.edge t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY beacon_id) FROM public.beacon t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY battery_id) FROM public.battery t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY assignment_id) FROM public.beacon_node_assignment t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY ar_development_id) FROM public.ar_development t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY mall_id) FROM public.mall t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY snapshot_id) FROM public.node_map_snapshot t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY ar_development_id) FROM public.node_map_editor_identity t)
 )::text) INTO after_hash;
 IF before_hash IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'Verification changed permanent records'; END IF;
 INSERT INTO navar_snapshot_verification VALUES(jsonb_build_object('passed',report,'passed_count',jsonb_array_length(report),'permanent_records_unchanged',true));
END $verify$;
SELECT result FROM navar_snapshot_verification;
