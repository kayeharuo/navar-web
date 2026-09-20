-- NavAR: lock down the public schema (deny-by-default)
-- Run AFTER 01, 02, 03 and 04, once, in the Supabase SQL Editor.
--
-- What this does
--   1. Turns Row Level Security (RLS) ON for every table in the public schema.
--      With RLS on and NO policies, the browser-safe keys (publishable / anon)
--      and logged-in users (authenticated) can read or write nothing.
--   2. Removes any direct table/sequence privileges from anon and authenticated.
--   3. Makes future tables start locked down too.
--
-- What keeps working
--   The NavAR backend uses the secret / service_role key. That role bypasses RLS
--   and keeps the grants from 02_mall_management_grants.sql, so the API is unaffected.
--
-- IMPORTANT (read before running)
--   After this file runs, NOTHING can reach these tables except the backend.
--   If the mobile app is meant to query Supabase tables DIRECTLY with the
--   publishable key, it will stop working until explicit RLS policies (and
--   matching grants) are written for the specific tables it needs. That is the
--   intended default: open specific access on purpose, never by accident.
--   Supabase Auth (login, signup, password reset) is not affected.
--
-- If you later create functions in the public schema, also run:
--   REVOKE ALL ON FUNCTION <name>(<args>) FROM PUBLIC, anon, authenticated;

BEGIN;

-- 1. RLS on for every existing table in public.
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;

-- 2. No direct privileges for the public-facing roles.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. Tables/sequences created later by this role start without those privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
