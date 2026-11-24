BEGIN;
CREATE FUNCTION app_private.sync_beacon_assignment_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP IN ('DELETE','UPDATE') AND OLD.beacon_id IS NOT NULL THEN UPDATE public.beacon b SET beacon_node_count=(SELECT count(*) FROM public.beacon_node_assignment a WHERE a.beacon_id=b.beacon_id) WHERE beacon_id=OLD.beacon_id;END IF;
 IF TG_OP IN ('INSERT','UPDATE') AND NEW.beacon_id IS NOT NULL THEN UPDATE public.beacon b SET beacon_node_count=(SELECT count(*) FROM public.beacon_node_assignment a WHERE a.beacon_id=b.beacon_id) WHERE beacon_id=NEW.beacon_id;END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER sync_beacon_assignment_count AFTER INSERT OR DELETE OR UPDATE ON public.beacon_node_assignment FOR EACH ROW EXECUTE FUNCTION app_private.sync_beacon_assignment_count();
UPDATE public.beacon b SET beacon_node_count=(SELECT count(*) FROM public.beacon_node_assignment a WHERE a.beacon_id=b.beacon_id) WHERE beacon_node_count IS DISTINCT FROM (SELECT count(*) FROM public.beacon_node_assignment a WHERE a.beacon_id=b.beacon_id);
REVOKE ALL ON FUNCTION app_private.sync_beacon_assignment_count() FROM PUBLIC,anon,authenticated;
COMMIT;
