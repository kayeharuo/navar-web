BEGIN;
CREATE OR REPLACE FUNCTION app_private.check_initial_outlet_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE capacity integer;
BEGIN
 IF TG_OP='UPDATE' AND OLD.mall_id IS NOT DISTINCT FROM NEW.mall_id THEN RETURN NEW;END IF;
 PERFORM 1 FROM public.mall WHERE mall_id=NEW.mall_id FOR UPDATE;
 IF (app_private.stall_map_state(NEW.mall_id)->>'published_before')::boolean THEN RETURN NEW;END IF;
 capacity:=(app_private.mall_establishment_capacity(NEW.mall_id)->>'totalCapacity')::integer;
 IF capacity IS NOT NULL AND (SELECT count(*) FROM public.store WHERE mall_id=NEW.mall_id AND coalesce(lower(store_status),'unmapped')<>'inactive' AND store_id IS DISTINCT FROM NEW.store_id)>=capacity THEN RAISE EXCEPTION 'All % store and stall slots in your onboarding count are in use.',capacity;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.check_initial_outlet_capacity() FROM PUBLIC,anon,authenticated;
COMMIT;
