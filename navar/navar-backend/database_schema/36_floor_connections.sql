-- Run once after 22_node_map_backend.sql. Deploy backend/frontend together.
-- Transactional: preserves existing cross-floor edges and legacy node links.
BEGIN;
ALTER TABLE public.node ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.node ADD COLUMN IF NOT EXISTS node_transition_group VARCHAR(100);
ALTER TABLE public.edge ADD COLUMN IF NOT EXISTS edge_direction TEXT NOT NULL DEFAULT 'both'
    CHECK (edge_direction IN ('both', 'forward', 'reverse'));

-- Recover any legacy partner connections not already represented by edges.
INSERT INTO public.edge (start_node_id, end_node_id, ar_development_id, edge_distance,
    edge_path_type, edge_created_at, edge_updated_at, edge_is_accessible, edge_is_cross_floor)
SELECT DISTINCT LEAST(n.node_id, t.node_id), GREATEST(n.node_id, t.node_id), n.ar_development_id,
    CASE n.node_type WHEN 'ELEVATOR' THEN 8 WHEN 'ESCALATOR' THEN 10 WHEN 'RAMP' THEN 20 ELSE 12 END,
    CASE WHEN n.node_type IN ('ELEVATOR','RAMP') THEN 'accessible' ELSE 'normal' END,
    now(), now(), n.node_type IN ('ELEVATOR','RAMP'), TRUE
FROM public.node n JOIN public.node t ON t.node_id = n.node_cross_floor_link_id
WHERE n.ar_development_id = t.ar_development_id AND n.floor_id <> t.floor_id
AND NOT EXISTS (SELECT 1 FROM public.edge e WHERE e.ar_development_id=n.ar_development_id
    AND LEAST(e.start_node_id,e.end_node_id)=LEAST(n.node_id,t.node_id)
    AND GREATEST(e.start_node_id,e.end_node_id)=GREATEST(n.node_id,t.node_id));

-- A shared generated group keeps existing connected landings editable.
WITH RECURSIVE reach(root, id) AS (
    SELECT node_id, node_id FROM public.node WHERE node_type IN ('STAIRS','ELEVATOR','ESCALATOR','RAMP')
    UNION
    SELECT r.root, CASE WHEN e.start_node_id=r.id THEN e.end_node_id ELSE e.start_node_id END
    FROM reach r JOIN public.edge e ON (e.start_node_id=r.id OR e.end_node_id=r.id)
    WHERE e.edge_is_cross_floor
), groups AS (SELECT id, min(root) AS group_id FROM reach GROUP BY id)
UPDATE public.node n SET node_transition_group = n.node_type || ' ' || g.group_id
FROM groups g WHERE n.node_id=g.id AND n.node_transition_group IS NULL;

-- Fail rather than silently delete conflicting historical duplicate edges.
CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_map_pair ON public.edge
    (ar_development_id, LEAST(start_node_id,end_node_id), GREATEST(start_node_id,end_node_id));

CREATE OR REPLACE FUNCTION public.save_node_map(p_ar_development_id integer, p_base_revision integer, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                node_transition_group = v_rec ->> 'transition_group',
                is_emergency = COALESCE((v_rec ->> 'is_emergency')::BOOLEAN, FALSE),
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
                node_label, node_type, node_transition_group, is_emergency, node_x_coordinate, node_y_coordinate,
                node_pixel_x, node_pixel_y, node_is_store_entrance, node_is_accessible,
                node_created_at, node_updated_at, floor_id, store_id, unit_id, ar_development_id
            ) VALUES (
                v_rec ->> 'label', v_rec ->> 'type', v_rec ->> 'transition_group', COALESCE((v_rec ->> 'is_emergency')::BOOLEAN, FALSE),
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
    DELETE FROM public.beacon_node_assignment a
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
            edge_is_accessible, edge_is_cross_floor, edge_direction
        ) VALUES (
            (v_rec ->> 'distance')::DOUBLE PRECISION, v_rec ->> 'path_type', v_now, v_now,
            v_from_id, v_to_id, p_ar_development_id,
            (v_rec ->> 'is_accessible')::BOOLEAN, (v_rec ->> 'is_cross_floor')::BOOLEAN, COALESCE(v_rec ->> 'direction', 'both')
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
$function$;

REVOKE ALL ON FUNCTION public.save_node_map(INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_node_map(INTEGER, INTEGER, JSONB) TO service_role;
ALTER TABLE public.node DROP COLUMN IF EXISTS node_cross_floor_link_id;
NOTIFY pgrst, 'reload schema';
COMMIT;
