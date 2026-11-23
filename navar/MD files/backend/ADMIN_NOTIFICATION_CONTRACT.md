# Admin notification contract

`public.admin_notification` is the shared notification table for internal mall
admins and super admins. It is separate from `public.notification`, whose
recipient is an app user.

The identity boundaries are:

- `ADMIN` contains internal users with roles `super_admin`, `mall_admin`, and
  `store_admin`.
- `APP_USER` contains mobile AR users and is not used for this admin workflow.
- Application workflow notifications for a mall go to every active
  `mall_admin` whose `admin.mall_id` matches the application mall.
- `store_admin` is excluded from mall-wide application notifications unless a
  future feature explicitly targets store operations.

## Recipient model

Create one row per recipient admin. This keeps read and archive state
independent when several mall admins belong to the same mall.

- `admin_id`: the admin who should see the notification.
- `mall_id`: the mall context of the event. It is nullable because a future
  system-wide event may not belong to one mall.
- `admin_notif_is_read` and `admin_notif_is_archived`: recipient-specific state.

## Event/source model

- `admin_notif_type`: stable event category, such as
  `ticket_status_changed`, `application_submitted`, or `store_added`.
- `admin_notif_source_type`: stable source category, such as `beacon_ticket`,
  `application`, `contract`, `store`, or `unit`.
- `admin_notif_source_id`: the source record ID when one exists.
- `admin_notif_source_label`: a readable snapshot used when the source is
  deleted or unavailable.
- `admin_notif_actor_id` and `admin_notif_actor_role`: the admin who caused the
  event, when applicable.

The source columns are intentionally generic so both repositories can add
notification types without changing this table. The service that creates a
notification must verify that the source exists and derive `mall_id` from the
source instead of trusting a client-provided mall ID.

The AR workflow is graph-based. Application and AR-development records may
refer to floor-plan coordinates, graph nodes, edges, accessibility routes,
emergency routes, and beacon-based positioning. These are separate from the
mobile `APP_USER` identity and notification system.

## Ticket behavior

For a beacon ticket status change, insert one notification for every active
`mall_admin` whose `admin.mall_id` matches the beacon's mall. The notification
contains `source_type = 'beacon_ticket'`, the ticket ID, the beacon/ticket
label, and the actor. When a ticket enters `investigating`, include the
assigned admin in the message.

When a beacon is deactivated directly, insert one notification for every
active mall admin as well, using `source_type = 'beacon'` and the beacon ID.

The table is added to Supabase Realtime by
`database_schema/17_admin_notifications.sql`. Repositories that read it
directly through Supabase must authenticate as the recipient admin so the
row-level security policy exposes only that admin's notifications.

The backend writer must use `SUPABASE_SECRET_KEY` or
`SUPABASE_SERVICE_ROLE_KEY`, not the publishable/anon key. These privileged
keys bypass the table's recipient read policies for server-side inserts.
Notification delivery is intentionally non-blocking: if the notification
insert fails, the ticket or beacon operation still succeeds and the backend
logs `Admin notification delivery failed`. This prevents a notification
configuration problem from rolling back or masking the operational action.
