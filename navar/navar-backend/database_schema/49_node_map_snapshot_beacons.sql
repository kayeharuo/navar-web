BEGIN;
-- Serialize edits from both management screens using one mall revision.
ALTER TABLE public.mall ADD COLUMN IF NOT EXISTS mall_beacon_revision bigint NOT NULL DEFAULT 0;
-- Stable editor identities let an immutable snapshot find records created when
-- it was applied, including after closing and reopening the editor.
CREATE TABLE IF NOT EXISTS public.node_map_editor_identity (
 ar_development_id bigint PRIMARY KEY REFERENCES public.ar_development(ar_development_id) ON DELETE CASCADE,
 node_ids jsonb NOT NULL DEFAULT '{}', beacon_ids jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.node_map_editor_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.node_map_editor_identity FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.node_map_editor_identity TO service_role;
CREATE OR REPLACE FUNCTION public.bump_mall_beacon_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid bigint; bid bigint;
BEGIN
 IF TG_TABLE_NAME='beacon' THEN
  IF TG_OP='DELETE' THEN mid:=OLD.mall_id; ELSE mid:=NEW.mall_id; END IF;
 ELSE
  IF TG_OP='DELETE' THEN bid:=OLD.beacon_id; ELSE bid:=NEW.beacon_id; END IF;
  SELECT mall_id INTO mid FROM public.beacon WHERE beacon_id=bid;
 END IF;
 UPDATE public.mall SET mall_beacon_revision=mall_beacon_revision+1 WHERE mall_id=mid;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.bump_mall_beacon_revision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS beacon_revision ON public.beacon;
CREATE TRIGGER beacon_revision BEFORE INSERT OR UPDATE OR DELETE ON public.beacon FOR EACH ROW EXECUTE FUNCTION public.bump_mall_beacon_revision();
DROP TRIGGER IF EXISTS beacon_revision ON public.battery;
CREATE TRIGGER beacon_revision BEFORE INSERT OR UPDATE OR DELETE ON public.battery FOR EACH ROW EXECUTE FUNCTION public.bump_mall_beacon_revision();
DROP TRIGGER IF EXISTS beacon_revision ON public.beacon_node_assignment;
CREATE TRIGGER beacon_revision BEFORE INSERT OR UPDATE OR DELETE ON public.beacon_node_assignment FOR EACH ROW EXECUTE FUNCTION public.bump_mall_beacon_revision();

CREATE OR REPLACE FUNCTION public.apply_node_map_snapshot(
 p_ar_development_id integer, p_base_revision integer, p_payload jsonb,
 p_beacons jsonb, p_beacon_revision bigint, p_snapshot_id bigint,
 p_confirm_removal boolean, p_actor bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE mid bigint; current_revision bigint; result jsonb; item jsonb; assignments jsonb;
 bid bigint; nid bigint; beacon_data jsonb; battery_data jsonb; beacon_ids jsonb := '{}'; edge_ids jsonb;
BEGIN
 SELECT a.mall_id INTO mid FROM public.ar_development d JOIN public.application a USING(application_id)
 WHERE d.ar_development_id=p_ar_development_id;
 IF mid IS NULL THEN RAISE EXCEPTION 'AR development not found.' USING ERRCODE='NM404'; END IF;
 SELECT mall_beacon_revision INTO current_revision FROM public.mall WHERE mall_id=mid FOR UPDATE;
 IF current_revision IS DISTINCT FROM p_beacon_revision THEN
  RAISE EXCEPTION 'Beacon data changed in Mall Management or another editor. Save a snapshot of your work, then reload before applying.' USING ERRCODE='NM409';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.node_map_snapshot WHERE snapshot_id=p_snapshot_id AND ar_development_id=p_ar_development_id AND payload ? 'saveBody') THEN
  RAISE EXCEPTION 'Save this layout and its beacons as a snapshot first.' USING ERRCODE='NM422';
 END IF;
 IF jsonb_typeof(p_beacons) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Beacon list is required.' USING ERRCODE='NM422'; END IF;
 IF EXISTS(SELECT 1 FROM public.beacon b WHERE b.mall_id=mid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_beacons) x WHERE (x->>'dbId')::bigint=b.beacon_id)) THEN
  RAISE EXCEPTION 'This snapshot does not contain every current beacon. Reload and reconcile the beacon list before applying.' USING ERRCODE='NM409';
 END IF;
 IF NOT p_confirm_removal AND EXISTS(
  SELECT 1 FROM public.beacon_node_assignment a JOIN public.beacon b USING(beacon_id)
  WHERE a.ar_development_id=p_ar_development_id AND b.mall_id=mid AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_beacons) x JOIN jsonb_array_elements(p_payload->'nodes') n
    ON n->>'client_id'=x->>'nodeId'
   WHERE (x->>'dbId')::bigint=a.beacon_id AND (n->>'node_id')::bigint=a.node_id
  )
 ) THEN RAISE EXCEPTION 'Confirm removal or reassignment of saved beacon links before applying.' USING ERRCODE='NM422'; END IF;
 -- Save all geometry first; any later beacon error rolls the entire transaction back.
 result := public.save_node_map(p_ar_development_id,p_base_revision,p_payload);
 -- Clear this version only so swapping two beacon assignments is possible.
 DELETE FROM public.beacon_node_assignment WHERE ar_development_id=p_ar_development_id;
 FOR item IN SELECT * FROM jsonb_array_elements(p_beacons) LOOP
  bid:=NULLIF(item->>'dbId','')::bigint;
  IF bid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.beacon WHERE beacon_id=bid AND mall_id=mid) THEN
   RAISE EXCEPTION 'A beacon does not belong to this mall.' USING ERRCODE='NM422';
  END IF;
  IF NOT length(btrim(item->>'beaconCode'))>0 OR NOT length(btrim(item->>'label'))>0 THEN RAISE EXCEPTION 'Beacon code and label are required.' USING ERRCODE='NM422'; END IF;
  IF EXISTS(SELECT 1 FROM public.beacon WHERE beacon_code=item->>'beaconCode' AND beacon_id IS DISTINCT FROM bid) THEN RAISE EXCEPTION 'Beacon code is already in use.' USING ERRCODE='NM422'; END IF;
  IF EXISTS(SELECT 1 FROM public.beacon WHERE mall_id=mid AND beacon_minor=(item->>'minor')::integer AND beacon_id IS DISTINCT FROM bid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_beacons) x WHERE (x->>'dbId')::bigint=beacon_id)) THEN RAISE EXCEPTION 'Beacon minor is already in use.' USING ERRCODE='NM422'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('versionId',ar_development_id,'nodeId',node_id)),'[]') INTO assignments
   FROM public.beacon_node_assignment WHERE beacon_id=bid AND ar_development_id<>p_ar_development_id;
  nid:=NULL;
  IF item->>'nodeId' IS NOT NULL THEN
   nid:=(result->'node_ids'->>(item->>'nodeId'))::bigint;
   IF nid IS NULL THEN RAISE EXCEPTION 'Beacon assignment references a deleted node.' USING ERRCODE='NM422'; END IF;
   assignments:=assignments || jsonb_build_array(jsonb_build_object('versionId',p_ar_development_id,'nodeId',nid));
  END IF;
  beacon_data:=jsonb_build_object('beacon_code',item->>'beaconCode','beacon_label',item->>'label',
   'beacon_minor',(item->>'minor')::integer,'beacon_tx_power',(item->>'txPower')::integer,
   'beacon_location',COALESCE(item->>'location',''),'beacon_status','placed',
   'beacon_installed_at',item->>'dateInstalled','beacon_maintained_at',item->>'lastMaintenanceDate','floor_id',NULL);
  battery_data:=jsonb_build_object('battery_code','SNAP-BAT-'||gen_random_uuid()::text,
   'battery_brand',item->>'batteryBrand','battery_installed_at',item->>'batteryInstallDate');
  bid:=public.save_beacon_with_assignments(mid,bid,beacon_data,assignments,battery_data);
  IF NOT EXISTS(SELECT 1 FROM public.battery WHERE beacon_id=bid AND battery_status='current') THEN
   INSERT INTO public.battery(beacon_id,battery_code,battery_brand,battery_status,battery_installed_at)
    VALUES(bid,battery_data->>'battery_code',item->>'batteryBrand','current',(item->>'batteryInstallDate')::timestamptz);
  END IF;
  beacon_ids:=beacon_ids || jsonb_build_object(item->>'clientId',bid);
 END LOOP;
 INSERT INTO public.node_map_editor_identity(ar_development_id,node_ids,beacon_ids)
 VALUES(p_ar_development_id,result->'node_ids',beacon_ids)
 ON CONFLICT(ar_development_id) DO UPDATE SET
 node_ids=node_map_editor_identity.node_ids || EXCLUDED.node_ids,
 beacon_ids=node_map_editor_identity.beacon_ids || EXCLUDED.beacon_ids;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('node_map','node_map_snapshot_applied','Applied snapshot '||p_snapshot_id||' with beacon details and assignments',now(),p_actor,mid);
 SELECT mall_beacon_revision INTO current_revision FROM public.mall WHERE mall_id=mid;
 SELECT COALESCE(jsonb_object_agg(
  CASE WHEN f.key<t.key THEN f.key||'::'||t.key ELSE t.key||'::'||f.key END,e.edge_id),'{}')
 INTO edge_ids FROM public.edge e
 JOIN jsonb_each_text(result->'node_ids') f ON f.value::bigint=e.start_node_id
 JOIN jsonb_each_text(result->'node_ids') t ON t.value::bigint=e.end_node_id
 WHERE e.ar_development_id=p_ar_development_id;
 RETURN result || jsonb_build_object('beacon_ids',beacon_ids,'beacon_revision',current_revision,'edge_ids',edge_ids);
END $$;
REVOKE ALL ON FUNCTION public.apply_node_map_snapshot(integer,integer,jsonb,jsonb,bigint,bigint,boolean,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_node_map_snapshot(integer,integer,jsonb,jsonb,bigint,bigint,boolean,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
