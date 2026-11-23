import { autoConnect } from "./autoConnections.js";

// A global save includes the same pending fields that the editor previews.
export function prepareDraft(snapshot, floorMeta, { floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty }) {
    let nodes = snapshot.nodes;
    let calibration = snapshot.calibration;
    if (nodeEditsDirty && nodeEdits && selectedId) {
        nodes = { ...nodes, [floor]: (nodes[floor] || []).map(n => n.id === selectedId ? { ...nodeEdits, x: n.x, y: n.y } : n) };
    }
    if (calibrationEditsDirty && calibrationEdits && calibration[floor]) {
        const meters = Number(calibrationEdits.meters), pathLossExponent = Number(calibrationEdits.pathLossExponent);
        if (!Number.isFinite(meters) || meters <= 0) throw new Error(`${floor}: real distance must be greater than zero.`);
        if (!Number.isFinite(pathLossExponent) || pathLossExponent < 1 || pathLossExponent > 6) throw new Error(`${floor}: path loss exponent must be between 1 and 6.`);
        const previous = calibration[floor];
        calibration = { ...calibration, [floor]: { ...previous, refLine: calibrationEdits.refLine.trim(), meters, pathLossExponent, pxPerMeter: Math.hypot(previous.refEnd.x-previous.refStart.x, previous.refEnd.y-previous.refStart.y)/meters } };
    }
    return autoConnect({ ...snapshot, nodes, calibration }, floorMeta);
}

