BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'admin_password_request' AND column_name = 'request_fingerprint'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'admin_password_request' AND column_name = 'apr_request_fingerprint'
    ) THEN
        ALTER TABLE public.admin_password_request RENAME COLUMN request_fingerprint TO apr_request_fingerprint;
        ALTER TABLE public.admin_password_request RENAME COLUMN auth_user_id TO apr_auth_user_id;
        ALTER TABLE public.admin_password_request RENAME COLUMN request_kind TO apr_request_kind;
        ALTER TABLE public.admin_password_request RENAME COLUMN issued_at TO apr_issued_at;
        ALTER TABLE public.admin_password_request RENAME COLUMN expires_at TO apr_expires_at;
        ALTER TABLE public.admin_password_request RENAME COLUMN claimed_at TO apr_claimed_at;
        ALTER TABLE public.admin_password_request RENAME COLUMN superseded_at TO apr_superseded_at;
    END IF;
END $$;

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
    SET apr_superseded_at = now()
    WHERE apr_auth_user_id = p_auth_user_id
      AND apr_claimed_at IS NULL
      AND apr_superseded_at IS NULL;

    INSERT INTO public.admin_password_request (
        apr_request_fingerprint, apr_auth_user_id, apr_request_kind, apr_expires_at
    ) VALUES (
        p_request_fingerprint, p_auth_user_id, p_request_kind, p_expires_at
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
DECLARE claimed_kind VARCHAR(10);
BEGIN
    UPDATE public.admin_password_request
    SET apr_claimed_at = now()
        WHERE apr_request_fingerprint = p_request_fingerprint
            AND apr_auth_user_id = p_auth_user_id
      AND apr_claimed_at IS NULL
      AND apr_superseded_at IS NULL
      AND apr_expires_at > now()
    RETURNING apr_request_kind INTO claimed_kind;
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
        SELECT 1 FROM public.admin_password_request
                WHERE apr_auth_user_id = p_auth_user_id
                    AND apr_request_fingerprint = p_request_fingerprint
          AND apr_claimed_at IS NULL
          AND apr_superseded_at IS NULL
          AND apr_expires_at > now()
    );
$$;

COMMIT;