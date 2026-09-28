-- NavAR Account Management / Supabase Auth preparation
-- Run this after 01_navar_schema.sql and 02/03 (in order).
-- Assumes the ADMIN and APP_USER tables are EMPTY. This migration does not
-- create users, send email, or expose an API. Run it once in the Supabase SQL Editor.
--
-- Design: Supabase Auth (auth.users) owns identity and passwords for BOTH web
-- admins and mobile users. ADMIN and APP_USER are application profile tables,
-- each linked to exactly one Auth user through ADMIN_AUTH_USER_ID (ADMIN) or USER_AUTH_USER_ID (APP_USER). Neither table
-- stores passwords.

BEGIN;

-- Safety guard: stop immediately if either table has rows, because this
-- migration adds NOT NULL / CHECK rules that assume clean tables.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ADMIN) THEN
        RAISE EXCEPTION 'ADMIN table is not empty. Stop and review before running 04.';
    END IF;
    IF EXISTS (SELECT 1 FROM APP_USER) THEN
        RAISE EXCEPTION 'APP_USER table is not empty. Stop and review before running 04.';
    END IF;
END $$;

-- =========================================================
-- ADMIN (web: super_admin, mall_admin, store_admin)
-- =========================================================

-- Link every admin to exactly one Supabase Auth identity.
-- Required from day one: no admin can exist without an Auth user.
ALTER TABLE ADMIN
    ADD COLUMN ADMIN_AUTH_USER_ID UUID NOT NULL;

ALTER TABLE ADMIN
    ADD CONSTRAINT uq_admin_auth_user_id
    UNIQUE (ADMIN_AUTH_USER_ID);

-- RESTRICT: an Auth user cannot be deleted while its ADMIN profile exists.
-- (Delete the ADMIN row first, or deactivate instead of deleting.)
ALTER TABLE ADMIN
    ADD CONSTRAINT fk_admin_auth_user_id
    FOREIGN KEY (ADMIN_AUTH_USER_ID)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;

-- The application never stores passwords. Supabase Auth hashes and verifies them.
ALTER TABLE ADMIN
    DROP COLUMN ADMIN_PASSWORD_HASH;

-- One canonical set of roles and lifecycle statuses.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_role
    CHECK (ADMIN_ROLE IN ('super_admin', 'mall_admin', 'store_admin'));

ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_account_status
    CHECK (ADMIN_ACCOUNT_STATUS IN ('partial', 'official', 'deactivated'));

-- Scope rules. Store Admin is not exposed in the first UI, but its
-- relationship is prepared for later.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_scope
    CHECK (
        (ADMIN_ROLE = 'super_admin' AND MALL_ID IS NULL AND STORE_ID IS NULL)
        OR (ADMIN_ROLE = 'mall_admin' AND MALL_ID IS NOT NULL AND STORE_ID IS NULL)
        OR (ADMIN_ROLE = 'store_admin' AND STORE_ID IS NOT NULL)
    );

-- Keep the two deactivation fields from disagreeing.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_deactivation_consistent
    CHECK ((ADMIN_ACCOUNT_STATUS = 'deactivated') = ADMIN_IS_DEACTIVATED);

-- Supabase Auth stores emails lowercase. Force the profile to match, and
-- block duplicates regardless of casing.
ALTER TABLE ADMIN
    ADD CONSTRAINT ck_admin_email_lowercase
    CHECK (ADMIN_EMAIL = LOWER(ADMIN_EMAIL));

CREATE UNIQUE INDEX ux_admin_email_case_insensitive
    ON ADMIN (LOWER(ADMIN_EMAIL));

-- =========================================================
-- APP_USER (mobile app users, self-registered)
-- =========================================================

-- Link every mobile user to exactly one Supabase Auth identity.
ALTER TABLE APP_USER
    ADD COLUMN USER_AUTH_USER_ID UUID NOT NULL;

ALTER TABLE APP_USER
    ADD CONSTRAINT uq_app_user_auth_user_id
    UNIQUE (USER_AUTH_USER_ID);

-- RESTRICT: users leave through soft deletion (USER_DELETED_AT). Other tables
-- reference USER_ID, so a hard delete must be handled deliberately.
ALTER TABLE APP_USER
    ADD CONSTRAINT fk_app_user_auth_user_id
    FOREIGN KEY (USER_AUTH_USER_ID)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;

-- The application never stores passwords.
ALTER TABLE APP_USER
    DROP COLUMN USER_PWHASH;

-- 50 characters can truncate valid email addresses. Match ADMIN_EMAIL (100).
ALTER TABLE APP_USER
    ALTER COLUMN USER_EMAIL TYPE VARCHAR(100);

ALTER TABLE APP_USER
    ADD CONSTRAINT ck_app_user_email_lowercase
    CHECK (USER_EMAIL = LOWER(USER_EMAIL));

CREATE UNIQUE INDEX ux_app_user_email_case_insensitive
    ON APP_USER (LOWER(USER_EMAIL));

COMMIT;

-- Not handled here (do in a later migration):
--  * Row Level Security / revoking anon and authenticated access (05 lock-down).
--  * A CHECK on APP_USER.USER_ROLE once the allowed values are decided.
--  * A trigger ensuring a store_admin's MALL_ID matches the store's mall.