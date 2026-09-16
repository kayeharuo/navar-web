-- Run this once in the Supabase SQL Editor.
-- The schema creates unquoted uppercase identifiers, which PostgreSQL stores lowercase.
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

