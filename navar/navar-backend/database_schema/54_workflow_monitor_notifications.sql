BEGIN;
CREATE TABLE app_private.workflow_monitor_event (
 event_key text PRIMARY KEY, mall_id bigint, kind text NOT NULL, title text NOT NULL,
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.workflow_monitor_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.workflow_monitor_event FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON app_private.workflow_monitor_event TO service_role;
ALTER TABLE public.admin_notification ADD COLUMN workflow_event_key text;
CREATE UNIQUE INDEX admin_notification_workflow_event ON public.admin_notification(admin_id,workflow_event_key) WHERE workflow_event_key IS NOT NULL;

CREATE FUNCTION app_private.notify_super_admins(p_key text,p_mall bigint,p_kind text,p_title text,p_message text,p_path text,p_source bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inserted text; name text;
BEGIN
 SELECT mall_name INTO name FROM public.mall WHERE mall_id=p_mall;
 IF name IS NULL AND p_mall IS NOT NULL THEN RETURN; END IF;
 name:=COALESCE(name,'NavAR');
 INSERT INTO app_private.workflow_monitor_event(event_key,mall_id,kind,title,message)
 VALUES(p_key,p_mall,p_kind,p_title,p_message) ON CONFLICT DO NOTHING RETURNING event_key INTO inserted;
 IF inserted IS NULL THEN RETURN; END IF;
 INSERT INTO public.admin_notification(admin_notif_type,admin_notif_title,admin_notif_message,admin_notif_action_url,admin_notif_action_label,
 admin_notif_source_type,admin_notif_source_id,admin_notif_source_label,admin_notif_is_read,admin_notif_is_archived,admin_notif_created_at,admin_id,mall_id,workflow_event_key)
 SELECT p_kind,p_title,name||': '||p_message,p_path,'View details',p_kind,p_source,left(name,255),false,false,now(),a.admin_id,p_mall,p_key
 FROM public.admin a WHERE a.admin_role='super_admin' AND a.admin_account_status='official' AND NOT a.admin_is_deactivated
 ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION app_private.notify_super_admins(text,bigint,text,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.notify_super_admins(text,bigint,text,text,text,text,bigint) TO service_role;

CREATE FUNCTION app_private.monitor_workflow_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n jsonb; o jsonb; rowdata jsonb; mid bigint; id bigint; status text; oldstatus text; path text;
 label text; key text; title text; body text; parent bigint; live boolean;
BEGIN
 n:=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 rowdata:=CASE WHEN TG_OP='DELETE' THEN o ELSE n END;
 mid:=(rowdata->>'mall_id')::bigint;
 IF TG_TABLE_NAME IN ('application','stall_application') THEN
  id:=(rowdata->>CASE WHEN TG_TABLE_NAME='application' THEN 'application_id' ELSE 's_application_id' END)::bigint;
  status:=lower(n->>CASE WHEN TG_TABLE_NAME='application' THEN 'application_status' ELSE 's_application_status' END);
  oldstatus:=lower(o->>CASE WHEN TG_TABLE_NAME='application' THEN 'application_status' ELSE 's_application_status' END);
  label:=CASE WHEN TG_TABLE_NAME='application' THEN 'Map application' ELSE 'Stall application' END;
  path:='/application-management?applicationId='||id||'&type='||CASE WHEN TG_TABLE_NAME='application' THEN 'new' ELSE 'stall' END||'&view=thread';
  IF status IN ('submitted','pending','resubmitted') AND status IS DISTINCT FROM oldstatus THEN
   PERFORM app_private.notify_super_admins(TG_TABLE_NAME||':'||id||':submitted:'||txid_current(),mid,'application',label||' submitted',label||' #'||id||' is awaiting review.',path,id);
  ELSIF status IN ('disputed','cancelled','withdrawn') AND status IS DISTINCT FROM oldstatus THEN
   PERFORM app_private.notify_super_admins(TG_TABLE_NAME||':'||id||':'||status||':'||txid_current(),mid,'application',label||' '||status,'Review the updated application status: '||status||'.',path,id);
  END IF;
 ELSIF TG_TABLE_NAME='ar_development' THEN
  id:=(rowdata->>'ar_development_id')::bigint;
  SELECT mall_id INTO mid FROM public.application WHERE application_id=(rowdata->>'application_id')::bigint;
  path:='/ar-development?projectId='||id;
  IF n->>'ar_development_mall_approved_at' IS NOT NULL AND o->>'ar_development_mall_approved_at' IS NULL THEN
   PERFORM app_private.notify_super_admins('ar:'||id||':approved',mid,'ar_development','AR approved by mall','The mall confirmed AR version '||(n->>'ar_development_version')||'. Review subscription payment and publication.',path,id);
  END IF;
  status:=lower(n->>'ar_development_status');oldstatus:=lower(o->>'ar_development_status');
  IF status IS DISTINCT FROM oldstatus AND status IN ('pending','node_mapping','testing','ready','live','unpublished','on_hold') THEN
   title:=CASE status WHEN 'ready' THEN 'AR ready for mall review' WHEN 'live' THEN 'AR published' WHEN 'unpublished' THEN 'AR unpublished' WHEN 'on_hold' THEN 'AR development on hold' ELSE 'AR development updated' END;
   PERFORM app_private.notify_super_admins('ar:'||id||':status:'||status||':'||txid_current(),mid,'ar_development',title,'AR version '||(n->>'ar_development_version')||' is now '||replace(status,'_',' ')||'.',path,id);
  END IF;
 ELSIF TG_TABLE_NAME='contract_payment_request' THEN
  id:=(rowdata->>'request_id')::bigint;path:='/subscription-management';
  IF lower(n->>'status')='paid' AND lower(o->>'status') IS DISTINCT FROM 'paid' THEN
   label:=initcap(replace(COALESCE(n->>'fee_type','payment'),'_',' '));
   PERFORM app_private.notify_super_admins('payment:'||id||':paid',mid,'subscription',label||' payment received',label||' payment of PHP '||to_char(COALESCE((n->>'amount_cent')::numeric,0)/100,'FM9999999990.00')||' was recorded. Payment #'||id||'.',path,id);
  END IF;
  IF COALESCE(n->>'fulfillment_error',n->>'reconciliation_reason') IS NOT NULL
   AND (n->>'fulfillment_error',n->>'reconciliation_reason') IS DISTINCT FROM (o->>'fulfillment_error',o->>'reconciliation_reason') THEN
   PERFORM app_private.notify_super_admins('payment:'||id||':review:'||txid_current(),mid,'subscription','Payment requires review','Payment #'||id||' needs reconciliation or workflow review.',path,id);
  END IF;
  IF lower(n->>'status') IN ('failed','cancelled','refunded') AND n->>'status' IS DISTINCT FROM o->>'status' THEN
   PERFORM app_private.notify_super_admins('payment:'||id||':'||(n->>'status'),mid,'subscription','Payment '||(n->>'status'),'Review payment #'||id||'.',path,id);
  END IF;
 ELSIF TG_TABLE_NAME='contract' THEN
  id:=(rowdata->>'contract_id')::bigint;path:='/subscription-management';
  IF n->>'contract_start' IS NOT NULL AND (TG_OP='INSERT' OR o->>'contract_start' IS NULL OR (n->>'contract_is_current'='true' AND o->>'contract_is_current' IS DISTINCT FROM 'true')) THEN
   title:=CASE WHEN n->>'scheduled'='true' THEN 'Subscription change scheduled' WHEN n->>'change_type'='renewal' THEN 'Subscription renewed' WHEN n->>'change_type'='upgrade' THEN 'Subscription upgraded' WHEN n->>'change_type'='reinstatement' THEN 'Subscription reinstated' ELSE 'Subscription activated' END;
   PERFORM app_private.notify_super_admins('contract:'||id||CASE WHEN n->>'scheduled'='true' THEN ':scheduled' ELSE ':started' END,mid,'subscription',title,COALESCE(n#>>'{tier_snapshot,s_tier_label}','Selected')||' subscription dates and tier have been recorded.',path,id);
  END IF;
  IF n->>'cancellation_requested_at' IS NOT NULL AND o->>'cancellation_requested_at' IS NULL THEN
   PERFORM app_private.notify_super_admins('contract:'||id||':cancellation',mid,'subscription','Subscription cancellation requested','Review the cancellation request and effective date.',path,id);
  END IF;
  IF lower(n->>'contract_status') IN ('grace','grace period') AND lower(n->>'contract_status') IS DISTINCT FROM lower(o->>'contract_status') THEN
   PERFORM app_private.notify_super_admins('contract:'||id||':grace',mid,'subscription','Subscription under grace period','Review the unpaid renewal and subscription expiry.','/subscription-management',id);
  END IF;
 ELSIF TG_TABLE_NAME='store' THEN
  id:=(rowdata->>'store_id')::bigint;
  SELECT EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=mid AND (d.ar_development_status IN ('live','unpublished') OR d.ar_development_activated_at IS NOT NULL)) INTO live;
  IF live AND (TG_OP='DELETE' OR (lower(n->>'store_status') IN ('inactive','deactivated','removed','closed') AND n->>'store_status' IS DISTINCT FROM o->>'store_status')) THEN
   label:=CASE WHEN rowdata->>'store_type'='stall' THEN 'Stall' ELSE 'Store' END;
   PERFORM app_private.notify_super_admins('store:'||id||':removed:'||txid_current(),mid,'store',label||' removed after publication',COALESCE(rowdata->>'store_name',label)||' was removed or deactivated. Review the published map and beacon assignments.','/mall-management/stores/'||mid,id);
  END IF;
 ELSIF TG_TABLE_NAME IN ('stall','unit') THEN
  id:=(rowdata->>CASE WHEN TG_TABLE_NAME='stall' THEN 'stall_id' ELSE 'unit_id' END)::bigint;
  SELECT mall_id INTO mid FROM public.floor WHERE floor_id=(rowdata->>'floor_id')::bigint;
  SELECT EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=mid AND d.ar_development_status IN ('live','unpublished')) INTO live;
  IF live AND (TG_OP='DELETE' OR (o->>'store_id' IS NOT NULL AND n->>'store_id' IS NULL)) THEN
   PERFORM app_private.notify_super_admins(TG_TABLE_NAME||':'||id||':removed:'||txid_current(),mid,'store','Stall or store location removed','A published mall location was removed or unassigned. Review its map nodes and beacon assignments.','/mall-management/units/'||mid,id);
  END IF;
 ELSIF TG_TABLE_NAME='mall_service_request' THEN
  id:=(rowdata->>'service_id')::bigint;status:=lower(n->>'status');oldstatus:=lower(o->>'status');
  IF status IS DISTINCT FROM oldstatus AND status NOT IN ('draft') THEN
   label:=initcap(replace(COALESCE(n->>'kind','service'),'_',' '));
   PERFORM app_private.notify_super_admins('service:'||id||':'||status||':'||txid_current(),mid,'application',label||' request updated','Request #'||id||' is now '||replace(status,'_',' ')||'. Review its application and payment.','/application-management',id);
  END IF;
 ELSIF TG_TABLE_NAME='suspension' THEN
  id:=(rowdata->>'suspension_id')::bigint;SELECT mall_id INTO mid FROM public.contract WHERE contract_id=(rowdata->>'contract_id')::bigint;
  IF TG_OP='INSERT' THEN
   PERFORM app_private.notify_super_admins('suspension:'||id,mid,'subscription','Subscription suspended','Reason: '||(n->>'suspension_reason')||'. Review renewal, payment and AR availability.','/subscription-management',id);
  ELSIF n->>'suspension_lifted_at' IS NOT NULL AND o->>'suspension_lifted_at' IS NULL THEN
   PERFORM app_private.notify_super_admins('suspension:'||id||':lifted',mid,'subscription','Subscription suspension lifted','Review the restored subscription and AR availability.','/subscription-management',id);
  END IF;
 ELSIF TG_TABLE_NAME='beacon_ticket' THEN
  id:=(rowdata->>'ticket_id')::bigint;
  IF mid IS NULL THEN SELECT mall_id INTO mid FROM public.beacon WHERE beacon_id=(rowdata->>'beacon_id')::bigint; END IF;
  IF TG_OP='INSERT' OR n->>'ticket_current_status' IS DISTINCT FROM o->>'ticket_current_status' THEN
   PERFORM app_private.notify_super_admins('ticket:'||id||':'||COALESCE(n->>'ticket_current_status','reported')||':'||txid_current(),mid,'beacon_ticket','Beacon service ticket updated','Review beacon ticket #'||id||' and its reported issue.','/mall-management/beacons/'||mid||'?ticketId='||id,id);
  END IF;
 ELSIF TG_TABLE_NAME='beacon' THEN
  id:=(rowdata->>'beacon_id')::bigint;
  IF n->>'beacon_status' IS DISTINCT FROM o->>'beacon_status' AND lower(n->>'beacon_status') IN ('maintenance','missing','inactive','faulty','offline') THEN
   PERFORM app_private.notify_super_admins('beacon:'||id||':'||(n->>'beacon_status')||':'||txid_current(),mid,'beacon','Beacon requires attention','Review beacon #'||id||' marked '||(n->>'beacon_status')||'.','/mall-management/beacons/'||mid,id);
  END IF;
 ELSIF TG_TABLE_NAME='inquiry' AND TG_OP='INSERT' THEN
  id:=(rowdata->>'inquiry_id')::bigint;
  PERFORM app_private.notify_super_admins('inquiry:'||id||':received',mid,'inquiry','Mall inquiry received',COALESCE(n->>'inquiry_mall_name','A mall')||' submitted an inquiry for review.','/mall-management/inquiries',id);
 ELSIF TG_TABLE_NAME='payment' AND n->>'payment_paid_at' IS NOT NULL AND (TG_OP='INSERT' OR o->>'payment_paid_at' IS NULL) THEN
  id:=(rowdata->>'payment_id')::bigint;
  SELECT mall_id INTO mid FROM public.contract WHERE contract_id=(rowdata->>'contract_id')::bigint;
  IF mid IS NULL THEN SELECT mall_id INTO mid FROM public.stall_application WHERE s_application_id=(rowdata->>'s_application_id')::bigint; END IF;
  PERFORM app_private.notify_super_admins('legacy-payment:'||id,mid,'subscription','Payment received',initcap(replace(COALESCE(n->>'payment_type','Payment'),'_',' '))||' payment was recorded.','/subscription-management',id);
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION app_private.monitor_workflow_change() FROM PUBLIC,anon,authenticated;
DO $$DECLARE tbl text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['application','stall_application','ar_development','contract_payment_request','contract','store','stall','unit','mall_service_request','suspension','beacon_ticket','beacon','inquiry','payment'] LOOP
  EXECUTE format('CREATE TRIGGER workflow_monitor_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.monitor_workflow_change()',tbl);
 END LOOP;
END $$;

-- Preserve mall notifications and email delivery; Super Admin delivery now comes
-- from source-row triggers, including when callers never invoke this emitter.
DO $$DECLARE ddl text;BEGIN
 SELECT pg_get_functiondef('public.emit_subscription_event(text,bigint,text,text,text,boolean)'::regprocedure) INTO ddl;
 IF position('AND (admin_role=''super_admin'' OR (admin_role=''mall_admin'' AND mall_id=p_mall))' IN ddl)=0 THEN RAISE EXCEPTION 'Unexpected subscription notification emitter';END IF;
 ddl:=replace(ddl,'AND (admin_role=''super_admin'' OR (admin_role=''mall_admin'' AND mall_id=p_mall))','AND admin_role=''mall_admin'' AND mall_id=p_mall');
 EXECUTE ddl;
END $$;

-- Clock-based transitions need a scheduler: no interface action is involved.
CREATE FUNCTION public.monitor_subscription_deadlines()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c record; today date:=(now() AT TIME ZONE 'Asia/Manila')::date; ends date; remaining int; n int:=0; title text; suffix text; paid_renewal boolean;
BEGIN
 FOR c IN SELECT * FROM public.contract WHERE contract_is_current AND contract_start IS NOT NULL AND lower(contract_status) NOT IN ('cancelled','superseded') LOOP
  ends:=(c.contract_end AT TIME ZONE 'Asia/Manila')::date;remaining:=ends-today;
  SELECT EXISTS(SELECT 1 FROM public.contract next JOIN public.contract_payment_request p ON p.contract_id=next.contract_id AND p.status='paid' AND p.fulfilled_at IS NOT NULL AND p.reconciliation_reason IS NULL
    WHERE next.previous_contract_id=c.contract_id AND next.change_type IN ('renewal','reinstatement')) INTO paid_renewal;
  IF paid_renewal THEN CONTINUE;END IF;
  title:=NULL;suffix:=NULL;
  IF remaining IN (30,15,7,1) THEN title:='Subscription renewal approaching';suffix:='expiry:'||remaining;
  ELSIF remaining<0 AND -remaining<=c.contract_grace_period_days THEN title:='Subscription under grace period';suffix:='grace';
  ELSIF remaining<0 AND -remaining>c.contract_grace_period_days THEN title:='Subscription not renewed';suffix:='not-renewed';END IF;
  IF title IS NOT NULL THEN
   PERFORM app_private.notify_super_admins('contract:'||c.contract_id||':'||suffix,c.mall_id,'subscription',title,'Subscription expiry: '||to_char(ends,'Month DD, YYYY')||'. Review payment, renewal and AR availability.','/subscription-management',c.contract_id);n:=n+1;
  END IF;
  IF remaining<0 AND -remaining=GREATEST(c.contract_grace_period_days-1,1) AND -remaining<=c.contract_grace_period_days THEN
   PERFORM app_private.notify_super_admins('contract:'||c.contract_id||':grace-ending',c.mall_id,'subscription','Subscription grace period ending','Renewal remains unpaid and the grace period is ending. Review the account.','/subscription-management',c.contract_id);
  END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.monitor_subscription_deadlines() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.monitor_subscription_deadlines() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
