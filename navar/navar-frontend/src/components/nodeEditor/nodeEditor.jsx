import { prepareDraft } from "./prepareDraft";
import { apiRequest } from "../../config/api";
import { EditorBeacons } from './components/EditorBeacons';
import { MapSnapshots } from './components/MapSnapshots';
import { LoaderCircle } from 'lucide-react';
import { planNodeDeletion, findBeaconAssignmentChanges, getBeaconAssignmentIssues } from './beaconChanges';
import { notifyMallBeaconsUpdated } from '../../utils/mallDataEvents';
import { snapshotContent } from './snapshotContent';
import { autoConnect } from "./autoConnections";
import { TransitionGroupPicker } from "./components/TransitionGroupPicker";
import { FloorConnections } from "./components/FloorConnections";
import { EmergencyToggle } from "./components/EmergencyToggle";
import "./nodeEditor.css";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { preserveCurrentSnapshot } from './snapshotPreservation';
import { NodeCanvas } from "./components/NodeCanvas";
import { PlaceModal } from "./components/PlaceModal";
import { CalibrationModal } from "./components/CalibrationModal";
import { DataTable } from "./components/DataTable";
import { useHistory } from "./hooks/useHistory";
import { C, F, M, NODE_TYPES, NODE_GROUPS, PATH_TYPE, FLOORS, STORE_UNITS, stallStoresForFloor, formatStore, uid, } from "./editorConstants";
import { loadNodeMap, buildSaveBody, saveNodeMap, edgeMeters, withFreshDistances } from "./mapApi";
import { useFloorImage } from "./hooks/useFloorImage";
// The map is editable only while the AR development is in Node Mapping. The status
// comes from the server; the editor never changes it.
const STATUS_CONFIG = {
    node_mapping: { label: "Node Mapping", short: "Node Mapping", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", icon: "🗺️", editable: true },
    navigation_testing: { label: "Navigation Testing", short: "Nav Testing", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: "🧭", editable: false },
    ready_for_activation: { label: "Ready for Activation", short: "Ready", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "✅", editable: false },
    live: { label: "Live", short: "Live", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "🟢", editable: false },
};
const STATUS_ORDER = ["node_mapping", "navigation_testing", "ready_for_activation", "live"];
const LOCKED_STATUS = { label: "Locked", short: "Locked", color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1", icon: "🔒", editable: false };
const statusConfigFor = (status) => STATUS_CONFIG[status] || { ...LOCKED_STATUS, label: String(status || "locked").replace(/_/g, " "), short: String(status || "locked").replace(/_/g, " ") };
function validateTransitions(nodes, edges, groups) {
    const connections = edges.__crossFloor || [];
    return Object.entries(nodes).flatMap(([floor, list]) => list.filter(n => NODE_TYPES[n.type]?.isFloorTransition && (!groups.some(g => g.id === n.transition_group_id && g.type === n.type) || !connections.some(e => e.from === n.id || e.to === n.id))).map(n => ({ floor, nodeId: n.id, label: n.label, type: n.type, reason: !groups.some(g => g.id === n.transition_group_id && g.type === n.type) ? "Missing transition group: select or create one in Node Properties." : "No matching landing: add this group on the neighboring floor (or next served elevator floor)." })));
}
// ── Shared atoms ──────────────────────────────────────────────────────────────
const SecHead = ({ children, color }) => (<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 12 }}>
    <div style={{ width: 3, height: 12, borderRadius: 2, background: color || C.blue }}/>
    <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M }}>
      {children}
    </span>
  </div>);
const CoordinateInput = ({ value, onChange, ...props }) => {
    const [draft, setDraft] = useState(null);
    const shown = draft && draft.value === value ? draft.text : Number(value.toFixed(2));
    return <input {...props} value={shown} onChange={e => {
        const text = e.target.value;
        const number = e.target.valueAsNumber;
        setDraft({ value: Number.isFinite(number) ? number : value, text });
        if (text !== "" && Number.isFinite(number)) onChange(number);
    }} onBlur={() => setDraft(null)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />;
};
const PathBadge = ({ type, sm }) => {
    const pt = PATH_TYPE[type] || PATH_TYPE.normal;
    return (<span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: sm ? 10 : 11, fontWeight: 700, fontFamily: M,
            color: pt.badgeTxt, background: pt.badge, border: `1px solid ${pt.color}30`,
            padding: sm ? "1px 8px" : "2px 10px", borderRadius: 5, whiteSpace: "nowrap",
        }}>
      {pt.label}
    </span>);
};
const Toast = ({ msg, color }) => (<div style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
        background: color, color: "#fff", padding: "10px 20px",
        borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: F,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 9999,
        pointerEvents: "none", whiteSpace: "nowrap",
    }}>{msg}</div>);
const ConfirmModal = ({ title, body, confirmLabel, confirmColor, onConfirm, onCancel }) => (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8000 }}>
    <div style={{ background: "#fff", borderRadius: 14, padding: "28px 28px 22px", width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", fontFamily: F }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 22 }}>{body}</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#F8FAFC", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: confirmColor, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>{confirmLabel}</button>
      </div>
    </div>
  </div>);
// Transition validation warning modal
const TransitionWarningModal = ({ issues, onClose }) => (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8100 }}>
    <div style={{ background: "#fff", borderRadius: 14, padding: "26px 28px 22px", width: 500, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.28)", fontFamily: F }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#FEF2F2", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚠️</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#DC2626" }}>Cannot Save — Floor Transitions Unlinked</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Every floor transition node must be connected to a counterpart on another floor.</div>
        </div>
      </div>
      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, padding: "12px 14px", marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
        {issues.map((iss, i) => (<div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: i < issues.length - 1 ? "1px solid #FECACA" : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, flexShrink: 0, marginTop: 4 }}/>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", fontFamily: F }}>{iss.label}</div>
              <div style={{ fontSize: 10, color: "#64748B", fontFamily: M }}>{iss.floor} · {iss.nodeId} · {NODE_TYPES[iss.type]?.label}</div>
              <div style={{ fontSize: 10, color: C.red, fontFamily: M, marginTop: 1 }}>{iss.reason}</div>
            </div>
          </div>))}
      </div>
      <div style={{ fontSize: 11, color: "#64748B", fontFamily: M, marginBottom: 16, lineHeight: 1.6 }}>
        Assign each landing to a group and place its matching landing on another floor. Connections are created automatically.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 8, background: C.red, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
          Go Fix Issues
        </button>
      </div>
    </div>
  </div>);
const IconBtn = ({ onClick, disabled, title, children, active }) => (<button onClick={onClick} disabled={disabled} title={title} style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 5, padding: "5px 11px", borderRadius: 7,
        border: `1px solid ${active ? C.blue : C.border}`,
        background: active ? C.blueL : C.white,
        color: disabled ? "#CBD5E1" : active ? C.blue : "#334155",
        fontSize: 11, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: F, transition: "all 0.12s",
    }}>{children}</button>);
// ── Edge properties panel ─────────────────────────────────────────────────────
const EdgePanel = ({ edge, nodes, onChangeType, onDelete, locked }) => {
    const pt = PATH_TYPE[edge.path_type] || PATH_TYPE.normal;
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    return (<>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 22, height: 4, background: pt.color, borderRadius: 2, flexShrink: 0 }}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: pt.badgeTxt, fontFamily: M }}>EDGE · {edge.path_type.toUpperCase()}</span>
      </div>
      <SecHead color={pt.color}>Path Type</SecHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        {Object.entries(PATH_TYPE).map(([k, v]) => (<button key={k} onClick={() => !locked && onChangeType(k)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6,
                border: `1.5px solid ${edge.path_type === k ? v.color : C.border}`,
                background: edge.path_type === k ? `${v.color}12` : C.white,
                cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1,
            }}>
            <div style={{ width: 20, height: 3, background: edge.path_type === k ? v.color : "#CBD5E1", borderRadius: 2, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, fontWeight: edge.path_type === k ? 700 : 500, color: edge.path_type === k ? v.badgeTxt : "#475569", fontFamily: F }}>{v.label}</span>
          </button>))}
      </div>
      <SecHead color="#94A3B8">Nodes</SecHead>
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 10, fontSize: 12, fontFamily: F }}>
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#64748B", fontFamily: M }}>FROM</span>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>{fromNode?.label || edge.from}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: M }}>{edge.from}</div>
        </div>
        <div style={{ width: "100%", height: 1, background: C.line, margin: "5px 0" }}/>
        <div>
          <span style={{ fontSize: 10, color: "#64748B", fontFamily: M }}>TO</span>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>{toNode?.label || edge.to}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: M }}>{edge.to}</div>
        </div>
      </div>
      {edge.distance_value != null && (<>
          <SecHead color="#94A3B8">Distance</SecHead>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", fontFamily: M, marginBottom: 10 }}>
            {edge.distance_value.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400, color: "#64748B" }}>m</span>
          </div>
        </>)}
      {!locked && (<div style={{ marginTop: 8 }}>
          <button onClick={onDelete} style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
            Delete Edge
          </button>
        </div>)}
    </>);
};
// Shows why a save was refused (red) or what to double-check on a map that was saved (amber).
const SaveProblemsModal = ({ problems, onClose }) => {
    const tone = problems.tone === "warn" ? { c: "#B45309", bg: "#FFFBEB", border: "#FDE68A", icon: "⚠️" } : { c: C.red, bg: "#FEF2F2", border: "#FECACA", icon: "⛔" };
    return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8100 }}>
    <div style={{ background: "#fff", borderRadius: 14, padding: "24px 26px 20px", width: 560, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.28)", fontFamily: F }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: tone.c, marginBottom: 12 }}>{tone.icon} {problems.title}</div>
      <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 9, padding: "10px 14px", maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
        {problems.items.map((t, i) => (<div key={i} style={{ fontSize: 12, color: "#0F172A", padding: "5px 0", borderBottom: i < problems.items.length - 1 ? `1px solid ${tone.border}` : "none", lineHeight: 1.5 }}>{t}</div>))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 8, background: tone.c, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>OK</button>
      </div>
    </div>
  </div>);
};
// ── Main ──────────────────────────────────────────────────────────────────────
function NodeEditorWorkspace({ projectId, mallName, onBack, initial }) {
    const { snapshot, push: historyPush, replace: historyReplace, undo, redo, canUndo, canRedo } = useHistory(autoConnect(initial.snapshot, initial.floorMeta));
    const push = useCallback(next => historyPush(autoConnect({ ...next, groups: next.groups ?? snapshot.groups ?? [], beacons: next.beacons ?? snapshot.beacons ?? [] }, initial.floorMeta)), [historyPush, snapshot.groups, snapshot.beacons, initial.floorMeta]);
    const replace = next => historyReplace(autoConnect({ ...next, groups: next.groups ?? snapshot.groups ?? [], beacons: next.beacons ?? snapshot.beacons ?? [] }, initial.floorMeta));
    const { floorMeta } = initial;
    // The status and revision come from the server. The revision is how the backend
    // detects that someone else saved the map first.
    const projectStatus = initial.meta.status;
    const revision = useRef(initial.meta.revision);
    const beaconRevision = useRef(initial.meta.beaconRevision);
    const beaconDbIds = useRef(new Map());
    const appliedBeacons = useRef(initial.snapshot.beacons || []);
    const appliedContent = useRef(snapshotContent(buildSaveBody(initial.snapshot, floorMeta, { baseRevision: initial.meta.revision, finalize: true, dbIds: new Map() })));
    const [matchingSnapshot, setMatchingSnapshot] = useState(null);
    const [beaconPanel, setBeaconPanel] = useState(false);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const [beaconRemovalWarning, setBeaconRemovalWarning] = useState(null);
    const [nodeDeleteWarning, setNodeDeleteWarning] = useState(null);
    const [needsSnapshot, setNeedsSnapshot] = useState(false);
    const dbIds = useRef(new Map());
    const [savedAt, setSavedAt] = useState(null);
    const [unsaved, setUnsaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savePhase, setSavePhase] = useState('checking');
    const [snapshotPanel, setSnapshotPanel] = useState(false);
    const [namedSnapshots, setNamedSnapshots] = useState([]);
    const [snapshotName, setSnapshotName] = useState("");
    const [snapshotBusy, setSnapshotBusy] = useState(false);
    const [snapshotError, setSnapshotError] = useState("");
    const [restoreTarget, setRestoreTarget] = useState(null);
    const [restoreCheck, setRestoreCheck] = useState({ status: 'idle', match: null });
    const [confirmAction, setConfirmAction] = useState(null);
    const [transitionIssues, setTransitionIssues] = useState(null);
    const [saveProblems, setSaveProblems] = useState(null);
    const statusCfg = statusConfigFor(projectStatus);
    const isLocked = !statusCfg.editable;
    // ── View state ──
    const [floor, setFloor] = useState(FLOORS[0]);
    const [edMode, setEdMode] = useState("select");
    const [calibPts, setCalibPts] = useState([]);
    const [calibModal, setCalibModal] = useState(false);
    const [showData, setShowData] = useState(false);
    const [toast, setToast] = useState(null);
    // ── Node mode state ──
    const [selectedId, setSelectedId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const setSelId = useCallback((id) => { setSelectedId(id); setSelectedIds(id ? [id] : []); }, []);
    const [clipboard, setClipboard] = useState(null);
    const pasteCount = useRef(0);
    const [selectedEdgeId, setSelEdgeId] = useState(null);
    const [calibrationSelected, setCalibrationSelected] = useState(false);
    const [calibrationEdits, setCalibrationEdits] = useState(null);
    const [calibrationEditsDirty, setCalibrationEditsDirty] = useState(false);
    const [calibrationError, setCalibrationError] = useState("");
    const [connectFrom, setConnFrom] = useState(null);
    const [pathType, setPathType] = useState("normal");
    const [placeModal, setPlaceModal] = useState(null);
    const dragInProgress = useRef(false);
    const [dragNodes, setDragNodes] = useState(null);
    const [dragCalibration, setDragCalibration] = useState(null);
    // ── Node properties local edit state ──
    const [nodeEdits, setNodeEdits] = useState(null);
    const [nodeEditsDirty, setNodeEditsDirty] = useState(false);
    const [labelError, setLabelError] = useState(false);
    const { nodes, edges, calibration } = snapshot;
    const floorCalib = calibration[floor];
    const activeFloorCalib = dragCalibration || floorCalib;
    const floorNodes = nodes[floor] || [];
    const floorEdges = withFreshDistances(edges[floor] || [], (dragNodes ?? nodes)[floor] || [], activeFloorCalib?.pxPerMeter);
    const selNode = floorNodes.find(n => n.id === selectedId) || null;
    const selEdge = floorEdges.find(e => e.id === selectedEdgeId) || null;
    const totalNodes = Object.values(nodes).flat().length;
    const totalEdges = Object.values(edges).flat().length;
    const accEdges = Object.values(edges).flat().filter(e => e.path_type === "accessible").length;
    const liveNodes = dragNodes ?? nodes;
    const liveFloorNodes = liveNodes[floor] || [];
    // Canvas nodes: preview staged properties without overriding live drag coordinates.
    const canvasFloorNodes = (nodeEdits && selectedId)
        ? liveFloorNodes.map(n => n.id === selectedId ? { ...nodeEdits, x: n.x, y: n.y } : n)
        : liveFloorNodes;
    const showToast = useCallback((msg, color = C.green) => {
        setToast({ msg, color });
        setTimeout(() => setToast(null), 2800);
    }, []);
    useEffect(() => {
        if (!calibrationSelected || !floorCalib) {
            setCalibrationEdits(null);
            setCalibrationEditsDirty(false);
            setCalibrationError("");
            return;
        }
        setCalibrationEdits({ refLine: floorCalib.refLine || "", meters: String(floorCalib.meters ?? ""), pathLossExponent: String(floorCalib.pathLossExponent ?? "") });
        setCalibrationEditsDirty(false);
        setCalibrationError("");
    }, [calibrationSelected, floor, floorCalib]);
    const firstSnapshot = useRef(true);
    const replacingAfterSave = useRef(false);
    useEffect(() => {
        if (firstSnapshot.current) {
            firstSnapshot.current = false;
            return;
        }
        if (replacingAfterSave.current) {
            replacingAfterSave.current = false;
            return;
        }
        setUnsaved(true);
    }, [snapshot]);
    // Warn before leaving with changes that were never saved.
    useEffect(() => {
        if (!unsaved && !nodeEditsDirty && !calibrationEditsDirty)
            return;
        const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [unsaved, nodeEditsDirty, calibrationEditsDirty]);
    const floorImage = useFloorImage(floorMeta[floor]?.imageUrl);
    useEffect(() => { setDragNodes(null); }, [snapshot]);
    // Sync nodeEdits when selection changes
    useEffect(() => {
        if (selectedId) {
            const node = (nodes[floor] || []).find(n => n.id === selectedId);
            setNodeEdits(node ? { ...node } : null);
        }
        else {
            setNodeEdits(null);
        }
        setNodeEditsDirty(false);
        setLabelError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);
    // ── Persistence: everything goes through the backend, which re-validates and re-computes ──
    const persist = useCallback(async (finalize, confirmAssignmentRemoval = false, chosenMatch = null) => {
        if (isLocked || saving)
            return false;
        setSavePhase(chosenMatch ? 'applying' : 'checking');
        setSaving(true);
        try {
            const draft = prepareDraft({ nodes: liveNodes, edges, calibration, groups: snapshot.groups, beacons: snapshot.beacons }, floorMeta, { floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty });
            const body = buildSaveBody(draft, floorMeta, { baseRevision: revision.current, finalize, dbIds: dbIds.current });
            const content = snapshotContent(body);
            if (!chosenMatch || chosenMatch.content !== content) {
                const { match, revision: latestRevision, beaconRevision: latestBeaconRevision } = await apiRequest(`/api/ar-developments/${projectId}/node-map/snapshots/match`, { method: 'POST', body: JSON.stringify(body) });
                if (latestRevision !== revision.current || latestBeaconRevision !== beaconRevision.current) {
                    const error = new Error('The saved map or beacon data changed elsewhere. Preserve your work as a snapshot, then reload the editor.');
                    error.status = 409; throw error;
                }
                if (match) {
                    setSavedSnapshot({ ...match, content });
                    setMatchingSnapshot({ ...match, content, confirmAssignmentRemoval });
                    return false;
                }
                if (content === appliedContent.current) {
                    setUnsaved(false);
                    setNodeEditsDirty(false);
                    setCalibrationEditsDirty(false);
                    showToast('No changes to save. This map and beacon setup is already applied.', C.blue);
                    return true;
                }
                setNeedsSnapshot(true); setSnapshotPanel(true); setSnapshotError('This layout differs from every saved snapshot. Save a new snapshot before applying.'); return false;
            }
            body.snapshotId = chosenMatch.id;
            body.baseBeaconRevision = beaconRevision.current;
            body.confirmAssignmentRemoval = confirmAssignmentRemoval;
            body.beacons = body.beacons.map(b => ({ ...b, dbId: beaconDbIds.current.get(b.clientId) ?? b.dbId }));
            const result = await saveNodeMap(projectId, body);
            revision.current = result.revision;
            beaconRevision.current = result.beaconRevision;
            for (const [clientId, id] of Object.entries(result.beaconIds || {})) beaconDbIds.current.set(clientId, id);
            const savedBeacons = draft.beacons.map(b => ({ ...b, dbId: beaconDbIds.current.get(b.clientId) ?? b.dbId }));
            appliedBeacons.current = savedBeacons;
            appliedContent.current = content;
            const savedNodeIds = result.nodeIds || {};
            for (const [clientId, id] of Object.entries(savedNodeIds))
                dbIds.current.set(clientId, id);
            const savedNodes = Object.fromEntries(Object.entries(draft.nodes).map(([floorLabel, floorNodes]) => [
                floorLabel,
                floorNodes.map(node => ({ ...node, dbId: savedNodeIds[node.id] ?? node.dbId ?? dbIds.current.get(node.id) })),
            ]));
            const savedEdgeIds = result.edgeIds || {};
            const savedEdges = Object.fromEntries(Object.entries(draft.edges).map(([floorLabel, floorEdges]) => [
                floorLabel,
                floorEdges.map(edge => ({ ...edge, dbId: savedEdgeIds[[edge.from, edge.to].sort().join("::")] ?? edge.dbId })),
            ]));
            replacingAfterSave.current = true;
            replace({ nodes: savedNodes, edges: savedEdges, calibration: draft.calibration, groups: draft.groups, beacons: savedBeacons });
            setNodeEdits(current => current ? { ...current, dbId: savedNodeIds[current.id] ?? current.dbId ?? dbIds.current.get(current.id) } : current);
            setNodeEditsDirty(false);
            setCalibrationEditsDirty(false);
            const now = new Date();
            setSavedAt(now);
            setUnsaved(false);
            notifyMallBeaconsUpdated(initial.meta.mallId);
            setSaveProblems(result.warnings?.length ? { title: "Saved, with warnings", items: result.warnings.map(w => w.message), tone: "warn" } : null);
            showToast(finalize ? "Map saved and validated." : `Draft saved — ${now.toLocaleTimeString()}`, C.green);
            return true;
        }
        catch (error) {
            const items = error.details?.errors?.length ? error.details.errors : [error.message];
            if (error.status === 409)
                setSaveProblems({ title: "Cannot save — the map changed elsewhere", items: [error.message, "Copy anything you need, then reload the editor."], tone: "error" });
            else
                setSaveProblems({ title: "Not saved", items, tone: "error" });
            return false;
        }
        finally {
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLocked, saving, liveNodes, edges, calibration, snapshot.groups, snapshot.beacons, savedSnapshot, floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty, floorMeta, projectId, initial.meta.mallId, replace]);
    const handleSaveDraft = useCallback(() => { setSnapshotPanel(true); setNeedsSnapshot(false); }, []);
    const snapshotUrl = `/api/ar-developments/${projectId}/node-map/snapshots`;
    const openSnapshots = () => { setRestoreTarget(null); setSnapshotError(''); setSnapshotPanel(true); setNeedsSnapshot(false); };
    useEffect(() => {
        if (!snapshotPanel) return;
        let active = true;
        setSnapshotBusy(true);
        apiRequest(snapshotUrl).then(items => { if (active) setNamedSnapshots(items); })
            .catch(error => { if (active) setSnapshotError(error.message); })
            .finally(() => { if (active) setSnapshotBusy(false); });
        return () => { active = false; };
    }, [snapshotPanel, snapshotUrl]);
    const restoreComparison = useMemo(() => {
        if (!restoreTarget) return null;
        try {
            const draft = prepareDraft({ nodes: liveNodes, edges, calibration, groups: snapshot.groups, beacons: snapshot.beacons }, floorMeta, { floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty });
            return { draft };
        } catch (error) { return { error: error.message }; }
    }, [restoreTarget, liveNodes, edges, calibration, snapshot.groups, snapshot.beacons, floorMeta, floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty]);
    useEffect(() => {
        if (!restoreComparison) { setRestoreCheck({ status: 'idle', match: null }); return; }
        if (restoreComparison.error) { setRestoreCheck({ status: 'error', match: null, error: restoreComparison.error }); return; }
        let active = true;
        setRestoreCheck({ status: 'checking', match: null });
        const body = buildSaveBody(restoreComparison.draft, floorMeta, { baseRevision: revision.current, finalize: true, dbIds: dbIds.current });
        apiRequest(`${snapshotUrl}/match`, { method: 'POST', body: JSON.stringify(body) })
            .then(({ match }) => { if (active) setRestoreCheck({ status: match ? 'matched' : 'different', match }); })
            .catch(error => { if (active) setRestoreCheck({ status: 'error', match: null, error: error.message }); });
        return () => { active = false; };
    }, [restoreComparison, snapshotUrl, floorMeta]);
    const saveSnapshot = async () => {
        if (isLocked || snapshotBusy || saving) return false;
        setSnapshotBusy(true); setSnapshotError("");
        try {
            const draft = prepareDraft({ nodes: liveNodes, edges, calibration, groups: snapshot.groups, beacons: snapshot.beacons }, floorMeta, { floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty });
            const { missing: orphans } = getBeaconAssignmentIssues(draft.beacons, draft.nodes, dbIds.current);
            if (orphans.length) { setSnapshotPanel(false); setBeaconRemovalWarning({ orphans, changed: [] }); return false; }
            const saveBody = buildSaveBody(draft, floorMeta, { baseRevision: revision.current, finalize: true, dbIds: dbIds.current });
            const payload = { ...draft, saveBody, floorIds: Object.fromEntries(Object.entries(floorMeta).map(([label, meta]) => [label, meta.floorId])) };
            const saved = await preserveCurrentSnapshot({
                name: snapshotName, body: saveBody, payload,
                findMatch: body => apiRequest(`${snapshotUrl}/match`, { method: 'POST', body: JSON.stringify(body) }),
                create: value => apiRequest(snapshotUrl, { method: 'POST', body: JSON.stringify(value) }),
            });
            setSavedSnapshot({ id: saved.snapshot_id, name: saved.name, content: snapshotContent(saveBody) });
            if (!saved.existing) setNamedSnapshots(current => [saved, ...current]);
            setSnapshotName(""); setNeedsSnapshot(false);
            showToast(saved.existing ? `Already saved as "${saved.name}". No duplicate created.` : 'Snapshot saved. Use Save & Validate to apply.'); return true;
        } catch (error) { setSnapshotError(error.message); return false; }
        finally { setSnapshotBusy(false); }
    };
    const restoreSnapshot = async (preserve) => {
        if (isLocked || saving || snapshotBusy) return;
        if (preserve && !await saveSnapshot()) return;
        setSnapshotBusy(true); setSnapshotError("");
        try {
            const saved = await apiRequest(`${snapshotUrl}/${restoreTarget.snapshot_id}`);
            const draft = structuredClone(saved.payload);
            if (!Array.isArray(draft.beacons) || !draft.saveBody) throw new Error('This older snapshot has no beacon data. It cannot be applied safely; create a new snapshot.');
            const floorIds = Object.fromEntries(Object.entries(floorMeta).map(([label, meta]) => [label, meta.floorId]));
            if (Object.keys(floorIds).length !== Object.keys(draft.floorIds).length || Object.entries(floorIds).some(([label, id]) => draft.floorIds[label] !== id)) throw new Error("The floors have changed since this snapshot. This layout cannot be restored.");
            const current = await loadNodeMap(projectId);
            const currentIds = new Set(Object.values(current.snapshot.nodes).flat().map(n => n.dbId));
            for (const list of Object.values(draft.nodes)) for (const node of list) {
                const id = saved.identities?.node_ids?.[node.id] ?? dbIds.current.get(node.id) ?? node.dbId;
                node.dbId = currentIds.has(id) ? id : undefined;
            }
            dbIds.current.clear();
            for (const b of draft.beacons) b.dbId = saved.identities?.beacon_ids?.[b.clientId] ?? beaconDbIds.current.get(b.clientId) ?? b.dbId;
            // A historic layout must not delete hardware added since it was saved.
            for (const b of current.snapshot.beacons) if (!draft.beacons.some(old => old.dbId === b.dbId)) draft.beacons.push({ ...b, nodeId: null });
            setSavedSnapshot({ id: saved.snapshot_id, name: saved.name, content: snapshotContent(draft.saveBody) });
            push(draft); setSelId(null); setSelEdgeId(null); setNodeEdits(null); setNodeEditsDirty(false);
            setCalibrationSelected(false); setCalibrationEditsDirty(false); setCalibPts([]); setConnFrom(null);
            setUnsaved(true); setRestoreTarget(null); setSnapshotPanel(false);
            showToast(`Restored ${saved.name}. Use Save & Validate to apply.`, C.blue);
        } catch (error) { setSnapshotError(error.message); }
        finally { setSnapshotBusy(false); }
    };
    // "Save & Validate": stricter than a draft save (every stairs / escalator / elevator /
    // ramp must be linked). It does NOT change the AR development status; moving to
    // Navigation Testing is done from the AR Development page.
    const handleSave = async (confirmed = false) => {
        setConfirmAction(null);
        let draft;
        try { draft = prepareDraft({ nodes: liveNodes, edges, calibration, groups: snapshot.groups, beacons: snapshot.beacons }, floorMeta, { floor, selectedId, nodeEdits, nodeEditsDirty, calibrationEdits, calibrationEditsDirty }); }
        catch (error) { setSaveProblems({ title: "Not saved", items: [error.message], tone: "error" }); return; }
        const issues = validateTransitions(draft.nodes, draft.edges, draft.groups || []);
        if (issues.length > 0) {
            setTransitionIssues(issues);
            return;
        }
        const { missing: orphans, unassigned } = getBeaconAssignmentIssues(draft.beacons, draft.nodes, dbIds.current);
        const changed = findBeaconAssignmentChanges(appliedBeacons.current, draft.beacons, draft.nodes, dbIds.current, beaconDbIds.current);
        if (orphans.length || ((changed.length || unassigned.length) && confirmed !== true)) { setBeaconRemovalWarning({ orphans, changed, unassigned }); return; }
        await persist(true, confirmed === true);
    };
    // ── Push helpers ──
    const pushNodes = (n) => push({ nodes: n, edges, calibration });
    const pushEdges = (e) => push({ nodes, edges: e, calibration });
    const pushAll = (n, e, c) => push({ nodes: n, edges: e, calibration: c });
    // ── Undo / Redo ──
    const handleUndo = useCallback(() => {
        if (isLocked)
            return;
        const s = undo();
        if (s) {
            setSelId(null);
            setSelEdgeId(null);
            showToast("Undo", C.violet);
        }
    }, [undo, isLocked, setSelId, showToast]);
    const handleRedo = useCallback(() => {
        if (isLocked)
            return;
        const s = redo();
        if (s) {
            setSelId(null);
            setSelEdgeId(null);
            showToast("Redo", C.blue);
        }
    }, [redo, isLocked, setSelId, showToast]);
    // ── Canvas handler ──
    const handleCanvasClick = (x, y) => {
        if (edMode === "calibrate") {
            if (calibPts.length < 2) {
                const pts = [...calibPts, { x, y }];
                setCalibPts(pts);
                if (pts.length === 2)
                    setCalibModal(true);
            }
            return;
        }
        if (isLocked)
            return;
        if (edMode === "place") {
            setPlaceModal({ x, y });
            return;
        }
        setSelId(null);
        setSelEdgeId(null);
        setCalibrationSelected(false);
    };
    // ── Node handlers ──
    const handlePlaceConfirm = (data) => {
        if (!placeModal || isLocked)
            return;
        const { newGroup, ...properties } = data;
        const n = { id: uid("n"), x: placeModal.x, y: placeModal.y, floor, ...properties };
        push({ nodes: { ...nodes, [floor]: [...(nodes[floor] || []), n] }, edges, calibration, groups: newGroup ? [...(snapshot.groups || []), newGroup] : snapshot.groups });
        setSelId(n.id);
        setSelEdgeId(null);
        setEdMode("select");
        setPlaceModal(null);
        showToast(`${NODE_TYPES[data.type]?.label} placed.`);
    };
    const handleNodeClick = (node, additive = false) => {
        setCalibrationSelected(false);
        if (edMode === "select" && additive) {
            const next = selectedIds.includes(node.id) ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id];
            setSelectedIds(next);
            setSelectedId(next.includes(node.id) ? node.id : next.at(-1) || null);
            setSelEdgeId(null);
            return;
        }
        if (isLocked) {
            setSelId(node.id);
            setSelEdgeId(null);
            return;
        }
        if (edMode === "connect") {
            if (!connectFrom) {
                setConnFrom(node.id);
                return;
            }
            if (connectFrom === node.id) {
                setConnFrom(null);
                return;
            }
            const exists = floorEdges.find(e => (e.from === connectFrom && e.to === node.id) || (e.from === node.id && e.to === connectFrom));
            if (!exists) {
                const fromNode = floorNodes.find(n => n.id === connectFrom);
                let autoPt = pathType;
                if (NODE_TYPES[fromNode?.type || ""]?.isPwdType || NODE_TYPES[node.type]?.isPwdType)
                    autoPt = "accessible";
                if (fromNode?.isEmergency || node.isEmergency || NODE_TYPES[fromNode?.type || ""]?.isEmergencyType || NODE_TYPES[node.type]?.isEmergencyType)
                    autoPt = "restricted";
                const dist = fromNode ? edgeMeters(fromNode, node, floorCalib?.pxPerMeter) : null;
                const newEdge = { id: uid("e"), from: connectFrom, to: node.id, floor, path_type: autoPt, distance_value: dist };
                pushEdges({ ...edges, [floor]: [...(edges[floor] || []), newEdge] });
                showToast(`Edge added${dist != null ? ` — ${dist}m` : ""}${autoPt !== "normal" ? ` (${autoPt})` : ""}.`);
            }
            else {
                showToast("Edge already exists.", C.orange);
            }
            setConnFrom(null);
        }
        else {
            setSelId(node.id);
            setSelEdgeId(null);
        }
    };
    const handleEdgeClick = (edgeId) => { if (edMode === "select") {
        setCalibrationSelected(false);
        setSelEdgeId(edgeId);
        setSelId(null);
    } };
    const translatedNodes = (id, x, y, base = nodes) => {
        const source = (base[floor] || []).find(n => n.id === id);
        if (!source) return base;
        const ids = selectedIds.includes(id) ? selectedIds : [id];
        const moving = (base[floor] || []).filter(n => ids.includes(n.id));
        const width = floorImage.image?.naturalWidth ?? Infinity;
        const height = floorImage.image?.naturalHeight ?? Infinity;
        const dx = Math.max(-Math.min(...moving.map(n => n.x)), Math.min(x - source.x, width - Math.max(...moving.map(n => n.x))));
        const dy = Math.max(-Math.min(...moving.map(n => n.y)), Math.min(y - source.y, height - Math.max(...moving.map(n => n.y))));
        return { ...base, [floor]: base[floor].map(n => ids.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n) };
    };
    const handleNodeDrag = (id, x, y) => {
        if (isLocked) return;
        if (!selectedIds.includes(id)) setSelId(id);
        dragInProgress.current = true;
        setDragNodes(translatedNodes(id, x, y));
    };
    const moveNode = (id, x, y) => {
        if (isLocked) return;
        const next = translatedNodes(id, x, y);
        push({ nodes: next, edges: { ...edges, [floor]: withFreshDistances(edges[floor] || [], next[floor], floorCalib?.pxPerMeter) }, calibration });
    };
    const handleNodeDragEnd = (id, x, y) => {
        if (!dragInProgress.current) return;
        dragInProgress.current = false;
        moveNode(id, x, y);
        setDragNodes(null);
    };
    const handleNodeNudge = (id, x, y) => moveNode(id, x, y);
    const calibrationWithRefs = (refStart, refEnd) => {
        if (!floorCalib) return null;
        const next = { ...floorCalib, refStart, refEnd };
        next.pxPerMeter = Math.hypot(next.refEnd.x - next.refStart.x, next.refEnd.y - next.refStart.y) / next.meters;
        return next;
    };
    const handleCalibrationDrag = (refStart, refEnd) => {
        if (isLocked) return;
        setCalibrationSelected(true);
        setDragCalibration(calibrationWithRefs(refStart, refEnd));
    };
    const handleCalibrationDragEnd = (refStart, refEnd) => {
        if (isLocked) return;
        const next = calibrationWithRefs(refStart, refEnd);
        if (!next) return;
        pushAll(nodes, { ...edges, [floor]: withFreshDistances(edges[floor] || [], nodes[floor] || [], next.pxPerMeter) }, { ...calibration, [floor]: next });
        setDragCalibration(null);
        showToast(`Calibration point moved. Scale is now ${next.pxPerMeter.toFixed(2)} px/m.`);
    };
    const handleCalibrationSelect = () => {
        setCalibrationSelected(true);
        setSelId(null);
        setSelEdgeId(null);
    };
    const setCalibrationEditField = (field, value) => {
        if (isLocked) return;
        setCalibrationEdits(current => current ? { ...current, [field]: value } : current);
        setCalibrationEditsDirty(true);
        setCalibrationError("");
    };
    const saveCalibrationEdits = () => {
        if (!floorCalib || !calibrationEdits || isLocked) return;
        const meters = Number(calibrationEdits.meters);
        const pathLossExponent = Number(calibrationEdits.pathLossExponent);
        if (!Number.isFinite(meters) || meters <= 0) {
            setCalibrationError("Real distance must be greater than zero.");
            return;
        }
        if (!Number.isFinite(pathLossExponent) || pathLossExponent < 1 || pathLossExponent > 6) {
            setCalibrationError("Path loss exponent must be between 1.0 and 6.0.");
            return;
        }
        const pixelLength = Math.hypot(floorCalib.refEnd.x - floorCalib.refStart.x, floorCalib.refEnd.y - floorCalib.refStart.y);
        const next = { ...floorCalib, refLine: calibrationEdits.refLine.trim(), meters, pathLossExponent, pxPerMeter: pixelLength / meters };
        pushAll(nodes, { ...edges, [floor]: withFreshDistances(edges[floor] || [], nodes[floor] || [], next.pxPerMeter) }, { ...calibration, [floor]: next });
        setCalibrationEditsDirty(false);
        setCalibrationError("");
        showToast(`Calibration properties saved. Scale is now ${next.pxPerMeter.toFixed(2)} px/m.`);
    };
    const copyNodes = () => {
        const copied = canvasFloorNodes.filter(n => selectedIds.includes(n.id)).map(n => ({ ...n }));
        if (!copied.length) return;
        setClipboard(copied);
        pasteCount.current = 0;
        showToast(`${copied.length} node(s) copied.`);
    };
    const pasteNodes = (point) => {
        if (isLocked || !clipboard?.length || floorImage.status !== "ready") return;
        const offset = ++pasteCount.current * 20;
        const minX = Math.min(...clipboard.map(n => n.x)), minY = Math.min(...clipboard.map(n => n.y));
        const maxX = Math.max(...clipboard.map(n => n.x)), maxY = Math.max(...clipboard.map(n => n.y));
        const dx = Math.max(-minX, Math.min(point ? point.x - minX : offset, floorImage.image.naturalWidth - maxX));
        const dy = Math.max(-minY, Math.min(point ? point.y - minY : offset, floorImage.image.naturalHeight - maxY));
        const copies = clipboard.map(n => ({ ...n, id: uid("n"), dbId: null, floor, x: n.x + dx, y: n.y + dy, cross_floor_link: null }));
        pushNodes({ ...nodes, [floor]: [...floorNodes, ...copies] });
        setSelectedIds(copies.map(n => n.id));
        setSelectedId(copies[0].id);
        setSelEdgeId(null);
        setEdMode("select");
        showToast(`${copies.length} node(s) pasted.`);
    };
    const deleteNode = useCallback(() => {
        if (!selectedId || isLocked || saving) return;
        const ids = selectedIds.length ? selectedIds : [selectedId];
        const plan = planNodeDeletion(snapshot, floor, ids, dbIds.current);
        if (plan.affected.length) { setNodeDeleteWarning({ floor, ids, affected: plan.affected }); return; }
        push(plan.snapshot); setSelId(null); setSelEdgeId(null);
        showToast('Node deleted. No beacon assignments were affected.', C.red);
    }, [selectedId, selectedIds, isLocked, saving, snapshot, floor, push, showToast, setSelId]);
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName;
            const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
            const ctrl = e.ctrlKey || e.metaKey;
            if (inInput || e.target?.isContentEditable || placeModal || calibModal || confirmAction || showData || saveProblems || transitionIssues || beaconPanel || snapshotPanel || beaconRemovalWarning || nodeDeleteWarning || matchingSnapshot || saving) return;
            if (ctrl && e.key.toLowerCase() === "c") { if (selectedIds.length) { e.preventDefault(); copyNodes(); } return; }
            if (ctrl && e.key.toLowerCase() === "v") { if (!isLocked && clipboard) { e.preventDefault(); pasteNodes(); } return; }
            if (ctrl) {
                if (e.key === "z" && !e.shiftKey) {
                    e.preventDefault();
                    handleUndo();
                }
                if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
                    e.preventDefault();
                    handleRedo();
                }
                if (e.key === "s" && !isLocked) {
                    e.preventDefault();
                    handleSaveDraft();
                }
            }
            if (!inInput && (e.key === "Delete" || e.key === "Backspace") && !isLocked) {
                if (selectedId) {
                    e.preventDefault();
                    deleteNode();
                }
                else if (selectedEdgeId) {
                    e.preventDefault();
                    pushEdges({ ...edges, [floor]: edges[floor].filter(e2 => e2.id !== selectedEdgeId) });
                    setSelEdgeId(null);
                    showToast("Edge deleted.", C.red);
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleUndo, handleRedo, handleSaveDraft, isLocked, selectedId, selectedEdgeId, nodes, edges, calibration, floor, push, pushEdges, selectedIds, clipboard, copyNodes, pasteNodes, placeModal, calibModal, confirmAction, showData, saveProblems, transitionIssues, beaconPanel, snapshotPanel, beaconRemovalWarning, nodeDeleteWarning, matchingSnapshot, deleteNode, saving, showToast]);
    const handleCalibConfirm = (data) => {
        // Keep the two clicked points: they are what makes the scale reproducible and auditable.
        const next = { ...data, refStart: calibPts[0], refEnd: calibPts[1] };
        // A new scale changes the real length of every edge on this floor.
        pushAll(nodes, { ...edges, [floor]: withFreshDistances(edges[floor] || [], nodes[floor] || [], next.pxPerMeter) }, { ...calibration, [floor]: next });
        setCalibPts([]);
        setCalibModal(false);
        setEdMode("select");
        showToast(`Scale set: ${data.pxPerMeter.toFixed(2)} px/m on ${floor}.`);
    };
    const setNodeEditField = (field, val) => {
        if (isLocked)
            return;
        setNodeEdits(prev => prev ? { ...prev, [field]: val } : null);
        setNodeEditsDirty(true);
        if (field === "label")
            setLabelError(false);
    };
    const setNodeEditFields = (fields) => {
        if (isLocked)
            return;
        setNodeEdits(prev => prev ? { ...prev, ...fields } : null);
        setNodeEditsDirty(true);
        if ("label" in fields)
            setLabelError(false);
    };
    const handleSaveNodeEdits = (confirmed = false) => {
        if (!nodeEdits || !selectedId || isLocked)
            return;
        if (!nodeEdits.label.trim()) {
            setLabelError(true);
            showToast("Label is required for all nodes.", C.red);
            return;
        }
        if (NODE_TYPES[nodeEdits.type]?.isFloorTransition) {
            const group = (snapshot.groups || []).find(g => g.id === nodeEdits.transition_group_id && g.type === nodeEdits.type);
            if (!group || nodes[floor].some(n => n.id !== selectedId && n.transition_group_id === group.id)) { showToast(`${nodeEdits.label} (${floor}, ${selectedId}): choose an available ${NODE_TYPES[nodeEdits.type]?.label} group.`, C.red); return; }
        }
        const previous = nodes[floor].find(n => n.id === selectedId);
        if (!confirmed && (previous.type !== nodeEdits.type || previous.transition_group_id !== nodeEdits.transition_group_id) && (edges.__crossFloor || []).some(e => e.from === selectedId || e.to === selectedId)) { setConfirmAction("change-group"); return; }
        setConfirmAction(null);
        // Property edits never carry coordinates: keep the node where it currently is.
        const typeChanged = nodes[floor].find(n => n.id === selectedId)?.type !== nodeEdits.type;
        const updatedNodes = Object.fromEntries(Object.entries(nodes).map(([key, floorNodes]) => [key, floorNodes.map(n => {
            if (n.id === selectedId) return { ...nodeEdits, x: n.x, y: n.y };
            return typeChanged && n.cross_floor_link === selectedId ? { ...n, cross_floor_link: null } : n;
        })]));
        const groupChanged = nodes[floor].find(n => n.id === selectedId)?.transition_group_id !== nodeEdits.transition_group_id;
        push({ nodes: updatedNodes, edges: { ...edges, __crossFloor: (edges.__crossFloor || []).filter(e => !(typeChanged || groupChanged) || (e.from !== selectedId && e.to !== selectedId)) }, calibration });
        setNodeEditsDirty(false);
        setLabelError(false);
        showToast("Node properties saved.", C.green);
    };
    const deleteEdge = () => {
        if (!selectedEdgeId || isLocked)
            return;
        pushEdges({ ...edges, [floor]: edges[floor].filter(e => e.id !== selectedEdgeId) });
        setSelEdgeId(null);
        showToast("Edge deleted.", C.red);
    };
    const changeEdgeType = (type) => {
        if (!selectedEdgeId || isLocked)
            return;
        pushEdges({ ...edges, [floor]: edges[floor].map(e => e.id === selectedEdgeId ? { ...e, path_type: type } : e) });
    };
    // ── Mode switching ──
    const switchMode = (m) => {
        if (isLocked && m !== "select")
            return;
        setEdMode(m);
        setConnFrom(null);
        setSelId(null);
        setSelEdgeId(null);
        setCalibrationSelected(false);
        if (m !== "calibrate")
            setCalibPts([]);
    };
    const nodeTools = [
        { id: "select", icon: "↖", l: "Select & Move", lockedOk: true },
        { id: "place", icon: "+", l: "Place Node", lockedOk: false },
        { id: "connect", icon: "↔", l: "Connect Nodes", lockedOk: false },
        { id: "calibrate", icon: "📏", l: "Set Scale", lockedOk: false, warn: !floorCalib },
    ];
    // ── Render ──────────────────────────────────────────────────────────────────
    return (<div style={{ fontFamily: F, color: C.txt, height: "100vh", display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 14px", height: 50, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flexShrink: 0 }}>
        {onBack && (<button onClick={onBack} title="Back to AR Development" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: "#334155", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
          ← Back
        </button>)}
        <div style={{ width: 26, height: 26, borderRadius: 7, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.txt }}>NavAR</span>
        <span style={{ color: C.border }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>Node Editor</span>
        <span style={{ color: C.border }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{mallName}</span>

        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          <IconBtn onClick={handleUndo} disabled={!canUndo || isLocked} title="Undo (Ctrl+Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M3 13C5.5 6.5 12 4 17.5 7.5S22 18 16 20"/>
            </svg>
            Undo
          </IconBtn>
          <IconBtn onClick={handleRedo} disabled={!canRedo || isLocked} title="Redo (Ctrl+Y)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6"/><path d="M21 13C18.5 6.5 12 4 6.5 7.5S2 18 8 20"/>
            </svg>
            Redo
          </IconBtn>
        </div>

        {/* Status stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: 6, background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 8px" }}>
          {STATUS_ORDER.map((s, i) => {
            const cfg = statusConfigFor(s);
            const isCurrent = s === projectStatus;
            const isPast = STATUS_ORDER.indexOf(projectStatus) > i;
            return (<div key={s} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <span style={{ fontSize: 9, color: isPast || isCurrent ? "#94A3B8" : "#E2E8F0", margin: "0 2px" }}>›</span>}
                <span style={{ fontSize: 10, fontWeight: isCurrent ? 700 : 500, fontFamily: M, color: isCurrent ? cfg.color : isPast ? "#94A3B8" : "#CBD5E1", background: isCurrent ? cfg.bg : "transparent", border: isCurrent ? `1px solid ${cfg.border}` : "1px solid transparent", borderRadius: 5, padding: isCurrent ? "1px 8px" : "1px 4px", whiteSpace: "nowrap" }}>
                  {isCurrent ? `${cfg.icon} ${cfg.short}` : cfg.short}
                </span>
              </div>);
        })}
        </div>

        <div style={{ flex: 1 }}/>

        {!floorCalib && !isLocked && (<div style={{ fontSize: 11, color: C.orange, background: C.orangeL, border: `1px solid ${C.orangeM}`, borderRadius: 6, padding: "3px 10px", fontFamily: M }}>⚠ No scale on {floor}</div>)}
        {floorCalib && (<div style={{ fontSize: 11, color: C.teal, background: C.tealL, border: `1px solid ${C.tealM}`, borderRadius: 6, padding: "3px 10px", fontFamily: M }}>
            📏 {floorCalib.pxPerMeter.toFixed(1)} px/m · n={floorCalib.pathLossExponent ?? "—"}
          </div>)}
        <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: M }}>{totalNodes}n · {totalEdges}e</span>

        {/* Action buttons */}
        <IconBtn onClick={openSnapshots} title="Manage snapshots (Ctrl+S)" disabled={saving || snapshotBusy}>Snapshots</IconBtn>
        <IconBtn onClick={() => setBeaconPanel(true)} disabled={saving || snapshotBusy}>Beacons ({snapshot.beacons?.length || 0})</IconBtn>
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>
          {savedAt && <span style={{ fontSize: 9, color: C.muted, fontFamily: M }}>Applied {savedAt.toLocaleTimeString()}</span>}
          {!isLocked && (<button onClick={() => handleSave()} style={{ display: "flex", alignItems: "center", gap: 5, background: C.blue, color: "#fff", border: `1px solid ${C.blue}`, borderRadius: 7, padding: "5px 13px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Save &amp; Validate
            </button>)}
          <div style={{ width: 1, height: 22, background: C.border }}/>
          <button onClick={() => setShowData(true)} style={{ background: C.white, color: "#334155", border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            View Data
          </button>
        </div>
      </div>

      {/* ── LOCKED BANNER ── */}
      {isLocked && (<div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.border}`, padding: "6px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 15 }}>{statusCfg.icon}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color, fontFamily: F }}>{statusCfg.label} — Editing Locked.{" "}</span>
            <span style={{ fontSize: 11, color: statusCfg.color, fontFamily: F, opacity: 0.8 }}>
              {projectStatus === "navigation_testing" && "Map is under navigation testing."}
              {projectStatus === "ready_for_activation" && "Map is ready for activation."}
              {projectStatus === "live" && "This map is live and active."}
              {!STATUS_CONFIG[projectStatus] && "The map can only be edited while the AR development is in Node Mapping."}
            </span>
          </div>
          <span style={{ fontSize: 10, color: statusCfg.color, fontFamily: M, opacity: 0.65, whiteSpace: "nowrap" }}>Read-only</span>
        </div>)}

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ width: 214, background: C.white, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" }}>

          {/* Tools */}
          <div style={{ padding: "10px 14px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 8, marginTop: 4 }}>Tools</div>
            {nodeTools.map(m => {
            const disabled = isLocked && !m.lockedOk;
            return (<button key={m.id} onClick={() => !disabled && switchMode(m.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${edMode === m.id ? C.blue : C.border}`, background: edMode === m.id ? C.blueL : disabled ? "#F8FAFC" : C.white, cursor: disabled ? "not-allowed" : "pointer", marginBottom: 4, opacity: disabled ? 0.4 : 1 }}>
                  <span style={{ fontSize: 13, color: edMode === m.id ? C.blue : "#94A3B8", width: 16, textAlign: "center" }}>{m.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: edMode === m.id ? 700 : 500, color: edMode === m.id ? C.blue : "#475569", fontFamily: F, flex: 1, textAlign: "left" }}>{m.l}</span>
                  {"warn" in m && m.warn && !isLocked && <span style={{ fontSize: 9, color: C.orange, fontFamily: M, fontWeight: 700 }}>!</span>}
                  {disabled && <span style={{ fontSize: 9, color: "#CBD5E1", fontFamily: M }}>🔒</span>}
                </button>);
        })}
          </div>

          {floorCalib && !isLocked && (<div style={{ padding: "0 14px 10px" }}>
              <button onClick={handleCalibrationSelect} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.goldM}`, background: calibrationSelected ? C.gold : C.goldL, color: calibrationSelected ? "#fff" : "#92400E", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
                Select Scale Calibration
              </button>
              <div style={{ marginTop: 5, fontSize: 9, color: "#92400E", lineHeight: 1.5, fontFamily: M }}>In Select &amp; Move, drag either amber endpoint to reposition the reference line.</div>
            </div>)}

          {edMode === "calibrate" && (<div style={{ margin: "0 14px 10px", padding: "10px 12px", background: C.goldL, border: `1px solid ${C.goldM}`, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", fontFamily: F, marginBottom: 5 }}>How to calibrate</div>
              <div style={{ fontSize: 10, color: "#92400E", fontFamily: F, lineHeight: 1.7 }}>
                1. Click point A on the floor plan<br />2. Click point B<br />3. Enter real-world distance
              </div>
              {calibPts.length > 0 && (<button onClick={() => setCalibPts([])} style={{ marginTop: 8, fontSize: 10, color: C.orange, background: "none", border: `1px solid ${C.orangeM}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: M, fontWeight: 700 }}>Clear points</button>)}
            </div>)}

          {edMode === "connect" && !isLocked && (<div style={{ padding: "0 14px 10px" }}>
              <div style={{ height: 1, background: C.line, marginBottom: 10 }}/>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 7 }}>Path Type</div>
              {Object.entries(PATH_TYPE).map(([k, v]) => (<button key={k} onClick={() => setPathType(k)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${pathType === k ? v.color : C.border}`, background: pathType === k ? `${v.color}12` : C.white, cursor: "pointer", marginBottom: 5 }}>
                  <div style={{ width: 20, height: 3, background: pathType === k ? v.color : "#CBD5E1", borderRadius: 2, flexShrink: 0 }}/>
                  <span style={{ fontSize: 11, fontWeight: pathType === k ? 700 : 500, color: pathType === k ? v.badgeTxt : "#475569", fontFamily: F }}>{v.label}</span>
                </button>))}
              <div style={{ fontSize: 10, color: "#64748B", fontFamily: M, marginTop: 6, lineHeight: 1.6 }}>Auto-overridden by node type.</div>
            </div>)}

          <div style={{ height: 1, background: C.line }}/>

          {/* Legend */}
          <div style={{ padding: "12px 14px", overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 8 }}>Legend</div>
            {NODE_GROUPS.map(g => (<div key={g} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: M, marginBottom: 4, fontWeight: 700, letterSpacing: "0.07em" }}>{g.toUpperCase()}</div>
                {Object.entries(NODE_TYPES).filter(([, v]) => v.group === g).map(([k, v]) => (<div key={k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, color: "#334155", fontFamily: F }}>{v.label}</span>

                    {v.isFloorTransition && <span style={{ fontSize: 8, color: C.violet, fontFamily: M, fontWeight: 700 }}>⇅</span>}
                  </div>))}
              </div>))}
          </div>

          {/* Stats */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px", background: C.dim, marginTop: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Nodes", totalNodes, "#0F172A"], ["Edges", totalEdges, "#0F172A"], ["Accessible", accEdges, C.teal], ["This floor", liveFloorNodes.length, C.violet]].map(([l, v, c]) => (<div key={String(l)} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: M, marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: String(c), fontFamily: M }}>{v}</div>
                </div>))}
            </div>
            {floorCalib && <div style={{ marginTop: 8, fontSize: 10, color: C.teal, fontFamily: M, lineHeight: 1.5 }}>📏 {floorCalib.pxPerMeter.toFixed(1)} px/m · n={floorCalib.pathLossExponent ?? "—"} · {floorCalib.refLine || "—"} ({floorCalib.meters}m)</div>}
            {!floorCalib && <div style={{ marginTop: 8, fontSize: 10, color: C.orange, fontFamily: M }}>⚠ No scale set for {floor}</div>}
          </div>
        </div>

        {/* ── CENTER ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Floor tabs */}
          <div style={{ display: "flex", background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 12px", flexShrink: 0 }}>
            {FLOORS.map(f => {
            const cal = calibration[f];
            const count = (liveNodes[f] || []).length;
            return (<button key={f} onClick={() => { setFloor(f); setSelId(null); setSelEdgeId(null); setConnFrom(null); setCalibPts([]); }} style={{ padding: "10px 16px", border: "none", borderBottom: `2.5px solid ${floor === f ? C.blue : "transparent"}`, background: "transparent", fontSize: 12, fontWeight: floor === f ? 700 : 500, color: floor === f ? C.blue : "#64748B", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 6 }}>
                  {f}
                  <span style={{ fontSize: 10, fontFamily: M, color: floor === f ? C.blue : "#94A3B8", background: floor === f ? C.blueL : "#F1F5F9", padding: "1px 7px", borderRadius: 8 }}>
                    {count}
                  </span>
                  {!cal && <span title="No scale calibration" style={{ fontSize: 9, color: C.orange }}>📏</span>}
                </button>);
        })}
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, padding: 12, minHeight: 0 }}>
            <NodeCanvas key={floor} nodes={canvasFloorNodes} edges={floorEdges} selectedIds={selectedIds} onCopy={copyNodes} onPaste={pasteNodes} canPaste={!!clipboard?.length} mode={isLocked && edMode !== "calibrate" ? "select" : edMode} editable={!isLocked} selectedId={selectedId} selectedEdgeId={selectedEdgeId} connectFrom={connectFrom} calibPts={calibPts} savedRef={activeFloorCalib} calibrationSelected={calibrationSelected} image={floorImage.image} imageStatus={floorImage.status} pxPerMeter={activeFloorCalib?.pxPerMeter} onCanvasClick={handleCanvasClick} onNodeClick={handleNodeClick} onNodeDrag={handleNodeDrag} onNodeDragEnd={handleNodeDragEnd} onNodeNudge={handleNodeNudge} onEdgeClick={handleEdgeClick} onCalibrationSelect={handleCalibrationSelect} onCalibrationDrag={handleCalibrationDrag} onCalibrationDragEnd={handleCalibrationDragEnd}/>
          </div>

          {/* Status bar */}
          <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: "7px 16px", display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
            {connectFrom && !isLocked && (<span style={{ fontSize: 11, color: C.gold, fontFamily: M, fontWeight: 600 }}>● Connecting from: {liveFloorNodes.find(n => n.id === connectFrom)?.label || connectFrom}</span>)}
            {edMode === "calibrate" && calibPts.length === 1 && (<span style={{ fontSize: 11, color: C.orange, fontFamily: M }}>● Point A set — click point B</span>)}
            <div style={{ flex: 1 }}/>
            {isLocked
            ? <span style={{ fontSize: 10, color: statusCfg.color, fontFamily: M, fontWeight: 600 }}>🔒 Read-only · {statusCfg.label}</span>
            : <span style={{ fontSize: 10, color: "#CBD5E1", fontFamily: M }}>Ctrl+Z · Ctrl+Y · Ctrl+S · Del</span>}
            {floorCalib && <span style={{ fontSize: 10, color: C.teal, fontFamily: M }}>📏 {floorCalib.pxPerMeter.toFixed(1)} px/m · n={floorCalib.pathLossExponent ?? "—"}</span>}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ width: 248, background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ padding: "12px 14px", flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 8 }}>
              {calibrationSelected ? "Calibration Properties" : selEdge ? "Edge Properties" : selectedIds.length > 1 ? `Node Properties (${selectedIds.length} selected)` : "Node Properties"}
            </div>

            {calibrationSelected && floorCalib && calibrationEdits && (<div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><div style={{ width: 22, height: 3, background: C.gold, borderRadius: 2 }}/><strong style={{ fontSize: 11, color: "#92400E", fontFamily: M }}>SCALE CALIBRATION</strong>{!isLocked && calibrationEditsDirty && <span style={{ marginLeft: "auto", fontSize: 9, color: C.orange, fontFamily: M, fontWeight: 700 }}>● unsaved</span>}</div>
                <SecHead color={C.gold}>Reference Line Name</SecHead><input value={calibrationEdits.refLine} onChange={e => setCalibrationEditField("refLine", e.target.value)} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${calibrationEditsDirty ? C.orange + "88" : C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: C.txt, fontFamily: F, outline: "none", boxSizing: "border-box", marginBottom: 8, cursor: isLocked ? "not-allowed" : "text" }}/>
                <SecHead color={C.gold}>Real Distance</SecHead><input type="number" min="0.1" step="0.1" value={calibrationEdits.meters} onChange={e => setCalibrationEditField("meters", e.target.value)} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${calibrationEditsDirty ? C.orange + "88" : C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: C.txt, fontFamily: M, outline: "none", boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}/><div style={{ fontSize: 9, color: "#64748B", fontFamily: M, marginTop: 3, marginBottom: 8 }}>Meters</div>
                <SecHead color={C.gold}>Path Loss Exponent</SecHead><input type="number" min="1" max="6" step="0.1" value={calibrationEdits.pathLossExponent} onChange={e => setCalibrationEditField("pathLossExponent", e.target.value)} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${calibrationEditsDirty ? C.orange + "88" : C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: C.txt, fontFamily: M, outline: "none", boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}/><div style={{ fontSize: 9, color: "#64748B", fontFamily: M, lineHeight: 1.5, marginTop: 3, marginBottom: 8 }}>Allowed range: 1.0–6.0</div>
                <SecHead color="#94A3B8">Calculated Scale</SecHead><div style={{ padding: "9px 11px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, fontSize: 10, lineHeight: 1.6, fontFamily: M, color: "#64748B", marginBottom: 8 }}><div>{Math.hypot(floorCalib.refEnd.x - floorCalib.refStart.x, floorCalib.refEnd.y - floorCalib.refStart.y).toFixed(1)} px reference line</div><strong style={{ color: C.teal, fontSize: 11 }}>{(Number(calibrationEdits.meters) > 0 ? Math.hypot(floorCalib.refEnd.x - floorCalib.refStart.x, floorCalib.refEnd.y - floorCalib.refStart.y) / Number(calibrationEdits.meters) : 0).toFixed(2)} px/m</strong></div>
                {calibrationError && <div style={{ fontSize: 10, color: C.red, fontFamily: M, marginBottom: 8, lineHeight: 1.5 }}>{calibrationError}</div>}{!isLocked && <button onClick={saveCalibrationEdits} disabled={!calibrationEditsDirty} style={{ width: "100%", padding: "8px 0", borderRadius: 7, border: `1.5px solid ${calibrationEditsDirty ? C.blue : C.border}`, background: calibrationEditsDirty ? C.blue : "#F8FAFC", color: calibrationEditsDirty ? "#fff" : "#94A3B8", fontSize: 12, fontWeight: 700, cursor: calibrationEditsDirty ? "pointer" : "default", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>{calibrationEditsDirty ? "Save Changes" : "Saved"}</button>}
              </div>)}

            {selEdge && !selNode && (<EdgePanel edge={selEdge} nodes={liveFloorNodes} onChangeType={changeEdgeType} onDelete={deleteEdge} locked={isLocked}/>)}

            {selNode && !selEdge && (() => {
            const liveNode = liveFloorNodes.find(n => n.id === selectedId) || selNode;
            const lsn = { ...(nodeEdits ?? liveNode), x: liveNode.x, y: liveNode.y };
            const cfg = NODE_TYPES[lsn.type] || NODE_TYPES.WALKWAY;
            // Only current-floor store units
            const floorStores = STORE_UNITS.filter(s => s.floor === floor);
            const linked = floorStores.find(s => s.unit === lsn.related_store_id);
            const nodeDatabaseId = lsn.dbId;
            const directlyAssignedBeacons = (snapshot.beacons || []).filter(b => b.nodeId != null && (b.nodeId === lsn.id || (nodeDatabaseId != null && b.nodeId === `db${nodeDatabaseId}`)));
            return (<>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: M }}>{lsn.type}</span>
                    {isLocked && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: M, marginLeft: "auto" }}>🔒 read-only</span>}
                    {!isLocked && nodeEditsDirty && (<span style={{ fontSize: 9, color: C.orange, fontFamily: M, marginLeft: "auto", fontWeight: 700 }}>● unsaved</span>)}
                  </div>

                  <SecHead color={C.blue}>Beacon assignment</SecHead>
                  <div style={{ padding: '9px 10px', marginBottom: 12, borderRadius: 7, border: `1px solid ${C.border}`, background: C.dim, fontFamily: F }}>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 5 }}>Node #{nodeDatabaseId ?? lsn.id}</div>
                    {directlyAssignedBeacons.length ? directlyAssignedBeacons.map(b => <div key={b.clientId} style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>{b.beaconCode} · {b.label}</div>) : <div style={{ fontSize: 11, color: C.sub }}>No beacon is directly assigned to this node.</div>}
                    <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6, marginTop: 5 }}>Path connections do not assign or move beacons.</div>
                    <button onClick={() => setBeaconPanel(true)} style={{ marginTop: 7, padding: 0, background: 'none', border: 'none', color: C.blue, fontFamily: F, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Manage map beacons</button>
                  </div>
                  <SecHead color={cfg.color}>Node Type</SecHead>
                  <select aria-label="Node type" value={lsn.type} disabled={isLocked} onChange={e => {
                      const type = e.target.value;
                      setNodeEditFields({ type, related_store_id: type === "STORE_ENTRANCE" ? lsn.related_store_id : null,
                          stall_name: type === "STALL" ? lsn.stall_name : undefined,
                          transition_group_id: type === lsn.type ? lsn.transition_group_id : null,
                           });
                  }} style={{ width: "100%", padding: "6px 9px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.txt, fontFamily: F, fontSize: 12, marginBottom: 8 }}>
                    {NODE_GROUPS.map(group => <optgroup key={group} label={group}>
                      {Object.entries(NODE_TYPES).filter(([, config]) => config.group === group).map(([type, config]) => <option key={type} value={type}>{config.label}</option>)}
                    </optgroup>)}
                  </select>
                  <EmergencyToggle checked={Boolean(lsn.isEmergency)} onChange={value => setNodeEditField("isEmergency", value)} disabled={isLocked} />
                  <SecHead color={cfg.color}>
                    Label <span style={{ fontSize: 8, color: C.red, fontWeight: 700 }}>REQUIRED</span>
                  </SecHead>
                  <input value={lsn.label || ""} onChange={e => setNodeEditField("label", e.target.value)} placeholder={cfg.label} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${labelError ? C.red : nodeEditsDirty ? C.orange + "88" : C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: C.txt, fontFamily: F, outline: "none", boxSizing: "border-box", marginBottom: labelError ? 2 : 8, cursor: isLocked ? "not-allowed" : "text" }}/>
                  {labelError && <div style={{ fontSize: 10, color: C.red, fontFamily: M, marginBottom: 6 }}>Label is required.</div>}

                  {/* STORE_ENTRANCE: link to unit (current floor only) */}
                  {lsn.type === "STORE_ENTRANCE" && (<>
                      <SecHead color={C.blue}>Linked Store Unit</SecHead>
                      {linked && (<div style={{ background: C.blueL, border: `1px solid ${C.blueM}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 18, lineHeight: 1 }}>🏪</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.blue, fontFamily: F, marginBottom: 1 }}>{linked.brand}</div>
                            <div style={{ fontSize: 10, color: "#1D4ED8", fontFamily: F, marginBottom: 4, lineHeight: 1.4 }}>{linked.name}</div>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              <span style={{ fontSize: 9, fontFamily: M, fontWeight: 700, color: "#fff", background: C.blue, padding: "1px 6px", borderRadius: 3 }}>{linked.unit}</span>
                              <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: M }}>{linked.floor}</span>
                            </div>
                          </div>
                        </div>)}
                      <select value={lsn.related_store_id || ""} onChange={e => {
                        if (!isLocked) {
                            const storeId = e.target.value || null;
                            const store = storeId ? floorStores.find(s => s.unit === storeId) : null;
                            setNodeEditFields({ related_store_id: storeId, ...(store ? { label: store.brand } : {}) });
                        }
                    }} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 11, color: C.txt, fontFamily: M, outline: "none", marginBottom: 8, cursor: isLocked ? "not-allowed" : "pointer" }}>
                        <option value="">— unlinked —</option>
                        {floorStores.map(s => <option key={s.unit} value={s.unit}>{formatStore(s)}</option>)}
                      </select>
                    </>)}

                  {/* STALL: dropdown of stall stores */}
                  {lsn.type === "STALL" && (<>
                      <SecHead color={C.gold}>Store / Brand</SecHead>
                      {lsn.stall_name && (<div style={{ background: C.goldL, border: `1px solid ${C.goldM}`, borderRadius: 7, padding: "6px 10px", marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13 }}>🛒</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", fontFamily: F }}>{lsn.stall_name}</div>
                            <div style={{ fontSize: 9, color: "#92400E", fontFamily: M }}>Stall / Kiosk · No unit number</div>
                          </div>
                        </div>)}
                      <select value={lsn.stall_name || ""} onChange={e => {
                        const stallName = e.target.value || undefined;
                        setNodeEditFields({ stall_name: stallName, ...(stallName ? { label: stallName } : {}) });
                    }} disabled={isLocked} style={{ width: "100%", background: isLocked ? "#F8FAFC" : C.bg, border: `1px solid ${C.goldM}`, borderRadius: 6, padding: "6px 9px", fontSize: 11, color: lsn.stall_name ? C.txt : "#94A3B8", fontFamily: F, outline: "none", marginBottom: 4, cursor: isLocked ? "not-allowed" : "pointer" }}>
                        <option value="">— Select stall store —</option>
                        {stallStoresForFloor(floor).map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                      <div style={{ fontSize: 10, color: "#64748B", fontFamily: M, marginBottom: 8, lineHeight: 1.5 }}>
                        Not linked to a store unit — stalls are temporary / no unit number.
                      </div>
                    </>)}

                  {cfg.isFloorTransition && <>
                    <SecHead color={C.violet}>Transition group</SecHead>
                    <TransitionGroupPicker key={`${lsn.id}-${lsn.type}`} type={lsn.type} value={lsn.transition_group_id} groups={snapshot.groups || []} nodes={nodes} floor={floor} nodeId={lsn.id} disabled={isLocked}
                      onChange={id => setNodeEditField("transition_group_id", id)}
                      onCreate={group => { push({ nodes, edges, calibration, groups: [...(snapshot.groups || []), group] }); setNodeEditField("transition_group_id", group.id); }}
                      onRename={(id, name) => { push({ nodes, edges, calibration, groups: (snapshot.groups || []).map(g => g.id === id ? { ...g, name } : g) }); showToast("Group renamed on every floor. Save a snapshot to preserve it."); }} />
                    {nodeEditsDirty && <div style={{ fontSize: 10, fontFamily: M, color: C.orange, marginBottom: 8 }}>Save Changes before editing connections.</div>}
                    <SecHead color={C.violet}>Connected floors</SecHead>
                    <FloorConnections node={lsn} nodes={{ ...liveNodes, [floor]: liveNodes[floor].map(n => n.id === lsn.id ? lsn : n) }} edges={autoConnect({ nodes: { ...liveNodes, [floor]: liveNodes[floor].map(n => n.id === lsn.id ? lsn : n) }, edges, groups: snapshot.groups || [] }, floorMeta).edges.__crossFloor} floorMeta={floorMeta} locked={isLocked || nodeEditsDirty} onChange={connections => pushEdges({ ...edges, __crossFloor: connections })} />
                  </>}

                  <SecHead color="#94A3B8">Position</SecHead>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
                    {["X", "Y"].map(k => (<div key={k}>
                        <div style={{ fontSize: 9, color: "#64748B", fontFamily: M, marginBottom: 3 }}>{k}</div>
                        <CoordinateInput key={`${selectedId}-${k}`} aria-label={`${k} coordinate`} type="number" min="0" max={k === "X" ? floorImage.image?.naturalWidth : floorImage.image?.naturalHeight} step="any" disabled={isLocked} value={lsn[k.toLowerCase()]} onChange={number => {
                            moveNode(selectedId, k === "X" ? number : lsn.x, k === "Y" ? number : lsn.y);
                        }} style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", fontSize: 11, fontFamily: M, color: "#334155", fontWeight: 600 }} />
                      </div>))}
                  </div>

                  <SecHead color="#94A3B8">Connected Edges ({floorEdges.filter(e => e.from === selectedId || e.to === selectedId).length})</SecHead>
                  {floorEdges.filter(e => e.from === selectedId || e.to === selectedId).map(e => {
                    const oid = e.from === selectedId ? e.to : e.from;
                    const on = liveFloorNodes.find(n => n.id === oid);
                    return (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }} onClick={() => { setSelEdgeId(e.id); setSelId(null); }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#334155", fontFamily: F, fontWeight: 500 }}>{on?.label || oid}</div>
                          {e.distance_value != null && <div style={{ fontSize: 10, color: "#64748B", fontFamily: M }}>{e.distance_value.toFixed(1)} m</div>}
                        </div>
                        <PathBadge type={e.path_type} sm/>
                      </div>);
                })}

                  {!isLocked && (<div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => handleSaveNodeEdits()} disabled={!nodeEditsDirty} style={{
                        width: "100%", padding: "8px 0", borderRadius: 7,
                        border: `1.5px solid ${nodeEditsDirty ? C.blue : C.border}`,
                        background: nodeEditsDirty ? C.blue : "#F8FAFC",
                        color: nodeEditsDirty ? "#fff" : "#94A3B8",
                        fontSize: 12, fontWeight: 700,
                        cursor: nodeEditsDirty ? "pointer" : "default",
                        fontFamily: F, display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 6, transition: "all 0.15s",
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        {nodeEditsDirty ? "Save Changes" : "Saved"}
                      </button>
                      <button onClick={deleteNode} style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>Delete Node</button>
                    </div>)}
                </>);
        })()}

            {!calibrationSelected && !selNode && !selEdge && (<div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, lineHeight: 1.6 }}>
                Select a node, edge, or scale calibration to view its properties.
                {isLocked && <div style={{ marginTop: 8, color: statusCfg.color, fontWeight: 600, fontSize: 11 }}>🔒 Map is in read-only mode.</div>}
              </div>)}
          </div>

          {/* Progress */}
          <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, background: "#F8FAFC" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 8 }}>Progress</div>
            {[
            ["Stores", Object.values(liveNodes).flat().filter(n => n.type === "STORE_ENTRANCE").length, STORE_UNITS.length, C.blue],
            ["Accessible edges", accEdges, 10, C.teal],
        ].map(([l, v, max, c]) => (<div key={String(l)} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: M }}>{l}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: String(c), fontFamily: M }}>{v}/{max}</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${Math.min(Number(v) / Number(max), 1) * 100}%`, background: String(c), borderRadius: 3, transition: "width 0.3s" }}/>
                </div>
              </div>))}
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M, marginBottom: 8 }}>Pipeline</div>
              {STATUS_ORDER.map((s, i) => {
            const cfg = statusConfigFor(s);
            const isCurrent = s === projectStatus;
            const isPast = STATUS_ORDER.indexOf(projectStatus) > i;
            return (<div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: isCurrent ? cfg.color : isPast ? "#94A3B8" : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 800 }}>{isPast ? "✓" : i + 1}</div>
                      {i < STATUS_ORDER.length - 1 && <div style={{ width: 1, height: 10, background: isPast ? "#94A3B8" : C.border, marginTop: 2 }}/>}
                    </div>
                    <div style={{ paddingTop: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? cfg.color : isPast ? "#94A3B8" : "#CBD5E1", fontFamily: F }}>{cfg.label}</div>
                    </div>
                  </div>);
        })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {placeModal && !isLocked && (<PlaceModal groups={snapshot.groups || []} nodes={nodes} x={placeModal.x} y={placeModal.y} floor={floor} onConfirm={handlePlaceConfirm} onCancel={() => setPlaceModal(null)}/>)}
      {calibModal && (<CalibrationModal floor={floor} calibPts={calibPts} initial={floorCalib} suggested={floorMeta[floor]?.submittedReference} onConfirm={handleCalibConfirm} onCancel={() => { setCalibModal(false); setCalibPts([]); }}/>)}
      {showData && (<DataTable groups={snapshot.groups || []} nodes={nodes} edges={edges} calibration={calibration} beacons={snapshot.beacons || []} beaconMajor={initial.meta.beaconMajor} onClose={() => setShowData(false)}/>)}

      {/* ── CONFIRM DIALOGS ── */}
      {confirmAction === "change-group" && <ConfirmModal title="Change landing group?" body="Changing this landing's group or type replaces its floor connections with matching landings in the new group. Renaming a group preserves its connections." confirmLabel="Change group" confirmColor={C.red} onConfirm={() => handleSaveNodeEdits(true)} onCancel={() => setConfirmAction(null)} />}

      {/* ── SAVE RESULT: errors from the backend, or warnings about a saved map ── */}
      {saveProblems && (<SaveProblemsModal problems={saveProblems} onClose={() => setSaveProblems(null)}/>)}

      {/* ── TRANSITION VALIDATION WARNING ── */}
      {transitionIssues && transitionIssues.length > 0 && (<TransitionWarningModal issues={transitionIssues} onClose={() => setTransitionIssues(null)}/>)}

      {snapshotPanel && <MapSnapshots items={namedSnapshots} name={snapshotName} onNameChange={setSnapshotName}
        selected={savedSnapshot} needsSnapshot={needsSnapshot} busy={snapshotBusy || saving} error={snapshotError}
        locked={isLocked} restoreTarget={restoreTarget} restoreCheck={restoreCheck} onSelectRestore={setRestoreTarget} onSave={saveSnapshot}
        onRestore={restoreSnapshot} onClose={() => { setSnapshotPanel(false); setRestoreTarget(null); setSnapshotError(''); }} />}
      {beaconPanel && <EditorBeacons beacons={snapshot.beacons || []} nodes={liveNodes} floorMeta={floorMeta} projectId={projectId} mallName={mallName} major={initial.meta.beaconMajor} locked={isLocked || saving} onChange={beacons => push({ ...snapshot, beacons })} onClose={() => setBeaconPanel(false)} />}
      {matchingSnapshot && <ConfirmModal title="Matches a saved snapshot" body={<>
        <p>Your current map and beacon setup matches <strong>{matchingSnapshot.name}</strong>.</p>
        <p style={{ marginTop: 10 }}>You can Save &amp; Validate using this saved copy. A new snapshot is not needed.</p>
      </>} confirmLabel="Save & Validate" confirmColor={C.blue} onCancel={() => setMatchingSnapshot(null)} onConfirm={() => {
        const match = matchingSnapshot; setMatchingSnapshot(null);
        void persist(true, match.confirmAssignmentRemoval, match);
      }} />}
      {nodeDeleteWarning && <ConfirmModal title="Delete nodes and unassign beacons?" body={<>
        <p>The following beacon links will be cleared in this editor:</p>
        <ul style={{ margin: '12px 0', paddingLeft: 18 }}>{nodeDeleteWarning.affected.map(b => <li key={b.clientId}><strong>{b.label}</strong> ({b.beaconCode}) — {b.removedNode?.label || b.nodeId} → Unassigned</li>)}</ul>
        <p>Save a new snapshot, then Save &amp; Validate to apply the deletion and unassignment together.</p>
      </>} confirmLabel="Delete & unassign" confirmColor={C.red} onCancel={() => setNodeDeleteWarning(null)} onConfirm={() => {
        const plan = planNodeDeletion(snapshot, nodeDeleteWarning.floor, nodeDeleteWarning.ids, dbIds.current);
        push(plan.snapshot); setNodeDeleteWarning(null); setSelId(null); setSelEdgeId(null);
        showToast(`${plan.removed.length} node(s) deleted; ${plan.affected.length} beacon(s) unassigned in this layout.`, C.orange);
      }} />}
      {beaconRemovalWarning && <ConfirmModal title="Review beacon assignments" body={<>
        {beaconRemovalWarning.orphans.length > 0 && <p>These beacons point to deleted nodes: {beaconRemovalWarning.orphans.map(b => b.label).join(', ')}. Confirm to clear their assignments in the editor, then save a new snapshot before applying.</p>}
        {beaconRemovalWarning.changed.length > 0 && <p>Saved assignments will be removed or reassigned for: {beaconRemovalWarning.changed.map(b => b.label).join(', ')}. Applying also updates shared beacon details in Mall Management.</p>}
        {beaconRemovalWarning.unassigned?.length > 0 && <div style={{ marginTop: 12 }}><p><strong>{beaconRemovalWarning.unassigned.length} beacon(s) have no assigned node:</strong></p><ul style={{ margin: '8px 0', paddingLeft: 18 }}>{beaconRemovalWarning.unassigned.map(b => <li key={b.clientId}>{b.label} ({b.beaconCode})</li>)}</ul><p>They will remain unassigned for this AR version. Assign them in Map beacons, or confirm to continue.</p></div>}
      </>} confirmLabel={beaconRemovalWarning.orphans.length ? 'Clear missing assignments' : beaconRemovalWarning.unassigned?.length ? 'Continue with unassigned beacons' : 'Confirm and continue'} confirmColor={C.orange} onCancel={() => setBeaconRemovalWarning(null)} onConfirm={() => {
        const warning = beaconRemovalWarning; setBeaconRemovalWarning(null);
        if (warning.orphans.length) {
            const ids = new Set(warning.orphans.map(b => b.clientId));
            push({ ...snapshot, beacons: snapshot.beacons.map(b => ids.has(b.clientId) ? { ...b, nodeId: null } : b) });
            setNeedsSnapshot(true); setSnapshotPanel(true); setSnapshotError('Missing assignments cleared. Save a new snapshot before applying.');
        } else handleSave(true);
      }} />}
      {saving && <div role="status" aria-live="polite" className="ne-apply-overlay"><div className="ne-apply-card"><span><LoaderCircle size={23} className="ne-spin" /></span><strong>{savePhase === 'checking' ? 'Checking saved snapshots' : 'Applying snapshot'}</strong><p>{savePhase === 'checking' ? 'Comparing your map and beacon setup with saved copies.' : 'Saving your map and beacon setup together.'}</p></div></div>}
      {toast && <Toast msg={toast.msg} color={toast.color}/>}
    </div>);
}

// ── Entry point: load the map from the backend, then render the editor ─────────
export default function NodeEditor({ projectId, mallName, onBack }) {
    const [state, setState] = useState({ status: "loading", data: null, error: "" });
    useEffect(() => {
        let active = true;
        setState({ status: "loading", data: null, error: "" });
        loadNodeMap(projectId)
            .then(data => { if (active) setState({ status: "ready", data, error: "" }); })
            .catch(error => { if (active) setState({ status: "error", data: null, error: error.message || "Unable to load the map." }); });
        return () => { active = false; };
    }, [projectId]);
    if (state.status !== "ready") {
        return (<div style={{ fontFamily: F, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: C.bg, color: C.txt }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: state.status === "error" ? C.red : "#475569" }}>{state.status === "error" ? state.error : "Loading map…"}</div>
        {onBack && (<button onClick={onBack} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>← Back</button>)}
      </div>);
    }
    if (state.data.floorMetaEmpty || Object.keys(state.data.floorMeta).length === 0) {
        return (<div style={{ fontFamily: F, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: C.bg, color: "#475569", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.txt }}>No floor plans were submitted for this application.</div>
        <div style={{ fontSize: 12 }}>The mall must upload at least one floor plan before the map can be edited.</div>
        {onBack && (<button onClick={onBack} style={{ marginTop: 8, padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>← Back</button>)}
      </div>);
    }
    // key forces a clean editor (fresh undo history, fresh revision) after a reload
    return <NodeEditorWorkspace key={projectId} projectId={projectId} mallName={mallName || state.data.meta.mallName} onBack={onBack} initial={state.data}/>;
}
