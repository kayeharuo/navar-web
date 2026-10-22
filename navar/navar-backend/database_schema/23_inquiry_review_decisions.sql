-- Requires inquiry migrations 21/22 and existing Mall Admin owner provisioning.
-- Approval copies submitted inquiry data only. Owner completes setup afterward.
BEGIN;
CREATE OR REPLACE FUNCTION public.review_super_admin_inquiry(
 p_id bigint,p_actor bigint,p_action text,p_data jsonb,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin%ROWTYPE; i public.inquiry%ROWTYPE; msg public.inquiry_message%ROWTYPE;
 result jsonb; tier bigint; kind text; body text;
BEGIN
 SELECT * INTO a FROM public.admin WHERE admin_id=p_actor AND admin_role='super_admin'
 AND admin_account_status='official' AND NOT admin_is_deactivated;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active Super Admin access is required.' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('approve','reject') OR p_action IS NULL OR p_request IS NULL THEN
  RAISE EXCEPTION 'Invalid inquiry decision.';
 END IF;
 SELECT * INTO i FROM public.inquiry WHERE inquiry_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found.' USING ERRCODE='P0002'; END IF;
 kind:=CASE WHEN p_action='approve' THEN 'convert' ELSE 'reply' END;
 body:=CASE WHEN p_action='approve' THEN
  'Your inquiry has been approved. Use the secure setup link to create your password, review your subscription tier and terms, then proceed with payment and complete your mall information.'
  ELSE 'Your inquiry has been declined. Reason: '||trim(p_data->>'reason') END;
 IF p_action='reject' AND COALESCE(length(trim(p_data->>'reason')),0) NOT BETWEEN 1 AND 3000 THEN
  RAISE EXCEPTION 'Enter a rejection reason (up to 3000 characters).';
 END IF;
 SELECT * INTO msg FROM public.inquiry_message WHERE i_message_request_id=p_request;
 IF FOUND THEN
  IF msg.inquiry_id<>p_id OR msg.i_message_admin_id<>p_actor OR msg.i_message_kind<>kind OR msg.i_message_message<>body THEN
   RAISE EXCEPTION 'Request reference already used.' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('message_id',msg.i_message_id,'mall_id',i.mall_id,'replayed',true);
 END IF;
 IF i.mall_id IS NOT NULL OR lower(i.inquiry_status) IN ('approved','converted','rejected') THEN
  RAISE EXCEPTION 'This inquiry is already finalized.' USING ERRCODE='40001';
 END IF;
 IF i.inquiry_updated_at IS DISTINCT FROM (p_data->>'updatedAt')::timestamptz THEN
  RAISE EXCEPTION 'Inquiry changed. Reload before deciding.' USING ERRCODE='40001';
 END IF;
 IF p_action='approve' THEN
  IF NULLIF(i.inquiry_interested_tier,'') IS NOT NULL THEN
   SELECT s_tier_id INTO tier FROM public.subscription_tier WHERE s_tier_key=i.inquiry_interested_tier;
   IF NOT FOUND THEN RAISE EXCEPTION 'The requested subscription tier no longer exists.'; END IF;
  END IF;
  result:=public.provision_inquiry_mall(p_id,p_actor,(p_data->>'authUserId')::uuid,tier,p_data->'offer');
  -- Only copy facts supplied by the owner; do not manufacture floor rows,
  -- coordinates, beacon counts, logo uploads or operating schedules.
  UPDATE public.mall SET mall_address=i.inquiry_mall_address,mall_zipcode=i.inquiry_mall_zip_code,
   mall_floor_count=i.inquiry_mall_floor_count,mall_description=i.inquiry_mall_description,
   mall_logo=i.inquiry_mall_logo,mall_updated_at=now() WHERE mall_id=(result->>'mall_id')::bigint;
 ELSE
  PERFORM public.reject_mall_inquiry(p_id,p_actor,trim(p_data->>'reason'));
 END IF;
 INSERT INTO public.inquiry_message(i_message_sender_type,i_message_sender_email,i_message_message,i_message_sent_at,
  i_message_is_read,inquiry_id,i_message_request_id,i_message_admin_id,i_message_kind,i_message_delivery_status)
 VALUES('admin',a.admin_email,body,now(),true,p_id,p_request,p_actor,kind,'pending') RETURNING * INTO msg;
 RETURN jsonb_build_object('message_id',msg.i_message_id,'mall_id',result->'mall_id','replayed',false);
END; $$;
REVOKE ALL ON FUNCTION public.review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_super_admin_inquiry(bigint,bigint,text,jsonb,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
