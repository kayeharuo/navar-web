BEGIN;
CREATE TABLE public.thread_admin_read (
 admin_id bigint NOT NULL REFERENCES public.admin(admin_id) ON DELETE CASCADE,
 thread_id bigint NOT NULL REFERENCES public.thread(thread_id) ON DELETE CASCADE,
 last_message_id bigint NOT NULL,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(admin_id,thread_id)
);
ALTER TABLE public.thread_admin_read ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.thread_admin_read FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.thread_admin_read TO service_role;
CREATE INDEX thread_admin_read_thread ON public.thread_admin_read(thread_id);
CREATE FUNCTION public.mark_admin_thread_read(p_admin bigint,p_thread bigint,p_message bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_admin AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN
  RAISE EXCEPTION 'Active Super Admin required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.thread_message WHERE message_id=p_message AND thread_id=p_thread) THEN
  RAISE EXCEPTION 'Message does not belong to this conversation' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.thread_admin_read(admin_id,thread_id,last_message_id) VALUES(p_admin,p_thread,p_message)
 ON CONFLICT(admin_id,thread_id) DO UPDATE SET last_message_id=GREATEST(public.thread_admin_read.last_message_id,EXCLUDED.last_message_id),read_at=now();
END $$;
REVOKE ALL ON FUNCTION public.mark_admin_thread_read(bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_admin_thread_read(bigint,bigint,bigint) TO service_role;
-- Realtime honors SELECT policies; publication membership alone is insufficient.
GRANT SELECT ON public.thread_message TO authenticated;
CREATE POLICY super_admin_realtime_thread_messages ON public.thread_message FOR SELECT TO authenticated
 USING((SELECT app_private.is_super_admin()));
NOTIFY pgrst,'reload schema';
COMMIT;
