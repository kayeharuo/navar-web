-- Keep account lifecycle and deactivation history separate.
-- Run after 04_account_management_auth_preparation.sql.
-- Deactivated accounts retain partial/official status and their historical timestamp.

BEGIN;

ALTER TABLE public.admin
    DROP CONSTRAINT IF EXISTS ck_admin_deactivation_consistent;

ALTER TABLE public.admin
    DROP CONSTRAINT IF EXISTS ck_admin_account_status;

UPDATE public.admin
SET admin_account_status = CASE
    WHEN admin_last_login IS NULL THEN 'partial'
    ELSE 'official'
END
WHERE admin_account_status = 'deactivated';

ALTER TABLE public.admin
    ADD CONSTRAINT ck_admin_account_status
    CHECK (admin_account_status IN ('partial', 'official'));

ALTER TABLE public.admin
    ADD CONSTRAINT ck_admin_deactivation_consistent
    CHECK (NOT admin_is_deactivated OR admin_deactivated_on IS NOT NULL);

COMMIT;
