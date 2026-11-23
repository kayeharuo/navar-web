BEGIN;
-- The adapted legacy function must not expose a client-side payment bypass.
-- Current manual payment actions go through the authenticated Super Admin API.
REVOKE ALL ON FUNCTION public.complete_my_manual_onboarding_payment() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_my_manual_onboarding_payment() TO service_role;
COMMIT;
