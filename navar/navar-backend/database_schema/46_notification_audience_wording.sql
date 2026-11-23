-- Keep mall instructions in mall notifications/emails and show management actions to super admins.
CREATE OR REPLACE FUNCTION public.subscription_super_admin_message(p_kind text,p_title text,p_message text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE message text := p_message;
BEGIN
 IF p_kind='suspended' AND p_title='Subscription suspended: Operational' THEN
  RETURN 'AR is unpublished for an operational pause. Lift the operational suspension in Subscription Management when the mall is ready. The subscription clock continues.';
 ELSIF p_kind='restored' THEN
  RETURN 'The operational suspension has been lifted. The mall''s subscription dates are unchanged. Review AR publication status in AR Development.';
 END IF;
 IF p_kind='suspended' THEN
  message := replace(message,'Renew the annual subscription and settle','The mall must renew the annual subscription and settle');
 END IF;
 IF p_kind LIKE 'expiry_%' OR p_kind LIKE 'grace_%' THEN
  message := replace(message,'Your subscription','The mall''s subscription');
  message := replace(message,'Renew through your mall subscription page.','Monitor the mall''s renewal and payment in Subscription Management.');
  message := replace(message,'Renew now to avoid suspension and reinstatement fees.','Follow up with the mall on renewal to avoid suspension and reinstatement fees.');
  message := replace(message,'After grace, annual subscription and','After grace, the mall must pay the annual subscription and');
 END IF;
 RETURN message;
END $$;
REVOKE ALL ON FUNCTION public.subscription_super_admin_message(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_super_admin_message(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.emit_subscription_event(p_key text,p_mall bigint,p_kind text,p_title text,p_message text,p_email boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE event bigint; recipient public.admin; mall_name text; admin_message text;
BEGIN
 INSERT INTO public.subscription_event(event_key,mall_id,kind,title,message) VALUES(p_key,p_mall,p_kind,p_title,p_message)
 ON CONFLICT(event_key) DO NOTHING RETURNING event_id INTO event;
 IF event IS NULL THEN RETURN; END IF;
 SELECT m.mall_name INTO STRICT mall_name FROM public.mall m WHERE m.mall_id=p_mall;
 admin_message := mall_name||': '||public.subscription_super_admin_message(p_kind,p_title,p_message);
 FOR recipient IN SELECT * FROM public.admin WHERE NOT admin_is_deactivated AND admin_account_status='official'
 AND (admin_role='super_admin' OR (admin_role='mall_admin' AND mall_id=p_mall)) LOOP
  INSERT INTO public.admin_notification(admin_notif_type,admin_notif_title,admin_notif_message,admin_notif_action_url,admin_notif_action_label,
   admin_notif_source_type,admin_notif_source_id,admin_notif_source_label,admin_notif_is_read,admin_notif_is_archived,admin_notif_created_at,admin_id,mall_id)
  VALUES('subscription',p_title,CASE WHEN recipient.admin_role='super_admin' THEN admin_message ELSE p_message END,
   CASE WHEN recipient.admin_role='super_admin' THEN '/subscription-management' ELSE '/subscription' END,
   'View subscription','subscription',event,CASE WHEN recipient.admin_role='super_admin' THEN left(mall_name,255) ELSE 'Subscription' END,false,false,now(),recipient.admin_id,p_mall);
  IF recipient.admin_role='mall_admin' THEN
   INSERT INTO public.notification(notif_type,notif_title,notif_message,notif_action_url,notif_action_label,notif_is_read,notif_is_archived,notif_created_at,notif_target_role,mall_id,notif_admin_recipient)
   VALUES('subscription',p_title,p_message,'/subscription','View subscription',false,false,now(),'mall_admin',p_mall,recipient.admin_id);
   IF p_email THEN
    INSERT INTO public.email_log(email_log_type,email_log_to_email,email_log_subject,email_log_body,email_log_status,email_log_sent_at,mall_id,email_log_source_type,email_log_source_id)
    VALUES('subscription_'||p_kind,recipient.admin_email,p_title,p_message,'queued',NULL,p_mall,'subscription',event::text);
   END IF;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.emit_subscription_event(text,bigint,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emit_subscription_event(text,bigint,text,text,text,boolean) TO service_role;

-- Refresh displayed copies only. Preserve event records, mail history, read/archive flags and timestamps.
UPDATE public.admin_notification n
SET admin_notif_message=m.mall_name||': '||public.subscription_super_admin_message(e.kind,e.title,e.message),
    admin_notif_source_label=left(m.mall_name,255)
FROM public.admin a,public.subscription_event e,public.mall m
WHERE n.admin_id=a.admin_id AND a.admin_role='super_admin' AND n.admin_notif_source_type='subscription'
 AND n.admin_notif_source_id=e.event_id AND n.mall_id=e.mall_id AND m.mall_id=e.mall_id;

-- Older pre-workflow templates are no longer emitted, but remain in notification history.
UPDATE public.admin_notification n
SET admin_notif_message=m.mall_name||': '||CASE
 WHEN n.admin_notif_source_type='application_approved' THEN 'The mall application was approved. AR development is pending in the queue.'
 ELSE 'Node mapping has started for the mall.' END
FROM public.admin a,public.mall m
WHERE n.admin_id=a.admin_id AND a.admin_role='super_admin' AND m.mall_id=n.mall_id
 AND ((n.admin_notif_source_type='application_approved' AND n.admin_notif_message='Your application was approved and AR development is now pending in the queue.')
 OR (n.admin_notif_source_type='ar_development_status_changed' AND n.admin_notif_message='Node mapping has started for your mall.'));
