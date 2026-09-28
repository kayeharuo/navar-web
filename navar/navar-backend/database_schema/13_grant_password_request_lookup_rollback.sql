-- Rollback for 13_grant_password_request_lookup.sql.

BEGIN;

REVOKE SELECT ON TABLE public.admin_password_request FROM service_role;

COMMIT;
