INSERT INTO public.admin (
    admin_role, admin_email, admin_full_name, admin_contact_num, admin_job_title,
    admin_is_primary, admin_is_deactivated, admin_deactivated_on, admin_last_login,
    admin_created_at, admin_updated_at, mall_id, store_id, admin_account_status,
    admin_auth_user_id
) VALUES (
    'super_admin', 'tesgeonzon15@gmail.com', 'Princess Kaye S. Geonzon', NULL, 'System Administrator',
    FALSE, FALSE, NULL, NULL,
    NOW(), NOW(), NULL, NULL, 'official',
    '335a6319-d808-4cd7-a439-49f75883c84e'
);