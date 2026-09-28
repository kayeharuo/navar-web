-- Allow the backend service role to read the claimed request kind during completion.
-- Run after 11_admin_password_request_migration.sql.

BEGIN;

GRANT SELECT ON TABLE public.admin_password_request TO service_role;

COMMIT;
