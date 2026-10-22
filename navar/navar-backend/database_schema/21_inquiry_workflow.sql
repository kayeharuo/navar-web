-- Inquiry-only persistence. Requires existing owner-onboarding migrations 22 and 25
-- from Mall Admin in the SAME Supabase project. Does not seed customer data.
BEGIN;
ALTER TABLE public.inquiry_message
 ADD COLUMN IF NOT EXISTS i_message_request_id uuid,
 ADD COLUMN IF NOT EXISTS i_message_admin_id bigint REFERENCES public.admin(admin_id),
 ADD COLUMN IF NOT EXISTS i_message_kind text NOT NULL DEFAULT 'reply',
 ADD COLUMN IF NOT EXISTS i_message_delivery_status text NOT NULL DEFAULT 'not_recorded',
 ADD COLUMN IF NOT EXISTS i_message_delivered_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS inquiry_message_request_unique ON public.inquiry_message(i_message_request_id);
CREATE INDEX IF NOT EXISTS inquiry_message_thread_order ON public.inquiry_message(inquiry_id,i_message_sent_at,i_message_id);
CREATE INDEX IF NOT EXISTS inquiry_created_order ON public.inquiry(inquiry_created_at DESC,inquiry_id DESC);
-- These tables are accessed through authenticated Super Admin endpoints only.
ALTER TABLE public.inquiry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_message ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry,public.inquiry_message FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.inquiry,public.inquiry_message TO service_role;

CREATE OR REPLACE FUNCTION public.manage_super_admin_inquiry(
 p_id bigint,p_actor bigint,p_action text,p_data jsonb,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin%ROWTYPE; i public.inquiry%ROWTYPE; msg public.inquiry_message%ROWTYPE;
 result jsonb; m bigint; f jsonb; h jsonb; d text; tier bigint;
BEGIN
 SELECT * INTO a FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin'
 AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active Super Admin access is required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.inquiry WHERE inquiry_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found.' USING ERRCODE='P0002'; END IF;
 IF p_action IN ('reply','convert') THEN
  IF p_request IS NULL THEN RAISE EXCEPTION 'A request reference is required.'; END IF;
  SELECT * INTO msg FROM public.inquiry_message WHERE i_message_request_id=p_request;
  IF FOUND THEN
   IF msg.inquiry_id<>p_id OR msg.i_message_admin_id<>p_actor OR msg.i_message_kind<>p_action
      OR (p_action='reply' AND msg.i_message_message<>trim(p_data->>'text')) THEN
    RAISE EXCEPTION 'Request reference already used.' USING ERRCODE='40001';
   END IF;
   RETURN jsonb_build_object('message_id',msg.i_message_id,'mall_id',i.mall_id,'replayed',true);
  END IF;
 END IF;
 IF p_action='status' THEN
  IF i.mall_id IS NOT NULL OR lower(i.inquiry_status) IN ('approved','converted','rejected') THEN
   RAISE EXCEPTION 'A finalized inquiry cannot be moved back to review.' USING ERRCODE='40001';
  END IF;
  IF p_data->>'status' NOT IN ('New','In Progress') OR p_data->>'status' IS NULL THEN RAISE EXCEPTION 'Invalid inquiry status.'; END IF;
  IF i.inquiry_updated_at IS DISTINCT FROM (p_data->>'updatedAt')::timestamptz THEN
   RAISE EXCEPTION 'Inquiry changed. Reload before updating.' USING ERRCODE='40001';
  END IF;
  UPDATE public.inquiry SET inquiry_status=p_data->>'status',inquiry_updated_at=now() WHERE inquiry_id=p_id;
  RETURN jsonb_build_object('id',p_id);
 ELSIF p_action='reply' THEN
  IF COALESCE(length(trim(p_data->>'text')),0) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Reply must contain 1 to 4000 characters.'; END IF;
  INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,
   i_message_is_read,inquiry_id,i_message_request_id,i_message_admin_id,i_message_kind,i_message_delivery_status)
  VALUES('admin',a.admin_email,trim(p_data->>'text'),now(),true,p_id,p_request,p_actor,'reply','pending') RETURNING * INTO msg;
  UPDATE public.inquiry SET inquiry_status=CASE WHEN lower(inquiry_status)='new' THEN 'In Progress' ELSE inquiry_status END,
   inquiry_updated_at=now() WHERE inquiry_id=p_id;
 ELSIF p_action='convert' THEN
  IF i.mall_id IS NOT NULL THEN RAISE EXCEPTION 'Inquiry already converted. Reload the list.' USING ERRCODE='40001'; END IF;
  IF i.inquiry_updated_at IS DISTINCT FROM (p_data->>'updatedAt')::timestamptz THEN
   RAISE EXCEPTION 'Inquiry changed. Reload before converting.' USING ERRCODE='40001';
  END IF;
  IF NULLIF(i.inquiry_interested_tier,'') IS NOT NULL THEN
   SELECT s_tier_id INTO tier FROM public.subscription_tier WHERE s_tier_key=i.inquiry_interested_tier;
   IF NOT FOUND THEN RAISE EXCEPTION 'The requested subscription tier no longer exists.'; END IF;
  END IF;
  result:=public.provision_inquiry_mall(p_id,p_actor,(p_data->>'authUserId')::uuid,tier,p_data->'offer');
  m:=(result->>'mall_id')::bigint;
  -- Persist all existing conversion-modal fields together with onboarding, or roll back all of them.
  UPDATE public.mall SET mall_name=p_data->>'name',mall_state=p_data->>'province',mall_city=p_data->>'city',
   mall_zipcode=NULLIF(p_data->>'zipCode',''),mall_address=p_data->>'address',
   mall_latitude=(p_data->>'latitude')::double precision,mall_longitude=(p_data->>'longitude')::double precision,
   mall_floor_count=(p_data->>'floors')::integer,mall_description=NULLIF(p_data->>'description',''),
   mall_coverage_area=NULLIF(p_data->>'mallCoverageArea',''),mall_beacon_major=(p_data->>'majorBeacons')::integer,
   mall_logo=CASE WHEN NULLIF(p_data->>'logoBase64','') IS NULL THEN i.inquiry_mall_logo ELSE decode(p_data->>'logoBase64','base64') END,
   mall_updated_at=now() WHERE mall_id=m;
  FOR f IN SELECT value FROM jsonb_array_elements(p_data->'floorDetails') LOOP
   INSERT INTO public.floor(floor_num,floor_label,floor_created_at,floor_updated_at,mall_id)
   VALUES((f->>'floorNo')::integer,f->>'label',now(),now(),m);
  END LOOP;
  FOR h IN SELECT value FROM jsonb_array_elements(p_data->'operatingHours') LOOP
   FOR d IN SELECT jsonb_array_elements_text(h->'days') LOOP
    INSERT INTO public.operating_hours(opthrs_day_of_week,opthrs_open_time,opthrs_close_time,opthrs_is_closed,
     opthrs_is_mall,opthrs_is_store,opthrs_is_inquiry,inquiry_id,mall_id)
    VALUES(d,(h->>'open')::time,(h->>'close')::time,false,true,false,false,NULL,m);
   END LOOP;
  END LOOP;
  INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,
   i_message_is_read,inquiry_id,i_message_request_id,i_message_admin_id,i_message_kind,i_message_delivery_status)
  VALUES('admin',a.admin_email,'Your inquiry has been approved. Complete your account setup, review your subscription tier and agreement, then proceed with payment.',
   now(),true,p_id,p_request,p_actor,'convert','pending') RETURNING * INTO msg;
 ELSE RAISE EXCEPTION 'Unsupported inquiry action.';
 END IF;
 RETURN jsonb_build_object('message_id',msg.i_message_id,'mall_id',m,'replayed',false);
END; $$;
REVOKE ALL ON FUNCTION public.manage_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
