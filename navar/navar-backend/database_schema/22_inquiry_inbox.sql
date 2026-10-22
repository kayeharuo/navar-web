-- Apply after 21_inquiry_workflow.sql in the same Supabase database.
BEGIN;
ALTER TABLE public.inquiry_message ADD COLUMN IF NOT EXISTS i_message_email_id text;
CREATE UNIQUE INDEX IF NOT EXISTS inquiry_inbound_email_unique
 ON public.inquiry_message(i_message_email_id) WHERE i_message_email_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inquiry_inbox_cursor (
 mailbox text PRIMARY KEY,
 uid_validity text NOT NULL,
 last_uid bigint NOT NULL CHECK(last_uid>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inquiry_inbox_cursor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_inbox_cursor FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.inquiry_inbox_cursor TO service_role;

-- Service-only: the IMAP worker verifies Gmail authentication headers first.
-- Sender ownership and thread matching are rechecked here in the transaction.
CREATE OR REPLACE FUNCTION public.import_inquiry_email(
 p_request uuid,p_email_id text,p_sender text,p_body text,p_received_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target bigint; owner_email text; inserted_id bigint;
BEGIN
 IF p_email_id IS NULL OR length(p_email_id) NOT BETWEEN 3 AND 998
 OR p_body IS NULL OR length(trim(p_body)) NOT BETWEEN 1 AND 20000
 OR p_received_at IS NULL THEN RAISE EXCEPTION 'Invalid incoming inquiry message.'; END IF;
 SELECT m.inquiry_id,i.inquiry_contact_email INTO target,owner_email
 FROM public.inquiry_message m JOIN public.inquiry i ON i.inquiry_id=m.inquiry_id
 WHERE m.i_message_request_id=p_request AND m.i_message_sender_type IN ('admin','super_admin')
 AND m.i_message_kind IN ('reply','convert');
 IF NOT FOUND OR lower(trim(owner_email)) IS DISTINCT FROM lower(trim(p_sender)) THEN
  RETURN jsonb_build_object('imported',false,'reason','unmatched_sender_or_thread');
 END IF;
 INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,
  i_message_sent_at,i_message_is_read,inquiry_id,i_message_kind,i_message_delivery_status,i_message_email_id)
 VALUES('mall',lower(trim(p_sender)),trim(p_body),p_received_at,false,target,'incoming','received',p_email_id)
 ON CONFLICT(i_message_email_id) WHERE i_message_email_id IS NOT NULL DO NOTHING
 RETURNING i_message_id INTO inserted_id;
 IF inserted_id IS NOT NULL THEN
  UPDATE public.inquiry SET inquiry_updated_at=now() WHERE inquiry_id=target;
 END IF;
 RETURN jsonb_build_object('imported',inserted_id IS NOT NULL,'inquiry_id',target,'message_id',inserted_id);
END; $$;
REVOKE ALL ON FUNCTION public.import_inquiry_email(uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_inquiry_email(uuid,text,text,text,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
