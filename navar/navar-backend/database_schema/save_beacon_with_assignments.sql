-- Backend-only transaction: beacon details, version links and current battery.
CREATE OR REPLACE FUNCTION public.save_beacon_with_assignments(
    p_mall_id bigint, p_beacon_id bigint, p_beacon jsonb,
    p_assignments jsonb, p_battery jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
    v_id bigint;
    v_item jsonb;
    v_beacon public.beacon;
    v_now timestamptz := now();
BEGIN
    IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Node assignments must be a list.';
    END IF;
    -- Serialize beacon and assignment writes for this mall.
    PERFORM 1 FROM public.mall WHERE mall_id = p_mall_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mall not found.'; END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_assignments) item
        GROUP BY (item->>'versionId')::bigint HAVING count(*) > 1
    ) THEN RAISE EXCEPTION 'Only one node is allowed per beacon per AR version.'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.node n
            JOIN public.ar_development d ON d.ar_development_id = n.ar_development_id
            JOIN public.application a ON a.application_id = d.application_id
            JOIN public.floor f ON f.floor_id = n.floor_id
            WHERE n.node_id = (v_item->>'nodeId')::bigint
              AND d.ar_development_id = (v_item->>'versionId')::bigint
              AND a.mall_id = p_mall_id AND f.mall_id = p_mall_id
        ) THEN RAISE EXCEPTION 'Node does not belong to this mall and AR version.'; END IF;
    END LOOP;
    v_beacon := jsonb_populate_record(NULL::public.beacon, p_beacon);
    IF v_beacon.floor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.floor WHERE floor_id = v_beacon.floor_id AND mall_id = p_mall_id) THEN
        RAISE EXCEPTION 'Floor does not belong to this mall.';
    END IF;
    IF p_beacon_id IS NULL THEN
        INSERT INTO public.beacon (
            beacon_code, beacon_label, beacon_minor, beacon_tx_power, beacon_status,
            beacon_location, beacon_node_count, beacon_installed_at, beacon_maintained_at, mall_id, floor_id
        ) VALUES (
            v_beacon.beacon_code, v_beacon.beacon_label, v_beacon.beacon_minor, v_beacon.beacon_tx_power, v_beacon.beacon_status,
            v_beacon.beacon_location, jsonb_array_length(p_assignments), v_beacon.beacon_installed_at,
            v_beacon.beacon_maintained_at, p_mall_id, v_beacon.floor_id
        ) RETURNING beacon_id INTO v_id;
        INSERT INTO public.battery (battery_code, battery_brand, battery_status, battery_installed_at, beacon_id)
        VALUES (p_battery->>'battery_code', p_battery->>'battery_brand', 'current', (p_battery->>'battery_installed_at')::timestamptz, v_id);
    ELSE
        UPDATE public.beacon SET
            beacon_code = v_beacon.beacon_code, beacon_label = v_beacon.beacon_label,
            beacon_minor = v_beacon.beacon_minor, beacon_tx_power = v_beacon.beacon_tx_power,
            beacon_location = v_beacon.beacon_location, beacon_node_count = jsonb_array_length(p_assignments),
            beacon_installed_at = v_beacon.beacon_installed_at, beacon_maintained_at = v_beacon.beacon_maintained_at,
            floor_id = v_beacon.floor_id
        WHERE beacon_id = p_beacon_id AND mall_id = p_mall_id RETURNING beacon_id INTO v_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Beacon does not belong to this mall.'; END IF;
        UPDATE public.battery SET battery_brand = p_battery->>'battery_brand',
            battery_installed_at = (p_battery->>'battery_installed_at')::timestamptz
        WHERE beacon_id = v_id AND battery_status = 'current';
    END IF;
    DELETE FROM public.beacon_node_assignment assignment WHERE assignment.beacon_id = v_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) item
          WHERE (item->>'versionId')::bigint = assignment.ar_development_id);
    INSERT INTO public.beacon_node_assignment (
        beacon_id, node_id, ar_development_id, assignment_created_at, assignment_updated_at
    ) SELECT v_id, (item->>'nodeId')::bigint, (item->>'versionId')::bigint, v_now, v_now
      FROM jsonb_array_elements(p_assignments) item
    ON CONFLICT (ar_development_id, beacon_id)
    DO UPDATE SET node_id = EXCLUDED.node_id, assignment_updated_at = EXCLUDED.assignment_updated_at;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_beacon_with_assignments(bigint,bigint,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_beacon_with_assignments(bigint,bigint,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
