-- NavAR: lock down the public schema, then open ONLY what the mobile app needs
-- Run AFTER 01, 02, 03 and 04, once, in the Supabase SQL Editor. Safe to re-run.
--
-- THE MODEL (one page)
--   * Everything is denied by default: RLS is ON for every table and the
--     public-facing roles (anon, authenticated) get no privileges.
--   * The backend (secret / service_role key) bypasses RLS and is unaffected.
--   * The Unity app signs in with Supabase Auth and then reads/writes tables
--     directly as the role "authenticated". What a logged-in person can do depends
--     on WHO they are (never on what the app claims):
--
--       WHO                                   MAP / STORE DATA THEY CAN READ        CAN WRITE
--       ------------------------------------  ------------------------------------  ---------------------------
--       Public mobile user (APP_USER)         only malls whose AR status is public  their OWN rows only
--       Tester (APP_USER with role 'tester')  every mall, any AR stage              their OWN rows only
--       Mall Admin (official, active)         public malls + their OWN mall         nothing
--       Super Admin (official, active)        every mall, any AR stage              map-building tables + nothing else
--       Not logged in (anon)                  nothing                               nothing
--
--     Admin, billing, contracts, audit, logs stay backend-only for everyone.
--
-- EASY-TO-EDIT SETTINGS (search for the word SETTING)
--   1. app_private.is_public_status()  which AR statuses the PUBLIC may see   (default 'Live')
--   2. register_app_user()             the USER_ROLE given to new mobile users (default 'user')
--   3. app_private.is_tester()         the USER_ROLE that marks a tester      (default 'tester')
--
-- HOW TO MAKE SOMEONE A TESTER (project owner only, in the SQL Editor):
--   UPDATE app_user SET user_role = 'tester' WHERE user_email = 'them@example.com';
--   Users cannot do this to themselves: the app has no permission to change user_role.
--
-- TO GIVE THE APP ACCESS TO ANOTHER TABLE LATER: copy one block from PART D or E,
--   grant only the columns the app needs, and write a policy. Never GRANT ALL.

BEGIN;

-- =====================================================================
-- PART A: deny by default
-- =====================================================================
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Needed so logged-in users can reach the tables they are granted below.
GRANT USAGE ON SCHEMA public TO authenticated;

-- =====================================================================
-- PART B: private helper functions (NOT callable through the Data API)
-- The schema app_private must never be added to "Exposed schemas" in
-- Supabase (Project Settings, Data API). Only "public" should be exposed.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- SETTING 1: AR_DEVELOPMENT_STATUS values the PUBLIC may see. Staff and testers see every
-- status regardless. To let the public also see a testing stage, use e.g. IN ('Live', 'Navigation Testing').
-- If the text does not match what your admin panel stores, the public sees NO map data
-- (it fails closed). Check with:  SELECT DISTINCT ar_development_status FROM ar_development;
CREATE OR REPLACE FUNCTION app_private.is_public_status(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$ SELECT COALESCE(p_status IN ('Live'), false) $$;

-- The logged-in user's APP_USER id (NULL for admins, unregistered logins, or deleted users).
CREATE OR REPLACE FUNCTION app_private.current_app_user_id()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT u.user_id
    FROM public.app_user u
    WHERE u.user_auth_user_id = (SELECT auth.uid())
      AND u.user_deleted_at IS NULL
$$;

-- Is the caller an active, fully activated Super Admin?
CREATE OR REPLACE FUNCTION app_private.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin a
        WHERE a.admin_auth_user_id = (SELECT auth.uid())
          AND a.admin_role = 'super_admin'
          AND a.admin_account_status = 'official'
          AND NOT a.admin_is_deactivated
    )
$$;

-- Can the caller see this mall as STAFF? Super Admin: any mall. Mall Admin: only their own.
CREATE OR REPLACE FUNCTION app_private.staff_can_see_mall(p_mall_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin a
        WHERE a.admin_auth_user_id = (SELECT auth.uid())
          AND a.admin_account_status = 'official'
          AND NOT a.admin_is_deactivated
          AND (a.admin_role = 'super_admin'
               OR (a.admin_role = 'mall_admin' AND a.mall_id = p_mall_id))
    )
$$;

-- SETTING 3: a tester is a registered app user whose USER_ROLE is 'tester'.
CREATE OR REPLACE FUNCTION app_private.is_tester()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.app_user u
        WHERE u.user_auth_user_id = (SELECT auth.uid())
          AND u.user_deleted_at IS NULL
          AND u.user_role = 'tester'
    )
$$;

-- Can the caller see this mall's data? Testers and staff: always. Everyone else: only
-- when one of the mall's AR developments has a public status.
CREATE OR REPLACE FUNCTION app_private.mall_visible(p_mall_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT app_private.is_tester()
        OR app_private.staff_can_see_mall(p_mall_id)
        OR EXISTS (
            SELECT 1
            FROM public.application a
            JOIN public.ar_development d ON d.application_id = a.application_id
            WHERE a.mall_id = p_mall_id
              AND app_private.is_public_status(d.ar_development_status)
        )
$$;

-- Same idea for one specific AR development (version).
CREATE OR REPLACE FUNCTION app_private.ar_visible(p_ar_development_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ar_development d
        JOIN public.application a ON a.application_id = d.application_id
        WHERE d.ar_development_id = p_ar_development_id
          AND (app_private.is_public_status(d.ar_development_status)
               OR app_private.is_tester()
               OR app_private.staff_can_see_mall(a.mall_id))
    )
$$;

CREATE OR REPLACE FUNCTION app_private.floor_visible(p_floor_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT app_private.mall_visible(f.mall_id)
         FROM public.floor f WHERE f.floor_id = p_floor_id),
        false)
$$;

-- A store is visible when it sits in a unit on a visible floor.
CREATE OR REPLACE FUNCTION app_private.store_visible(p_store_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.unit u
        WHERE u.store_id = p_store_id
          AND app_private.floor_visible(u.floor_id)
    )
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

-- Indexes so the policies above stay fast (Postgres does not index foreign keys).
CREATE INDEX IF NOT EXISTS ix_application_mall_id        ON application (mall_id);
CREATE INDEX IF NOT EXISTS ix_ar_development_application ON ar_development (application_id);
CREATE INDEX IF NOT EXISTS ix_floor_mall_id              ON floor (mall_id);
CREATE INDEX IF NOT EXISTS ix_unit_floor_id              ON unit (floor_id);
CREATE INDEX IF NOT EXISTS ix_unit_store_id              ON unit (store_id);
CREATE INDEX IF NOT EXISTS ix_node_floor_id              ON node (floor_id);
CREATE INDEX IF NOT EXISTS ix_edge_ar_development_id     ON edge (ar_development_id);
CREATE INDEX IF NOT EXISTS ix_beacon_mall_id             ON beacon (mall_id);
CREATE INDEX IF NOT EXISTS ix_navsession_user_id         ON navigation_session (user_id);
CREATE INDEX IF NOT EXISTS ix_navplan_user_id            ON navigation_plan (user_id);
CREATE INDEX IF NOT EXISTS ix_plandest_plan_id           ON navigation_plan_destination (plan_id);
CREATE INDEX IF NOT EXISTS ix_bscan_navsesh_id           ON beacon_scan_log (navsesh_id);
CREATE INDEX IF NOT EXISTS ix_storevisit_user_id         ON store_visit (user_id);
CREATE INDEX IF NOT EXISTS ix_promo_interaction_user_id  ON promotion_interaction (user_id);
CREATE INDEX IF NOT EXISTS ix_usersession_user_id        ON user_session (user_id);
CREATE INDEX IF NOT EXISTS ix_usermallvisit_user_id      ON user_mall_visit (user_id);
CREATE INDEX IF NOT EXISTS ix_accesspref_user_id         ON accessibility_preference (user_id);
CREATE INDEX IF NOT EXISTS ix_notifpref_user_id          ON notif_preference (user_id);
CREATE INDEX IF NOT EXISTS ix_entrypoint_floor_id        ON application_entry_point (floor_id);
CREATE INDEX IF NOT EXISTS ix_appfloorplan_floor_id      ON application_floor_plan (floor_id);
CREATE INDEX IF NOT EXISTS ix_floorcalib_ar_id           ON floor_calibration (ar_development_id);
CREATE INDEX IF NOT EXISTS ix_beaconnode_ar_id           ON beacon_node_assigment (ar_development_id);
CREATE INDEX IF NOT EXISTS ix_admin_auth_user_id         ON admin (admin_auth_user_id);

-- =====================================================================
-- PART C: sign-up. The app calls this ONCE after the user has signed up
-- and confirmed their email:  POST /rest/v1/rpc/register_app_user
-- It is the only way an APP_USER row is created, so the app cannot pick its
-- own role, email, or auth id.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.register_app_user(
    p_name   text,
    p_gender text DEFAULT NULL,
    p_dob    date DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    -- SETTING 2: the USER_ROLE value given to every mobile user.
    v_role  constant text := 'user';
    v_uid   uuid := auth.uid();
    v_email text;
    v_id    bigint;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    -- Web admins and mobile users share one login pool. Admins may never become app users.
    IF EXISTS (SELECT 1 FROM public.admin WHERE admin_auth_user_id = v_uid) THEN
        RAISE EXCEPTION 'this account type cannot register here' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (SELECT 1 FROM public.app_user WHERE user_auth_user_id = v_uid) THEN
        RAISE EXCEPTION 'already registered' USING ERRCODE = '23505';
    END IF;

    p_name := btrim(p_name);
    IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 1 AND 50 THEN
        RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
    IF p_gender IS NOT NULL AND char_length(p_gender) > 10 THEN
        RAISE EXCEPTION 'invalid gender' USING ERRCODE = '22023';
    END IF;
    IF p_dob IS NOT NULL AND (p_dob > current_date OR p_dob < DATE '1900-01-01') THEN
        RAISE EXCEPTION 'invalid date of birth' USING ERRCODE = '22023';
    END IF;

    -- Email comes from Supabase Auth (never from the app) and must be confirmed.
    SELECT lower(u.email) INTO v_email
    FROM auth.users u
    WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL;

    IF v_email IS NULL OR char_length(v_email) > 100 THEN
        RAISE EXCEPTION 'email not confirmed' USING ERRCODE = '28000';
    END IF;

    INSERT INTO public.app_user (
        user_role, user_name, user_email, user_gender, user_dob,
        user_created_at, user_last_login, user_auth_user_id
    ) VALUES (
        v_role, p_name, v_email, p_gender, p_dob,
        now(), now(), v_uid
    )
    RETURNING user_id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_app_user(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_app_user(text, text, date) TO authenticated;

-- =====================================================================
-- PART D: READ-ONLY reference data (map, stores, beacons)
-- Rows are visible per the table at the top: public users see public-status malls only;
-- testers and staff see more (see app_private.mall_visible).
-- Column lists are deliberate: private columns (store contact details, beacon
-- maintenance data, internal timestamps) are NOT granted, so the app must ask
-- for columns by name (select=store_id,store_name...) instead of select=*.
-- =====================================================================

-- ---- mall (all columns) ----
GRANT SELECT ON mall TO authenticated;
DROP POLICY IF EXISTS mobile_read_mall ON mall;
CREATE POLICY mobile_read_mall ON mall FOR SELECT TO authenticated
    USING (app_private.mall_visible(mall_id));

-- ---- floor ----
GRANT SELECT ON floor TO authenticated;
DROP POLICY IF EXISTS mobile_read_floor ON floor;
CREATE POLICY mobile_read_floor ON floor FOR SELECT TO authenticated
    USING (app_private.mall_visible(mall_id));

-- ---- unit ----
GRANT SELECT ON unit TO authenticated;
DROP POLICY IF EXISTS mobile_read_unit ON unit;
CREATE POLICY mobile_read_unit ON unit FOR SELECT TO authenticated
    USING (app_private.floor_visible(floor_id));

-- ---- node ----
GRANT SELECT ON node TO authenticated;
DROP POLICY IF EXISTS mobile_read_node ON node;
CREATE POLICY mobile_read_node ON node FOR SELECT TO authenticated
    USING (app_private.floor_visible(floor_id));

-- ---- edge ----
GRANT SELECT ON edge TO authenticated;
DROP POLICY IF EXISTS mobile_read_edge ON edge;
CREATE POLICY mobile_read_edge ON edge FOR SELECT TO authenticated
    USING (app_private.ar_visible(ar_development_id));

-- ---- floor_calibration ----
GRANT SELECT ON floor_calibration TO authenticated;
DROP POLICY IF EXISTS mobile_read_floor_calibration ON floor_calibration;
CREATE POLICY mobile_read_floor_calibration ON floor_calibration FOR SELECT TO authenticated
    USING (app_private.ar_visible(ar_development_id));

-- ---- beacon_node_assigment (table name spelled as in the schema) ----
GRANT SELECT ON beacon_node_assigment TO authenticated;
DROP POLICY IF EXISTS mobile_read_beacon_node_assigment ON beacon_node_assigment;
CREATE POLICY mobile_read_beacon_node_assigment ON beacon_node_assigment FOR SELECT TO authenticated
    USING (app_private.ar_visible(ar_development_id));

-- ---- beacon (identification columns only; no status/maintenance/battery info) ----
GRANT SELECT (beacon_id, beacon_code, beacon_label, beacon_minor, beacon_tx_power,
              beacon_location, mall_id, floor_id) ON beacon TO authenticated;
DROP POLICY IF EXISTS mobile_read_beacon ON beacon;
CREATE POLICY mobile_read_beacon ON beacon FOR SELECT TO authenticated
    USING (app_private.mall_visible(mall_id));

-- ---- store (public columns only; NO contact person / phone / email / CR flag) ----
GRANT SELECT (store_id, store_name, store_status, brand_id) ON store TO authenticated;
DROP POLICY IF EXISTS mobile_read_store ON store;
CREATE POLICY mobile_read_store ON store FOR SELECT TO authenticated
    USING (app_private.store_visible(store_id));

-- ---- store_additional_info ----
GRANT SELECT (addinfo_id, addinfo_text, store_id) ON store_additional_info TO authenticated;
DROP POLICY IF EXISTS mobile_read_store_additional_info ON store_additional_info;
CREATE POLICY mobile_read_store_additional_info ON store_additional_info FOR SELECT TO authenticated
    USING (app_private.store_visible(store_id));

-- ---- operating_hours (mall hours or store hours) ----
GRANT SELECT ON operating_hours TO authenticated;
DROP POLICY IF EXISTS mobile_read_operating_hours ON operating_hours;
CREATE POLICY mobile_read_operating_hours ON operating_hours FOR SELECT TO authenticated
    USING (
        (mall_id  IS NOT NULL AND app_private.mall_visible(mall_id))
     OR (store_id IS NOT NULL AND app_private.store_visible(store_id))
    );

-- ---- promotion (add a status filter here once PROMOTION_STATUS values are decided) ----
GRANT SELECT (promotion_id, promotion_title, promotion_description, promotion_type,
              promotion_start_date, promotion_end_date, promotion_status, store_id)
    ON promotion TO authenticated;
DROP POLICY IF EXISTS mobile_read_promotion ON promotion;
CREATE POLICY mobile_read_promotion ON promotion FOR SELECT TO authenticated
    USING (app_private.store_visible(store_id));

-- ---- brand (global public catalog) ----
GRANT SELECT (brand_id, brand_name, brand_logo, brand_description, brand_category)
    ON brand TO authenticated;
DROP POLICY IF EXISTS mobile_read_brand ON brand;
CREATE POLICY mobile_read_brand ON brand FOR SELECT TO authenticated
    USING (true);

-- ---- application_entry_point (where AR starts in a mall) ----
GRANT SELECT (app_entry_point_id, app_entry_point_label, app_entry_point_description,
              application_id, floor_id) ON application_entry_point TO authenticated;
DROP POLICY IF EXISTS mobile_read_application_entry_point ON application_entry_point;
CREATE POLICY mobile_read_application_entry_point ON application_entry_point FOR SELECT TO authenticated
    USING (app_private.floor_visible(floor_id));

-- ---- application_floor_plan (floor plan image, routes, scale) ----
GRANT SELECT (app_floor_plan_id, app_floor_plan_image, app_floor_plan_reference_line,
              app_floor_plan_meter_length, app_floor_plan_accessibility_route,
              app_floor_plan_emergency_route, application_id, floor_id)
    ON application_floor_plan TO authenticated;
DROP POLICY IF EXISTS mobile_read_application_floor_plan ON application_floor_plan;
CREATE POLICY mobile_read_application_floor_plan ON application_floor_plan FOR SELECT TO authenticated
    USING (app_private.floor_visible(floor_id));

-- ---- ar_development (version/status, so the app can tell which map version to use) ----
GRANT SELECT (ar_development_id, ar_development_status, ar_development_version,
              ar_development_activated_at, application_id) ON ar_development TO authenticated;
DROP POLICY IF EXISTS mobile_read_ar_development ON ar_development;
CREATE POLICY mobile_read_ar_development ON ar_development FOR SELECT TO authenticated
    USING (app_private.ar_visible(ar_development_id));

-- ---- system_settings (only the beacon UUID the app scans for) ----
GRANT SELECT (settings_beacon_uuid) ON system_settings TO authenticated;
DROP POLICY IF EXISTS mobile_read_system_settings ON system_settings;
CREATE POLICY mobile_read_system_settings ON system_settings FOR SELECT TO authenticated
    USING (true);

-- =====================================================================
-- PART E: the user's OWN data (read/write). A user sees and changes only rows
-- where USER_ID is their own. Nobody gets DELETE unless stated.
-- Users who are deleted (USER_DELETED_AT set) or are admins match nothing.
-- =====================================================================

-- ---- app_user: read own profile; change name / gender / date of birth / last login only ----
GRANT SELECT (user_id, user_role, user_name, user_email, user_gender, user_dob,
              user_created_at, user_last_login) ON app_user TO authenticated;
GRANT UPDATE (user_name, user_gender, user_dob, user_last_login) ON app_user TO authenticated;
DROP POLICY IF EXISTS mobile_own_app_user_read ON app_user;
CREATE POLICY mobile_own_app_user_read ON app_user FOR SELECT TO authenticated
    USING (user_auth_user_id = (SELECT auth.uid()) AND user_deleted_at IS NULL);
DROP POLICY IF EXISTS mobile_own_app_user_update ON app_user;
CREATE POLICY mobile_own_app_user_update ON app_user FOR UPDATE TO authenticated
    USING      (user_auth_user_id = (SELECT auth.uid()) AND user_deleted_at IS NULL)
    WITH CHECK (user_auth_user_id = (SELECT auth.uid()) AND user_deleted_at IS NULL);

-- ---- simple "USER_ID = me" tables ----
GRANT SELECT, INSERT, UPDATE ON accessibility_preference TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON accessibility_preference;
CREATE POLICY mobile_own_rows ON accessibility_preference FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT, UPDATE ON notif_preference TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON notif_preference;
CREATE POLICY mobile_own_rows ON notif_preference FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT, UPDATE ON navigation_plan TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON navigation_plan;
CREATE POLICY mobile_own_rows ON navigation_plan FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT, UPDATE ON navigation_session TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON navigation_session;
CREATE POLICY mobile_own_rows ON navigation_session FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT, UPDATE ON user_session TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON user_session;
CREATE POLICY mobile_own_rows ON user_session FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT, UPDATE ON user_mall_visit TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON user_mall_visit;
CREATE POLICY mobile_own_rows ON user_mall_visit FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

-- Insert-only activity records (no edits, no deletes)
GRANT SELECT, INSERT ON store_visit TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON store_visit;
CREATE POLICY mobile_own_rows ON store_visit FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

GRANT SELECT, INSERT ON promotion_interaction TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON promotion_interaction;
CREATE POLICY mobile_own_rows ON promotion_interaction FOR ALL TO authenticated
    USING      (user_id = (SELECT app_private.current_app_user_id()))
    WITH CHECK (user_id = (SELECT app_private.current_app_user_id()));

-- ---- tables owned through another table ----
-- A destination belongs to the user who owns its plan. It may only point at that
-- user's own navigation session.
GRANT SELECT, INSERT, UPDATE, DELETE ON navigation_plan_destination TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON navigation_plan_destination;
CREATE POLICY mobile_own_rows ON navigation_plan_destination FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.navigation_plan p
                WHERE p.plan_id = navigation_plan_destination.plan_id
                  AND p.user_id = (SELECT app_private.current_app_user_id()))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.navigation_plan p
                WHERE p.plan_id = navigation_plan_destination.plan_id
                  AND p.user_id = (SELECT app_private.current_app_user_id()))
        AND (navigation_plan_destination.navsesh_id IS NULL
             OR EXISTS (SELECT 1 FROM public.navigation_session s
                        WHERE s.navsesh_id = navigation_plan_destination.navsesh_id
                          AND s.user_id = (SELECT app_private.current_app_user_id())))
    );

-- Beacon scans belong to the user who owns the navigation session (insert-only).
GRANT SELECT, INSERT ON beacon_scan_log TO authenticated;
DROP POLICY IF EXISTS mobile_own_rows ON beacon_scan_log;
CREATE POLICY mobile_own_rows ON beacon_scan_log FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.navigation_session s
                WHERE s.navsesh_id = beacon_scan_log.navsesh_id
                  AND s.user_id = (SELECT app_private.current_app_user_id()))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.navigation_session s
                WHERE s.navsesh_id = beacon_scan_log.navsesh_id
                  AND s.user_id = (SELECT app_private.current_app_user_id()))
    );

-- =====================================================================
-- PART F: AR DEVELOPMENT. Unity may BUILD map data, but ONLY for an active, fully
-- activated Super Admin (checked in the database from the ADMIN table, never from
-- anything the app sends). Public users, testers and Mall Admins cannot write here.
-- Remove this whole part if Unity will only ever READ map data.
-- Note: writes made this way skip the backend, so they are not audit-logged.
-- =====================================================================
GRANT INSERT, UPDATE, DELETE ON node                  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON edge                  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON floor_calibration     TO authenticated;
GRANT INSERT, UPDATE, DELETE ON beacon_node_assigment TO authenticated;

DROP POLICY IF EXISTS staff_write_node ON node;
CREATE POLICY staff_write_node ON node FOR ALL TO authenticated
    USING (app_private.is_super_admin()) WITH CHECK (app_private.is_super_admin());

DROP POLICY IF EXISTS staff_write_edge ON edge;
CREATE POLICY staff_write_edge ON edge FOR ALL TO authenticated
    USING (app_private.is_super_admin()) WITH CHECK (app_private.is_super_admin());

DROP POLICY IF EXISTS staff_write_floor_calibration ON floor_calibration;
CREATE POLICY staff_write_floor_calibration ON floor_calibration FOR ALL TO authenticated
    USING (app_private.is_super_admin()) WITH CHECK (app_private.is_super_admin());

DROP POLICY IF EXISTS staff_write_beacon_node_assigment ON beacon_node_assigment;
CREATE POLICY staff_write_beacon_node_assigment ON beacon_node_assigment FOR ALL TO authenticated
    USING (app_private.is_super_admin()) WITH CHECK (app_private.is_super_admin());

-- Auto-numbered IDs need sequence access for the tables the app can INSERT into.
DO $$
DECLARE
    r record;
    seq text;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('accessibility_preference',    'pref_id'),
            ('notif_preference',            'notifpref_id'),
            ('navigation_plan',             'plan_id'),
            ('navigation_plan_destination', 'plan_dest_id'),
            ('navigation_session',          'navsesh_id'),
            ('user_session',                'session_id'),
            ('user_mall_visit',             'visit_id'),
            ('store_visit',                 'store_visit_id'),
            ('promotion_interaction',       'interaction_id'),
            ('beacon_scan_log',             'bscan_id'),
            ('node',                        'node_id'),
            ('edge',                        'edge_id'),
            ('floor_calibration',           'calibration_id'),
            ('beacon_node_assigment',       'assignment_id')
        ) AS v(tbl, col)
    LOOP
        seq := pg_get_serial_sequence('public.' || r.tbl, r.col);
        IF seq IS NULL THEN
            RAISE EXCEPTION 'No sequence found for %.% (is the column SERIAL?)', r.tbl, r.col;
        END IF;
        EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', seq);
    END LOOP;
END $$;

-- =====================================================================
-- Deliberately NOT granted to the mobile app (backend only):
--   ADMIN, ACCOUNT_INVITE, AUDIT_LOG, EMAIL_LOG, CONTRACT, PAYMENT, WALLET,
--   TRANSACTION_HISTORY, SUSPENSION, SUBSCRIPTION_TIER, SYSTEM_SETTINGS (other
--   columns), TENANT, INQUIRY*, THREAD*, APPLICATION and STALL* tables (other than
--   the columns above), AR_DEVELOPMENT (other columns), BEACON_TICKET*, BATTERY,
--   ANALYTICS_*, and NOTIFICATION (NOTIF_RECIPIENT does not say
--   whether it is an admin or a user id; decide that before opening it).
-- =====================================================================

COMMIT;