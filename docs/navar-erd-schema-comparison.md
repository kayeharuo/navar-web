# NavAR ERD comparison

Compared on October 22, 2026 against the live NavAR Supabase project `kblobarjzrloqjikpbun`. Source: `ERD FOR NAVAR (4).json`. Database inspection was read-only. Names were compared without case sensitivity and with surrounding whitespace removed.

The live public schema has **71 tables**. The ERD has **60 entities**, including the external `auth.users` entity. **13 public tables are missing**; `store_additional_info` appears only in the ERD.

## Missing tables

### admin_account_email_attempt

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `admin_id` | bigint | NO | FOREIGN KEY (admin_id) REFERENCES admin(admin_id); PRIMARY KEY (admin_id) |
| `attempted_at` | timestamp with time zone | NO |  |

### agreement_versions

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `version` | text | NO | PRIMARY KEY (version) |
| `content_hash` | text | NO |  |
| `is_current` | boolean | NO | Default: false |
| `published_at` | timestamp with time zone | NO | Default: now() |

### inquiry_activity

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `id` | bigint | NO | PRIMARY KEY (id); Default: nextval('inquiry_activity_id_seq'::regclass) |
| `inquiry_id` | bigint | NO | FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id) |
| `actor_id` | bigint | YES | FOREIGN KEY (actor_id) REFERENCES admin(admin_id) |
| `action` | text | NO |  |
| `details` | jsonb | NO | Default: '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | Default: now() |

### inquiry_correction

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `id` | bigint | NO | PRIMARY KEY (id); Default: nextval('inquiry_correction_id_seq'::regclass) |
| `inquiry_id` | bigint | NO | FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id) |
| `token_hash` | text | NO | UNIQUE (token_hash) |
| `message_id` | bigint | NO | FOREIGN KEY (message_id) REFERENCES inquiry_message(i_message_id) |
| `expires_at` | timestamp with time zone | NO |  |
| `used_at` | timestamp with time zone | YES |  |
| `revoked_at` | timestamp with time zone | YES |  |
| `before_data` | jsonb | NO |  |
| `after_data` | jsonb | YES |  |
| `created_at` | timestamp with time zone | NO | Default: now() |

### inquiry_inbox_cursor

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `mailbox` | text | NO | PRIMARY KEY (mailbox) |
| `uid_validity` | text | NO |  |
| `last_uid` | bigint | NO |  |
| `updated_at` | timestamp with time zone | NO | Default: now() |

### inquiry_note

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `id` | bigint | NO | PRIMARY KEY (id); Default: nextval('inquiry_note_id_seq'::regclass) |
| `inquiry_id` | bigint | NO | FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id) |
| `actor_id` | bigint | NO | FOREIGN KEY (actor_id) REFERENCES admin(admin_id) |
| `body` | text | NO |  |
| `request_id` | uuid | NO | UNIQUE (request_id) |
| `created_at` | timestamp with time zone | NO | Default: now() |

### inquiry_read_receipt

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `inquiry_id` | bigint | NO | FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id); PRIMARY KEY (inquiry_id, actor_id) |
| `actor_id` | bigint | NO | FOREIGN KEY (actor_id) REFERENCES admin(admin_id); PRIMARY KEY (inquiry_id, actor_id) |
| `last_message_id` | bigint | NO | Default: 0 |
| `read_at` | timestamp with time zone | NO | Default: now() |

### mall_account_invitation

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `id` | uuid | NO | FOREIGN KEY (auth_user_id) REFERENCES auth.users(id); PRIMARY KEY (id); Default: gen_random_uuid() |
| `mall_id` | bigint | NO | FOREIGN KEY (mall_id) REFERENCES mall(mall_id); UNIQUE (mall_id, request_key) |
| `role` | text | NO |  |
| `email` | character varying | NO |  |
| `full_name` | character varying | NO |  |
| `contact` | character varying | YES |  |
| `job_title` | character varying | YES |  |
| `status` | text | NO | Default: 'pending'::text |
| `delivery_status` | text | NO | Default: 'draft'::text |
| `token_hash` | text | NO |  |
| `expires_at` | timestamp with time zone | NO | Default: (now() + '48:00:00'::interval) |
| `created_at` | timestamp with time zone | NO | Default: now() |
| `created_by` | bigint | NO | FOREIGN KEY (created_by) REFERENCES admin(admin_id) |
| `accepted_at` | timestamp with time zone | YES |  |
| `auth_user_id` | uuid | YES | FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) |
| `requires_password` | boolean | NO | Default: false |
| `delivery_generation` | integer | NO | Default: 0 |
| `last_attempt_at` | timestamp with time zone | YES |  |
| `lease_until` | timestamp with time zone | YES |  |
| `delivery_error` | text | YES |  |
| `request_key` | uuid | NO | UNIQUE (mall_id, request_key) |

### mall_invitation_tenant

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `invitation_id` | uuid | NO | FOREIGN KEY (invitation_id) REFERENCES mall_account_invitation(id) ON DELETE CASCADE; PRIMARY KEY (invitation_id, tenant_id) |
| `tenant_id` | bigint | NO | PRIMARY KEY (invitation_id, tenant_id); FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) |

### mall_onboarding

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `mall_id` | bigint | NO | FOREIGN KEY (mall_id) REFERENCES mall(mall_id); PRIMARY KEY (mall_id) |
| `contract_id` | bigint | YES | FOREIGN KEY (contract_id) REFERENCES contract(contract_id) |
| `offer` | jsonb | YES |  |
| `prepayment_acceptance` | jsonb | YES |  |
| `agreement_acceptance` | jsonb | YES |  |
| `profile_draft` | jsonb | YES |  |
| `profile_completed_at` | timestamp with time zone | YES |  |
| `establishments` | jsonb | YES |  |
| `establishments_completed_at` | timestamp with time zone | YES |  |
| `application_id` | bigint | YES | FOREIGN KEY (application_id) REFERENCES application(application_id) |
| `completed_at` | timestamp with time zone | YES |  |
| `legacy_approved` | boolean | NO | Default: false |
| `revision` | integer | NO | Default: 0 |
| `offered_by` | bigint | YES | FOREIGN KEY (offered_by) REFERENCES admin(admin_id) |
| `floors_deferred_at` | timestamp with time zone | YES |  |
| `floors_configured_at` | timestamp with time zone | YES |  |

### mall_payment_checkout

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `request_id` | bigint | NO | PRIMARY KEY (request_id); FOREIGN KEY (request_id) REFERENCES contract_payment_request(request_id) |
| `session_id` | text | NO | UNIQUE (session_id) |
| `amount_cent` | bigint | NO |  |
| `livemode` | boolean | NO |  |
| `payment_id` | text | YES | UNIQUE (payment_id) |
| `confirmed_at` | timestamp with time zone | YES |  |
| `payment_source` | text | NO | Default: 'paymongo'::text |

### store_amenity

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `store_amenity_id` | bigint | NO | PRIMARY KEY (store_amenity_id) |
| `store_id` | bigint | NO | FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE CASCADE |
| `store_amenity_type` | text | NO |  |
| `store_amenity_name` | text | NO |  |
| `store_amenity_note_type` | text | YES |  |
| `store_amenity_created_at` | timestamp with time zone | NO | Default: now() |
| `store_amenity_updated_at` | timestamp with time zone | NO | Default: now() |

### tenant_account

| Column | PostgreSQL type | Nullable | Key/default |
|---|---|---|---|
| `tenant_id` | bigint | NO | PRIMARY KEY (tenant_id); FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) |
| `auth_user_id` | uuid | NO | FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) |
| `is_active` | boolean | NO | Default: true |
| `accepted_at` | timestamp with time zone | NO | Default: now() |
| `updated_at` | timestamp with time zone | NO | Default: now() |
| `last_login_at` | timestamp with time zone | YES |  |

## Column differences in existing entities

?ERD only? may indicate a renamed field or an obsolete field; no rename history is inferred from the names alone.

| Table | In database, absent from ERD | ERD only |
|---|---|---|
| `admin` | `admin_profile_picture_path` | `admin_profile_path` |
| `admin_password_request` | `apr_superseded_at` | `apr_suspended_at` |
| `application` | `application_accepted_at`, `application_attempt`, `application_dispute_count`, `application_reason_category`, `application_reason_notes` |  |
| `application_floor_plan` | `accessible_routes`, `emergency_routes`, `plan_calibration`, `plan_filename` |  |
| `ar_development` | `ar_development_mall_approved_at`, `ar_development_ready_at`, `ar_development_reminder_count`, `ar_development_resume_status`, `ar_development_unpublish_reason` |  |
| `battery` | `battery_code` |  |
| `contract` | `contract_map_updates_per_year` |  |
| `contract_payment_request` | `checkout_url`, `confirmation_message`, `confirmed_at`, `created_at`, `fee_type`, `paid_at`, `payment_reference`, `request_id`, `status` | `contract_checkout_url`, `contract_confirmation_message`, `contract_confirmed_at`, `contract_fee_type`, `contract_paid_at`, `contract_payment_created_at`, `contract_payment_reference`, `contract_payment_request_id`, `contract_payment_status` |
| `inquiry` | `inquiry_has_revision`, `inquiry_mall_barangay`, `inquiry_original_description`, `inquiry_rejection_reason`, `inquiry_reviewed_at`, `inquiry_reviewed_by` | `inquiry`, `inquiry_mall_logo` |
| `inquiry_message` | `i_message_admin_id`, `i_message_delivered_at`, `i_message_delivery_status`, `i_message_email_id`, `i_message_kind`, `i_message_request_id` |  |
| `mall` | `mall_barangay` |  |
| `mall_admin_account` | `created_at`, `setup_completed_at`, `username` | `mall_created_at`, `mall_setup_completed_at`, `mall_username` |
| `node` | `ar_development_id` |  |
| `promotion` | `promotion_image`, `promotion_image_path` |  |
| `store` | `mall_id`, `onboarding_floor_id`, `store_description`, `store_type` |  |

## Foreign keys with no corresponding connector

These are actual database foreign keys for which the export has no connector between the two entities. This also includes links to missing tables. Entity-level connectors do not identify individual fields, so an existing connector cannot verify every FK when several connect the same entities.

- `admin_account_email_attempt`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id)`
- `application_entry_point`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `beacon_scan_log`: `FOREIGN KEY (resolved_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `inquiry`: `FOREIGN KEY (inquiry_reviewed_by) REFERENCES admin(admin_id)`
- `inquiry_activity`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_activity`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_correction`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_correction`: `FOREIGN KEY (message_id) REFERENCES inquiry_message(i_message_id)`
- `inquiry_message`: `FOREIGN KEY (i_message_admin_id) REFERENCES admin(admin_id)`
- `inquiry_note`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_note`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_read_receipt`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_read_receipt`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `mall_account_invitation`: `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)`
- `mall_account_invitation`: `FOREIGN KEY (created_by) REFERENCES admin(admin_id)`
- `mall_account_invitation`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `mall_invitation_tenant`: `FOREIGN KEY (invitation_id) REFERENCES mall_account_invitation(id) ON DELETE CASCADE`
- `mall_invitation_tenant`: `FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)`
- `mall_onboarding`: `FOREIGN KEY (application_id) REFERENCES application(application_id)`
- `mall_onboarding`: `FOREIGN KEY (contract_id) REFERENCES contract(contract_id)`
- `mall_onboarding`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `mall_onboarding`: `FOREIGN KEY (offered_by) REFERENCES admin(admin_id)`
- `mall_payment_checkout`: `FOREIGN KEY (request_id) REFERENCES contract_payment_request(request_id)`
- `navigation_plan`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `navigation_session`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `node`: `FOREIGN KEY (node_cross_floor_link_id) REFERENCES node(node_id) ON DELETE SET NULL`
- `node`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id)`
- `node`: `FOREIGN KEY (node_cross_floor_link_id, ar_development_id) REFERENCES node(node_id, ar_development_id)`
- `notification`: `FOREIGN KEY (notif_recipient) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `store`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `store`: `FOREIGN KEY (onboarding_floor_id) REFERENCES floor(floor_id)`
- `store_amenity`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE CASCADE`
- `tenant_account`: `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)`
- `tenant_account`: `FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)`

## Diagram connectors without a matching database foreign key

These connectors may represent conceptual relationships, but are not currently backed by a direct FK.

- `admin` ? `notification`
- `navigation_plan` ? `user_session`
- `store` ? `store_additional_info`

## Database constraints to document

The export supplies field names and PK/FK labels, but does not document data types, nullability, defaults, unique keys, or check rules. The following is the full current constraint inventory for the public schema.

### accessibility_preference

- `accessibility_preference_pkey`: `PRIMARY KEY (pref_id)`
- `accessibility_preference_user_unique`: `UNIQUE (user_id)`
- `ck_accesspref_at_least_one`: `CHECK ((pref_require_esc OR pref_require_stair OR pref_require_elev OR pref_require_ramp))`
- `fk_accessibility_preference_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### account_invite

- `account_invite_pkey`: `PRIMARY KEY (a_invite_id)`
- `fk_account_invite_admin_id`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### admin

- `admin_pkey`: `PRIMARY KEY (admin_id)`
- `ck_admin_account_status`: `CHECK (((admin_account_status)::text = ANY ((ARRAY['partial'::character varying, 'official'::character varying])::text[])))`
- `ck_admin_deactivation_consistent`: `CHECK (((NOT admin_is_deactivated) OR (admin_deactivated_on IS NOT NULL)))`
- `ck_admin_email_lowercase`: `CHECK (((admin_email)::text = lower((admin_email)::text)))`
- `ck_admin_role`: `CHECK (((admin_role)::text = ANY ((ARRAY['super_admin'::character varying, 'mall_admin'::character varying, 'store_admin'::character varying])::text[])))`
- `ck_admin_scope`: `CHECK (((((admin_role)::text = 'super_admin'::text) AND (mall_id IS NULL) AND (store_id IS NULL)) OR (((admin_role)::text = 'mall_admin'::text) AND (mall_id IS NOT NULL) AND (store_id IS NULL)) OR (((admin_role)::text = 'store_admin'::text) AND (store_id IS NOT NULL))))`
- `fk_admin_auth_user_id`: `FOREIGN KEY (admin_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `fk_admin_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_admin_store`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL`
- `uq_admin_auth_user_id`: `UNIQUE (admin_auth_user_id)`

### admin_account_email_attempt

- `admin_account_email_attempt_admin_id_fkey`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id)`
- `admin_account_email_attempt_pkey`: `PRIMARY KEY (admin_id)`

### admin_notification

- `admin_notification_admin_id_fkey`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id)`
- `admin_notification_admin_notif_actor_id_fkey`: `FOREIGN KEY (admin_notif_actor_id) REFERENCES admin(admin_id)`
- `admin_notification_mall_id_fkey`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `admin_notification_pkey`: `PRIMARY KEY (admin_notif_id)`

### admin_password_request

- `admin_password_request_auth_user_id_fkey`: `FOREIGN KEY (apr_auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `admin_password_request_pkey`: `PRIMARY KEY (apr_request_fingerprint)`
- `admin_password_request_request_kind_check`: `CHECK (((apr_request_kind)::text = ANY ((ARRAY['invite'::character varying, 'reset'::character varying])::text[])))`

### agreement_versions

- `agreement_versions_content_hash_check`: `CHECK ((content_hash ~ '^[a-f0-9]{64}$'::text))`
- `agreement_versions_pkey`: `PRIMARY KEY (version)`

### analytics_daily_snapshot

- `analytics_daily_snapshot_pkey`: `PRIMARY KEY (daily_id)`
- `fk_analytics_daily_snapshot_daily_top_store_id`: `FOREIGN KEY (daily_top_store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_analytics_daily_snapshot_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### analytics_hourly_snapshot

- `analytics_hourly_snapshot_pkey`: `PRIMARY KEY (hourly_id)`
- `fk_analytics_hourly_snapshot_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### app_user

- `app_user_auth_user_id_unique`: `UNIQUE (user_auth_user_id)`
- `app_user_pkey`: `PRIMARY KEY (user_id)`
- `ck_app_user_email_lowercase`: `CHECK (((user_email)::text = lower((user_email)::text)))`
- `fk_app_user_auth_user_id`: `FOREIGN KEY (user_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `uq_app_user_auth_user_id`: `UNIQUE (user_auth_user_id)`

### application

- `application_attempt_positive`: `CHECK ((application_attempt > 0))`
- `application_dispute_limit`: `CHECK (((application_dispute_count >= 0) AND (application_dispute_count <= 2)))`
- `application_mall_version_attempt_key`: `UNIQUE (mall_id, application_version, application_attempt)`
- `application_pkey`: `PRIMARY KEY (application_id)`
- `fk_application_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### application_entry_point

- `application_entry_point_pkey`: `PRIMARY KEY (app_entry_point_id)`
- `fk_application_entry_point_application_id`: `FOREIGN KEY (application_id) REFERENCES application(application_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_application_entry_point_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### application_floor_plan

- `application_floor_plan_pkey`: `PRIMARY KEY (app_floor_plan_id)`
- `fk_application_floor_plan_application_id`: `FOREIGN KEY (application_id) REFERENCES application(application_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_application_floor_plan_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### ar_development

- `ar_development_pkey`: `PRIMARY KEY (ar_development_id)`
- `ar_workflow_status`: `CHECK (((ar_development_status)::text = ANY ((ARRAY['pending'::character varying, 'node_mapping'::character varying, 'testing'::character varying, 'on_hold'::character varying, 'ready'::character varying, 'live'::character varying, 'unpublished'::character varying])::text[])))`
- `fk_ar_development_application_id`: `FOREIGN KEY (application_id) REFERENCES application(application_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### audit_log

- `audit_log_pkey`: `PRIMARY KEY (audit_log_id)`
- `fk_audit_log_audit_log_performed_by`: `FOREIGN KEY (audit_log_performed_by) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_audit_log_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### battery

- `battery_pkey`: `PRIMARY KEY (battery_id)`
- `fk_battery_beacon_id`: `FOREIGN KEY (beacon_id) REFERENCES beacon(beacon_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### beacon

- `beacon_pkey`: `PRIMARY KEY (beacon_id)`
- `fk_beacon_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id)`
- `fk_beacon_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### beacon_node_assigment

- `assignment_node_same_version`: `FOREIGN KEY (node_id, ar_development_id) REFERENCES node(node_id, ar_development_id)`
- `assignment_one_node_per_beacon_per_version`: `UNIQUE (ar_development_id, beacon_id)`
- `beacon_node_assigment_pkey`: `PRIMARY KEY (assignment_id)`
- `fk_beacon_node_assigment_ar_development_id`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_beacon_node_assigment_beacon_id`: `FOREIGN KEY (beacon_id) REFERENCES beacon(beacon_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_beacon_node_assigment_node_id`: `FOREIGN KEY (node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### beacon_scan_log

- `beacon_scan_log_pkey`: `PRIMARY KEY (bscan_id)`
- `fk_beacon_scan_log_beacon_id`: `FOREIGN KEY (beacon_id) REFERENCES beacon(beacon_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_beacon_scan_log_navsesh_id`: `FOREIGN KEY (navsesh_id) REFERENCES navigation_session(navsesh_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_beacon_scan_log_resolved_node_id`: `FOREIGN KEY (resolved_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE SET NULL`

### beacon_ticket

- `beacon_ticket_pkey`: `PRIMARY KEY (ticket_id)`
- `fk_beacon_ticket_beacon_id`: `FOREIGN KEY (beacon_id) REFERENCES beacon(beacon_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_beacon_ticket_ticket_assigned_to`: `FOREIGN KEY (ticket_assigned_to) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_beacon_ticket_ticket_reported_by`: `FOREIGN KEY (ticket_reported_by) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### beacon_ticket_log

- `beacon_ticket_log_pkey`: `PRIMARY KEY (ticket_log_id)`
- `fk_beacon_ticket_log_ticket_id`: `FOREIGN KEY (ticket_id) REFERENCES beacon_ticket(ticket_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_beacon_ticket_log_ticket_log_changed_by`: `FOREIGN KEY (ticket_log_changed_by) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### brand

- `brand_pkey`: `PRIMARY KEY (brand_id)`

### contract

- `contract_pkey`: `PRIMARY KEY (contract_id)`
- `fk_contract_admin_id`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_contract_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_contract_s_tier_id`: `FOREIGN KEY (s_tier_id) REFERENCES subscription_tier(s_tier_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### contract_payment_request

- `contract_payment_request_check`: `CHECK (((status <> 'paid'::text) OR ((paid_at IS NOT NULL) AND (payment_reference IS NOT NULL))))`
- `contract_payment_request_checkout_url_check`: `CHECK (((checkout_url IS NULL) OR (checkout_url ~ '^https://[^[:space:]]+$'::text)))`
- `contract_payment_request_contract_id_fee_type_key`: `UNIQUE (contract_id, fee_type)`
- `contract_payment_request_contract_id_fkey`: `FOREIGN KEY (contract_id) REFERENCES contract(contract_id)`
- `contract_payment_request_fee_type_check`: `CHECK ((fee_type = ANY (ARRAY['onboarding'::text, 'subscription'::text])))`
- `contract_payment_request_pkey`: `PRIMARY KEY (request_id)`
- `contract_payment_request_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))`

### edge

- `ck_edge_distance_positive`: `CHECK ((edge_distance >= (0)::double precision))`
- `ck_edge_no_self_loop`: `CHECK ((start_node_id <> end_node_id))`
- `ck_edge_path_type`: `CHECK (((edge_path_type)::text = ANY ((ARRAY['normal'::character varying, 'accessible'::character varying, 'restricted'::character varying])::text[])))`
- `edge_end_node_same_version`: `FOREIGN KEY (end_node_id, ar_development_id) REFERENCES node(node_id, ar_development_id)`
- `edge_pkey`: `PRIMARY KEY (edge_id)`
- `edge_start_node_same_version`: `FOREIGN KEY (start_node_id, ar_development_id) REFERENCES node(node_id, ar_development_id)`
- `fk_edge_ar_development_id`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_edge_end_node_id`: `FOREIGN KEY (end_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_edge_start_node_id`: `FOREIGN KEY (start_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE RESTRICT`

### email_log

- `email_log_pkey`: `PRIMARY KEY (email_log_id)`
- `fk_email_log_email_log_triggered_by`: `FOREIGN KEY (email_log_triggered_by) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_email_log_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE SET NULL`

### floor

- `fk_floor_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `floor_pkey`: `PRIMARY KEY (floor_id)`

### floor_calibration

- `ck_floor_calibration_ple_range`: `CHECK (((calibration_path_loss_exponent IS NULL) OR ((calibration_path_loss_exponent >= (1)::double precision) AND (calibration_path_loss_exponent <= (6)::double precision))))`
- `fk_floor_calibration_ar_development_id`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_floor_calibration_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `floor_calibration_pkey`: `PRIMARY KEY (calibration_id)`

### inquiry

- `ck_inquiry_coverage_area`: `CHECK (((inquiry_coverage_area IS NULL) OR ((inquiry_coverage_area)::text = ANY ((ARRAY['Less than or equal to 15,000 sqm'::character varying, 'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm'::character varying, 'Greater than 50,000 sqm, but less than or equal to 150,000 sqm'::character varying, 'Greater than 150,000 sqm'::character varying])::text[]))))`
- `fk_inquiry_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `inquiry_inquiry_reviewed_by_fkey`: `FOREIGN KEY (inquiry_reviewed_by) REFERENCES admin(admin_id)`
- `inquiry_pkey`: `PRIMARY KEY (inquiry_id)`

### inquiry_activity

- `inquiry_activity_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_activity_inquiry_id_fkey`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_activity_pkey`: `PRIMARY KEY (id)`

### inquiry_correction

- `inquiry_correction_inquiry_id_fkey`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_correction_message_id_fkey`: `FOREIGN KEY (message_id) REFERENCES inquiry_message(i_message_id)`
- `inquiry_correction_pkey`: `PRIMARY KEY (id)`
- `inquiry_correction_token_hash_check`: `CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))`
- `inquiry_correction_token_hash_key`: `UNIQUE (token_hash)`

### inquiry_inbox_cursor

- `inquiry_inbox_cursor_last_uid_check`: `CHECK ((last_uid >= 0))`
- `inquiry_inbox_cursor_pkey`: `PRIMARY KEY (mailbox)`

### inquiry_message

- `fk_inquiry_message_inquiry_id`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `inquiry_message_i_message_admin_id_fkey`: `FOREIGN KEY (i_message_admin_id) REFERENCES admin(admin_id)`
- `inquiry_message_pkey`: `PRIMARY KEY (i_message_id)`

### inquiry_note

- `inquiry_note_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_note_body_check`: `CHECK (((length(body) >= 1) AND (length(body) <= 4000)))`
- `inquiry_note_inquiry_id_fkey`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_note_pkey`: `PRIMARY KEY (id)`
- `inquiry_note_request_id_key`: `UNIQUE (request_id)`

### inquiry_read_receipt

- `inquiry_read_receipt_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES admin(admin_id)`
- `inquiry_read_receipt_inquiry_id_fkey`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `inquiry_read_receipt_pkey`: `PRIMARY KEY (inquiry_id, actor_id)`

### mall

- `ck_mall_coverage_area`: `CHECK (((mall_coverage_area IS NULL) OR ((mall_coverage_area)::text = ANY ((ARRAY['Less than or equal to 15,000 sqm'::character varying, 'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm'::character varying, 'Greater than 50,000 sqm, but less than or equal to 150,000 sqm'::character varying, 'Greater than 150,000 sqm'::character varying])::text[]))))`
- `mall_latitude_range`: `CHECK (((mall_latitude >= ('-90'::integer)::double precision) AND (mall_latitude <= (90)::double precision)))`
- `mall_longitude_range`: `CHECK (((mall_longitude >= ('-180'::integer)::double precision) AND (mall_longitude <= (180)::double precision)))`
- `mall_pkey`: `PRIMARY KEY (mall_id)`

### mall_account_invitation

- `mall_account_invitation_auth_user_id_fkey`: `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)`
- `mall_account_invitation_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES admin(admin_id)`
- `mall_account_invitation_delivery_status_check`: `CHECK ((delivery_status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text, 'failed'::text])))`
- `mall_account_invitation_email_check`: `CHECK (((email)::text = lower(btrim((email)::text))))`
- `mall_account_invitation_full_name_check`: `CHECK ((length(btrim((full_name)::text)) > 0))`
- `mall_account_invitation_mall_id_fkey`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `mall_account_invitation_mall_id_request_key_key`: `UNIQUE (mall_id, request_key)`
- `mall_account_invitation_pkey`: `PRIMARY KEY (id)`
- `mall_account_invitation_role_check`: `CHECK ((role = ANY (ARRAY['mall_admin'::text, 'tenant'::text])))`
- `mall_account_invitation_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text])))`
- `mall_account_invitation_token_hash_check`: `CHECK ((length(token_hash) = 64))`

### mall_admin_account

- `mall_admin_account_admin_id_fkey`: `FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE`
- `mall_admin_account_pkey`: `PRIMARY KEY (admin_id)`
- `mall_admin_account_username_key`: `UNIQUE (username)`
- `mall_admin_username_format`: `CHECK (((username IS NULL) OR ((username)::text ~ '^[a-z0-9_.]{3,30}$'::text)))`

### mall_invitation_tenant

- `mall_invitation_tenant_invitation_id_fkey`: `FOREIGN KEY (invitation_id) REFERENCES mall_account_invitation(id) ON DELETE CASCADE`
- `mall_invitation_tenant_pkey`: `PRIMARY KEY (invitation_id, tenant_id)`
- `mall_invitation_tenant_tenant_id_fkey`: `FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)`

### mall_onboarding

- `mall_onboarding_application_id_fkey`: `FOREIGN KEY (application_id) REFERENCES application(application_id)`
- `mall_onboarding_contract_id_fkey`: `FOREIGN KEY (contract_id) REFERENCES contract(contract_id)`
- `mall_onboarding_mall_id_fkey`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `mall_onboarding_offered_by_fkey`: `FOREIGN KEY (offered_by) REFERENCES admin(admin_id)`
- `mall_onboarding_pkey`: `PRIMARY KEY (mall_id)`

### mall_payment_checkout

- `mall_payment_checkout_amount_cent_check`: `CHECK ((amount_cent > 0))`
- `mall_payment_checkout_payment_id_key`: `UNIQUE (payment_id)`
- `mall_payment_checkout_payment_source_check`: `CHECK ((payment_source = ANY (ARRAY['paymongo'::text, 'manual'::text])))`
- `mall_payment_checkout_pkey`: `PRIMARY KEY (request_id)`
- `mall_payment_checkout_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES contract_payment_request(request_id)`
- `mall_payment_checkout_session_id_check`: `CHECK ((((payment_source = 'paymongo'::text) AND (session_id ~ '^(cs|pi)_[A-Za-z0-9]+$'::text)) OR ((payment_source = 'manual'::text) AND (session_id ~ '^manual_[0-9]+$'::text) AND (NOT livemode))))`
- `mall_payment_checkout_session_id_key`: `UNIQUE (session_id)`

### navigation_plan

- `fk_navigation_plan_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_navigation_plan_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `navigation_plan_pkey`: `PRIMARY KEY (plan_id)`

### navigation_plan_destination

- `fk_navigation_plan_destination_destination_node_id`: `FOREIGN KEY (destination_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_navigation_plan_destination_destination_store_id`: `FOREIGN KEY (destination_store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_plan_destination_navsesh_id`: `FOREIGN KEY (navsesh_id) REFERENCES navigation_session(navsesh_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_plan_destination_plan_id`: `FOREIGN KEY (plan_id) REFERENCES navigation_plan(plan_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `navigation_plan_destination_pkey`: `PRIMARY KEY (plan_dest_id)`

### navigation_session

- `fk_navigation_session_ar_development_id`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_session_destination_node_id`: `FOREIGN KEY (destination_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_session_last_known_node_id`: `FOREIGN KEY (last_known_node_id) REFERENCES node(node_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_session_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_navigation_session_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_navigation_session_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `navigation_session_pkey`: `PRIMARY KEY (navsesh_id)`

### node

- `ck_node_no_self_link`: `CHECK (((node_cross_floor_link_id IS NULL) OR (node_cross_floor_link_id <> node_id)))`
- `fk_node_cross_floor_link_id`: `FOREIGN KEY (node_cross_floor_link_id) REFERENCES node(node_id) ON DELETE SET NULL`
- `fk_node_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_node_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_node_unit_id`: `FOREIGN KEY (unit_id) REFERENCES unit(unit_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `node_ar_development_id_fkey`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id)`
- `node_cross_floor_same_version`: `FOREIGN KEY (node_cross_floor_link_id, ar_development_id) REFERENCES node(node_id, ar_development_id)`
- `node_id_ar_development_key`: `UNIQUE (node_id, ar_development_id)`
- `node_pkey`: `PRIMARY KEY (node_id)`

### notif_preference

- `fk_notif_preference_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `notif_preference_pkey`: `PRIMARY KEY (notifpref_id)`
- `notif_preference_user_unique`: `UNIQUE (user_id)`

### notification

- `fk_notification_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_notification_notif_recipient`: `FOREIGN KEY (notif_recipient) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `notification_pkey`: `PRIMARY KEY (notif_id)`

### operating_hours

- `fk_operating_hours_inquiry_id`: `FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id)`
- `fk_operating_hours_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_operating_hours_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `operating_hours_day_full_name`: `CHECK (((opthrs_day_of_week)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying, 'Saturday'::character varying, 'Sunday'::character varying])::text[])))`
- `operating_hours_pkey`: `PRIMARY KEY (opthrs_id)`

### payment

- `fk_payment_contract_id`: `FOREIGN KEY (contract_id) REFERENCES contract(contract_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_payment_s_application_id`: `FOREIGN KEY (s_application_id) REFERENCES stall_application(s_application_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_payment_wallet_id`: `FOREIGN KEY (wallet_id) REFERENCES wallet(wallet_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `payment_pkey`: `PRIMARY KEY (payment_id)`

### promotion

- `fk_promotion_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `promotion_pkey`: `PRIMARY KEY (promotion_id)`

### promotion_interaction

- `fk_promotion_interaction_promotion_id`: `FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_promotion_interaction_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `promotion_interaction_pkey`: `PRIMARY KEY (interaction_id)`

### stall

- `fk_stall_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_stall_s_application_id`: `FOREIGN KEY (s_application_id) REFERENCES stall_application(s_application_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_stall_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `stall_pkey`: `PRIMARY KEY (stall_id)`

### stall_application

- `fk_stall_application_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `stall_application_pkey`: `PRIMARY KEY (s_application_id)`

### stall_floor_plan

- `fk_stall_floor_plan_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_stall_floor_plan_s_application_id`: `FOREIGN KEY (s_application_id) REFERENCES stall_application(s_application_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `stall_floor_plan_pkey`: `PRIMARY KEY (s_floor_plan_id)`

### store

- `ck_store_type`: `CHECK (((store_type)::text = ANY ((ARRAY['store'::character varying, 'stall'::character varying])::text[])))`
- `fk_store_brand_id`: `FOREIGN KEY (brand_id) REFERENCES brand(brand_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_store_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id)`
- `store_onboarding_floor_id_fkey`: `FOREIGN KEY (onboarding_floor_id) REFERENCES floor(floor_id)`
- `store_pkey`: `PRIMARY KEY (store_id)`

### store_amenity

- `store_amenity_pkey`: `PRIMARY KEY (store_amenity_id)`
- `store_amenity_store_amenity_note_type_check`: `CHECK ((store_amenity_note_type = ANY (ARRAY['warn'::text, 'ok'::text, 'no'::text])))`
- `store_amenity_store_amenity_type_check`: `CHECK ((store_amenity_type = ANY (ARRAY['service'::text, 'facility'::text, 'note'::text])))`
- `store_amenity_store_id_fkey`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE CASCADE`

### store_payment_method

- `fk_store_payment_method_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `store_payment_method_pkey`: `PRIMARY KEY (store_pm_id)`

### store_visit

- `fk_store_visit_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_store_visit_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_store_visit_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `store_visit_pkey`: `PRIMARY KEY (store_visit_id)`

### subscription_tier

- `subscription_tier_pkey`: `PRIMARY KEY (s_tier_id)`

### suspension

- `fk_suspension_contract_id`: `FOREIGN KEY (contract_id) REFERENCES contract(contract_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_suspension_suspension_lifted_by`: `FOREIGN KEY (suspension_lifted_by) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `suspension_pkey`: `PRIMARY KEY (suspension_id)`

### system_settings

- `system_settings_pkey`: `PRIMARY KEY (settings_id)`

### tenant

- `fk_tenant_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `tenant_pkey`: `PRIMARY KEY (tenant_id)`

### tenant_account

- `tenant_account_auth_user_id_fkey`: `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)`
- `tenant_account_pkey`: `PRIMARY KEY (tenant_id)`
- `tenant_account_tenant_id_fkey`: `FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)`

### thread

- `fk_thread_application_id`: `FOREIGN KEY (application_id) REFERENCES application(application_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_thread_ar_development_id`: `FOREIGN KEY (ar_development_id) REFERENCES ar_development(ar_development_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `fk_thread_s_application_id`: `FOREIGN KEY (s_application_id) REFERENCES stall_application(s_application_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `thread_pkey`: `PRIMARY KEY (thread_id)`

### thread_message

- `fk_thread_message_message_sender`: `FOREIGN KEY (message_sender) REFERENCES admin(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_thread_message_thread_id`: `FOREIGN KEY (thread_id) REFERENCES thread(thread_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `thread_message_pkey`: `PRIMARY KEY (message_id)`

### thread_message_attachment

- `thread_message_attachment_mime_check`: `CHECK (((thread_message_attachment_mime_type)::text = ANY ((ARRAY['image/png'::character varying, 'image/jpeg'::character varying, 'image/webp'::character varying])::text[])))`
- `thread_message_attachment_pkey`: `PRIMARY KEY (thread_message_attachment_id)`
- `thread_message_attachment_size_check`: `CHECK (((thread_message_attachment_file_size > 0) AND (thread_message_attachment_file_size <= 5242880)))`
- `thread_message_attachment_thread_message_id_fkey`: `FOREIGN KEY (thread_message_id) REFERENCES thread_message(message_id) ON DELETE CASCADE`
- `thread_message_attachment_type_check`: `CHECK (((thread_message_attachment_type)::text = 'image'::text))`

### transaction_history

- `fk_transaction_history_wallet_id`: `FOREIGN KEY (wallet_id) REFERENCES wallet(wallet_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `transaction_history_pkey`: `PRIMARY KEY (trans_id)`

### unit

- `fk_unit_floor_id`: `FOREIGN KEY (floor_id) REFERENCES floor(floor_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_unit_store_id`: `FOREIGN KEY (store_id) REFERENCES store(store_id) ON UPDATE CASCADE ON DELETE SET NULL`
- `unit_pkey`: `PRIMARY KEY (unit_id)`

### user_mall_visit

- `fk_user_mall_visit_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_user_mall_visit_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `user_mall_visit_pkey`: `PRIMARY KEY (visit_id)`

### user_session

- `fk_user_session_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `fk_user_session_user_id`: `FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `user_session_pkey`: `PRIMARY KEY (session_id)`

### wallet

- `fk_wallet_mall_id`: `FOREIGN KEY (mall_id) REFERENCES mall(mall_id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `wallet_pkey`: `PRIMARY KEY (wallet_id)`

## Interpretation notes

- `auth.users` is a Supabase-managed table in the auth schema, intentionally outside this public-schema inventory. Its referenced primary key is `id`, not `auth_user_id`; FK fields in application tables can still be named `admin_auth_user_id` or `user_auth_user_id`.
- Both the ERD and live database spell `beacon_node_assigment` without the second ?n? in ?assignment?. It is not a missing table. Renaming it would be a separate application/database change.
- `contract_onboarding_fee` in the ERD has leading non-breaking whitespace; after trimming, it matches the database. Several floor-plan fields also have trailing whitespace.
- `wallet`, `transaction_history`, and `payment.wallet_id` still exist in the live database. Removing the dashboard wallet column did not remove these database objects. Retiring them requires a separate decision and migration.
- No application reviewed/unread flag was found in the current application columns. Existing application status and notification read state are separate concepts.
- The ERD is a logical diagram: copying all Supabase-managed auth/storage internals into it is unnecessary unless an infrastructure-level diagram is intended.
