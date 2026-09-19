-- NavAR Account Management / Supabase Auth preparation
-- Run this after 01_navar_schema.sql.
-- This migration does not create users, send email, or expose an API.
-- Run it once in the Supabase SQL Editor after confirming the project is backed up.

BEGIN;

-- Supabase Auth owns identity and passwords. ADMIN stores the application profile.
ALTER TABLE ADMIN
    ADD COLUMN AUTH_USER_ID UUID;

ALTER TABLE ADMIN
    ADD CONSTRAINT uq_admin_auth_user_id
    UNIQUE (AUTH_USER_ID);

ALTER TABLE ADMIN
    ADD CONSTRAINT fk_admin_auth_user_id
    FOREIGN KEY (AUTH_USER_ID)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;

-- Keep this nullable only during migration. New application-created admins must
-- always receive AUTH_USER_ID from Supabase Auth before their ADMIN row is saved.
ALTER TABLE ADMIN
    ALTER COLUMN ADMIN_PASSWORD_HASH DROP NOT NULL;

-- Use one canonical set of roles and lifecycle statuses.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_role
    CHECK (ADMIN_ROLE IN ('super_admin', 'mall_admin', 'store_admin'));

ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_account_status
    CHECK (ADMIN_ACCOUNT_STATUS IN ('partial', 'official', 'deactivated'));

-- Scope rules for all three admin types. Store Admin is not exposed in the first UI,
-- but its database relationship is prepared for later.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_scope
    CHECK (
        (ADMIN_ROLE = 'super_admin' AND MALL_ID IS NULL AND STORE_ID IS NULL)
        OR (ADMIN_ROLE = 'mall_admin' AND MALL_ID IS NOT NULL AND STORE_ID IS NULL)
        OR (ADMIN_ROLE = 'store_admin' AND STORE_ID IS NOT NULL)
    );

-- Supabase Auth treats email addresses case-insensitively. Keep the application
-- profile from containing duplicate emails with different casing.
CREATE UNIQUE INDEX ux_admin_email_case_insensitive
    ON ADMIN (LOWER(ADMIN_EMAIL));

COMMIT;

-- Later, after every existing ADMIN row has an AUTH_USER_ID and the backend no
-- longer uses ADMIN_PASSWORD_HASH, run these separately:
--
-- ALTER TABLE ADMIN ALTER COLUMN AUTH_USER_ID SET NOT NULL;
-- ALTER TABLE ADMIN DROP COLUMN ADMIN_PASSWORD_HASH;
