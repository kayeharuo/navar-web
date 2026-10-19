import { apiRequest } from "../../config/api";
import { setEditorCatalog } from "./editorConstants";

// Everything the editor needs to talk to the backend lives here:
//   loadNodeMap -> turns the server response into the editor's per-floor snapshot
//   buildSaveBody / saveNodeMap -> turns the snapshot back into the request body
// The editor works in IMAGE PIXELS only. Meters are computed by the backend.

const catalog = { unitIdByKey: new Map(), stallIdByName: new Map() };
const unitKey = (floor, unit) => `${floor}::${unit}`;

export const dbNodeId = (id) => `db${id}`;
export const dbEdgeId = (id) => `dbe${id}`;

function uniqueFloorLabels(floors) {
    const seen = new Map();
    return floors.map(f => {
        const base = (f.label || `Floor ${f.floorNum}`).trim();
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        return n === 1 ? base : `${base} (${f.floorNum})`;
    });
}

export async function loadNodeMap(arDevelopmentId) {
    const data = await apiRequest(`/api/ar-developments/${arDevelopmentId}/node-map`);
    const labels = uniqueFloorLabels(data.floors);
    const labelByFloorId = new Map(data.floors.map((f, i) => [f.floorId, labels[i]]));
    const floorMeta = {};
    data.floors.forEach((f, i) => {
        floorMeta[labels[i]] = { floorId: f.floorId, imageUrl: f.imageUrl, submittedReference: f.submittedReference };
    });

    const storeUnits = data.units.map(u => ({
        unit: u.unitLabel, brand: u.storeName, name: u.storeName, floor: labelByFloorId.get(u.floorId), unitId: u.unitId,
    })).filter(u => u.floor);
    catalog.unitIdByKey = new Map(storeUnits.map(u => [unitKey(u.floor, u.unit), u.unitId]));
    catalog.stallIdByName = new Map(data.stalls.map(s => [s.storeName, s.storeId]));
    setEditorCatalog({ floors: labels, storeUnits, stallStores: data.stalls.map(s => s.storeName) });

    const unitLabelById = new Map(data.units.map(u => [u.unitId, u.unitLabel]));
    const stallNameById = new Map(data.stalls.map(s => [s.storeId, s.storeName]));
    const nodes = {}, edges = {}, calibration = {};
    for (const label of labels) {
        nodes[label] = [];
        edges[label] = [];
        calibration[label] = null;
    }
    const floorOfNode = new Map();
    for (const n of data.nodes) {
        const label = labelByFloorId.get(n.floorId);
        if (!label) continue;
        floorOfNode.set(n.dbId, label);
        nodes[label].push({
            id: dbNodeId(n.dbId), dbId: n.dbId, x: n.pixelX, y: n.pixelY, type: n.type, label: n.label, floor: label,
            related_store_id: n.type === "STORE_ENTRANCE" ? unitLabelById.get(n.unitId) ?? null : null,
            stall_name: n.type === "STALL" ? stallNameById.get(n.storeId) : undefined,
            isPwd: Boolean(n.isAccessible), status: "active",
            cross_floor_link: n.crossFloorDbId ? dbNodeId(n.crossFloorDbId) : null,
        });
    }
    for (const e of data.edges) {
        const label = floorOfNode.get(e.fromDbId);
        if (!label || floorOfNode.get(e.toDbId) !== label) continue;
        edges[label].push({ id: dbEdgeId(e.dbId), from: dbNodeId(e.fromDbId), to: dbNodeId(e.toDbId), floor: label, path_type: e.pathType, distance_value: e.distance });
    }
    data.floors.forEach((f, i) => {
        const c = f.calibration;
        if (c && c.pixelsPerMeter && c.refStart?.x != null) {
            calibration[labels[i]] = { pxPerMeter: c.pixelsPerMeter, refLine: c.refLine || "", meters: c.meters, pathLossExponent: c.pathLossExponent, refStart: c.refStart, refEnd: c.refEnd };
        }
    });
    return {
        meta: { arDevelopmentId: data.arDevelopmentId, mallName: data.mallName, status: data.status, revision: data.revision },
        floorMeta,
        snapshot: { nodes, edges, calibration },
    };
}

// dbIds: Map(editor node id -> database id) for nodes created earlier in this session.
export function buildSaveBody(snapshot, floorMeta, { baseRevision, finalize, dbIds }) {
    const calibrations = [], nodes = [], edges = [];
    for (const [label, meta] of Object.entries(floorMeta)) {
        const c = snapshot.calibration[label];
        if (c && c.refStart && c.refEnd) {
            calibrations.push({ floorId: meta.floorId, refStart: c.refStart, refEnd: c.refEnd, meters: c.meters, pathLossExponent: c.pathLossExponent, refLine: c.refLine || "" });
        }
        for (const n of snapshot.nodes[label] || []) {
            nodes.push({
                clientId: n.id, dbId: n.dbId ?? dbIds.get(n.id) ?? null, floorId: meta.floorId, type: n.type, label: n.label,
                pixelX: n.x, pixelY: n.y, isAccessible: Boolean(n.isPwd),
                unitId: n.type === "STORE_ENTRANCE" ? catalog.unitIdByKey.get(unitKey(label, n.related_store_id)) ?? null : null,
                storeId: n.type === "STALL" ? catalog.stallIdByName.get(n.stall_name) ?? null : null,
                crossFloorClientId: n.cross_floor_link || null,
            });
        }
        for (const e of snapshot.edges[label] || []) {
            edges.push({ fromClientId: e.from, toClientId: e.to, pathType: e.path_type });
        }
    }
    return { baseRevision, finalize: Boolean(finalize), calibrations, nodes, edges };
}

export function saveNodeMap(arDevelopmentId, body) {
    return apiRequest(`/api/ar-developments/${arDevelopmentId}/node-map`, { method: "PUT", body: JSON.stringify(body) });
}

// Edge length in meters from two node positions and the floor scale (2 decimals).
export function edgeMeters(a, b, pxPerMeter) {
    if (!pxPerMeter) return null;
    return Math.round((Math.hypot(b.x - a.x, b.y - a.y) / pxPerMeter) * 100) / 100;
}

// Recomputes distance_value after a node moved or the scale changed, so the numbers on
// screen always match the geometry. Pass onlyNodeId to touch just the edges of one node.
export function withFreshDistances(floorEdges, floorNodes, pxPerMeter, onlyNodeId) {
    const byId = new Map(floorNodes.map(n => [n.id, n]));
    return floorEdges.map(e => {
        if (onlyNodeId && e.from !== onlyNodeId && e.to !== onlyNodeId) return e;
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return e;
        return { ...e, distance_value: edgeMeters(a, b, pxPerMeter) };
    });
}
