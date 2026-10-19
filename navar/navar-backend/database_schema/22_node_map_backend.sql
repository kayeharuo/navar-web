-- ============================================================
-- 22_node_map_backend.sql
-- Backend support for the AR-development node editor (Edit Map).
--
-- What this does
--   1. NODE  : keeps the source pixel position (so a floor can be
--              re-calibrated without losing precision) and a cross-floor
--              link for stairs / escalators / elevators / ramps.
--   2. EDGE  : accessibility flag, cross-floor flag, no self loops, no
--              duplicate edge between the same two nodes in one AR version.
--   3. AR_DEVELOPMENT : a map revision counter for edit-conflict detection.
--   4. FLOOR_CALIBRATION : path-loss exponent becomes DOUBLE PRECISION (the
--              editor offers 2.5 / 3.5; INTEGER silently rounded them), stores
--              the reference-line label, one row per floor per AR version.
--   5. save_node_map() : saves a whole map in ONE transaction. Only the
--              backend (service_role) may call it.
--
-- Coordinate rules
--   NODE_PIXEL_X/Y      = position in the floor-plan IMAGE, image pixels,
--                         origin top-left, y grows DOWN. Editor-only.
--   NODE_X/Y_COORDINATE = REAL-WORLD METERS, same origin and axes, computed
--                         by the backend: pixel / pixels-per-meter.
--   Unity position      = (x, 0, -y) on the floor_id level. There is no stored
--                         z: the floor is identified by FLOOR_ID and AR gets the
--                         real floor height from plane detection.
--                         See MD files/backend/node-map-backend.md.
--
-- Safe to re-run. Review the existing-data notes at the bottom first.
-- ============================================================

BEGIN;

ALTER TABLE public.node
    ADD COLUMN IF NOT EXISTS node_pixel_x DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS node_pixel_y DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS node_cross_floor_link_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_node_cross_floor_link_id') THEN
        ALTER TABLE public.node
            ADD CONSTRAINT fk_node_cross_floor_link_id
            FOREIGN KEY (node_cross_floor_link_id) REFERENCES public.node(node_id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_node_no_self_link') THEN
        ALTER TABLE public.node
            ADD CONSTRAINT ck_node_no_self_link
            CHECK (node_cross_floor_link_id IS NULL OR node_cross_floor_link_id <> node_id);
    END IF;
END $$;

ALTER TABLE public.edge
    ADD COLUMN IF NOT EXISTS edge_is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS edge_is_cross_floor BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_edge_no_self_loop') THEN
        ALTER TABLE public.edge
            ADD CONSTRAINT ck_edge_no_self_loop CHECK (start_node_id <> end_node_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_edge_path_type') THEN
        ALTER TABLE public.edge
            ADD CONSTRAINT ck_edge_path_type CHECK (edge_path_type IN ('normal', 'accessible', 'restricted'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_edge_distance_positive') THEN
        ALTER TABLE public.edge
            ADD CONSTRAINT ck_edge_distance_positive CHECK (edge_distance >= 0);
    END IF;
END $$;

-- One undirected edge per pair of nodes per AR development.
CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_pair_per_ar_development
    ON public.edge (ar_development_id, LEAST(start_node_id, end_node_id), GREATEST(start_node_id, end_node_id));

CREATE INDEX IF NOT EXISTS ix_node_store_id ON public.node (store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_edge_start_node ON public.edge (start_node_id);
CREATE INDEX IF NOT EXISTS ix_edge_end_node ON public.edge (end_node_id);

-- Bumped on every map save. The editor sends the revision it loaded; a mismatch
-- means someone else saved first (optimistic concurrency, no timestamp rounding).
ALTER TABLE public.ar_development
    ADD COLUMN IF NOT EXISTS ar_development_map_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.floor_calibration
    ALTER COLUMN calibration_path_loss_exponent TYPE DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS calibration_ref_label TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_floor_calibration_ple_range') THEN
        ALTER TABLE public.floor_calibration
            ADD CONSTRAINT ck_floor_calibration_ple_range
            CHECK (calibration_path_loss_exponent IS NULL
                   OR (calibration_path_loss_exponent >= 1 AND calibration_path_loss_exponent <= 6));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_calibration_floor_ar
    ON public.floor_calibration (floor_id, ar_development_id);

-- ------------------------------------------------------------
-- save_node_map
--
-- p_payload is built and validated by the backend, never by the browser:
-- {
--   "floor_ids": [floor_id, ...]   floors in scope for this save
--   "calibrations": [{ floor_id, ref_start_x, ref_start_y, ref_end_x, ref_end_y,
--                      real_meters, pixels_per_meter, path_loss_exponent, ref_label }],
--   "nodes": [{ client_id, node_id|null, floor_id, type, label, pixel_x, pixel_y,
--               x, y, is_accessible, is_store_entrance, store_id, unit_id,
--               cross_floor_client_id|null }],
--   "edges": [{ from_client_id, to_client_id, distance, path_type,
--               is_accessible, is_cross_floor }]
-- }
--
-- SQLSTATE codes mapped by the route:
--   NM404 not found | NM409 conflict (edited elsewhere / node still in use)
--   NM422 not allowed in the current state, or invalid payload
-- ------------------------------------------------------------
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

-- Notes before running on a database that already has map rows:
--   * Existing NODE rows have no pixel position. They keep working in meters
--     (the editor shows them from NODE_X/Y_COORDINATE x pixels-per-meter).
--   * The unique edge index and the CHECK constraints fail if duplicate or
--     self-referencing edges already exist. Find them first with:
--       SELECT ar_development_id, LEAST(start_node_id,end_node_id), GREATEST(start_node_id,end_node_id), COUNT(*)
--         FROM edge GROUP BY 1,2,3 HAVING COUNT(*) > 1;
--   * Check after running:
--       SELECT data_type FROM information_schema.columns
--        WHERE table_name = 'floor_calibration' AND column_name = 'calibration_path_loss_exponent';
--       -> double precision
