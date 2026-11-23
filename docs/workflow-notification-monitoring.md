# Database-driven Super Admin notifications

Applied migrations 54 and 55 to NavAR on November 23, 2026.

All active, official Super Admins receive alerts in `public.admin_notification`.
The existing recipient RLS policy and Realtime subscription deliver the bell
updates. Mall interfaces save their normal authorized source records; they do
not need to insert notifications or call a notification endpoint.

| Source | Events monitored |
| --- | --- |
| `contract_payment_request` | Onboarding, subscription, renewal, upgrade, reinstatement and other application/service payments marked paid; failed/cancelled/refunded payments; reconciliation and fulfillment errors |
| `application` | Submitted/resubmitted map applications, disputes, withdrawals and cancellations |
| `stall_application` | Submitted/resubmitted stall applications, disputes, withdrawals and cancellations |
| `ar_development` | Mall approval timestamp; development status transitions including Ready, Live, On Hold and Unpublished |
| `contract` | Started, renewed, upgraded, reinstated or scheduled terms; cancellation requests; grace status |
| `mall_service_request` | Structural/map update and other service request status changes |
| `store`, `stall`, `unit` | Store/stall deletion, deactivation and location unassignment after AR publication |
| `suspension` | New suspensions and lifted suspensions |
| `beacon_ticket`, `beacon` | Service ticket creation/status changes and beacon attention states |
| `payment` | Paid legacy/standalone contract and stall payments |
| `inquiry` | New mall inquiries |

The private `workflow_monitor_event` ledger deduplicates events. A notification's
`workflow_event_key` identifies its source event. Unchanged status updates do not
produce new alerts; notices commit or roll back with the underlying transaction.
Functions and the ledger cannot be called/written by browser roles.

Existing `emit_subscription_event` still serves Mall Admin notifications and
emails. Super Admin delivery for these workflow events now uses source-row
triggers. Existing beacon interface notifications likewise target Mall Admins,
while Super Admin monitoring is handled by database triggers.

## Dates and scheduling

The pg_cron job `navar-subscription-deadline-alerts` runs
`public.monitor_subscription_deadlines()` every 15 minutes, independently of the
websites and backend uptime. The existing backend lifecycle worker also invokes
it when enabled. Deduplication covers both paths.

It checks current started contracts against Manila calendar dates, issues renewal
reminders at 30/15/7/1 days, grace-entry/grace-ending alerts and non-renewal alerts
after grace. A paid, fulfilled renewal/reinstatement for the next term suppresses
old-term expiry warnings. The monitoring job reports state; it does not change
subscription dates, collect money, suspend accounts or publish/unpublish AR.
Existing lifecycle processing remains responsible for those transitions.

## Presentation and existing records

Subscription history displays V1 for the first term with a subscription start
date. The prior onboarding-only contract remains stored, but is excluded from
displayed subscription term numbering. Payment and term provenance stays in the
database/audit trail; presentation labels use normal capitalized names and Paid.

`backfill_gaisano_workflow_notifications.sql` restores missed payment, mall
approval and subscription-activation alerts from existing fulfilled/approved
rows only. It is idempotent and does not modify business records.

Tests: `test/workflow-monitoring.test.cjs`,
`test/subscription-presentation.test.cjs`, existing subscription lifecycle,
payment simulation, feedback and recipient-wording tests. Live trigger checks
ran inside a rolled-back transaction.

Only committed database changes can be monitored. Unsaved frontend-only actions
and deadlines that were never stored cannot produce database events. Third-party
interfaces must continue to store the documented business records and statuses;
they should not invent separate notification writes.
