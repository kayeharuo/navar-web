-- Notifications for internal mall and super admins.
-- NOTIFICATION.NOTIF_RECIPIENT intentionally remains linked to APP_USER.

CREATE TABLE IF NOT EXISTS public.admin_notification (
    admin_notif_id SERIAL PRIMARY KEY,
    admin_notif_type VARCHAR(30) NOT NULL,
    admin_notif_title VARCHAR(100) NOT NULL,
    admin_notif_message TEXT NOT NULL,
    admin_notif_action_url VARCHAR(255),
    admin_notif_action_label VARCHAR(50),
    admin_notif_source_type VARCHAR(40),
    admin_notif_source_id INTEGER,
    admin_notif_source_label VARCHAR(255),
    admin_notif_actor_id INTEGER REFERENCES public.admin(admin_id),
    admin_notif_actor_role VARCHAR(30),
    admin_notif_is_read BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notif_is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notif_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_notif_read_at TIMESTAMPTZ,
    admin_id INTEGER NOT NULL REFERENCES public.admin(admin_id),
    mall_id INTEGER REFERENCES public.mall(mall_id)
);

ALTER TABLE public.admin_notification
    ADD COLUMN IF NOT EXISTS admin_notif_source_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS admin_notif_source_id INTEGER,
    ADD COLUMN IF NOT EXISTS admin_notif_source_label VARCHAR(255),
    ADD COLUMN IF NOT EXISTS admin_notif_actor_id INTEGER REFERENCES public.admin(admin_id),
    ADD COLUMN IF NOT EXISTS admin_notif_actor_role VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_admin_notification_recipient
    ON public.admin_notification (admin_id, admin_notif_is_read, admin_notif_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_source
    ON public.admin_notification (admin_notif_source_type, admin_notif_source_id);

ALTER TABLE public.admin_notification ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.admin_notification TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_notification_admin_notif_id_seq TO service_role;

DROP POLICY IF EXISTS admin_notification_insert_service ON public.admin_notification;
CREATE POLICY admin_notification_insert_service
    ON public.admin_notification
    FOR INSERT
    TO service_role
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS admin_notification_select_own ON public.admin_notification;
CREATE POLICY admin_notification_select_own
    ON public.admin_notification
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin a
            WHERE a.admin_id = admin_notification.admin_id
              AND a.admin_auth_user_id = (SELECT auth.uid())
              AND a.admin_is_deactivated = FALSE
        )
    );

DROP POLICY IF EXISTS admin_notification_update_own ON public.admin_notification;
CREATE POLICY admin_notification_update_own
    ON public.admin_notification
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin a
            WHERE a.admin_id = admin_notification.admin_id
              AND a.admin_auth_user_id = (SELECT auth.uid())
              AND a.admin_is_deactivated = FALSE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.admin a
            WHERE a.admin_id = admin_notification.admin_id
              AND a.admin_auth_user_id = (SELECT auth.uid())
              AND a.admin_is_deactivated = FALSE
        )
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'admin_notification'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notification;
    END IF;
END
$$;
