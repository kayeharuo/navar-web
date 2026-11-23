-- Restore missed alerts from existing, verified rows. No workflow state changes.
BEGIN;
DO $$DECLARE r record;BEGIN
 FOR r IN SELECT * FROM public.contract_payment_request WHERE mall_id=12 AND status='paid' AND fulfilled_at IS NOT NULL AND reconciliation_reason IS NULL LOOP
  PERFORM app_private.notify_super_admins('payment:'||r.request_id||':paid',12,'subscription',initcap(replace(r.fee_type,'_',' '))||' payment received',
   initcap(replace(r.fee_type,'_',' '))||' payment of PHP '||to_char(r.amount_cent::numeric/100,'FM9999999990.00')||' was recorded on '||to_char(r.paid_at AT TIME ZONE 'Asia/Manila','Month DD, YYYY')||'.','/subscription-management',r.request_id);
 END LOOP;
 FOR r IN SELECT d.* FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=12 AND d.ar_development_mall_approved_at IS NOT NULL LOOP
  PERFORM app_private.notify_super_admins('ar:'||r.ar_development_id||':approved',12,'ar_development','AR approved by mall',
   'The mall approved AR version '||r.ar_development_version||' on '||to_char(r.ar_development_mall_approved_at AT TIME ZONE 'Asia/Manila','Month DD, YYYY')||'.','/ar-development?projectId='||r.ar_development_id,r.ar_development_id);
 END LOOP;
 FOR r IN SELECT * FROM public.contract WHERE mall_id=12 AND contract_is_current AND contract_start IS NOT NULL LOOP
  PERFORM app_private.notify_super_admins('contract:'||r.contract_id||':started',12,'subscription','Subscription activated',
   COALESCE(r.tier_snapshot->>'s_tier_label','Selected')||' subscription is active. Review the subscription dates and payment history.','/subscription-management',r.contract_id);
 END LOOP;
END $$;
COMMIT;
