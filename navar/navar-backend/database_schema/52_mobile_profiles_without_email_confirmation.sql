BEGIN;
-- Mobile profiles require an authenticated identity, without email confirmation.
CREATE OR REPLACE FUNCTION app_private.enforce_separate_account_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid; email text; identity_email text;
BEGIN
 IF TG_TABLE_NAME='app_user' THEN uid:=NEW.user_auth_user_id; email:=lower(NEW.user_email);
 ELSIF TG_TABLE_NAME='admin' THEN uid:=NEW.admin_auth_user_id; email:=lower(NEW.admin_email);
 ELSE uid:=NEW.auth_user_id; END IF;
 IF uid IS NOT NULL THEN
  SELECT lower(u.email) INTO identity_email FROM auth.users u WHERE u.id=uid FOR UPDATE;
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
  IF email IS DISTINCT FROM identity_email THEN
   RAISE EXCEPTION 'Mobile profile must match the sign-in email.' USING ERRCODE='23514';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.app_user u WHERE u.user_auth_user_id=uid OR lower(u.user_email)=email) THEN
   RAISE EXCEPTION 'This sign-in identity already belongs to a mobile app user. Use a separate web account.' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.enforce_separate_account_profiles() FROM PUBLIC,anon,authenticated;

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

    -- Email comes from Supabase Auth (never from the app).
    SELECT lower(u.email) INTO v_email
    FROM auth.users u
    WHERE u.id = v_uid;

    IF v_email IS NULL OR char_length(v_email) > 100 THEN
        RAISE EXCEPTION 'sign-in email unavailable' USING ERRCODE = '28000';
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
NOTIFY pgrst,'reload schema';
COMMIT;
