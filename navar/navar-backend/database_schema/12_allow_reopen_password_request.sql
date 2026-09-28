-- Allow an uncompleted password link to be reopened within its one-hour validity window.
-- Run after 11_admin_password_request_migration.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_admin_password_request(
    p_auth_user_id UUID,
    p_request_fingerprint CHAR(64)
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_password_request
        WHERE auth_user_id = p_auth_user_id
          AND request_fingerprint = p_request_fingerprint
          AND claimed_at IS NULL
          AND superseded_at IS NULL
          AND expires_at > now()
    );
$$;

REVOKE ALL ON FUNCTION public.validate_admin_password_request(UUID, CHAR(64)) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_admin_password_request(UUID, CHAR(64)) TO service_role;

COMMIT;
