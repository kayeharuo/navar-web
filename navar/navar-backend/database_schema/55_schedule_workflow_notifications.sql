BEGIN;
-- Supabase has pg_cron installed. The backend lifecycle worker also calls this
-- function as a fallback; event keys prevent duplicate alerts.
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('navar-subscription-deadline-alerts','*/15 * * * *','SELECT public.monitor_subscription_deadlines();');
 END IF;
END $$;
COMMIT;
