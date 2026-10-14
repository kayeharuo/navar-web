-- Keep one application version per mall until that mall has a live or
-- published AR development. Historical versions are retained after that point.
--
-- This is intentionally one PostgreSQL DO statement. Some SQL editors commit
-- each statement independently, which would remove a temporary table before
-- the later DELETE statements can use it.

DO $cleanup$
DECLARE
    application_ids INTEGER[];
BEGIN
    SELECT COALESCE(array_agg(old.application_id), ARRAY[]::INTEGER[])
    INTO application_ids
    FROM public.application old
    WHERE EXISTS (
        SELECT 1
        FROM public.application newer
        WHERE newer.mall_id = old.mall_id
          AND (
              newer.application_updated_at > old.application_updated_at
              OR (
                  newer.application_updated_at = old.application_updated_at
                  AND newer.application_id > old.application_id
              )
          )
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.ar_development live
        JOIN public.application live_app
          ON live_app.application_id = live.application_id
        WHERE live_app.mall_id = old.mall_id
          AND LOWER(live.ar_development_status) IN ('live', 'published')
    );

    -- Delete dependent records before their application rows.
    DELETE FROM public.thread_message_attachment attachment
    WHERE attachment.thread_message_id IN (
        SELECT message.message_id
        FROM public.thread_message message
        JOIN public.thread thread
          ON thread.thread_id = message.thread_id
        WHERE thread.application_id = ANY(application_ids)
    );

    DELETE FROM public.thread_message message
    WHERE message.thread_id IN (
        SELECT thread.thread_id
        FROM public.thread
        WHERE thread.application_id = ANY(application_ids)
    );

    DELETE FROM public.thread
    WHERE application_id = ANY(application_ids);

    DELETE FROM public.application_entry_point
    WHERE application_id = ANY(application_ids);

    DELETE FROM public.application_floor_plan
    WHERE application_id = ANY(application_ids);

    DELETE FROM public.ar_development
    WHERE application_id = ANY(application_ids);

    DELETE FROM public.application
    WHERE application_id = ANY(application_ids);
END
$cleanup$;
