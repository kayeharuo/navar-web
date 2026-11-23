BEGIN;

-- Auth is the shared login pool, not evidence that someone is a mobile user.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC,anon,authenticated;

-- Retain a private recovery copy of profiles accidentally created for web staff.
CREATE TABLE IF NOT EXISTS app_private.web_profile_cleanup_archive (
 user_id bigint PRIMARY KEY,
 profile jsonb NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.web_profile_cleanup_archive FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE app_private.web_profile_cleanup_archive ENABLE ROW LEVEL SECURITY;

LOCK TABLE public.app_user,public.admin,public.tenant_account IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE web_profile_cleanup_ids ON COMMIT DROP AS
 SELECT u.user_id FROM public.app_user u WHERE
 EXISTS(SELECT 1 FROM public.admin a WHERE a.admin_auth_user_id=u.user_auth_user_id OR lower(a.admin_email)=lower(u.user_email))
 OR EXISTS(SELECT 1 FROM public.tenant_account t WHERE t.auth_user_id=u.user_auth_user_id);

-- Abort rather than cascade away mobile history or preferences.
DO $$ DECLARE dep record; referenced boolean; BEGIN
 FOR dep IN SELECT c.conrelid::regclass tbl,a.attname col
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  WHERE c.contype='f' AND c.confrelid='public.app_user'::regclass
 LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s d JOIN web_profile_cleanup_ids w ON w.user_id=d.%I)',dep.tbl,dep.col) INTO referenced;
  IF referenced THEN RAISE EXCEPTION 'Web mobile-profile cleanup has dependent data in %. Review before removing profiles.',dep.tbl; END IF;
 END LOOP;
END $$;
INSERT INTO app_private.web_profile_cleanup_archive(user_id,profile)
 SELECT u.user_id,to_jsonb(u) FROM public.app_user u JOIN web_profile_cleanup_ids w USING(user_id)
 ON CONFLICT(user_id) DO NOTHING;
DELETE FROM public.app_user u USING web_profile_cleanup_ids w WHERE u.user_id=w.user_id;

-- A private definer trigger must inspect all profiles, even for callers whose
-- RLS cannot see admin records. Serialize by identity to cover concurrent sites.
CREATE OR REPLACE FUNCTION app_private.enforce_separate_account_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid; email text; identity_email text; confirmed timestamptz;
BEGIN
 IF TG_TABLE_NAME='app_user' THEN uid:=NEW.user_auth_user_id; email:=lower(NEW.user_email);
 ELSIF TG_TABLE_NAME='admin' THEN uid:=NEW.admin_auth_user_id; email:=lower(NEW.admin_email);
 ELSE uid:=NEW.auth_user_id; END IF;
 IF uid IS NOT NULL THEN
  SELECT lower(u.email),u.email_confirmed_at INTO identity_email,confirmed FROM auth.users u WHERE u.id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A valid sign-in identity is required.' USING ERRCODE='23503'; END IF;
 END IF;
 email:=COALESCE(email,identity_email);
 -- Email also protects legacy admin profiles without a linked Auth UUID.
 IF email IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('navar-profile:'||email,0)); END IF;
 IF TG_TABLE_NAME='app_user' THEN
  IF EXISTS(SELECT 1 FROM public.admin a WHERE a.admin_auth_user_id=uid OR lower(a.admin_email)=email)
   OR EXISTS(SELECT 1 FROM public.tenant_account t WHERE t.auth_user_id=uid) THEN
   RAISE EXCEPTION 'Web admin and tenant accounts cannot have a mobile app profile.' USING ERRCODE='23514';
  END IF;
  IF email IS DISTINCT FROM identity_email OR confirmed IS NULL THEN
   RAISE EXCEPTION 'Mobile profile requires the confirmed sign-in email.' USING ERRCODE='23514';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.app_user u WHERE u.user_auth_user_id=uid OR lower(u.user_email)=email) THEN
   RAISE EXCEPTION 'This sign-in identity already belongs to a mobile app user. Use a separate web account.' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.enforce_separate_account_profiles() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS separate_mobile_profile ON public.app_user;
CREATE TRIGGER separate_mobile_profile BEFORE INSERT OR UPDATE OF user_auth_user_id,user_email ON public.app_user
 FOR EACH ROW EXECUTE FUNCTION app_private.enforce_separate_account_profiles();
DROP TRIGGER IF EXISTS separate_admin_profile ON public.admin;
CREATE TRIGGER separate_admin_profile BEFORE INSERT OR UPDATE OF admin_auth_user_id,admin_email ON public.admin
 FOR EACH ROW EXECUTE FUNCTION app_private.enforce_separate_account_profiles();
DROP TRIGGER IF EXISTS separate_tenant_profile ON public.tenant_account;
CREATE TRIGGER separate_tenant_profile BEFORE INSERT OR UPDATE OF auth_user_id ON public.tenant_account
 FOR EACH ROW EXECUTE FUNCTION app_private.enforce_separate_account_profiles();

-- Existing permissive policies cannot override these ownership checks.
ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mobile_profile_insert_identity ON public.app_user;
CREATE POLICY mobile_profile_insert_identity ON public.app_user AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(user_auth_user_id=(SELECT auth.uid()) AND user_role='user');
DROP POLICY IF EXISTS mobile_profile_update_identity ON public.app_user;
CREATE POLICY mobile_profile_update_identity ON public.app_user AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(user_auth_user_id=(SELECT auth.uid())) WITH CHECK(user_auth_user_id=(SELECT auth.uid()));
-- Do not let browser clients change account ownership, email, roles or deletion.
REVOKE UPDATE ON public.app_user FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(user_id,user_role,user_name,user_email,user_gender,user_dob,user_created_at,user_deleted_at,user_last_login,user_auth_user_id) ON public.app_user FROM PUBLIC,anon,authenticated;
GRANT UPDATE(user_name,user_gender,user_dob,user_last_login) ON public.app_user TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
