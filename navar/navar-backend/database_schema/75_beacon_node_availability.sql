BEGIN;
ALTER TABLE public.node ADD COLUMN node_is_active boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.node.node_is_active IS 'Runtime navigation availability. False while a currently assigned beacon is faulty, offline, missing, under maintenance or deactivated. Does not delete or rewrite map snapshots.';
CREATE FUNCTION app_private.node_beacon_active(p_node bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.beacon_node_assignment a JOIN public.beacon b USING(beacon_id) WHERE a.node_id=p_node AND lower(b.beacon_status) IN ('faulty','deactivated','inactive','maintenance','missing','offline','retired'));
$$;
CREATE FUNCTION app_private.enforce_node_beacon_health() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN NEW.node_is_active:=app_private.node_beacon_active(NEW.node_id);RETURN NEW;END$$;
CREATE TRIGGER enforce_node_beacon_health BEFORE INSERT OR UPDATE ON public.node FOR EACH ROW EXECUTE FUNCTION app_private.enforce_node_beacon_health();

CREATE FUNCTION app_private.sync_node_beacon_health() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='beacon' THEN
  UPDATE public.node n SET node_is_active=app_private.node_beacon_active(n.node_id) WHERE EXISTS(SELECT 1 FROM public.beacon_node_assignment a WHERE a.node_id=n.node_id AND a.beacon_id=NEW.beacon_id);
 ELSE
  IF TG_OP IN ('DELETE','UPDATE') THEN UPDATE public.node SET node_is_active=app_private.node_beacon_active(node_id) WHERE node_id=OLD.node_id;END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN UPDATE public.node SET node_is_active=app_private.node_beacon_active(node_id) WHERE node_id=NEW.node_id;END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER sync_node_beacon_health AFTER UPDATE OF beacon_status ON public.beacon FOR EACH ROW EXECUTE FUNCTION app_private.sync_node_beacon_health();
CREATE TRIGGER sync_assignment_node_health AFTER INSERT OR DELETE OR UPDATE ON public.beacon_node_assignment FOR EACH ROW EXECUTE FUNCTION app_private.sync_node_beacon_health();

CREATE FUNCTION app_private.transfer_retired_beacon_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior record;
BEGIN
 IF NEW.node_id IS NULL OR NEW.beacon_id IS NULL THEN RETURN NEW;END IF;
 PERFORM 1 FROM public.node WHERE node_id=NEW.node_id FOR UPDATE;
 FOR prior IN SELECT a.assignment_id,b.beacon_status FROM public.beacon_node_assignment a JOIN public.beacon b USING(beacon_id)
  WHERE a.node_id=NEW.node_id AND a.ar_development_id=NEW.ar_development_id AND a.beacon_id<>NEW.beacon_id FOR UPDATE OF a LOOP
  IF lower(prior.beacon_status) NOT IN ('deactivated','inactive','retired') THEN RAISE EXCEPTION 'This node is assigned to another beacon. Deactivate that beacon or clear its assignment first.';END IF;
  DELETE FROM public.beacon_node_assignment WHERE assignment_id=prior.assignment_id;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_retired_beacon_assignment BEFORE INSERT OR UPDATE ON public.beacon_node_assignment FOR EACH ROW EXECUTE FUNCTION app_private.transfer_retired_beacon_assignment();
UPDATE public.node SET node_is_active=app_private.node_beacon_active(node_id);

-- Mobile navigation reads omit unavailable nodes and their incident edges.
-- Existing version/ownership policies remain required; these are restrictive.
CREATE POLICY active_navigation_nodes ON public.node AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(node_is_active);
CREATE POLICY active_navigation_edges ON public.edge AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.node n WHERE n.node_id=edge.start_node_id AND n.node_is_active) AND EXISTS(SELECT 1 FROM public.node n WHERE n.node_id=edge.end_node_id AND n.node_is_active));
REVOKE ALL ON FUNCTION app_private.node_beacon_active(bigint),app_private.enforce_node_beacon_health(),app_private.sync_node_beacon_health(),app_private.transfer_retired_beacon_assignment() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
