-- Apply after 23. No customer fixtures or automatic emails are created.
BEGIN;
ALTER TABLE public.inquiry ADD COLUMN inquiry_original_description text, ADD COLUMN inquiry_has_revision boolean NOT NULL DEFAULT false;
CREATE TABLE public.inquiry_note (
 id bigserial PRIMARY KEY,inquiry_id bigint NOT NULL REFERENCES public.inquiry(inquiry_id),
 actor_id bigint NOT NULL REFERENCES public.admin(admin_id),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 request_id uuid NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inquiry_read_receipt (
 inquiry_id bigint REFERENCES public.inquiry(inquiry_id),actor_id bigint REFERENCES public.admin(admin_id),
 last_message_id bigint NOT NULL DEFAULT 0,read_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(inquiry_id,actor_id)
);
CREATE TABLE public.inquiry_activity (
 id bigserial PRIMARY KEY,inquiry_id bigint NOT NULL REFERENCES public.inquiry(inquiry_id),
 actor_id bigint REFERENCES public.admin(admin_id),action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inquiry_correction (
 id bigserial PRIMARY KEY,inquiry_id bigint NOT NULL REFERENCES public.inquiry(inquiry_id),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 message_id bigint NOT NULL REFERENCES public.inquiry_message(i_message_id),
 expires_at timestamptz NOT NULL,used_at timestamptz,revoked_at timestamptz,
 before_data jsonb NOT NULL,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.inquiry_activity(inquiry_id,created_at DESC);
CREATE INDEX ON public.inquiry_note(inquiry_id,created_at DESC);
CREATE INDEX ON public.inquiry_message(inquiry_id,i_message_id DESC);
ALTER TABLE public.inquiry_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_read_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_correction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_note,public.inquiry_read_receipt,public.inquiry_activity,public.inquiry_correction FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.inquiry_note,public.inquiry_read_receipt,public.inquiry_activity,public.inquiry_correction TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.inquiry_note_id_seq,public.inquiry_activity_id_seq,public.inquiry_correction_id_seq TO service_role;

CREATE FUNCTION public.inquiry_editable(i public.inquiry) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('mallName',i.inquiry_mall_name,'contactPerson',i.inquiry_contact_person,'phone',i.inquiry_contact_num,
 'province',i.inquiry_mall_state,'city',i.inquiry_mall_city,'address',i.inquiry_mall_address,'zipCode',i.inquiry_mall_zip_code,
 'floors',i.inquiry_mall_floor_count,'description',i.inquiry_mall_description,'coverageArea',i.inquiry_coverage_area);
$$;

CREATE FUNCTION public.inquiry_followup(p_id bigint,p_actor bigint,p_action text,p_data jsonb,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.inquiry%ROWTYPE; a public.admin%ROWTYPE; m public.inquiry_message%ROWTYPE; n public.inquiry_note%ROWTYPE;
 body text; kind text; owner_id bigint; latest bigint;
BEGIN
 SELECT * INTO a FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.inquiry WHERE inquiry_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found.' USING ERRCODE='P0002'; END IF;
 IF p_action='read' THEN
  SELECT COALESCE(max(i_message_id),0) INTO latest FROM public.inquiry_message WHERE inquiry_id=p_id AND i_message_id<=COALESCE((p_data->>'messageId')::bigint,0);
  INSERT INTO public.inquiry_read_receipt(inquiry_id,actor_id,last_message_id) VALUES(p_id,p_actor,latest)
  ON CONFLICT(inquiry_id,actor_id) DO UPDATE SET last_message_id=GREATEST(public.inquiry_read_receipt.last_message_id,excluded.last_message_id),read_at=now();
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Request reference required.'; END IF;
 IF p_action='note' THEN
  body:=trim(p_data->>'text');
  IF COALESCE(length(body),0) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Enter an internal note up to 4000 characters.'; END IF;
  SELECT * INTO n FROM public.inquiry_note WHERE request_id=p_request;
  IF FOUND THEN
   IF n.inquiry_id<>p_id OR n.actor_id<>p_actor OR n.body<>body THEN RAISE EXCEPTION 'Request reference already used.' USING ERRCODE='40001'; END IF;
   RETURN jsonb_build_object('ok',true,'replayed',true);
  END IF;
  INSERT INTO public.inquiry_note(inquiry_id,actor_id,body,request_id) VALUES(p_id,p_actor,body,p_request);
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action NOT IN ('reissue','corrections') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid follow-up action.'; END IF;
 kind:=CASE WHEN p_action='reissue' THEN 'convert' ELSE 'correction' END;
 body:=CASE WHEN p_action='reissue' THEN 'A new owner account setup link has been requested. Use the new link to complete your account setup.'
 ELSE 'Please update your inquiry information: '||trim(p_data->>'reason') END;
 SELECT * INTO m FROM public.inquiry_message WHERE i_message_request_id=p_request;
 IF FOUND THEN
  IF m.inquiry_id<>p_id OR m.i_message_admin_id<>p_actor OR m.i_message_kind<>kind OR m.i_message_message<>body THEN RAISE EXCEPTION 'Request reference already used.' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('message_id',m.i_message_id,'replayed',true);
 END IF;
 IF i.inquiry_updated_at IS DISTINCT FROM (p_data->>'updatedAt')::timestamptz THEN RAISE EXCEPTION 'Inquiry changed. Reload before continuing.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.inquiry_message WHERE inquiry_id=p_id AND i_message_kind=kind AND i_message_sent_at>now()-interval '10 minutes') THEN
  RAISE EXCEPTION 'Wait 10 minutes before issuing another link.' USING ERRCODE='40001';
 END IF;
 IF p_action='reissue' THEN
  IF i.mall_id IS NULL OR lower(i.inquiry_status) NOT IN ('approved','converted') THEN RAISE EXCEPTION 'Approve the inquiry first.'; END IF;
  SELECT a2.admin_id INTO owner_id FROM public.admin a2 JOIN public.mall_admin_account ma USING(admin_id)
   WHERE a2.mall_id=i.mall_id AND lower(a2.admin_email)=lower(i.inquiry_contact_email) AND a2.admin_is_primary
    AND NOT a2.admin_is_deactivated AND a2.admin_account_status='partial' AND ma.setup_completed_at IS NULL;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'The owner has completed setup or is not eligible for another setup invitation.'; END IF;
  IF EXISTS(SELECT 1 FROM public.inquiry_message WHERE inquiry_id=p_id AND i_message_kind='convert' AND i_message_delivery_status IN ('pending','sending','unconfirmed'))
   AND (p_data->>'acknowledgeUncertain') IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Check the sending mailbox and acknowledge the earlier uncertain delivery before issuing a new link.';
  END IF;
 ELSE
  IF i.mall_id IS NOT NULL OR lower(i.inquiry_status) IN ('approved','converted','rejected') THEN RAISE EXCEPTION 'A finalized inquiry cannot be edited.'; END IF;
  IF COALESCE(length(trim(p_data->>'reason')),0) NOT BETWEEN 1 AND 3000 OR COALESCE(p_data->>'tokenHash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid correction request.'; END IF;
 END IF;
 INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,i_message_is_read,
 inquiry_id,i_message_request_id,i_message_admin_id,i_message_kind,i_message_delivery_status)
 VALUES('admin',a.admin_email,body,now(),true,p_id,p_request,p_actor,kind,'pending') RETURNING * INTO m;
 IF p_action='corrections' THEN
  UPDATE public.inquiry_correction SET revoked_at=now() WHERE inquiry_id=p_id AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.inquiry_correction(inquiry_id,token_hash,message_id,expires_at,before_data)
  VALUES(p_id,p_data->>'tokenHash',m.i_message_id,now()+interval '72 hours',public.inquiry_editable(i));
  UPDATE public.inquiry SET inquiry_status='In Progress',inquiry_updated_at=now() WHERE inquiry_id=p_id;
 END IF;
 INSERT INTO public.inquiry_activity(inquiry_id,actor_id,action,details) VALUES(p_id,p_actor,p_action,jsonb_build_object('messageId',m.i_message_id));
 RETURN jsonb_build_object('message_id',m.i_message_id,'replayed',false);
END; $$;

CREATE FUNCTION public.submit_inquiry_correction(p_hash text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.inquiry_correction%ROWTYPE; i public.inquiry%ROWTYPE; k text;
BEGIN
 -- Lock inquiry first, matching reviewer operations, then recheck the token.
 SELECT * INTO c FROM public.inquiry_correction WHERE token_hash=p_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'This correction link is invalid or expired.'; END IF;
 SELECT * INTO i FROM public.inquiry WHERE inquiry_id=c.inquiry_id FOR UPDATE;
 SELECT * INTO c FROM public.inquiry_correction WHERE token_hash=p_hash FOR UPDATE;
 IF c.used_at IS NOT NULL OR c.revoked_at IS NOT NULL OR c.expires_at<=now() OR i.mall_id IS NOT NULL OR lower(i.inquiry_status) IN ('approved','converted','rejected') THEN RAISE EXCEPTION 'This correction link is no longer available.'; END IF;
 IF public.inquiry_editable(i) IS DISTINCT FROM c.before_data THEN RAISE EXCEPTION 'Inquiry details changed. Request a fresh correction link.' USING ERRCODE='40001'; END IF;
 IF p_data IS NULL THEN
  RETURN jsonb_build_object('fields',c.before_data,'email',i.inquiry_contact_email,'expiresAt',c.expires_at,
   'instructions',(SELECT i_message_message FROM public.inquiry_message WHERE i_message_id=c.message_id));
 END IF;
 FOREACH k IN ARRAY ARRAY['mallName','contactPerson','phone','province','city','address'] LOOP
  IF jsonb_typeof(p_data->k) IS DISTINCT FROM 'string' OR length(trim(p_data->>k)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Complete required inquiry fields.'; END IF;
 END LOOP;
 IF COALESCE(p_data->>'floors','') !~ '^[0-9]{1,3}$' OR (p_data->>'floors')::int NOT BETWEEN 1 AND 300
 OR length(COALESCE(p_data->>'description',''))>3000 OR length(COALESCE(p_data->>'coverageArea',''))>150 OR length(COALESCE(p_data->>'zipCode',''))>10 THEN RAISE EXCEPTION 'Invalid inquiry details.'; END IF;
 UPDATE public.inquiry SET inquiry_original_description=CASE WHEN inquiry_has_revision THEN inquiry_original_description ELSE inquiry_mall_description END,inquiry_has_revision=true,
 inquiry_mall_name=trim(p_data->>'mallName'),inquiry_contact_person=trim(p_data->>'contactPerson'),
 inquiry_contact_num=trim(p_data->>'phone'),inquiry_mall_state=trim(p_data->>'province'),inquiry_mall_city=trim(p_data->>'city'),
 inquiry_mall_address=trim(p_data->>'address'),inquiry_mall_zip_code=NULLIF(trim(p_data->>'zipCode'),''),inquiry_mall_floor_count=(p_data->>'floors')::int,
 inquiry_mall_description=NULLIF(trim(p_data->>'description'),''),inquiry_coverage_area=NULLIF(trim(p_data->>'coverageArea'),''),
 inquiry_status='In Progress',inquiry_updated_at=now() WHERE inquiry_id=i.inquiry_id RETURNING * INTO i;
 UPDATE public.inquiry_correction SET used_at=now(),after_data=public.inquiry_editable(i) WHERE id=c.id;
 INSERT INTO public.inquiry_activity(inquiry_id,action,details) VALUES(i.inquiry_id,'Owner corrected inquiry',jsonb_build_object('revisionId',c.id));
 INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,i_message_is_read,inquiry_id,i_message_kind,i_message_delivery_status)
 VALUES('mall',i.inquiry_contact_email,'I have updated my inquiry information for review.',now(),false,i.inquiry_id,'incoming','received');
 RETURN jsonb_build_object('ok',true);
END; $$;

-- Review history is written in the same transaction as approval/rejection.
CREATE FUNCTION public.record_inquiry_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.inquiry_status IS DISTINCT FROM OLD.inquiry_status AND lower(NEW.inquiry_status) IN ('approved','converted','rejected') THEN
  INSERT INTO public.inquiry_activity(inquiry_id,actor_id,action,details) VALUES(NEW.inquiry_id,NEW.inquiry_reviewed_by,NEW.inquiry_status,
   jsonb_build_object('reason',NEW.inquiry_rejection_reason,'previousStatus',OLD.inquiry_status));
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER inquiry_decision_history AFTER UPDATE ON public.inquiry FOR EACH ROW EXECUTE FUNCTION public.record_inquiry_decision();
REVOKE ALL ON FUNCTION public.inquiry_editable(public.inquiry),public.inquiry_followup(bigint,bigint,text,jsonb,uuid),public.submit_inquiry_correction(text,jsonb),public.record_inquiry_decision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inquiry_editable(public.inquiry),public.inquiry_followup(bigint,bigint,text,jsonb,uuid),public.submit_inquiry_correction(text,jsonb) TO service_role;
CREATE INDEX IF NOT EXISTS inquiry_contact_email_match ON public.inquiry(lower(trim(inquiry_contact_email)));
CREATE INDEX IF NOT EXISTS inquiry_mall_name_match ON public.inquiry(lower(trim(inquiry_mall_name)));
CREATE FUNCTION public.inquiry_followup_summary(p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.inquiry_id,
 'unread', (SELECT count(*) FROM public.inquiry_message m WHERE m.inquiry_id=i.inquiry_id AND m.i_message_sender_type='mall' AND m.i_message_id>COALESCE(r.last_message_id,0)) + CASE WHEN r.inquiry_id IS NULL THEN 1 ELSE 0 END,
 'waitingSince',CASE WHEN i.mall_id IS NULL AND lower(i.inquiry_status) NOT IN ('approved','converted','rejected') AND COALESCE(l.sender,'mall')='mall' THEN COALESCE(l.sent_at,i.inquiry_created_at) END,
 'progress',CASE WHEN i.mall_id IS NULL THEN NULL WHEN o.completed_at IS NOT NULL THEN 'Onboarding completed'
 WHEN o.profile_completed_at IS NOT NULL OR o.agreement_acceptance IS NOT NULL THEN 'Onboarding underway'
 WHEN ma.setup_completed_at IS NOT NULL THEN 'Account setup completed' ELSE 'Invitation pending' END,
 'canReissue',i.mall_id IS NOT NULL AND ma.setup_completed_at IS NULL AND a.admin_account_status='partial' AND NOT a.admin_is_deactivated,
 'duplicates',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.inquiry_id,'mallName',d.inquiry_mall_name,'status',d.inquiry_status,
 'reason',CASE WHEN lower(trim(d.inquiry_contact_email))=lower(trim(i.inquiry_contact_email)) THEN 'Same contact email' ELSE 'Same mall name' END))
 FROM public.inquiry d WHERE d.inquiry_id<>i.inquiry_id AND (lower(trim(d.inquiry_contact_email))=lower(trim(i.inquiry_contact_email)) OR lower(trim(d.inquiry_mall_name))=lower(trim(i.inquiry_mall_name)))),'[]'::jsonb)
 )),'[]'::jsonb) INTO result FROM public.inquiry i
 LEFT JOIN public.inquiry_read_receipt r ON r.inquiry_id=i.inquiry_id AND r.actor_id=p_actor
 LEFT JOIN LATERAL (SELECT i_message_sender_type sender,i_message_sent_at sent_at FROM public.inquiry_message WHERE inquiry_id=i.inquiry_id ORDER BY i_message_id DESC LIMIT 1) l ON true
 LEFT JOIN public.admin a ON a.mall_id=i.mall_id AND a.admin_is_primary AND a.admin_role='mall_admin' AND lower(a.admin_email)=lower(i.inquiry_contact_email)
 LEFT JOIN public.mall_admin_account ma ON ma.admin_id=a.admin_id
 LEFT JOIN public.mall_onboarding o ON o.mall_id=i.mall_id;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.inquiry_followup_summary(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inquiry_followup_summary(bigint) TO service_role;

ALTER FUNCTION public.review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) RENAME TO review_super_admin_inquiry_before_followup;
REVOKE ALL ON FUNCTION public.review_super_admin_inquiry_before_followup(bigint,bigint,text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.review_super_admin_inquiry(p_id bigint,p_actor bigint,p_action text,p_data jsonb,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.inquiry%ROWTYPE; result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated) THEN RAISE EXCEPTION 'Active Super Admin access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.inquiry WHERE inquiry_id=p_id FOR UPDATE;
 IF p_action='approve' AND NOT EXISTS(SELECT 1 FROM public.inquiry_message WHERE i_message_request_id=p_request)
 AND EXISTS(SELECT 1 FROM public.inquiry d WHERE d.inquiry_id<>p_id AND
 (lower(trim(d.inquiry_contact_email))=lower(trim(i.inquiry_contact_email)) OR lower(trim(d.inquiry_mall_name))=lower(trim(i.inquiry_mall_name))))
 AND (p_data->>'acknowledgeDuplicates') IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'Possible duplicate inquiry. Review matching inquiries and acknowledge them before approving.' USING ERRCODE='40001';
 END IF;
 result:=public.review_super_admin_inquiry_before_followup(p_id,p_actor,p_action,p_data,p_request);
 IF p_action='approve' AND (p_data->>'acknowledgeDuplicates')='true' AND NOT COALESCE((result->>'replayed')::boolean,false) THEN
  INSERT INTO public.inquiry_activity(inquiry_id,actor_id,action) VALUES(p_id,p_actor,'Duplicate matches reviewed');
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) TO service_role;
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
 AND m.i_message_kind IN ('reply','convert','correction');
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

NOTIFY pgrst,'reload schema';
COMMIT;
