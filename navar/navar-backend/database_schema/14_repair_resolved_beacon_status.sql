BEGIN;

UPDATE public.beacon AS beacon
SET beacon_status = 'placed'
WHERE EXISTS (
  SELECT 1
  FROM public.beacon_ticket AS ticket
  WHERE ticket.beacon_id = beacon.beacon_id
    AND ticket.ticket_current_status = 'resolved'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.beacon_ticket AS ticket
  WHERE ticket.beacon_id = beacon.beacon_id
    AND ticket.ticket_current_status <> 'resolved'
);

COMMIT;