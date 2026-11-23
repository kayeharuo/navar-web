BEGIN;
CREATE TABLE public.application_review_history (
 history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 application_id bigint NOT NULL REFERENCES public.application(application_id) ON DELETE CASCADE,
 review_round integer NOT NULL CHECK(review_round BETWEEN 1 AND 3),
 decision_status text NOT NULL CHECK(decision_status IN ('rejected','rejected_final')),
 rejection_reason text NOT NULL CHECK(length(btrim(rejection_reason))>0),
 reviewed_by bigint NOT NULL REFERENCES public.admin(admin_id),reviewed_at timestamptz NOT NULL,
 recovered boolean NOT NULL DEFAULT false,payload jsonb NOT NULL,
 UNIQUE(application_id,review_round)
);
ALTER TABLE public.application_review_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_review_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.application_review_history TO service_role;

CREATE FUNCTION app_private.capture_application_review(p_application bigint,p_actor bigint,p_reason text,p_at timestamptz DEFAULT now(),p_round integer DEFAULT NULL,p_recovered boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.application; round_no integer; status_value text; snapshot jsonb; result bigint;
BEGIN
 SELECT * INTO STRICT a FROM public.application WHERE application_id=p_application;
 round_no:=coalesce(p_round,a.application_dispute_count+1);
 status_value:=CASE WHEN round_no=3 THEN 'rejected_final' ELSE 'rejected' END;
 IF a.application_version<2 OR round_no NOT BETWEEN 1 AND 3 OR coalesce(length(btrim(p_reason)),0)=0 THEN RAISE EXCEPTION 'A rejected version request and its explanation are required.';END IF;
 snapshot:=jsonb_build_object(
  'application',to_jsonb(a)||jsonb_build_object('application_status',status_value,'application_dispute_count',round_no-1,'application_updated_at',p_at),
  'mall',(SELECT to_jsonb(m) FROM public.mall m WHERE mall_id=a.mall_id),
  'floors',(SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY floor_num,floor_id),'[]') FROM public.floor f WHERE mall_id=a.mall_id),
  'plans',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY floor_id),'[]') FROM public.application_floor_plan p WHERE application_id=p_application),
  'entries',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY floor_id,app_entry_point_id),'[]') FROM public.application_entry_point e WHERE application_id=p_application),
  'hours',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY opthrs_id),'[]') FROM public.operating_hours h WHERE mall_id=a.mall_id AND opthrs_is_mall),
  'service',(SELECT to_jsonb(s) FROM public.mall_service_request s WHERE application_id=p_application AND kind='map_update' ORDER BY service_id DESC LIMIT 1),
  'messages',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY message_sent_at,message_id),'[]') FROM public.thread_message m JOIN public.thread t USING(thread_id) WHERE t.application_id=p_application AND m.message_sent_at<=p_at),
  'attachments',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.thread_message_attachment x JOIN public.thread_message m ON m.message_id=x.thread_message_id JOIN public.thread t ON t.thread_id=m.thread_id WHERE t.application_id=p_application AND m.message_sent_at<=p_at)
 );
 INSERT INTO public.application_review_history(application_id,review_round,decision_status,rejection_reason,reviewed_by,reviewed_at,recovered,payload)
 VALUES(p_application,round_no,status_value,btrim(p_reason),p_actor,p_at,p_recovered,snapshot)
 ON CONFLICT(application_id,review_round) DO NOTHING RETURNING history_id INTO result;
 RETURN result;
END $$;

-- Recover existing rejected rounds only when an audit record identifies each
-- rejection and the unaccepted submission's plan/entry data never changed.
DO $$DECLARE a record; m record; first_rejection timestamptz; rejection_count integer;
BEGIN
 FOR a IN SELECT * FROM public.application WHERE application_version>1 AND application_accepted_at IS NULL AND application_status IN ('rejected','rejected_final') LOOP
  SELECT min(x.message_sent_at),count(*) INTO first_rejection,rejection_count FROM public.thread_message x JOIN public.thread t USING(thread_id)
   WHERE t.application_id=a.application_id AND x.message_sender_type IN ('admin','super_admin') AND EXISTS(SELECT 1 FROM public.audit_log l WHERE l.mall_id=a.mall_id AND l.audit_log_action='reject' AND l.audit_log_performed_by=x.message_sender AND l.audit_log_performed_at=x.message_sent_at);
  IF rejection_count<>a.application_dispute_count+1 OR rejection_count NOT BETWEEN 1 AND 3 OR
   EXISTS(SELECT 1 FROM public.application_floor_plan WHERE application_id=a.application_id AND app_floor_plan_updated_at>first_rejection) OR
   EXISTS(SELECT 1 FROM public.application_entry_point WHERE application_id=a.application_id AND app_entry_point_updated_at>first_rejection) THEN CONTINUE;END IF;
  FOR m IN SELECT x.*,row_number() OVER(ORDER BY x.message_sent_at,x.message_id)::integer round_no FROM public.thread_message x JOIN public.thread t USING(thread_id)
   WHERE t.application_id=a.application_id AND x.message_sender_type IN ('admin','super_admin') AND EXISTS(SELECT 1 FROM public.audit_log l WHERE l.mall_id=a.mall_id AND l.audit_log_action='reject' AND l.audit_log_performed_by=x.message_sender AND l.audit_log_performed_at=x.message_sent_at)
  LOOP PERFORM app_private.capture_application_review(a.application_id,m.message_sender,m.message_content,m.message_sent_at,m.round_no,true);END LOOP;
 END LOOP;
END $$;

CREATE FUNCTION app_private.map_application_payment_cleared(p_application bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.mall_service_request s LEFT JOIN public.contract_payment_request p ON p.request_id=s.payment_request_id
  WHERE s.application_id=p_application AND s.kind='map_update' AND s.status IN ('queued','in_progress') AND (
   ((s.quote->>'amount_cent')::bigint=0 AND s.payment_request_id IS NULL) OR
   ((s.quote->>'amount_cent')::bigint>0 AND p.status='paid' AND p.fulfilled_at IS NOT NULL AND p.reconciliation_reason IS NULL AND p.amount_cent=(s.quote->>'amount_cent')::bigint)
  )
 );
$$;

ALTER FUNCTION public.workflow_action(bigint,bigint,text,text,text) RENAME TO workflow_before_review_history;
ALTER FUNCTION public.workflow_before_review_history(bigint,bigint,text,text,text) SET SCHEMA app_private;
CREATE FUNCTION public.workflow_action(p_id bigint,p_actor bigint,p_action text,p_text text DEFAULT '',p_target text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; a public.application;
BEGIN
 IF p_action IN ('approve','revision') AND EXISTS(SELECT 1 FROM public.mall_service_request WHERE application_id=p_id AND kind='map_update') AND NOT app_private.map_application_payment_cleared(p_id) THEN RAISE EXCEPTION 'Record the map-update payment before approving or requesting revision.';END IF;
 result:=app_private.workflow_before_review_history(p_id,p_actor,p_action,p_text,p_target);
 IF p_action='reject' THEN
  SELECT * INTO a FROM public.application WHERE application_id=p_id;
  IF a.application_version>1 AND a.application_status IN ('rejected','rejected_final') THEN PERFORM app_private.capture_application_review(p_id,p_actor,p_text);END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.capture_application_review(bigint,bigint,text,timestamptz,integer,boolean),app_private.map_application_payment_cleared(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.workflow_action(bigint,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_action(bigint,bigint,text,text,text) TO service_role;
COMMIT;
