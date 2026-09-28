-- Track invitation and administrator-reset requests without storing tokens or links.
-- Run after 10_admin_deactivation_state_model.sql.

BEGIN;

CREATE TABLE public.admin_password_request (
    request_fingerprint CHAR(64) PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_kind VARCHAR(10) NOT NULL CHECK (request_kind IN ('invite', 'reset')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ
);

ALTER TABLE public.admin_password_request ENABLE ROW LEVEL SECURITY;

CREATE INDEX ix_admin_password_request_user_active
    ON public.admin_password_request (auth_user_id, issued_at DESC)
    WHERE claimed_at IS NULL AND superseded_at IS NULL;

CREATE OR REPLACE FUNCTION public.issue_admin_password_request(
    p_auth_user_id UUID,
    p_request_fingerprint CHAR(64),
    p_request_kind VARCHAR(10),
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.admin_password_request
    SET superseded_at = now()
    WHERE auth_user_id = p_auth_user_id
      AND claimed_at IS NULL
      AND superseded_at IS NULL;

    INSERT INTO public.admin_password_request (
        request_fingerprint,
        auth_user_id,
        request_kind,
        expires_at
    ) VALUES (
        p_request_fingerprint,
        p_auth_user_id,
        p_request_kind,
        p_expires_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_admin_password_request(
    p_auth_user_id UUID,
    p_request_fingerprint CHAR(64)
)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claimed_kind VARCHAR(10);
BEGIN
    UPDATE public.admin_password_request
    SET claimed_at = now()
    WHERE request_fingerprint = p_request_fingerprint
      AND auth_user_id = p_auth_user_id
      AND claimed_at IS NULL
      AND superseded_at IS NULL
      AND expires_at > now()
    RETURNING request_kind INTO claimed_kind;

    RETURN claimed_kind;
END;
$$;

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

REVOKE ALL ON TABLE public.admin_password_request FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_password_request TO service_role;
REVOKE ALL ON FUNCTION public.issue_admin_password_request(UUID, CHAR(64), VARCHAR(10), TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_admin_password_request(UUID, CHAR(64)) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_admin_password_request(UUID, CHAR(64)) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_admin_password_request(UUID, CHAR(64), VARCHAR(10), TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_admin_password_request(UUID, CHAR(64)) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_admin_password_request(UUID, CHAR(64)) TO service_role;

COMMIT;
