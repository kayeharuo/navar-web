-- MANUAL rollback only. Stop the backend and restore the previous code first.
-- Intended for immediate rollback before using the new workflow.
-- For rollback after real workflow activity, restore a pre-migration database backup.
-- This does not undo data changes performed after migration 23.
BEGIN;
LOCK TABLE public.application,public.ar_development,public.node IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.audit_log WHERE audit_log_module='application_ar') OR EXISTS(SELECT 1 FROM public.application WHERE application_attempt>1) THEN
 RAISE EXCEPTION 'Workflow has been used. Restore the pre-migration backup instead of dropping workflow history'; END IF;
 IF EXISTS(SELECT 1 FROM public.node n JOIN public.floor f USING(floor_id) GROUP BY f.mall_id HAVING count(DISTINCT n.ar_development_id)>1) THEN
 RAISE EXCEPTION 'Multiple node versions exist. Restore the pre-migration backup'; END IF;
END $$;
DROP TRIGGER guard_workflow_message ON public.thread_message;
DROP FUNCTION public.guard_workflow_message();
DROP FUNCTION public.claim_ready_reminders();
DROP FUNCTION public.ensure_application_thread(bigint);
DROP FUNCTION public.workflow_action(bigint,bigint,text,text,text);
DROP FUNCTION public.workflow_event(bigint,bigint,text,text,bigint);
DROP TRIGGER snapshot_map_allowance ON public.contract;
DROP FUNCTION public.snapshot_map_allowance();
ALTER TABLE public.ar_development DROP CONSTRAINT ar_workflow_status;
UPDATE public.ar_development SET ar_development_status='suspended' WHERE ar_development_status='on_hold';
ALTER TABLE public.edge DROP CONSTRAINT edge_start_node_same_version,DROP CONSTRAINT edge_end_node_same_version;
ALTER TABLE public.beacon_node_assigment DROP CONSTRAINT assignment_node_same_version,DROP CONSTRAINT assignment_one_node_per_beacon_per_version;
ALTER TABLE public.node DROP CONSTRAINT node_cross_floor_same_version,DROP CONSTRAINT node_id_ar_development_key,DROP COLUMN ar_development_id;
CREATE UNIQUE INDEX uq_application_mall_version ON public.application(mall_id,application_version);
ALTER TABLE public.application DROP CONSTRAINT application_mall_version_attempt_key,DROP CONSTRAINT application_attempt_positive,DROP CONSTRAINT application_dispute_limit,
 DROP COLUMN application_attempt,DROP COLUMN application_reason_category,DROP COLUMN application_reason_notes,DROP COLUMN application_accepted_at,DROP COLUMN application_dispute_count;
ALTER TABLE public.ar_development DROP COLUMN ar_development_resume_status,DROP COLUMN ar_development_ready_at,DROP COLUMN ar_development_reminder_count,DROP COLUMN ar_development_mall_approved_at,DROP COLUMN ar_development_unpublish_reason;
ALTER TABLE public.contract DROP COLUMN contract_map_updates_per_year;
-- RLS stays enabled. Do not weaken deny-by-default access during rollback.
-- Empty AR threads created by the migration remain harmless history.
DO $$ BEGIN
 IF current_setting('navar.rollback_tiers_restored',true) IS DISTINCT FROM 'true' THEN
 RAISE EXCEPTION 'Paste the saved rollback_tier_sql statements above this block, then SET LOCAL navar.rollback_tiers_restored = true'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_application_version_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    latest_id INTEGER;
    latest_version INTEGER;
BEGIN
    SELECT application_id, application_version
      INTO latest_id, latest_version
      FROM public.application
     WHERE mall_id = NEW.mall_id
     ORDER BY application_version DESC
     LIMIT 1;

    -- First application for this mall: always allowed.
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NOT public.application_was_published(latest_id) THEN
        RAISE EXCEPTION 'A new application version cannot be submitted until the AR development for version % has been published.', latest_version
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

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
    IF lower(v_status) <> 'node_mapping' THEN
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
               AND floor_id = ANY (v_floor_ids)
            RETURNING node_id INTO v_node_id;

            IF v_node_id IS NULL THEN
                RAISE EXCEPTION 'Node % does not exist in this mall.', v_rec ->> 'node_id' USING ERRCODE = 'NM422';
            END IF;
        ELSE
            INSERT INTO public.node (
                node_label, node_type, node_x_coordinate, node_y_coordinate,
                node_pixel_x, node_pixel_y, node_is_store_entrance, node_is_accessible,
                node_created_at, node_updated_at, floor_id, store_id, unit_id
            ) VALUES (
                v_rec ->> 'label', v_rec ->> 'type',
                (v_rec ->> 'x')::DOUBLE PRECISION, (v_rec ->> 'y')::DOUBLE PRECISION,
                (v_rec ->> 'pixel_x')::DOUBLE PRECISION, (v_rec ->> 'pixel_y')::DOUBLE PRECISION,
                (v_rec ->> 'is_store_entrance')::BOOLEAN, (v_rec ->> 'is_accessible')::BOOLEAN,
                v_now, v_now, (v_rec ->> 'floor_id')::INTEGER,
                NULLIF(v_rec ->> 'store_id', '')::INTEGER, NULLIF(v_rec ->> 'unit_id', '')::INTEGER
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
         WHERE floor_id = ANY (v_floor_ids) AND node_id <> ALL (v_keep)
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

COMMIT;
