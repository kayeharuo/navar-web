-- Rename in place; preserve rows, grants, RLS, foreign keys and function ACLs.
DO $rename$
DECLARE
    item RECORD;
    definition TEXT;
BEGIN
    IF to_regclass('public.beacon_node_assigment') IS NOT NULL THEN
        IF to_regclass('public.beacon_node_assignment') IS NOT NULL THEN
            RAISE EXCEPTION 'Both assignment tables exist; refusing to merge or overwrite.';
        END IF;
        ALTER TABLE public.beacon_node_assigment RENAME TO beacon_node_assignment;
    ELSIF to_regclass('public.beacon_node_assignment') IS NULL THEN
        RAISE EXCEPTION 'Beacon assignment table not found.';
    END IF;

    -- PL/pgSQL bodies contain table names as text and must be updated explicitly.
    SELECT pg_get_functiondef('public.save_node_map(integer,integer,jsonb)'::regprocedure) INTO definition;
    EXECUTE replace(definition, 'beacon_node_assigment', 'beacon_node_assignment');

    FOR item IN SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.beacon_node_assignment'::regclass
          AND conname LIKE '%beacon_node_assigment%'
    LOOP
        EXECUTE format('ALTER TABLE public.beacon_node_assignment RENAME CONSTRAINT %I TO %I',
            item.conname, replace(item.conname, 'beacon_node_assigment', 'beacon_node_assignment'));
    END LOOP;
    FOR item IN SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'beacon_node_assignment'
          AND policyname LIKE '%beacon_node_assigment%'
    LOOP
        EXECUTE format('ALTER POLICY %I ON public.beacon_node_assignment RENAME TO %I',
            item.policyname, replace(item.policyname, 'beacon_node_assigment', 'beacon_node_assignment'));
    END LOOP;
END
$rename$;
NOTIFY pgrst, 'reload schema';
