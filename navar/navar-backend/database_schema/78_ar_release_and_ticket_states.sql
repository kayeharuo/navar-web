BEGIN;
-- Private, owner-only recovery copies for the separately reviewed cleanup.
CREATE TABLE app_private.workflow_cleanup_archive (
 archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mall_id bigint NOT NULL CHECK(mall_id NOT IN (5,12,21)),
 record_type text NOT NULL,
 record_id bigint NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL,
 payload jsonb NOT NULL
);
ALTER TABLE app_private.workflow_cleanup_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.workflow_cleanup_archive FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION app_private.prepare_ar_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid bigint;
BEGIN
 IF lower(NEW.ar_development_status)<>'live' THEN RETURN NEW;END IF;
 SELECT mall_id INTO STRICT mid FROM public.application WHERE application_id=NEW.application_id;
 PERFORM 1 FROM public.mall WHERE mall_id=mid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id)
   WHERE a.mall_id=mid AND d.ar_development_id<>NEW.ar_development_id
   AND d.ar_development_status='live' AND d.ar_development_version>=NEW.ar_development_version)
 THEN RAISE EXCEPTION 'A newer or equal AR version is already Live.';END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION app_private.unpublish_previous_ar_versions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.ar_development_status='live' THEN
  UPDATE public.ar_development d SET ar_development_status='unpublished',
   ar_development_unpublish_reason='Replaced by AR version '||NEW.ar_development_version,
   ar_development_updated_at=now()
  FROM public.application a,public.application current_app
  WHERE d.application_id=a.application_id AND current_app.application_id=NEW.application_id
   AND a.mall_id=current_app.mall_id AND d.ar_development_id<>NEW.ar_development_id
   AND d.ar_development_version<NEW.ar_development_version AND d.ar_development_status='live';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "01_prepare_ar_publication" BEFORE INSERT OR UPDATE OF ar_development_status
 ON public.ar_development FOR EACH ROW EXECUTE FUNCTION app_private.prepare_ar_publication();
CREATE TRIGGER unpublish_previous_ar_versions AFTER INSERT OR UPDATE OF ar_development_status
 ON public.ar_development FOR EACH ROW EXECUTE FUNCTION app_private.unpublish_previous_ar_versions();

-- Older service producers may still submit pending; enter the supported workflow directly.
CREATE FUNCTION app_private.normalize_beacon_ticket_state() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.ticket_current_status:=lower(coalesce(NEW.ticket_current_status,'faulty'));
 IF NEW.ticket_current_status='pending' THEN NEW.ticket_current_status:='faulty';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "01_normalize_beacon_ticket_state" BEFORE INSERT OR UPDATE OF ticket_current_status
 ON public.beacon_ticket FOR EACH ROW EXECUTE FUNCTION app_private.normalize_beacon_ticket_state();
UPDATE public.beacon_ticket SET ticket_current_status='faulty' WHERE ticket_current_status='pending';
ALTER TABLE public.beacon_ticket ADD CONSTRAINT beacon_ticket_supported_state
 CHECK(ticket_current_status IN ('faulty','investigating','maintenance','resolved')) NOT VALID;
ALTER TABLE public.beacon_ticket VALIDATE CONSTRAINT beacon_ticket_supported_state;
REVOKE ALL ON FUNCTION app_private.prepare_ar_publication(),app_private.unpublish_previous_ar_versions(),app_private.normalize_beacon_ticket_state() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
