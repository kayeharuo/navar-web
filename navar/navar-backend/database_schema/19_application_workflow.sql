-- Application workflow support.
--
-- This migration does not create a new notification or thread table.
-- Internal notifications continue to use public.admin_notification.
-- Floor-plan files are stored privately in Supabase Storage; these columns
-- store file metadata and the private storage path only.

ALTER TABLE public.application_floor_plan
    ADD COLUMN IF NOT EXISTS app_floor_plan_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS app_floor_plan_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS app_floor_plan_mime_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS app_floor_plan_file_size BIGINT;

CREATE TABLE IF NOT EXISTS public.thread_message_attachment (
    thread_message_attachment_id SERIAL PRIMARY KEY,
    thread_message_id INTEGER NOT NULL REFERENCES public.thread_message(message_id) ON DELETE CASCADE,
    thread_message_attachment_type VARCHAR(30) NOT NULL DEFAULT 'image',
    thread_message_attachment_storage_path TEXT NOT NULL,
    thread_message_attachment_file_name VARCHAR(255) NOT NULL,
    thread_message_attachment_mime_type VARCHAR(100) NOT NULL,
    thread_message_attachment_file_size BIGINT NOT NULL,
    thread_message_attachment_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    thread_message_attachment_uploaded_by INTEGER REFERENCES public.admin(admin_id),
    CONSTRAINT thread_message_attachment_type_check
        CHECK (thread_message_attachment_type = 'image'),
    CONSTRAINT thread_message_attachment_mime_check
        CHECK (thread_message_attachment_mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT thread_message_attachment_size_check
        CHECK (thread_message_attachment_file_size > 0
               AND thread_message_attachment_file_size <= 5242880)
);

CREATE INDEX IF NOT EXISTS idx_thread_message_attachment_message
    ON public.thread_message_attachment (thread_message_id, thread_message_attachment_created_at);

CREATE INDEX IF NOT EXISTS idx_application_mall
    ON public.application (mall_id);

CREATE INDEX IF NOT EXISTS idx_application_status_updated
    ON public.application (application_status, application_updated_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.application
        GROUP BY mall_id, application_version
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot create uq_application_mall_version: duplicate application versions exist for at least one mall';
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_application_mall_version
    ON public.application (mall_id, application_version);

CREATE INDEX IF NOT EXISTS idx_application_floor_plan_application_floor
    ON public.application_floor_plan (application_id, floor_id);

CREATE INDEX IF NOT EXISTS idx_application_floor_plan_storage_path
    ON public.application_floor_plan (app_floor_plan_storage_path)
    WHERE app_floor_plan_storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_entry_point_application_floor
    ON public.application_entry_point (application_id, floor_id);

CREATE INDEX IF NOT EXISTS idx_ar_development_application_status
    ON public.ar_development (application_id, ar_development_status);

CREATE INDEX IF NOT EXISTS idx_thread_application
    ON public.thread (application_id)
    WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_ar_development
    ON public.thread (ar_development_id)
    WHERE ar_development_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_stall_application
    ON public.thread (s_application_id)
    WHERE s_application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_created
    ON public.thread (thread_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thread_message_thread_sent
    ON public.thread_message (thread_id, message_sent_at);
