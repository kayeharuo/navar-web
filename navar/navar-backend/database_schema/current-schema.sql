-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.mall (
  mall_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  mall_name character varying NOT NULL,
  mall_state character varying NOT NULL,
  mall_city character varying NOT NULL,
  mall_zipcode character varying,
  mall_address text,
  mall_floor_count integer,
  mall_description text,
  mall_logo bytea,
  mall_beacon_major integer,
  mall_created_at timestamp with time zone NOT NULL,
  mall_updated_at timestamp with time zone NOT NULL,
  mall_coverage_area character varying CHECK (mall_coverage_area IS NULL OR (mall_coverage_area::text = ANY (ARRAY['Less than or equal to 15,000 sqm'::character varying, 'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm'::character varying, 'Greater than 50,000 sqm, but less than or equal to 150,000 sqm'::character varying, 'Greater than 150,000 sqm'::character varying]::text[]))),
  mall_latitude double precision CHECK (mall_latitude >= '-90'::integer::double precision AND mall_latitude <= 90::double precision),
  mall_longitude double precision CHECK (mall_longitude >= '-180'::integer::double precision AND mall_longitude <= 180::double precision),
  mall_logo_path text,
  CONSTRAINT mall_pkey PRIMARY KEY (mall_id)
);
CREATE TABLE public.stall_application (
  s_application_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  s_application_status character varying NOT NULL,
  s_application_created_at timestamp with time zone NOT NULL,
  s_application_updated_at timestamp with time zone NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT stall_application_pkey PRIMARY KEY (s_application_id),
  CONSTRAINT fk_stall_application_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.floor (
  floor_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  floor_num integer NOT NULL,
  floor_label character varying NOT NULL,
  floor_created_at timestamp with time zone NOT NULL,
  floor_updated_at timestamp with time zone NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT floor_pkey PRIMARY KEY (floor_id),
  CONSTRAINT fk_floor_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.brand (
  brand_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  brand_name character varying NOT NULL,
  brand_logo bytea NOT NULL,
  brand_description text,
  brand_created_at timestamp with time zone NOT NULL,
  brand_updated_at timestamp with time zone NOT NULL,
  brand_category text NOT NULL,
  brand_logo_path text,
  CONSTRAINT brand_pkey PRIMARY KEY (brand_id)
);
CREATE TABLE public.store (
  store_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  store_name character varying NOT NULL,
  store_unit_count integer NOT NULL,
  store_contact_person character varying,
  store_contact_num character varying,
  store_email character varying,
  store_status character varying NOT NULL,
  store_created_at timestamp with time zone NOT NULL,
  store_updated_at timestamp with time zone NOT NULL,
  brand_id bigint NOT NULL,
  store_has_cr boolean NOT NULL,
  mall_id integer,
  store_type character varying NOT NULL DEFAULT 'store'::character varying CHECK (store_type::text = ANY (ARRAY['store'::character varying, 'stall'::character varying]::text[])),
  store_description text,
  onboarding_floor_id bigint,
  CONSTRAINT store_pkey PRIMARY KEY (store_id),
  CONSTRAINT fk_store_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id),
  CONSTRAINT fk_store_brand_id FOREIGN KEY (brand_id) REFERENCES public.brand(brand_id),
  CONSTRAINT store_onboarding_floor_id_fkey FOREIGN KEY (onboarding_floor_id) REFERENCES public.floor(floor_id)
);
CREATE TABLE public.stall (
  stall_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  stall_description text NOT NULL,
  stall_created_at timestamp with time zone NOT NULL,
  stall_updated_at timestamp with time zone NOT NULL,
  floor_id bigint NOT NULL,
  s_application_id bigint NOT NULL,
  store_id bigint,
  CONSTRAINT stall_pkey PRIMARY KEY (stall_id),
  CONSTRAINT fk_stall_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_stall_s_application_id FOREIGN KEY (s_application_id) REFERENCES public.stall_application(s_application_id),
  CONSTRAINT fk_stall_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.admin (
  admin_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  admin_role character varying NOT NULL CHECK (admin_role::text = ANY (ARRAY['super_admin'::character varying, 'mall_admin'::character varying, 'store_admin'::character varying]::text[])),
  admin_email character varying NOT NULL CHECK (admin_email::text = lower(admin_email::text)),
  admin_full_name character varying NOT NULL,
  admin_contact_num character varying,
  admin_job_title character varying,
  admin_is_primary boolean NOT NULL,
  admin_is_deactivated boolean NOT NULL,
  admin_deactivated_on timestamp with time zone,
  admin_last_login timestamp with time zone,
  admin_created_at timestamp with time zone NOT NULL,
  admin_updated_at timestamp with time zone NOT NULL,
  mall_id bigint,
  admin_account_status character varying NOT NULL CHECK (admin_account_status::text = ANY (ARRAY['partial'::character varying, 'official'::character varying]::text[])),
  store_id integer,
  admin_auth_user_id uuid NOT NULL UNIQUE,
  admin_profile_picture text,
  admin_profile_picture_path text,
  CONSTRAINT admin_pkey PRIMARY KEY (admin_id),
  CONSTRAINT fk_admin_store FOREIGN KEY (store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_admin_auth_user_id FOREIGN KEY (admin_auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_admin_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.email_log (
  email_log_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email_log_type character varying NOT NULL,
  email_log_to_email character varying NOT NULL,
  email_log_subject character varying NOT NULL,
  email_log_body text NOT NULL,
  email_log_status character varying NOT NULL,
  email_log_fail_reason text,
  email_log_sent_at timestamp with time zone NOT NULL,
  email_log_triggered_by bigint,
  mall_id bigint,
  CONSTRAINT email_log_pkey PRIMARY KEY (email_log_id),
  CONSTRAINT fk_email_log_email_log_triggered_by FOREIGN KEY (email_log_triggered_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_email_log_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.operating_hours (
  opthrs_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  opthrs_day_of_week character varying NOT NULL,
  opthrs_open_time time without time zone,
  opthrs_close_time time without time zone,
  opthrs_is_closed boolean NOT NULL,
  store_id bigint,
  opthrs_is_mall boolean,
  opthrs_is_store boolean,
  mall_id bigint,
  opthrs_is_inquiry boolean NOT NULL DEFAULT false,
  inquiry_id integer,
  CONSTRAINT operating_hours_pkey PRIMARY KEY (opthrs_id),
  CONSTRAINT fk_operating_hours_inquiry_id FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id),
  CONSTRAINT fk_operating_hours_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_operating_hours_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.app_user (
  user_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_role character varying NOT NULL,
  user_name character varying NOT NULL,
  user_email character varying NOT NULL CHECK (user_email::text = lower(user_email::text)),
  user_gender character varying,
  user_dob date,
  user_created_at timestamp with time zone NOT NULL,
  user_deleted_at timestamp with time zone,
  user_last_login timestamp with time zone,
  user_auth_user_id uuid NOT NULL UNIQUE,
  CONSTRAINT app_user_pkey PRIMARY KEY (user_id),
  CONSTRAINT fk_app_user_auth_user_id FOREIGN KEY (user_auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notif_preference (
  notifpref_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  notifpref_nav_updates boolean NOT NULL DEFAULT true,
  notifpref_prom_alerts boolean NOT NULL DEFAULT true,
  user_id bigint NOT NULL UNIQUE,
  CONSTRAINT notif_preference_pkey PRIMARY KEY (notifpref_id),
  CONSTRAINT fk_notif_preference_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id)
);
CREATE TABLE public.navigation_plan (
  plan_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  plan_created_at timestamp with time zone NOT NULL,
  plan_is_active boolean NOT NULL,
  user_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT navigation_plan_pkey PRIMARY KEY (plan_id),
  CONSTRAINT fk_navigation_plan_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id),
  CONSTRAINT fk_navigation_plan_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.beacon (
  beacon_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  beacon_code character varying NOT NULL,
  beacon_label character varying NOT NULL,
  beacon_minor integer NOT NULL,
  beacon_tx_power integer NOT NULL,
  beacon_status character varying NOT NULL,
  beacon_location character varying NOT NULL,
  beacon_node_count integer NOT NULL,
  beacon_installed_at timestamp with time zone NOT NULL,
  beacon_maintained_at timestamp with time zone NOT NULL,
  mall_id bigint NOT NULL,
  floor_id integer NOT NULL,
  CONSTRAINT beacon_pkey PRIMARY KEY (beacon_id),
  CONSTRAINT fk_beacon_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_beacon_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.battery (
  battery_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  battery_brand character varying NOT NULL,
  battery_status character varying NOT NULL,
  battery_installed_at timestamp with time zone NOT NULL,
  battery_replaced_at timestamp with time zone,
  beacon_id bigint NOT NULL,
  battery_code character varying NOT NULL,
  CONSTRAINT battery_pkey PRIMARY KEY (battery_id),
  CONSTRAINT fk_battery_beacon_id FOREIGN KEY (beacon_id) REFERENCES public.beacon(beacon_id)
);
CREATE TABLE public.user_session (
  session_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  session_start timestamp with time zone NOT NULL,
  session_last_activity timestamp with time zone NOT NULL,
  session_is_active boolean NOT NULL,
  user_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT user_session_pkey PRIMARY KEY (session_id),
  CONSTRAINT fk_user_session_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id),
  CONSTRAINT fk_user_session_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.audit_log (
  audit_log_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  audit_log_module character varying NOT NULL,
  audit_log_action character varying NOT NULL,
  audit_log_details text,
  audit_log_performed_at timestamp with time zone NOT NULL,
  audit_log_performed_by bigint NOT NULL,
  mall_id bigint,
  CONSTRAINT audit_log_pkey PRIMARY KEY (audit_log_id),
  CONSTRAINT fk_audit_log_audit_log_performed_by FOREIGN KEY (audit_log_performed_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_audit_log_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.application (
  application_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  application_version integer NOT NULL,
  application_status character varying NOT NULL,
  application_created_at timestamp with time zone NOT NULL,
  application_updated_at timestamp with time zone NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT application_pkey PRIMARY KEY (application_id),
  CONSTRAINT fk_application_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.ar_development (
  ar_development_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ar_development_status character varying NOT NULL,
  ar_development_version integer NOT NULL,
  ar_development_activated_at timestamp with time zone,
  ar_development_created_at timestamp with time zone NOT NULL,
  ar_development_updated_at timestamp with time zone NOT NULL,
  application_id bigint NOT NULL,
  ar_development_map_revision integer NOT NULL DEFAULT 0,
  CONSTRAINT ar_development_pkey PRIMARY KEY (ar_development_id),
  CONSTRAINT fk_ar_development_application_id FOREIGN KEY (application_id) REFERENCES public.application(application_id)
);
CREATE TABLE public.thread (
  thread_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  thread_source character varying NOT NULL,
  thread_created_at timestamp with time zone NOT NULL,
  application_id bigint,
  ar_development_id bigint,
  s_application_id bigint,
  CONSTRAINT thread_pkey PRIMARY KEY (thread_id),
  CONSTRAINT fk_thread_application_id FOREIGN KEY (application_id) REFERENCES public.application(application_id),
  CONSTRAINT fk_thread_ar_development_id FOREIGN KEY (ar_development_id) REFERENCES public.ar_development(ar_development_id),
  CONSTRAINT fk_thread_s_application_id FOREIGN KEY (s_application_id) REFERENCES public.stall_application(s_application_id)
);
CREATE TABLE public.store_payment_method (
  store_pm_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  store_pm_name text NOT NULL,
  store_pm_created_at timestamp with time zone NOT NULL,
  store_pm_updated_at timestamp with time zone NOT NULL,
  store_id bigint NOT NULL,
  CONSTRAINT store_payment_method_pkey PRIMARY KEY (store_pm_id),
  CONSTRAINT fk_store_payment_method_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.wallet (
  wallet_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  wallet_balance double precision NOT NULL,
  wallet_updated_at timestamp with time zone NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT wallet_pkey PRIMARY KEY (wallet_id),
  CONSTRAINT fk_wallet_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.analytics_hourly_snapshot (
  hourly_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  hourly_date timestamp with time zone NOT NULL,
  hourly_hour integer NOT NULL,
  hourly_session_count integer NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT analytics_hourly_snapshot_pkey PRIMARY KEY (hourly_id),
  CONSTRAINT fk_analytics_hourly_snapshot_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.thread_message (
  message_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  message_sender_type character varying NOT NULL,
  message_sent_at timestamp with time zone NOT NULL,
  message_content text NOT NULL,
  thread_id bigint NOT NULL,
  message_sender bigint NOT NULL,
  CONSTRAINT thread_message_pkey PRIMARY KEY (message_id),
  CONSTRAINT fk_thread_message_thread_id FOREIGN KEY (thread_id) REFERENCES public.thread(thread_id),
  CONSTRAINT fk_thread_message_message_sender FOREIGN KEY (message_sender) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.user_mall_visit (
  visit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  visit_first_visit_date timestamp with time zone NOT NULL,
  visit_total_session_count integer NOT NULL,
  user_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT user_mall_visit_pkey PRIMARY KEY (visit_id),
  CONSTRAINT fk_user_mall_visit_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id),
  CONSTRAINT fk_user_mall_visit_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.subscription_tier (
  s_tier_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  s_tier_key character varying NOT NULL,
  s_tier_label character varying NOT NULL,
  s_tier_annual_fee double precision NOT NULL,
  s_tier_grace_period_days integer NOT NULL,
  s_tier_onsite_dispatch_sla text NOT NULL,
  s_tier_reinstatement_rate double precision NOT NULL,
  s_tier_map_updates_per_year integer NOT NULL,
  s_tier_max_floors integer NOT NULL,
  s_tier_max_admin_account integer NOT NULL,
  s_tier_max_gfa double precision NOT NULL,
  s_tier_analytics_level text NOT NULL,
  s_tier_ar_priority text NOT NULL,
  s_tier_onboarding_fee double precision NOT NULL,
  s_tier_diagnosis boolean NOT NULL,
  s_tier_beacon_allocation integer NOT NULL,
  s_tier_remote_response_sla text NOT NULL,
  s_tier_replacement_unit_cost text NOT NULL,
  s_tier_battery_replacement text NOT NULL,
  s_tier_created_at timestamp with time zone NOT NULL,
  s_tier_updated_at timestamp with time zone NOT NULL,
  s_tier_included_tenant_count integer NOT NULL,
  s_tier_spare_units_onsite boolean NOT NULL,
  s_tier_additional_stall_fee double precision NOT NULL,
  CONSTRAINT subscription_tier_pkey PRIMARY KEY (s_tier_id)
);
CREATE TABLE public.contract (
  contract_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  contract_version integer NOT NULL,
  contract_is_current boolean NOT NULL,
  contract_annual_fee double precision NOT NULL,
  contract_onboarding_fee double precision NOT NULL,
  contract_grace_period_days integer NOT NULL,
  contract_reinstatement_rate double precision NOT NULL,
  contract_start timestamp with time zone,
  contract_end timestamp with time zone,
  contract_notes text,
  contract_created_at timestamp with time zone,
  contract_updated_at timestamp with time zone,
  admin_id bigint NOT NULL,
  s_tier_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  contract_status character varying,
  CONSTRAINT contract_pkey PRIMARY KEY (contract_id),
  CONSTRAINT fk_contract_admin_id FOREIGN KEY (admin_id) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_contract_s_tier_id FOREIGN KEY (s_tier_id) REFERENCES public.subscription_tier(s_tier_id),
  CONSTRAINT fk_contract_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.payment (
  payment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  payment_type character varying NOT NULL,
  payment_amount double precision NOT NULL,
  payment_method character varying NOT NULL,
  payment_ref_num character varying,
  payment_notes text,
  payment_paid_at timestamp with time zone NOT NULL,
  contract_id bigint NOT NULL,
  wallet_id bigint NOT NULL,
  s_application_id bigint,
  CONSTRAINT payment_pkey PRIMARY KEY (payment_id),
  CONSTRAINT fk_payment_contract_id FOREIGN KEY (contract_id) REFERENCES public.contract(contract_id),
  CONSTRAINT fk_payment_wallet_id FOREIGN KEY (wallet_id) REFERENCES public.wallet(wallet_id),
  CONSTRAINT fk_payment_s_application_id FOREIGN KEY (s_application_id) REFERENCES public.stall_application(s_application_id)
);
CREATE TABLE public.beacon_ticket (
  ticket_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ticket_current_status character varying NOT NULL,
  ticket_reported_at timestamp with time zone NOT NULL,
  ticket_reported_by bigint NOT NULL,
  beacon_id bigint NOT NULL,
  ticket_assigned_to bigint,
  ticket_issue text,
  CONSTRAINT beacon_ticket_pkey PRIMARY KEY (ticket_id),
  CONSTRAINT fk_beacon_ticket_ticket_reported_by FOREIGN KEY (ticket_reported_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_beacon_ticket_beacon_id FOREIGN KEY (beacon_id) REFERENCES public.beacon(beacon_id),
  CONSTRAINT fk_beacon_ticket_ticket_assigned_to FOREIGN KEY (ticket_assigned_to) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.beacon_ticket_log (
  ticket_log_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ticket_log_status character varying NOT NULL,
  ticket_log_notes text,
  ticket_log_changed_at timestamp with time zone NOT NULL,
  ticket_log_changed_by bigint NOT NULL,
  ticket_id bigint NOT NULL,
  CONSTRAINT beacon_ticket_log_pkey PRIMARY KEY (ticket_log_id),
  CONSTRAINT fk_beacon_ticket_log_ticket_log_changed_by FOREIGN KEY (ticket_log_changed_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_beacon_ticket_log_ticket_id FOREIGN KEY (ticket_id) REFERENCES public.beacon_ticket(ticket_id)
);
CREATE TABLE public.unit (
  unit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit_label character varying NOT NULL,
  unit_status character varying NOT NULL,
  unit_created_at timestamp with time zone NOT NULL,
  unit_updated_at timestamp with time zone NOT NULL,
  floor_id bigint NOT NULL,
  store_id bigint,
  CONSTRAINT unit_pkey PRIMARY KEY (unit_id),
  CONSTRAINT fk_unit_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_unit_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.node (
  node_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  node_label character varying,
  node_type character varying NOT NULL,
  node_x_coordinate double precision NOT NULL,
  node_y_coordinate double precision NOT NULL,
  node_is_store_entrance boolean NOT NULL,
  node_is_accessible boolean NOT NULL,
  node_created_at timestamp with time zone NOT NULL,
  node_updated_at timestamp with time zone NOT NULL,
  floor_id bigint NOT NULL,
  store_id bigint,
  unit_id bigint,
  node_pixel_x double precision,
  node_pixel_y double precision,
  node_cross_floor_link_id integer,
  CONSTRAINT node_pkey PRIMARY KEY (node_id),
  CONSTRAINT fk_node_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_node_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_node_unit_id FOREIGN KEY (unit_id) REFERENCES public.unit(unit_id),
  CONSTRAINT fk_node_cross_floor_link_id FOREIGN KEY (node_cross_floor_link_id) REFERENCES public.node(node_id)
);
CREATE TABLE public.navigation_session (
  navsesh_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  navsesh_start_time timestamp with time zone NOT NULL,
  navsesh_arrived_time timestamp with time zone,
  navsesh_date date NOT NULL,
  navsesh_is_completed boolean NOT NULL,
  navsesh_is_emergency boolean NOT NULL,
  navsesh_route_pref character varying,
  user_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  store_id bigint,
  last_known_node_id bigint,
  destination_node_id bigint,
  ar_development_id bigint,
  CONSTRAINT navigation_session_pkey PRIMARY KEY (navsesh_id),
  CONSTRAINT fk_navigation_session_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id),
  CONSTRAINT fk_navigation_session_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id),
  CONSTRAINT fk_navigation_session_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_navigation_session_last_known_node_id FOREIGN KEY (last_known_node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_navigation_session_destination_node_id FOREIGN KEY (destination_node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_navigation_session_ar_development_id FOREIGN KEY (ar_development_id) REFERENCES public.ar_development(ar_development_id)
);
CREATE TABLE public.application_entry_point (
  app_entry_point_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  app_entry_point_label character varying NOT NULL,
  app_entry_point_description text,
  app_entry_point_created_at timestamp with time zone NOT NULL,
  app_entry_point_updated_at timestamp with time zone NOT NULL,
  application_id bigint NOT NULL,
  floor_id bigint NOT NULL,
  CONSTRAINT application_entry_point_pkey PRIMARY KEY (app_entry_point_id),
  CONSTRAINT fk_application_entry_point_application_id FOREIGN KEY (application_id) REFERENCES public.application(application_id),
  CONSTRAINT fk_application_entry_point_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id)
);
CREATE TABLE public.beacon_node_assigment (
  assignment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  assignment_created_at timestamp with time zone NOT NULL,
  assignment_updated_at timestamp with time zone NOT NULL,
  beacon_id bigint,
  node_id bigint NOT NULL,
  ar_development_id bigint NOT NULL,
  CONSTRAINT beacon_node_assigment_pkey PRIMARY KEY (assignment_id),
  CONSTRAINT fk_beacon_node_assigment_beacon_id FOREIGN KEY (beacon_id) REFERENCES public.beacon(beacon_id),
  CONSTRAINT fk_beacon_node_assigment_node_id FOREIGN KEY (node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_beacon_node_assigment_ar_development_id FOREIGN KEY (ar_development_id) REFERENCES public.ar_development(ar_development_id)
);
CREATE TABLE public.store_visit (
  store_visit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  store_visit_timestamp timestamp with time zone NOT NULL,
  store_id bigint NOT NULL,
  user_id bigint NOT NULL,
  mall_id bigint NOT NULL,
  CONSTRAINT store_visit_pkey PRIMARY KEY (store_visit_id),
  CONSTRAINT fk_store_visit_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_store_visit_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id),
  CONSTRAINT fk_store_visit_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.account_invite (
  a_invite_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  a_invite_token character varying NOT NULL,
  a_invite_expires_at timestamp with time zone NOT NULL,
  a_invite_is_used boolean NOT NULL,
  a_invite_created_at timestamp with time zone NOT NULL,
  admin_id bigint NOT NULL,
  CONSTRAINT account_invite_pkey PRIMARY KEY (a_invite_id),
  CONSTRAINT fk_account_invite_admin_id FOREIGN KEY (admin_id) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.inquiry (
  inquiry_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  inquiry_email_token character varying NOT NULL,
  inquiry_mall_name character varying NOT NULL,
  inquiry_mall_state character varying NOT NULL,
  inquiry_mall_city character varying NOT NULL,
  inquiry_mall_zip_code character varying,
  inquiry_mall_address text,
  inquiry_mall_floor_count integer,
  inquiry_mall_description text,
  inquiry_contact_person character varying NOT NULL,
  inquiry_contact_num character varying,
  inquiry_contact_email character varying NOT NULL,
  inquiry_interested_tier character varying,
  inquiry_status character varying NOT NULL,
  inquiry_created_at timestamp with time zone NOT NULL,
  inquiry_updated_at timestamp with time zone NOT NULL,
  mall_id bigint,
  inquiry_coverage_area character varying CHECK (inquiry_coverage_area IS NULL OR (inquiry_coverage_area::text = ANY (ARRAY['Less than or equal to 15,000 sqm'::character varying, 'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm'::character varying, 'Greater than 50,000 sqm, but less than or equal to 150,000 sqm'::character varying, 'Greater than 150,000 sqm'::character varying]::text[]))),
  inquiry_reviewed_by bigint,
  inquiry_reviewed_at timestamp with time zone,
  inquiry_rejection_reason text,
  inquiry_original_description text,
  inquiry_has_revision boolean NOT NULL DEFAULT false,
  inquiry_mall_barangay text DEFAULT NULLIF(btrim("substring"(inquiry_mall_address, '(?i)(?:^|,)[[:space:]]*Barangay[[:space:]]+([^,]+)'::text)), ''::text),
  CONSTRAINT inquiry_pkey PRIMARY KEY (inquiry_id),
  CONSTRAINT inquiry_inquiry_reviewed_by_fkey FOREIGN KEY (inquiry_reviewed_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_inquiry_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.beacon_scan_log (
  bscan_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bscan_rssi_value integer NOT NULL,
  bscan_is_strongest_signal boolean NOT NULL,
  bscan_scanned_at timestamp with time zone NOT NULL,
  beacon_id bigint NOT NULL,
  navsesh_id bigint NOT NULL,
  resolved_node_id bigint,
  CONSTRAINT beacon_scan_log_pkey PRIMARY KEY (bscan_id),
  CONSTRAINT fk_beacon_scan_log_beacon_id FOREIGN KEY (beacon_id) REFERENCES public.beacon(beacon_id),
  CONSTRAINT fk_beacon_scan_log_navsesh_id FOREIGN KEY (navsesh_id) REFERENCES public.navigation_session(navsesh_id),
  CONSTRAINT fk_beacon_scan_log_resolved_node_id FOREIGN KEY (resolved_node_id) REFERENCES public.node(node_id)
);
CREATE TABLE public.floor_calibration (
  calibration_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  calibration_ref_start_x double precision,
  calibration_ref_start_y double precision,
  calibration_ref_end_x double precision,
  calibration_ref_end_y double precision,
  calibration_real_meters double precision,
  calibration_pixel_per_meter double precision,
  calibration_path_loss_exponent double precision CHECK (calibration_path_loss_exponent IS NULL OR calibration_path_loss_exponent >= 1::double precision AND calibration_path_loss_exponent <= 6::double precision),
  calibration_created_at timestamp with time zone NOT NULL,
  calibration_updated_at timestamp with time zone NOT NULL,
  floor_id bigint NOT NULL,
  ar_development_id bigint NOT NULL,
  calibration_ref_label text,
  CONSTRAINT floor_calibration_pkey PRIMARY KEY (calibration_id),
  CONSTRAINT fk_floor_calibration_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_floor_calibration_ar_development_id FOREIGN KEY (ar_development_id) REFERENCES public.ar_development(ar_development_id)
);
CREATE TABLE public.notification (
  notif_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  notif_type character varying NOT NULL,
  notif_title character varying NOT NULL,
  notif_message text NOT NULL,
  notif_action_url character varying,
  notif_action_label character varying,
  notif_is_read boolean NOT NULL,
  notif_is_archived boolean NOT NULL,
  notif_created_at timestamp with time zone NOT NULL,
  notif_read_at timestamp with time zone,
  notif_target_role character varying,
  mall_id bigint NOT NULL,
  notif_recipient bigint,
  CONSTRAINT notification_pkey PRIMARY KEY (notif_id),
  CONSTRAINT fk_notification_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id),
  CONSTRAINT fk_notification_notif_recipient FOREIGN KEY (notif_recipient) REFERENCES public.app_user(user_id)
);
CREATE TABLE public.accessibility_preference (
  pref_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  pref_require_esc boolean NOT NULL DEFAULT true,
  pref_require_stair boolean NOT NULL DEFAULT true,
  pref_require_elev boolean NOT NULL DEFAULT true,
  pref_require_ramp boolean NOT NULL DEFAULT true,
  pref_updated_at timestamp with time zone,
  user_id bigint NOT NULL UNIQUE,
  CONSTRAINT accessibility_preference_pkey PRIMARY KEY (pref_id),
  CONSTRAINT fk_accessibility_preference_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id)
);
CREATE TABLE public.navigation_plan_destination (
  plan_dest_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  plan_dest_distance_from_current numeric NOT NULL,
  plan_dest_priority_rank integer NOT NULL,
  plan_dest_is_completed boolean NOT NULL,
  plan_id bigint NOT NULL,
  destination_store_id bigint,
  destination_node_id bigint NOT NULL,
  navsesh_id bigint,
  CONSTRAINT navigation_plan_destination_pkey PRIMARY KEY (plan_dest_id),
  CONSTRAINT fk_navigation_plan_destination_plan_id FOREIGN KEY (plan_id) REFERENCES public.navigation_plan(plan_id),
  CONSTRAINT fk_navigation_plan_destination_destination_store_id FOREIGN KEY (destination_store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_navigation_plan_destination_destination_node_id FOREIGN KEY (destination_node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_navigation_plan_destination_navsesh_id FOREIGN KEY (navsesh_id) REFERENCES public.navigation_session(navsesh_id)
);
CREATE TABLE public.tenant (
  tenant_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_name character varying NOT NULL,
  tenant_type character varying NOT NULL,
  tenant_contact_person character varying,
  tenant_contact_num character varying,
  tenant_email character varying,
  tenant_status character varying NOT NULL,
  tenant_created_at timestamp with time zone NOT NULL,
  tenant_updated_at timestamp with time zone,
  store_id bigint NOT NULL,
  CONSTRAINT tenant_pkey PRIMARY KEY (tenant_id),
  CONSTRAINT fk_tenant_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.edge (
  edge_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  edge_distance double precision NOT NULL CHECK (edge_distance >= 0::double precision),
  edge_path_type character varying NOT NULL CHECK (edge_path_type::text = ANY (ARRAY['normal'::character varying, 'accessible'::character varying, 'restricted'::character varying]::text[])),
  edge_created_at timestamp with time zone NOT NULL,
  edge_updated_at timestamp with time zone NOT NULL,
  start_node_id bigint NOT NULL,
  end_node_id bigint NOT NULL,
  ar_development_id bigint NOT NULL,
  edge_is_accessible boolean NOT NULL DEFAULT true,
  edge_is_cross_floor boolean NOT NULL DEFAULT false,
  CONSTRAINT edge_pkey PRIMARY KEY (edge_id),
  CONSTRAINT fk_edge_start_node_id FOREIGN KEY (start_node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_edge_end_node_id FOREIGN KEY (end_node_id) REFERENCES public.node(node_id),
  CONSTRAINT fk_edge_ar_development_id FOREIGN KEY (ar_development_id) REFERENCES public.ar_development(ar_development_id)
);
CREATE TABLE public.stall_floor_plan (
  s_floor_plan_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  s_floor_plan_image bytea NOT NULL,
  s_floor_plan_created_at timestamp with time zone NOT NULL,
  s_floor_plan_updated_at timestamp with time zone NOT NULL,
  floor_id bigint NOT NULL,
  s_application_id bigint NOT NULL,
  CONSTRAINT stall_floor_plan_pkey PRIMARY KEY (s_floor_plan_id),
  CONSTRAINT fk_stall_floor_plan_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id),
  CONSTRAINT fk_stall_floor_plan_s_application_id FOREIGN KEY (s_application_id) REFERENCES public.stall_application(s_application_id)
);
CREATE TABLE public.store_additional_info (
  addinfo_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  addinfo_text text NOT NULL,
  addinfo_created_at timestamp with time zone NOT NULL,
  addinfo_updated_at timestamp with time zone,
  store_id bigint NOT NULL,
  CONSTRAINT store_additional_info_pkey PRIMARY KEY (addinfo_id),
  CONSTRAINT fk_store_additional_info_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.promotion (
  promotion_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  promotion_title character varying NOT NULL,
  promotion_description text,
  promotion_type character varying NOT NULL,
  promotion_start_date date NOT NULL,
  promotion_end_date date NOT NULL,
  promotion_status character varying NOT NULL,
  promotion_created_at timestamp with time zone NOT NULL,
  promotion_updated_at timestamp with time zone,
  store_id bigint NOT NULL,
  CONSTRAINT promotion_pkey PRIMARY KEY (promotion_id),
  CONSTRAINT fk_promotion_store_id FOREIGN KEY (store_id) REFERENCES public.store(store_id)
);
CREATE TABLE public.promotion_interaction (
  interaction_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  interaction_timestamp timestamp with time zone NOT NULL,
  promotion_id bigint NOT NULL,
  user_id bigint NOT NULL,
  CONSTRAINT promotion_interaction_pkey PRIMARY KEY (interaction_id),
  CONSTRAINT fk_promotion_interaction_promotion_id FOREIGN KEY (promotion_id) REFERENCES public.promotion(promotion_id),
  CONSTRAINT fk_promotion_interaction_user_id FOREIGN KEY (user_id) REFERENCES public.app_user(user_id)
);
CREATE TABLE public.transaction_history (
  trans_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  trans_type character varying NOT NULL,
  trans_amount numeric NOT NULL,
  trans_reference character varying,
  trans_description text,
  trans_status character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  wallet_id bigint NOT NULL,
  CONSTRAINT transaction_history_pkey PRIMARY KEY (trans_id),
  CONSTRAINT fk_transaction_history_wallet_id FOREIGN KEY (wallet_id) REFERENCES public.wallet(wallet_id)
);
CREATE TABLE public.system_settings (
  settings_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  settings_beacon_uuid character varying NOT NULL,
  settings_created_at timestamp with time zone NOT NULL,
  CONSTRAINT system_settings_pkey PRIMARY KEY (settings_id)
);
CREATE TABLE public.suspension (
  suspension_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  suspension_reason text NOT NULL,
  suspension_penalty_amount double precision,
  suspension_notes text,
  suspension_suspended_at timestamp with time zone NOT NULL,
  suspension_lifted_at timestamp with time zone,
  suspension_lifted_by bigint,
  contract_id bigint NOT NULL,
  CONSTRAINT suspension_pkey PRIMARY KEY (suspension_id),
  CONSTRAINT fk_suspension_suspension_lifted_by FOREIGN KEY (suspension_lifted_by) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_suspension_contract_id FOREIGN KEY (contract_id) REFERENCES public.contract(contract_id)
);
CREATE TABLE public.application_floor_plan (
  app_floor_plan_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  app_floor_plan_image bytea NOT NULL,
  app_floor_plan_reference_line text NOT NULL,
  app_floor_plan_meter_length integer NOT NULL,
  app_floor_plan_accessibility_route text NOT NULL,
  app_floor_plan_emergency_route text NOT NULL,
  app_floor_plan_created_at timestamp with time zone NOT NULL,
  app_floor_plan_updated_at timestamp with time zone NOT NULL,
  application_id bigint NOT NULL,
  floor_id bigint NOT NULL,
  app_floor_plan_storage_path text,
  app_floor_plan_file_name character varying,
  app_floor_plan_mime_type character varying,
  app_floor_plan_file_size bigint,
  plan_filename text,
  plan_calibration jsonb,
  accessible_routes jsonb,
  emergency_routes jsonb,
  CONSTRAINT application_floor_plan_pkey PRIMARY KEY (app_floor_plan_id),
  CONSTRAINT fk_application_floor_plan_application_id FOREIGN KEY (application_id) REFERENCES public.application(application_id),
  CONSTRAINT fk_application_floor_plan_floor_id FOREIGN KEY (floor_id) REFERENCES public.floor(floor_id)
);
CREATE TABLE public.analytics_daily_snapshot (
  daily_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  daily_date timestamp with time zone NOT NULL,
  daily_total_sessions integer NOT NULL,
  daily_completed_sessions integer NOT NULL,
  daily_avg_duration_seconds integer NOT NULL,
  daily_new_users integer NOT NULL,
  daily_returning_users integer NOT NULL,
  daily_top_destination_node_type character varying,
  daily_revenue double precision NOT NULL,
  daily_top_store_id bigint,
  mall_id bigint NOT NULL,
  CONSTRAINT analytics_daily_snapshot_pkey PRIMARY KEY (daily_id),
  CONSTRAINT fk_analytics_daily_snapshot_daily_top_store_id FOREIGN KEY (daily_top_store_id) REFERENCES public.store(store_id),
  CONSTRAINT fk_analytics_daily_snapshot_mall_id FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.inquiry_message (
  i_message_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  i_message_sender_type character varying NOT NULL,
  i_message_sender_email character varying NOT NULL,
  i_message_message text NOT NULL,
  i_message_sent_at timestamp with time zone NOT NULL,
  i_message_is_read boolean NOT NULL,
  inquiry_id bigint NOT NULL,
  i_message_request_id uuid,
  i_message_admin_id bigint,
  i_message_kind text NOT NULL DEFAULT 'reply'::text,
  i_message_delivery_status text NOT NULL DEFAULT 'not_recorded'::text,
  i_message_delivered_at timestamp with time zone,
  i_message_email_id text,
  CONSTRAINT inquiry_message_pkey PRIMARY KEY (i_message_id),
  CONSTRAINT inquiry_message_i_message_admin_id_fkey FOREIGN KEY (i_message_admin_id) REFERENCES public.admin(admin_id),
  CONSTRAINT fk_inquiry_message_inquiry_id FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id)
);
CREATE TABLE public.admin_password_request (
  apr_request_fingerprint character NOT NULL,
  apr_auth_user_id uuid NOT NULL,
  apr_request_kind character varying NOT NULL CHECK (apr_request_kind::text = ANY (ARRAY['invite'::character varying, 'reset'::character varying]::text[])),
  apr_issued_at timestamp with time zone NOT NULL DEFAULT now(),
  apr_expires_at timestamp with time zone NOT NULL,
  apr_claimed_at timestamp with time zone,
  apr_superseded_at timestamp with time zone,
  CONSTRAINT admin_password_request_pkey PRIMARY KEY (apr_request_fingerprint),
  CONSTRAINT admin_password_request_auth_user_id_fkey FOREIGN KEY (apr_auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.mall_admin_account (
  admin_id bigint NOT NULL,
  username character varying UNIQUE CHECK (username IS NULL OR username::text ~ '^[a-z0-9_.]{3,30}$'::text),
  setup_completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mall_admin_account_pkey PRIMARY KEY (admin_id),
  CONSTRAINT mall_admin_account_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.contract_payment_request (
  request_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  contract_id bigint NOT NULL,
  fee_type text NOT NULL CHECK (fee_type = ANY (ARRAY['onboarding'::text, 'subscription'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])),
  checkout_url text CHECK (checkout_url IS NULL OR checkout_url ~ '^https://[^[:space:]]+$'::text),
  confirmation_message text,
  confirmed_at timestamp with time zone,
  paid_at timestamp with time zone,
  payment_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contract_payment_request_pkey PRIMARY KEY (request_id),
  CONSTRAINT contract_payment_request_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contract(contract_id)
);
CREATE TABLE public.mall_account_invitation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mall_id bigint NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['mall_admin'::text, 'tenant'::text])),
  email character varying NOT NULL CHECK (email::text = lower(btrim(email::text))),
  full_name character varying NOT NULL CHECK (length(btrim(full_name::text)) > 0),
  contact character varying,
  job_title character varying,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text])),
  delivery_status text NOT NULL DEFAULT 'draft'::text CHECK (delivery_status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text, 'failed'::text])),
  token_hash text NOT NULL CHECK (length(token_hash) = 64),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '48:00:00'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by bigint NOT NULL,
  accepted_at timestamp with time zone,
  auth_user_id uuid,
  requires_password boolean NOT NULL DEFAULT false,
  delivery_generation integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone,
  lease_until timestamp with time zone,
  delivery_error text,
  request_key uuid NOT NULL,
  CONSTRAINT mall_account_invitation_pkey PRIMARY KEY (id),
  CONSTRAINT mall_account_invitation_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT mall_account_invitation_mall_id_fkey FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id),
  CONSTRAINT mall_account_invitation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.mall_invitation_tenant (
  invitation_id uuid NOT NULL,
  tenant_id bigint NOT NULL,
  CONSTRAINT mall_invitation_tenant_pkey PRIMARY KEY (invitation_id, tenant_id),
  CONSTRAINT mall_invitation_tenant_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.mall_account_invitation(id),
  CONSTRAINT mall_invitation_tenant_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id)
);
CREATE TABLE public.tenant_account (
  tenant_id bigint NOT NULL,
  auth_user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_login_at timestamp with time zone,
  CONSTRAINT tenant_account_pkey PRIMARY KEY (tenant_id),
  CONSTRAINT tenant_account_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id),
  CONSTRAINT tenant_account_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.mall_onboarding (
  mall_id bigint NOT NULL,
  contract_id bigint,
  offer jsonb,
  prepayment_acceptance jsonb,
  agreement_acceptance jsonb,
  profile_draft jsonb,
  profile_completed_at timestamp with time zone,
  establishments jsonb,
  establishments_completed_at timestamp with time zone,
  application_id bigint,
  completed_at timestamp with time zone,
  legacy_approved boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0,
  offered_by bigint,
  floors_deferred_at timestamp with time zone,
  floors_configured_at timestamp with time zone,
  CONSTRAINT mall_onboarding_pkey PRIMARY KEY (mall_id),
  CONSTRAINT mall_onboarding_mall_id_fkey FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id),
  CONSTRAINT mall_onboarding_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contract(contract_id),
  CONSTRAINT mall_onboarding_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(application_id),
  CONSTRAINT mall_onboarding_offered_by_fkey FOREIGN KEY (offered_by) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.mall_payment_checkout (
  request_id bigint NOT NULL,
  session_id text NOT NULL UNIQUE,
  amount_cent bigint NOT NULL CHECK (amount_cent > 0),
  livemode boolean NOT NULL,
  payment_id text UNIQUE,
  confirmed_at timestamp with time zone,
  payment_source text NOT NULL DEFAULT 'paymongo'::text CHECK (payment_source = ANY (ARRAY['paymongo'::text, 'manual'::text])),
  CONSTRAINT mall_payment_checkout_pkey PRIMARY KEY (request_id),
  CONSTRAINT mall_payment_checkout_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.contract_payment_request(request_id)
);
CREATE TABLE public.admin_notification (
  admin_notif_id integer NOT NULL DEFAULT nextval('admin_notification_admin_notif_id_seq'::regclass),
  admin_notif_type character varying NOT NULL,
  admin_notif_title character varying NOT NULL,
  admin_notif_message text NOT NULL,
  admin_notif_action_url character varying,
  admin_notif_action_label character varying,
  admin_notif_source_type character varying,
  admin_notif_source_id integer,
  admin_notif_source_label character varying,
  admin_notif_actor_id integer,
  admin_notif_actor_role character varying,
  admin_notif_is_read boolean NOT NULL DEFAULT false,
  admin_notif_is_archived boolean NOT NULL DEFAULT false,
  admin_notif_created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_notif_read_at timestamp with time zone,
  admin_id integer NOT NULL,
  mall_id integer,
  CONSTRAINT admin_notification_pkey PRIMARY KEY (admin_notif_id),
  CONSTRAINT admin_notification_admin_notif_actor_id_fkey FOREIGN KEY (admin_notif_actor_id) REFERENCES public.admin(admin_id),
  CONSTRAINT admin_notification_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(admin_id),
  CONSTRAINT admin_notification_mall_id_fkey FOREIGN KEY (mall_id) REFERENCES public.mall(mall_id)
);
CREATE TABLE public.thread_message_attachment (
  thread_message_attachment_id integer NOT NULL DEFAULT nextval('thread_message_attachment_thread_message_attachment_id_seq'::regclass),
  thread_message_id integer NOT NULL,
  thread_message_attachment_type character varying NOT NULL DEFAULT 'image'::character varying CHECK (thread_message_attachment_type::text = 'image'::text),
  thread_message_attachment_storage_path text NOT NULL,
  thread_message_attachment_file_name character varying NOT NULL,
  thread_message_attachment_mime_type character varying NOT NULL CHECK (thread_message_attachment_mime_type::text = ANY (ARRAY['image/png'::character varying, 'image/jpeg'::character varying, 'image/webp'::character varying]::text[])),
  thread_message_attachment_file_size bigint NOT NULL CHECK (thread_message_attachment_file_size > 0 AND thread_message_attachment_file_size <= 5242880),
  thread_message_attachment_created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT thread_message_attachment_pkey PRIMARY KEY (thread_message_attachment_id),
  CONSTRAINT thread_message_attachment_thread_message_id_fkey FOREIGN KEY (thread_message_id) REFERENCES public.thread_message(message_id)
);
CREATE TABLE public.agreement_versions (
  version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'::text),
  is_current boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agreement_versions_pkey PRIMARY KEY (version)
);
CREATE TABLE public.inquiry_inbox_cursor (
  mailbox text NOT NULL,
  uid_validity text NOT NULL,
  last_uid bigint NOT NULL CHECK (last_uid >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_inbox_cursor_pkey PRIMARY KEY (mailbox)
);
CREATE TABLE public.inquiry_note (
  id bigint NOT NULL DEFAULT nextval('inquiry_note_id_seq'::regclass),
  inquiry_id bigint NOT NULL,
  actor_id bigint NOT NULL,
  body text NOT NULL CHECK (length(body) >= 1 AND length(body) <= 4000),
  request_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_note_pkey PRIMARY KEY (id),
  CONSTRAINT inquiry_note_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id),
  CONSTRAINT inquiry_note_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.inquiry_read_receipt (
  inquiry_id bigint NOT NULL,
  actor_id bigint NOT NULL,
  last_message_id bigint NOT NULL DEFAULT 0,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_read_receipt_pkey PRIMARY KEY (inquiry_id, actor_id),
  CONSTRAINT inquiry_read_receipt_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id),
  CONSTRAINT inquiry_read_receipt_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.inquiry_activity (
  id bigint NOT NULL DEFAULT nextval('inquiry_activity_id_seq'::regclass),
  inquiry_id bigint NOT NULL,
  actor_id bigint,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_activity_pkey PRIMARY KEY (id),
  CONSTRAINT inquiry_activity_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id),
  CONSTRAINT inquiry_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin(admin_id)
);
CREATE TABLE public.inquiry_correction (
  id bigint NOT NULL DEFAULT nextval('inquiry_correction_id_seq'::regclass),
  inquiry_id bigint NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'::text),
  message_id bigint NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  before_data jsonb NOT NULL,
  after_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_correction_pkey PRIMARY KEY (id),
  CONSTRAINT inquiry_correction_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiry(inquiry_id),
  CONSTRAINT inquiry_correction_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.inquiry_message(i_message_id)
);
CREATE TABLE public.admin_account_email_attempt (
  admin_id bigint NOT NULL,
  attempted_at timestamp with time zone NOT NULL,
  CONSTRAINT admin_account_email_attempt_pkey PRIMARY KEY (admin_id),
  CONSTRAINT admin_account_email_attempt_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(admin_id)
);