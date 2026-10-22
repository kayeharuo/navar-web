-- Application/AR workflow. Do not apply until 23_workflow_prechecks.sql is clear.
-- Existing migrations 01-22 are deliberately unchanged. No payment/renewal logic.
BEGIN;
LOCK TABLE public.mall, public.application, public.ar_development, public.node, public.edge, public.beacon_node_assigment IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(WITH refs AS (
 SELECT start_node_id node_id, ar_development_id FROM public.edge
 UNION SELECT end_node_id, ar_development_id FROM public.edge
 UNION SELECT node_id, ar_development_id FROM public.beacon_node_assigment)
 SELECT 1 FROM refs GROUP BY node_id HAVING count(DISTINCT ar_development_id)>1)
 THEN RAISE EXCEPTION 'STOP: nodes referenced by multiple AR versions'; END IF;
 IF EXISTS(SELECT 1 FROM public.node n JOIN public.floor f USING(floor_id)
 WHERE NOT EXISTS(SELECT 1 FROM public.ar_development d JOIN public.application a USING(application_id) WHERE a.mall_id=f.mall_id))
 THEN RAISE EXCEPTION 'STOP: mall with nodes has no AR development'; END IF;
END $$;
ALTER TABLE public.contract ADD COLUMN contract_map_updates_per_year integer;
UPDATE public.subscription_tier SET s_tier_map_updates_per_year=CASE s_tier_key WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3 END
WHERE s_tier_key IN ('basic','standard','premium');
UPDATE public.contract c SET contract_map_updates_per_year=t.s_tier_map_updates_per_year FROM public.subscription_tier t WHERE t.s_tier_id=c.s_tier_id;
ALTER TABLE public.contract ALTER COLUMN contract_map_updates_per_year SET NOT NULL;
CREATE FUNCTION public.snapshot_map_allowance() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.contract_map_updates_per_year IS NULL THEN SELECT s_tier_map_updates_per_year INTO NEW.contract_map_updates_per_year FROM public.subscription_tier WHERE s_tier_id=NEW.s_tier_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_map_allowance BEFORE INSERT ON public.contract FOR EACH ROW EXECUTE FUNCTION public.snapshot_map_allowance();
REVOKE ALL ON FUNCTION public.snapshot_map_allowance() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.application
 ADD COLUMN application_attempt integer NOT NULL DEFAULT 1,
 ADD COLUMN application_reason_category varchar,
 ADD COLUMN application_reason_notes text,
 ADD COLUMN application_accepted_at timestamptz,
 ADD COLUMN application_dispute_count integer NOT NULL DEFAULT 0,
 ADD CONSTRAINT application_mall_version_attempt_key UNIQUE(mall_id,application_version,application_attempt),
 ADD CONSTRAINT application_attempt_positive CHECK(application_attempt>0),
 ADD CONSTRAINT application_dispute_limit CHECK(application_dispute_count BETWEEN 0 AND 2);
-- Replace the old version-only unique index so rejected attempts can reuse a version.
DROP INDEX IF EXISTS public.uq_application_mall_version;
ALTER TABLE public.ar_development
 ADD COLUMN ar_development_resume_status varchar,
 ADD COLUMN ar_development_ready_at timestamptz,
 ADD COLUMN ar_development_reminder_count integer NOT NULL DEFAULT 0,
 ADD COLUMN ar_development_mall_approved_at timestamptz,
 ADD COLUMN ar_development_unpublish_reason varchar;
UPDATE public.ar_development SET ar_development_status='on_hold', ar_development_resume_status='pending' WHERE lower(ar_development_status)='suspended';
-- Existing CHECK constraints are not silently removed: an incompatible one aborts.
ALTER TABLE public.ar_development ADD CONSTRAINT ar_workflow_status CHECK(ar_development_status IN ('pending','node_mapping','testing','on_hold','ready','live','unpublished'));
UPDATE public.ar_development SET ar_development_ready_at=ar_development_updated_at WHERE ar_development_status='ready';
ALTER TABLE public.node ADD COLUMN ar_development_id bigint REFERENCES public.ar_development(ar_development_id);
UPDATE public.node n SET ar_development_id=(SELECT d.ar_development_id FROM public.ar_development d
 JOIN public.application a USING(application_id) JOIN public.floor f ON f.mall_id=a.mall_id
 WHERE f.floor_id=n.floor_id ORDER BY (lower(d.ar_development_status)='live') DESC,d.ar_development_version DESC,d.ar_development_id DESC LIMIT 1);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.edge e JOIN public.node s ON s.node_id=e.start_node_id JOIN public.node t ON t.node_id=e.end_node_id
 WHERE e.ar_development_id IS DISTINCT FROM s.ar_development_id OR e.ar_development_id IS DISTINCT FROM t.ar_development_id)
 OR EXISTS(SELECT 1 FROM public.beacon_node_assigment b JOIN public.node n USING(node_id) WHERE b.ar_development_id IS DISTINCT FROM n.ar_development_id)
 THEN RAISE EXCEPTION 'STOP: edges/assignments disagree with proposed node versions'; END IF;
END $$;
ALTER TABLE public.node ALTER COLUMN ar_development_id SET NOT NULL;
ALTER TABLE public.node ADD CONSTRAINT node_id_ar_development_key UNIQUE(node_id,ar_development_id),
 ADD CONSTRAINT node_cross_floor_same_version FOREIGN KEY(node_cross_floor_link_id,ar_development_id) REFERENCES public.node(node_id,ar_development_id);
ALTER TABLE public.edge
 ADD CONSTRAINT edge_start_node_same_version FOREIGN KEY(start_node_id,ar_development_id) REFERENCES public.node(node_id,ar_development_id),
 ADD CONSTRAINT edge_end_node_same_version FOREIGN KEY(end_node_id,ar_development_id) REFERENCES public.node(node_id,ar_development_id);
ALTER TABLE public.beacon_node_assigment
 ADD CONSTRAINT assignment_node_same_version FOREIGN KEY(node_id,ar_development_id) REFERENCES public.node(node_id,ar_development_id),
 ADD CONSTRAINT assignment_one_node_per_beacon_per_version UNIQUE(ar_development_id,beacon_id);
CREATE INDEX ix_node_ar_floor ON public.node(ar_development_id,floor_id);
CREATE INDEX ix_application_quota ON public.application(mall_id,application_accepted_at) WHERE application_version>1;
CREATE INDEX ix_ar_ready_reminders ON public.ar_development(ar_development_ready_at) WHERE ar_development_status='ready' AND ar_development_mall_approved_at IS NULL;
-- Preserve existing deny-by-default policies. No new grants to anon/authenticated.
ALTER TABLE public.node ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beacon_node_assigment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_development ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_application_version_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous public.application; BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=NEW.mall_id FOR UPDATE;
 SELECT * INTO previous FROM public.application WHERE mall_id=NEW.mall_id ORDER BY application_version DESC,application_attempt DESC LIMIT 1;
 IF NOT FOUND THEN
  IF NEW.application_version<>1 OR NEW.application_attempt<>1 THEN RAISE EXCEPTION 'First application must be version 1 attempt 1'; END IF;
  RETURN NEW;
 END IF;
 IF previous.application_status IN ('rejected','rejected_final') AND previous.application_accepted_at IS NULL
 AND NEW.application_version=previous.application_version AND NEW.application_attempt=previous.application_attempt+1 THEN RETURN NEW; END IF;
 IF NEW.application_version<>previous.application_version+1 OR NEW.application_attempt<>1 OR NOT EXISTS(
 SELECT 1 FROM public.ar_development WHERE application_id=previous.application_id AND ar_development_status='live')
 THEN RAISE EXCEPTION 'Latest AR must be Live, or this must be a new attempt after rejection'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_application_version_rule() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ensure_application_thread(p_application bigint) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result bigint; BEGIN
 PERFORM 1 FROM public.mall WHERE mall_id=(SELECT mall_id FROM public.application WHERE application_id=p_application) FOR UPDATE;
 SELECT thread_id INTO result FROM public.thread WHERE application_id=p_application ORDER BY thread_id LIMIT 1;
 IF result IS NULL THEN INSERT INTO public.thread(thread_source,thread_created_at,application_id) VALUES('development_application',now(),p_application) RETURNING thread_id INTO result; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ensure_application_thread(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_application_thread(bigint) TO service_role;

-- Internal event helper: audited changes and opposite-party notifications in the same transaction.
CREATE FUNCTION public.workflow_event(p_app bigint,p_actor bigint,p_action text,p_message text,p_ar bigint DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE m bigint; r text; BEGIN
 SELECT mall_id INTO STRICT m FROM public.application WHERE application_id=p_app;
 SELECT admin_role INTO STRICT r FROM public.admin WHERE admin_id=p_actor AND NOT admin_is_deactivated;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,mall_id)
 VALUES('application_ar',p_action,p_message,now(),p_actor,m);
 INSERT INTO public.admin_notification(admin_notif_type,admin_notif_title,admin_notif_message,admin_notif_action_url,admin_notif_action_label,
 admin_notif_source_type,admin_notif_source_id,admin_notif_source_label,admin_notif_actor_id,admin_notif_actor_role,admin_id,mall_id,admin_notif_created_at,admin_notif_is_read,admin_notif_is_archived)
 SELECT 'workflow_status','NavAR workflow update',p_message,
 CASE WHEN p_ar IS NULL THEN '/application-management?applicationId='||p_app ELSE '/ar-development?projectId='||p_ar END,'View details',
 'application_ar',coalesce(p_ar,p_app),'Version update',p_actor,r,a.admin_id,m,now(),false,false
 FROM public.admin a WHERE NOT a.admin_is_deactivated AND a.admin_account_status='official'
 AND ((r='super_admin' AND a.admin_role='mall_admin' AND a.mall_id=m) OR (r='mall_admin' AND a.admin_role='super_admin'));
END $$;

-- Only the verified backend calls this RPC. Lock mall before application to serialize acceptance/quota and publish.
CREATE FUNCTION public.workflow_action(p_id bigint,p_actor bigint,p_action text,p_text text DEFAULT '',p_target text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.application; d public.ar_development; who public.admin; c public.contract; new_status text; thread_id_value bigint; other public.ar_development; BEGIN
 SELECT * INTO STRICT who FROM public.admin WHERE admin_id=p_actor AND NOT admin_is_deactivated AND admin_account_status='official';
 IF who.admin_role NOT IN ('super_admin','mall_admin') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT a FROM public.application WHERE application_id=p_id;
 PERFORM 1 FROM public.mall WHERE mall_id=a.mall_id FOR UPDATE;
 SELECT * INTO STRICT a FROM public.application WHERE application_id=p_id FOR UPDATE;
 IF who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM a.mall_id THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.application x WHERE x.mall_id=a.mall_id AND (x.application_version,x.application_attempt)>(a.application_version,a.application_attempt)) THEN RAISE EXCEPTION 'Older versions are read-only' USING ERRCODE='P0001'; END IF;
 SELECT * INTO d FROM public.ar_development WHERE application_id=p_id ORDER BY ar_development_id DESC LIMIT 1 FOR UPDATE;
 IF d.ar_development_status IN ('live','unpublished') THEN RAISE EXCEPTION 'Published versions are read-only' USING ERRCODE='P0001'; END IF;
 IF p_action IN ('accept','reject','approve','revision','ar_status') AND who.admin_role<>'super_admin' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_action IN ('dispute','resubmit','mall_approve') AND who.admin_role<>'mall_admin' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_action='accept' THEN
  IF a.application_version<2 OR a.application_status NOT IN ('pending','disputed') THEN RAISE EXCEPTION 'Request cannot be accepted'; END IF;
  SELECT * INTO c FROM public.contract WHERE mall_id=a.mall_id AND contract_is_current FOR UPDATE;
  IF FOUND AND (c.contract_start IS NULL OR c.contract_end IS NULL) THEN RAISE EXCEPTION 'Contract term is required for quota accounting'; END IF;
  IF c.contract_map_updates_per_year IS NOT NULL AND (
   SELECT count(*) FROM public.application WHERE mall_id=a.mall_id AND application_version>1
   AND application_accepted_at>=c.contract_start AND application_accepted_at<c.contract_end)>=c.contract_map_updates_per_year THEN RAISE EXCEPTION 'No map updates left'; END IF;
  UPDATE public.application SET application_status='submitted',application_accepted_at=now(),application_updated_at=now() WHERE application_id=p_id;
 ELSIF p_action='reject' THEN
  IF a.application_version<2 OR a.application_status NOT IN ('pending','disputed') OR length(trim(p_text))=0 THEN RAISE EXCEPTION 'Rejection requires a pending/disputed v2+ request and explanation'; END IF;
  UPDATE public.application SET application_status=CASE WHEN application_dispute_count=2 THEN 'rejected_final' ELSE 'rejected' END,application_updated_at=now() WHERE application_id=p_id;
 ELSIF p_action='dispute' THEN
  IF a.application_status<>'rejected' OR a.application_version<2 OR a.application_dispute_count>=2 OR length(trim(p_text))=0 THEN RAISE EXCEPTION 'Dispute not allowed'; END IF;
  UPDATE public.application SET application_status='disputed',application_dispute_count=application_dispute_count+1,application_updated_at=now() WHERE application_id=p_id;
 ELSIF p_action='resubmit' THEN
  IF a.application_status NOT IN ('draft','for_revision') THEN RAISE EXCEPTION 'Resubmission not allowed'; END IF;
  UPDATE public.application SET application_status='submitted',application_updated_at=now() WHERE application_id=p_id;
 ELSIF p_action='revision' THEN
  IF a.application_status NOT IN ('submitted','approved') OR (a.application_status='approved' AND coalesce(d.ar_development_status,'') NOT IN ('pending','node_mapping','testing'))
  OR d.ar_development_mall_approved_at IS NOT NULL OR d.ar_development_ready_at IS NOT NULL THEN RAISE EXCEPTION 'Revision not allowed once AR has reached Ready'; END IF;
  UPDATE public.application SET application_status='for_revision',application_updated_at=now() WHERE application_id=p_id;
  IF a.application_status='approved' THEN
   UPDATE public.ar_development SET ar_development_resume_status=ar_development_status,ar_development_status='on_hold',ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;
   PERFORM public.workflow_event(p_id,p_actor,'on_hold','AR: '||d.ar_development_status||' -> on_hold',d.ar_development_id);
  END IF;
 ELSIF p_action='approve' THEN
  IF a.application_status<>'submitted' THEN RAISE EXCEPTION 'Only submitted applications can be approved'; END IF;
  UPDATE public.application SET application_status='approved',application_updated_at=now() WHERE application_id=p_id;
  IF d.ar_development_id IS NULL THEN
   INSERT INTO public.ar_development(application_id,ar_development_version,ar_development_status,ar_development_created_at,ar_development_updated_at)
   VALUES(p_id,a.application_version,'pending',now(),now()) RETURNING * INTO d;
   PERFORM public.workflow_event(p_id,p_actor,'ar_created','AR: pending',d.ar_development_id);
  ELSIF d.ar_development_status='on_hold' THEN
   UPDATE public.ar_development SET ar_development_status=ar_development_resume_status,ar_development_resume_status=NULL,ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;
   PERFORM public.workflow_event(p_id,p_actor,'ar_resumed','AR resumed: '||d.ar_development_resume_status,d.ar_development_id);
  ELSE RAISE EXCEPTION 'Existing AR is not On Hold'; END IF;
 ELSIF p_action='ar_status' THEN
  IF a.application_status<>'approved' OR d.ar_development_mall_approved_at IS NOT NULL OR NOT (
   (d.ar_development_status='pending' AND p_target='node_mapping') OR
   (d.ar_development_status='node_mapping' AND p_target='testing') OR
   (d.ar_development_status='testing' AND p_target IN ('node_mapping','ready')) OR
   (d.ar_development_status='ready' AND p_target IN ('testing','node_mapping'))) THEN RAISE EXCEPTION 'AR transition not allowed'; END IF;
  UPDATE public.ar_development SET ar_development_status=p_target,ar_development_updated_at=now(),
   ar_development_ready_at=CASE WHEN p_target='ready' THEN now() ELSE ar_development_ready_at END,
   ar_development_reminder_count=CASE WHEN p_target='ready' THEN 0 ELSE ar_development_reminder_count END WHERE ar_development_id=d.ar_development_id;
  IF p_target='ready' THEN
   INSERT INTO public.thread(thread_source,thread_created_at,ar_development_id) SELECT 'ar_development',now(),d.ar_development_id WHERE NOT EXISTS(SELECT 1 FROM public.thread WHERE ar_development_id=d.ar_development_id);
  END IF;
 ELSIF p_action='mall_approve' THEN
  IF d.ar_development_status<>'ready' OR p_text<>'acknowledged' OR d.ar_development_mall_approved_at IS NOT NULL THEN RAISE EXCEPTION 'Ready approval requires acknowledgement'; END IF;
  UPDATE public.ar_development SET ar_development_mall_approved_at=now(),ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;
 ELSIF p_action='publish' THEN
  IF d.ar_development_status<>'ready' OR d.ar_development_mall_approved_at IS NULL THEN RAISE EXCEPTION 'Mall approval is required'; END IF;
  FOR other IN SELECT x.* FROM public.ar_development x JOIN public.application y USING(application_id)
   WHERE y.mall_id=a.mall_id AND x.ar_development_status='live' AND x.ar_development_id<>d.ar_development_id FOR UPDATE OF x LOOP
   UPDATE public.ar_development SET ar_development_status='unpublished',ar_development_unpublish_reason='superseded',ar_development_updated_at=now() WHERE ar_development_id=other.ar_development_id;
   PERFORM public.workflow_event(other.application_id,p_actor,'superseded','AR unpublished: superseded',other.ar_development_id);
  END LOOP;
  UPDATE public.ar_development SET ar_development_status='live',ar_development_activated_at=now(),ar_development_updated_at=now() WHERE ar_development_id=d.ar_development_id;
 ELSE RAISE EXCEPTION 'Unknown workflow action'; END IF;
 IF length(trim(p_text))>0 AND p_action IN ('reject','dispute','revision') THEN
  INSERT INTO public.thread(thread_source,thread_created_at,application_id) SELECT 'development_application',now(),p_id WHERE NOT EXISTS(SELECT 1 FROM public.thread WHERE application_id=p_id);
  SELECT thread_id INTO STRICT thread_id_value FROM public.thread WHERE application_id=p_id ORDER BY thread_id LIMIT 1;
  INSERT INTO public.thread_message(message_sender_type,message_sent_at,message_content,thread_id,message_sender)
   VALUES(CASE WHEN who.admin_role='super_admin' THEN 'admin' ELSE 'mall_admin' END,now(),p_text,thread_id_value,p_actor);
 END IF;
 SELECT application_status INTO new_status FROM public.application WHERE application_id=p_id;
 PERFORM public.workflow_event(p_id,p_actor,p_action,CASE WHEN p_action='ar_status' THEN 'AR: '||d.ar_development_status||' -> '||p_target ELSE 'Application '||a.application_version||': '||p_action||' ('||new_status||') AR #'||coalesce(d.ar_development_id::text,'none') END,
 CASE WHEN p_action IN ('ar_status','mall_approve','publish') THEN d.ar_development_id ELSE NULL END);
 RETURN jsonb_build_object('applicationId',p_id,'arDevelopmentId',d.ar_development_id,'status',new_status);
END $$;
REVOKE ALL ON FUNCTION public.workflow_event(bigint,bigint,text,text,bigint),public.workflow_action(bigint,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_event(bigint,bigint,text,text,bigint),public.workflow_action(bigint,bigint,text,text,text) TO service_role;
-- Backfill thread visibility for ARs already Ready/Live, without inventing approvals.
INSERT INTO public.thread(thread_source,thread_created_at,ar_development_id)
 SELECT 'ar_development',now(),d.ar_development_id FROM public.ar_development d WHERE ar_development_status IN ('ready','live','unpublished') AND NOT EXISTS(SELECT 1 FROM public.thread t WHERE t.ar_development_id=d.ar_development_id);

CREATE OR REPLACE FUNCTION public.save_node_map(
    p_ar_development_id INTEGER,
    p_base_revision     INTEGER,
    p_payload           JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status      TEXT;
    v_revision    INTEGER;
    v_mall_id     INTEGER;
    v_now         TIMESTAMPTZ := now();
    v_floor_ids   INTEGER[];
    v_keep        INTEGER[] := ARRAY[]::INTEGER[];
    v_map         JSONB := '{}'::JSONB;
    v_rec         JSONB;
    v_node_id     INTEGER;
    v_from_id     INTEGER;
    v_to_id       INTEGER;
    v_link_id     INTEGER;
BEGIN
    SELECT d.ar_development_status, d.ar_development_map_revision, a.mall_id
      INTO v_status, v_revision, v_mall_id
      FROM public.ar_development d
      JOIN public.application a ON a.application_id = d.application_id
     WHERE d.ar_development_id = p_ar_development_id
       FOR UPDATE OF d;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AR development not found.' USING ERRCODE = 'NM404';
    END IF;
    IF lower(v_status) <> 'node_mapping' OR EXISTS(SELECT 1 FROM public.ar_development WHERE ar_development_id=p_ar_development_id AND ar_development_mall_approved_at IS NOT NULL) OR EXISTS(SELECT 1 FROM public.application newer JOIN public.application current ON current.mall_id=newer.mall_id JOIN public.ar_development d ON d.application_id=current.application_id WHERE d.ar_development_id=p_ar_development_id AND (newer.application_version,newer.application_attempt)>(current.application_version,current.application_attempt)) THEN
        RAISE EXCEPTION 'The map can only be edited while the AR development is in Node Mapping.' USING ERRCODE = 'NM422';
    END IF;
    IF p_base_revision IS NOT NULL AND v_revision <> p_base_revision THEN
        RAISE EXCEPTION 'The map was changed by someone else. Reload to get the latest version.' USING ERRCODE = 'NM409';
    END IF;

    -- Only floors named in the payload (and owned by this mall) are in scope.
    -- Nodes on any other floor are never touched, so a save cannot wipe a floor
    -- that has no floor plan in this application.
    SELECT COALESCE(array_agg(f.floor_id), ARRAY[]::INTEGER[]) INTO v_floor_ids
      FROM public.floor f
     WHERE f.mall_id = v_mall_id
       AND f.floor_id IN (
           SELECT (jsonb_array_elements_text(COALESCE(p_payload -> 'floor_ids', '[]'::JSONB)))::INTEGER
       );

    -- 1. Upsert nodes. Existing rows keep their node_id so beacon assignments survive.
    FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'nodes', '[]'::JSONB)) LOOP
        IF NOT ((v_rec ->> 'floor_id')::INTEGER = ANY (v_floor_ids)) THEN
            RAISE EXCEPTION 'A node references a floor that does not belong to this mall.' USING ERRCODE = 'NM422';
        END IF;

        IF v_rec ->> 'node_id' IS NOT NULL THEN
            v_node_id := NULL;
            UPDATE public.node SET
                node_label = v_rec ->> 'label',
                node_type = v_rec ->> 'type',
                node_x_coordinate = (v_rec ->> 'x')::DOUBLE PRECISION,
                node_y_coordinate = (v_rec ->> 'y')::DOUBLE PRECISION,
                node_pixel_x = (v_rec ->> 'pixel_x')::DOUBLE PRECISION,
                node_pixel_y = (v_rec ->> 'pixel_y')::DOUBLE PRECISION,
                node_is_store_entrance = (v_rec ->> 'is_store_entrance')::BOOLEAN,
                node_is_accessible = (v_rec ->> 'is_accessible')::BOOLEAN,
                node_updated_at = v_now,
                floor_id = (v_rec ->> 'floor_id')::INTEGER,
                store_id = NULLIF(v_rec ->> 'store_id', '')::INTEGER,
                unit_id = NULLIF(v_rec ->> 'unit_id', '')::INTEGER
             WHERE node_id = (v_rec ->> 'node_id')::INTEGER
               AND floor_id = ANY (v_floor_ids) AND ar_development_id=p_ar_development_id
            RETURNING node_id INTO v_node_id;

            IF v_node_id IS NULL THEN
                RAISE EXCEPTION 'Node % does not exist in this mall.', v_rec ->> 'node_id' USING ERRCODE = 'NM422';
            END IF;
        ELSE
            INSERT INTO public.node (
                node_label, node_type, node_x_coordinate, node_y_coordinate,
                node_pixel_x, node_pixel_y, node_is_store_entrance, node_is_accessible,
                node_created_at, node_updated_at, floor_id, store_id, unit_id, ar_development_id
            ) VALUES (
                v_rec ->> 'label', v_rec ->> 'type',
                (v_rec ->> 'x')::DOUBLE PRECISION, (v_rec ->> 'y')::DOUBLE PRECISION,
                (v_rec ->> 'pixel_x')::DOUBLE PRECISION, (v_rec ->> 'pixel_y')::DOUBLE PRECISION,
                (v_rec ->> 'is_store_entrance')::BOOLEAN, (v_rec ->> 'is_accessible')::BOOLEAN,
                v_now, v_now, (v_rec ->> 'floor_id')::INTEGER,
                NULLIF(v_rec ->> 'store_id', '')::INTEGER, NULLIF(v_rec ->> 'unit_id', '')::INTEGER, p_ar_development_id
            ) RETURNING node_id INTO v_node_id;
        END IF;

        v_map := v_map || jsonb_build_object(v_rec ->> 'client_id', v_node_id);
        v_keep := array_append(v_keep, v_node_id);
    END LOOP;

    -- 2. Edges of this version are replaced as a whole.
    DELETE FROM public.edge e
     USING public.node n
     WHERE e.ar_development_id = p_ar_development_id
       AND e.start_node_id = n.node_id
       AND n.floor_id = ANY (v_floor_ids);

    -- 3. Beacon assignments of THIS version that point at nodes being removed go too.
    DELETE FROM public.beacon_node_assigment a
     USING public.node n
     WHERE a.ar_development_id = p_ar_development_id
       AND a.node_id = n.node_id
       AND n.floor_id = ANY (v_floor_ids)
       AND n.node_id <> ALL (v_keep);

    -- 4. Remove nodes that were deleted in the editor. A node still used by another
    --    AR version, a scan log or a navigation session cannot be deleted.
    FOR v_node_id IN
        SELECT node_id FROM public.node
         WHERE floor_id = ANY (v_floor_ids) AND ar_development_id=p_ar_development_id AND node_id <> ALL (v_keep)
    LOOP
        BEGIN
            DELETE FROM public.node WHERE node_id = v_node_id;
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Node % is still used by another AR version, a beacon assignment or navigation history and cannot be deleted.', v_node_id
                USING ERRCODE = 'NM409';
        END;
    END LOOP;

    -- 5. Cross-floor links (second pass: every node now has an id).
    FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'nodes', '[]'::JSONB)) LOOP
        v_node_id := (v_map ->> (v_rec ->> 'client_id'))::INTEGER;
        v_link_id := NULL;
        IF v_rec ->> 'cross_floor_client_id' IS NOT NULL THEN
            IF NOT (v_map ? (v_rec ->> 'cross_floor_client_id')) THEN
                RAISE EXCEPTION 'A cross-floor link points to a node that is not part of this map.' USING ERRCODE = 'NM422';
            END IF;
            v_link_id := (v_map ->> (v_rec ->> 'cross_floor_client_id'))::INTEGER;
        END IF;
        UPDATE public.node SET node_cross_floor_link_id = v_link_id WHERE node_id = v_node_id;
    END LOOP;

    -- 6. Edges.
    FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'edges', '[]'::JSONB)) LOOP
        IF NOT (v_map ? (v_rec ->> 'from_client_id')) OR NOT (v_map ? (v_rec ->> 'to_client_id')) THEN
            RAISE EXCEPTION 'An edge references a node that is not part of this map.' USING ERRCODE = 'NM422';
        END IF;
        v_from_id := (v_map ->> (v_rec ->> 'from_client_id'))::INTEGER;
        v_to_id   := (v_map ->> (v_rec ->> 'to_client_id'))::INTEGER;
        INSERT INTO public.edge (
            edge_distance, edge_path_type, edge_created_at, edge_updated_at,
            start_node_id, end_node_id, ar_development_id,
            edge_is_accessible, edge_is_cross_floor
        ) VALUES (
            (v_rec ->> 'distance')::DOUBLE PRECISION, v_rec ->> 'path_type', v_now, v_now,
            v_from_id, v_to_id, p_ar_development_id,
            (v_rec ->> 'is_accessible')::BOOLEAN, (v_rec ->> 'is_cross_floor')::BOOLEAN
        );
    END LOOP;

    -- 7. Calibrations: one row per floor per AR development.
    DELETE FROM public.floor_calibration WHERE ar_development_id = p_ar_development_id;
    FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'calibrations', '[]'::JSONB)) LOOP
        IF NOT ((v_rec ->> 'floor_id')::INTEGER = ANY (v_floor_ids)) THEN
            RAISE EXCEPTION 'A calibration references a floor that does not belong to this mall.' USING ERRCODE = 'NM422';
        END IF;
        INSERT INTO public.floor_calibration (
            calibration_ref_start_x, calibration_ref_start_y, calibration_ref_end_x, calibration_ref_end_y,
            calibration_real_meters, calibration_pixel_per_meter, calibration_path_loss_exponent,
            calibration_ref_label, calibration_created_at, calibration_updated_at,
            floor_id, ar_development_id
        ) VALUES (
            (v_rec ->> 'ref_start_x')::DOUBLE PRECISION, (v_rec ->> 'ref_start_y')::DOUBLE PRECISION,
            (v_rec ->> 'ref_end_x')::DOUBLE PRECISION, (v_rec ->> 'ref_end_y')::DOUBLE PRECISION,
            (v_rec ->> 'real_meters')::DOUBLE PRECISION, (v_rec ->> 'pixels_per_meter')::DOUBLE PRECISION,
            (v_rec ->> 'path_loss_exponent')::DOUBLE PRECISION, v_rec ->> 'ref_label',
            v_now, v_now, (v_rec ->> 'floor_id')::INTEGER, p_ar_development_id
        );
    END LOOP;

    -- 8. Keep STORE.STORE_STATUS in step with node mapping (STORE_MAPPING_RULES.md).
    --    'inactive' stores and unit occupancy are never touched.
    UPDATE public.store s
       SET store_status = 'mapped', store_updated_at = v_now
     WHERE s.mall_id = v_mall_id
       AND s.store_status = 'unmapped'
       AND EXISTS (SELECT 1 FROM public.node n WHERE n.store_id = s.store_id);

    UPDATE public.store s
       SET store_status = 'unmapped', store_updated_at = v_now
     WHERE s.mall_id = v_mall_id
       AND s.store_status = 'mapped'
       AND NOT EXISTS (SELECT 1 FROM public.node n WHERE n.store_id = s.store_id);

    UPDATE public.ar_development
       SET ar_development_updated_at = v_now,
           ar_development_map_revision = v_revision + 1
     WHERE ar_development_id = p_ar_development_id;

    RETURN jsonb_build_object('revision', v_revision + 1, 'node_ids', v_map);
END;
$$;

REVOKE ALL ON FUNCTION public.save_node_map(INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_node_map(INTEGER, INTEGER, JSONB) TO service_role;


-- Guard thread writes even when another service writes the tables directly.
CREATE FUNCTION public.guard_workflow_message() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.thread; a public.application; d public.ar_development; who public.admin; BEGIN
 SELECT * INTO STRICT t FROM public.thread WHERE thread_id=NEW.thread_id;
 IF t.application_id IS NULL AND t.ar_development_id IS NULL THEN RETURN NEW; END IF;
 IF t.ar_development_id IS NOT NULL THEN
  SELECT * INTO STRICT d FROM public.ar_development WHERE ar_development_id=t.ar_development_id;
  IF d.ar_development_ready_at IS NULL AND d.ar_development_status NOT IN ('live','unpublished') THEN RAISE EXCEPTION 'AR thread is unavailable before Ready'; END IF;
 END IF;
 SELECT * INTO STRICT a FROM public.application WHERE application_id=coalesce(t.application_id,d.application_id);
 PERFORM 1 FROM public.mall WHERE mall_id=a.mall_id FOR UPDATE;
 SELECT * INTO STRICT who FROM public.admin WHERE admin_id=NEW.message_sender AND NOT admin_is_deactivated AND admin_account_status='official';
 IF who.admin_role NOT IN ('super_admin','mall_admin') OR (who.admin_role='mall_admin' AND who.mall_id IS DISTINCT FROM a.mall_id) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF a.application_status='draft' OR EXISTS(SELECT 1 FROM public.application x WHERE x.mall_id=a.mall_id AND (x.application_version,x.application_attempt)>(a.application_version,a.application_attempt))
 OR EXISTS(SELECT 1 FROM public.ar_development x WHERE x.application_id=a.application_id AND x.ar_development_status IN ('live','unpublished')) THEN RAISE EXCEPTION 'Version is read-only'; END IF;
 IF length(NEW.message_content)>10000 THEN RAISE EXCEPTION 'Message too long'; END IF;
 PERFORM public.workflow_event(a.application_id,NEW.message_sender,'thread_message','A new thread message was posted.',t.ar_development_id);
 RETURN NEW;
END $$;
CREATE TRIGGER guard_workflow_message BEFORE INSERT ON public.thread_message FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_message();
REVOKE ALL ON FUNCTION public.guard_workflow_message() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.claim_ready_reminders() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.ar_development; m bigint; day_due integer; total integer:=0; BEGIN
 FOR d IN SELECT * FROM public.ar_development WHERE ar_development_status='ready' AND ar_development_mall_approved_at IS NULL AND ar_development_ready_at IS NOT NULL FOR UPDATE SKIP LOCKED LOOP
  day_due:=CASE d.ar_development_reminder_count WHEN 0 THEN 3 WHEN 1 THEN 7 ELSE 14*(d.ar_development_reminder_count-1) END;
  IF now()<d.ar_development_ready_at+make_interval(days=>day_due) THEN CONTINUE; END IF;
  SELECT mall_id INTO STRICT m FROM public.application WHERE application_id=d.application_id;
  INSERT INTO public.admin_notification(admin_notif_type,admin_notif_title,admin_notif_message,admin_notif_action_url,admin_notif_source_type,admin_notif_source_id,admin_id,mall_id,admin_notif_created_at,admin_notif_is_read,admin_notif_is_archived)
  SELECT 'ready_reminder','AR awaiting your approval','Please carefully review your Ready AR before approving it.','/ar-development?projectId='||d.ar_development_id,'ar_ready_reminder',d.ar_development_id,admin_id,m,now(),false,false
  FROM public.admin WHERE mall_id=m AND admin_role='mall_admin' AND NOT admin_is_deactivated AND admin_account_status='official';
  INSERT INTO public.email_log(email_log_type,email_log_to_email,email_log_subject,email_log_body,email_log_status,email_log_sent_at,mall_id)
  SELECT 'ar_ready_reminder',admin_email,'NavAR AR ready for review #'||d.ar_development_id,
  'Your AR version '||d.ar_development_version||' is Ready. Please review the AR carefully and approve it in your mall portal, or post concerns in its AR thread.','queued',now(),m
  FROM public.admin WHERE mall_id=m AND admin_role='mall_admin' AND NOT admin_is_deactivated AND admin_account_status='official';
  UPDATE public.ar_development SET ar_development_reminder_count=ar_development_reminder_count+1 WHERE ar_development_id=d.ar_development_id;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.claim_ready_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_reminders() TO service_role;
COMMIT;
