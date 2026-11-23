-- One-time, owner-run recording reset requested by the user. Not a migration.
-- Exact targets: mall 12, application 37 (version 2), service 20, thread 35.
-- Shared version 1 Storage files and subscription/payment records are retained.
BEGIN;
CREATE TABLE IF NOT EXISTS app_private.application_reset_archive (
 archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mall_id bigint NOT NULL,application_id bigint NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(),archived_by text NOT NULL DEFAULT current_user,
 reason text NOT NULL,payload jsonb NOT NULL
);
ALTER TABLE app_private.application_reset_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.application_reset_archive FROM PUBLIC,anon,authenticated,service_role;

DO $$
DECLARE a public.application; s public.mall_service_request; payload jsonb;
 original_application jsonb; original_ar jsonb; original_contract jsonb;
BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=12 FOR UPDATE;
 SELECT * INTO a FROM public.application WHERE application_id=37 AND mall_id=12 AND application_version=2 FOR UPDATE;
 IF a.application_id IS NULL THEN RAISE EXCEPTION 'Expected Gaisano Fiesta version 2 application 37 was not found';END IF;
 IF (SELECT array_agg(application_id ORDER BY application_id) FROM public.application WHERE mall_id=12 AND application_version>=2) IS DISTINCT FROM ARRAY[37]::bigint[] THEN RAISE EXCEPTION 'Additional versions or attempts exist; inspect them before resetting';END IF;
 SELECT * INTO s FROM public.mall_service_request WHERE service_id=20 AND application_id=37 AND mall_id=12 FOR UPDATE;
 IF a.application_accepted_at IS NOT NULL OR a.application_status NOT IN ('pending','rejected','rejected_final','disputed') OR s.service_id IS NULL OR s.payment_request_id IS NOT NULL OR s.status NOT IN ('requested','cancelled') OR EXISTS(SELECT 1 FROM public.ar_development WHERE application_id=37) THEN RAISE EXCEPTION 'The request advanced or has financial/development records; stop and inspect';END IF;
 IF EXISTS(SELECT 1 FROM public.contract_payment_request WHERE mall_id=12 AND (details->>'application_id'='37' OR details->>'service_id'='20')) THEN RAISE EXCEPTION 'Related payment records must be reconciled before reset';END IF;
 IF EXISTS(SELECT 1 FROM public.map_application_floor_source x JOIN public.application_floor_plan p ON p.app_floor_plan_id=x.source_plan_id WHERE p.application_id=37 AND x.application_id<>37) OR EXISTS(SELECT 1 FROM app_private.map_intake_submission WHERE source_application_id=37 AND application_id<>37) THEN RAISE EXCEPTION 'Another application depends on version 2';END IF;
 IF EXISTS(SELECT 1 FROM public.thread_message_attachment x JOIN public.thread_message m ON m.message_id=x.thread_message_id JOIN public.thread t ON t.thread_id=m.thread_id WHERE t.application_id=37) THEN RAISE EXCEPTION 'Thread attachments exist; inspect Storage references before resetting';END IF;
 SELECT to_jsonb(x) INTO original_application FROM public.application x WHERE application_id=16;
 SELECT to_jsonb(x) INTO original_ar FROM public.ar_development x WHERE ar_development_id=17;
 SELECT to_jsonb(x) INTO original_contract FROM public.contract x WHERE contract_id=19;
 IF original_ar->>'ar_development_status'<>'live' THEN RAISE EXCEPTION 'Version 1 is no longer Live; stop and inspect';END IF;

 CREATE TEMP TABLE reset_notification_ids ON COMMIT DROP AS SELECT admin_notif_id FROM public.admin_notification WHERE mall_id=12 AND (
  admin_notif_action_url ~ '[?&]applicationId=37(&|$)' OR workflow_event_key LIKE 'application:37:%' OR workflow_event_key LIKE 'service:20:%');
 payload:=jsonb_build_object(
  'application',to_jsonb(a),'service',to_jsonb(s),
  'floor_plans',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.application_floor_plan x WHERE application_id=37),
  'entry_points',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.application_entry_point x WHERE application_id=37),
  'floor_sources',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.map_application_floor_source x WHERE application_id=37),
  'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM app_private.map_intake_submission x WHERE application_id=37),
  'threads',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.thread x WHERE application_id=37),
  'messages',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.thread_message x JOIN public.thread t USING(thread_id) WHERE t.application_id=37),
  'read_receipts',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.thread_admin_read x JOIN public.thread t USING(thread_id) WHERE t.application_id=37),
  'notifications',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.admin_notification x JOIN reset_notification_ids USING(admin_notif_id)),
  'workflow_events',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM app_private.workflow_monitor_event x WHERE event_key LIKE 'application:37:%' OR event_key LIKE 'service:20:%')
 );
 INSERT INTO app_private.application_reset_archive(mall_id,application_id,reason,payload) VALUES(12,37,'User requested removal of version 2 to record and repeat the application workflow.',payload);

 DELETE FROM public.thread_admin_read WHERE thread_id IN (SELECT thread_id FROM public.thread WHERE application_id=37);
 DELETE FROM public.thread_message WHERE thread_id IN (SELECT thread_id FROM public.thread WHERE application_id=37);
 DELETE FROM public.thread WHERE application_id=37;
 DELETE FROM public.map_application_floor_source WHERE application_id=37;
 DELETE FROM app_private.map_intake_submission WHERE application_id=37;
 DELETE FROM public.application_entry_point WHERE application_id=37;
 DELETE FROM public.application_floor_plan WHERE application_id=37;
 DELETE FROM public.mall_service_request WHERE service_id=20 AND application_id=37;
 DELETE FROM public.admin_notification WHERE admin_notif_id IN (SELECT admin_notif_id FROM reset_notification_ids);
 DELETE FROM app_private.workflow_monitor_event WHERE event_key LIKE 'application:37:%' OR event_key LIKE 'service:20:%';
 DELETE FROM public.application WHERE application_id=37 AND mall_id=12 AND application_version=2;

 IF original_application IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.application x WHERE application_id=16) OR original_ar IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.ar_development x WHERE ar_development_id=17) OR original_contract IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.contract x WHERE contract_id=19) THEN RAISE EXCEPTION 'Version 1 or the existing subscription changed; rolling back';END IF;
 IF NOT (app_private.map_intake_eligibility(12)->>'allowed')::boolean OR (app_private.map_intake_eligibility(12)->>'nextVersion')::integer<>2 THEN RAISE EXCEPTION 'Mall is not ready to submit version 2 again';END IF;
END $$;
SELECT app_private.map_intake_eligibility(12) AS next_application,
 (SELECT count(*) FROM public.application WHERE mall_id=12 AND application_version=2) AS remaining_version_2,
 (SELECT ar_development_status FROM public.ar_development WHERE ar_development_id=17) AS version_1_status;
COMMIT;
