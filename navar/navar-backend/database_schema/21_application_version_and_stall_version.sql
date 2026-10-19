-- ============================================================
-- 21_application_version_and_stall_rules.sql
-- Business rules enforced in the database, so they also protect the
-- separate mall repository that inserts directly into these tables.
--
-- 1. A mall can only submit a new application version once the AR
--    development linked to its latest application is published, or has
--    been published before (live / published / unpublished, or it has an
--    activated_at timestamp).
-- 2. A stall application can only be submitted while the mall has an AR
--    development that is live / published.

-- ============================================================

CREATE OR REPLACE FUNCTION public.application_was_published(p_application_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ar_development d
        WHERE d.application_id = p_application_id
          AND (
              LOWER(d.ar_development_status) IN ('live', 'published', 'unpublished')
              OR d.ar_development_activated_at IS NOT NULL
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.enforce_application_version_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    latest_id INTEGER;
    latest_version INTEGER;
BEGIN
    SELECT application_id, application_version
      INTO latest_id, latest_version
      FROM public.application
     WHERE mall_id = NEW.mall_id
     ORDER BY application_version DESC
     LIMIT 1;

    -- First application for this mall: always allowed.
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NOT public.application_was_published(latest_id) THEN
        RAISE EXCEPTION 'A new application version cannot be submitted until the AR development for version % has been published.', latest_version
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_version_rule ON public.application;
CREATE TRIGGER trg_application_version_rule
    BEFORE INSERT ON public.application
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_application_version_rule();

CREATE OR REPLACE FUNCTION public.enforce_stall_application_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.ar_development d
        JOIN public.application a ON a.application_id = d.application_id
        WHERE a.mall_id = NEW.mall_id
          AND LOWER(d.ar_development_status) IN ('live', 'published')
    ) THEN
        RAISE EXCEPTION 'Stall applications can only be submitted once the mall''s AR is live.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stall_application_rule ON public.stall_application;
CREATE TRIGGER trg_stall_application_rule
    BEFORE INSERT ON public.stall_application
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_stall_application_rule();