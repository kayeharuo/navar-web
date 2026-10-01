BEGIN;

ALTER TABLE public.beacon_ticket
  ADD COLUMN IF NOT EXISTS ticket_issue TEXT;

ALTER TABLE public.beacon_ticket_log
  DROP COLUMN IF EXISTS ticket_log_issue;

ALTER TABLE public.beacon_ticket
  ALTER COLUMN ticket_assigned_to DROP NOT NULL;

COMMIT;