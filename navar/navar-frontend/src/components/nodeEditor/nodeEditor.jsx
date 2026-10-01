import "./nodeEditor.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { NodeCanvas } from "./components/NodeCanvas";
import { PlaceModal } from "./components/PlaceModal";
import { CalibrationModal } from "./components/CalibrationModal";
import { DataTable } from "./components/DataTable";
import { useHistory } from "./hooks/useHistory";
import { C, F, M, NODE_TYPES, NODE_GROUPS, PATH_TYPE, FLOORS, STORE_UNITS, STALL_STORES, formatStore, uid, pxDist, } from "./editorConstants";
import { makeNodes, makeEdges, makeCalibration } from "./editorData";
const STATUS_CONFIG = {
    draft: { label: "Pending", short: "Pending", color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1", icon: "✏️", editable: true },
    node_mapping: { label: "Node Mapping", short: "Node Mapping", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", icon: "🗺️", editable: false },
    navigation_testing: { label: "Navigation Testing", short: "Nav Testing", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: "🧭", editable: false },
    ready_for_activation: { label: "Ready for Activation", short: "Ready", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "✅", editable: false },
    live: { label: "Live", short: "Live", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "🟢", editable: false },
};
const STATUS_ORDER = ["draft", "node_mapping", "navigation_testing", "ready_for_activation", "live"];
// ── Persistence keys ──────────────────────────────────────────────────────────
const NODE_DRAFT_KEY = "navarEditorDraft_v3";
const STATUS_KEY = "navarEditorStatus_v1";
const SAVED_TS_KEY = "navarEditorSavedTs_v1";
function loadNodeDraft() {
    try {
        const r = localStorage.getItem(NODE_DRAFT_KEY);
        return r ? JSON.parse(r) : null;
    }
    catch {
        return null;
    }
}
function loadStatus() {
    try {
        return localStorage.getItem(STATUS_KEY) || "draft";
    }
    catch {
        return "draft";
    }
}
function loadSavedTs() {
    try {
        const r = localStorage.getItem(SAVED_TS_KEY);
        return r ? new Date(r) : null;
    }
    catch {
        return null;
    }
}
const INITIAL_SNAPSHOT = { nodes: makeNodes(), edges: makeEdges(), calibration: makeCalibration() };
const getStartSnapshot = () => loadNodeDraft() ?? INITIAL_SNAPSHOT;
function validateTransitions(nodes) {
    const issues = [];
    const allNodes = Object.values(nodes).flat();
    FLOORS.forEach(f => {
        (nodes[f] || []).forEach(n => {
            if (!NODE_TYPES[n.type]?.isFloorTransition)
                return;
            if (!n.cross_floor_link) {
                issues.push({ floor: f, nodeId: n.id, label: n.label || n.type, type: n.type });
                return;
            }
            const target = allNodes.find(t => t.id === n.cross_floor_link);
            if (!target)
                issues.push({ floor: f, nodeId: n.id, label: n.label || n.type, type: n.type });
        });
    });
    return issues;
}
// ── Shared atoms ──────────────────────────────────────────────────────────────
const SecHead = ({ children, color }) => (<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 12 }}>
    <div style={{ width: 3, height: 12, borderRadius: 2, background: color || C.blue }}/>
    <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: M }}>
      {children}
    </span>
  </div>);
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
              <div style={{ fontSize: 10, color: C.red, fontFamily: M, marginTop: 1 }}>Missing cross-floor link — select this node and set the link in the right panel</div>
            </div>
          </div>))}
      </div>
      <div style={{ fontSize: 11, color: "#64748B", fontFamily: M, marginBottom: 16, lineHeight: 1.6 }}>
        A staircase, escalator, elevator, or ramp always connects to its counterpart on the adjacent floor. Fix all items above before saving.
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
// ── Main ──────────────────────────────────────────────────────────────────────
export default function NodeEditor({ mallName = "SM Seaside City Cebu", onBack }) {
    const { snapshot, push, undo, redo, canUndo, canRedo } = useHistory(getStartSnapshot());
    // Project status
    const [projectStatus, setProjectStatus] = useState(loadStatus);
    const [savedAt, setSavedAt] = useState(loadSavedTs);
    const [unsaved, setUnsaved] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [transitionIssues, setTransitionIssues] = useState(null);
    const statusCfg = STATUS_CONFIG[projectStatus];
    const isLocked = !statusCfg.editable;
    // ── View state ──
    const [floor, setFloor] = useState("Ground Floor");
    const [edMode, setEdMode] = useState("select");
    const [calibPts, setCalibPts] = useState([]);
    const [calibModal, setCalibModal] = useState(false);
    const [showData, setShowData] = useState(false);
    const [toast, setToast] = useState(null);
    // ── Node mode state ──
    const [selectedId, setSelId] = useState(null);
    const [selectedEdgeId, setSelEdgeId] = useState(null);
    const [connectFrom, setConnFrom] = useState(null);
    const [pathType, setPathType] = useState("normal");
    const [placeModal, setPlaceModal] = useState(null);
    const dragInProgress = useRef(false);
    const [dragNodes, setDragNodes] = useState(null);
    // ── Node properties local edit state ──
    const [nodeEdits, setNodeEdits] = useState(null);
    const [nodeEditsDirty, setNodeEditsDirty] = useState(false);
    const [labelError, setLabelError] = useState(false);
    const { nodes, edges, calibration } = snapshot;
    const floorNodes = nodes[floor] || [];
    const floorEdges = edges[floor] || [];
    const selNode = floorNodes.find(n => n.id === selectedId) || null;
    const selEdge = floorEdges.find(e => e.id === selectedEdgeId) || null;
    const totalNodes = Object.values(nodes).flat().length;
    const totalEdges = Object.values(edges).flat().length;
    const accEdges = Object.values(edges).flat().filter(e => e.path_type === "accessible").length;
    const floorCalib = calibration[floor];
    const liveNodes = dragNodes ?? nodes;
    const liveFloorNodes = liveNodes[floor] || [];
    // Canvas nodes: preview staged properties without overriding live drag coordinates.
    const canvasFloorNodes = (nodeEdits && selectedId)
        ? liveFloorNodes.map(n => n.id === selectedId ? { ...nodeEdits, x: n.x, y: n.y } : n)
        : liveFloorNodes;
    const showToast = (msg, color = C.green) => {
        setToast({ msg, color });
        setTimeout(() => setToast(null), 2800);
    };
    useEffect(() => { localStorage.setItem(STATUS_KEY, projectStatus); }, [projectStatus]);
    useEffect(() => { setUnsaved(true); }, [snapshot]);
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
    // ── Node persistence ──
    const persistNodeData = (statusOverride) => {
        const toSave = { nodes: liveNodes, edges, calibration };
        localStorage.setItem(NODE_DRAFT_KEY, JSON.stringify(toSave));
        const now = new Date();
        localStorage.setItem(SAVED_TS_KEY, now.toISOString());
        if (statusOverride)
            localStorage.setItem(STATUS_KEY, statusOverride);
        setSavedAt(now);
        setUnsaved(false);
        return now;
    };
    const handleSaveDraft = useCallback(() => {
        if (isLocked)
            return;
        const now = persistNodeData();
        showToast(`Draft saved — ${now.toLocaleTimeString()}`, C.green);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLocked, liveNodes, edges, calibration]);
    const handleSave = () => {
        const issues = validateTransitions(nodes);
        if (issues.length > 0) {
            setConfirmAction(null);
            setTransitionIssues(issues);
            return;
        }
        persistNodeData("node_mapping");
        setProjectStatus("node_mapping");
        setConfirmAction(null);
        showToast("Saved & sent to AR development. Editing locked.", C.blue);
    };
    const handleSubmitForTesting = () => {
        persistNodeData("navigation_testing");
        setProjectStatus("navigation_testing");
        setConfirmAction(null);
        showToast("Submitted for navigation testing.", "#D97706");
    };
    const handleRevertToDraft = () => {
        setProjectStatus("draft");
        localStorage.setItem(STATUS_KEY, "draft");
        setConfirmAction(null);
        showToast("Reverted to Draft — editing unlocked.", C.violet);
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
    }, [undo, isLocked]);
    const handleRedo = useCallback(() => {
        if (isLocked)
            return;
        const s = redo();
        if (s) {
            setSelId(null);
            setSelEdgeId(null);
            showToast("Redo", C.blue);
        }
    }, [redo, isLocked]);
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName;
            const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
            const ctrl = e.ctrlKey || e.metaKey;
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
                    push({ nodes: { ...nodes, [floor]: nodes[floor].filter(n => n.id !== selectedId) }, edges: { ...edges, [floor]: edges[floor].filter(e2 => e2.from !== selectedId && e2.to !== selectedId) }, calibration });
                    setSelId(null);
                    showToast("Node deleted.", C.red);
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
    }, [handleUndo, handleRedo, handleSaveDraft, isLocked, selectedId, selectedEdgeId, nodes, edges, calibration, floor, push, pushEdges]);
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
    };
    // ── Node handlers ──
    const handlePlaceConfirm = (data) => {
        if (!placeModal || isLocked)
            return;
        const n = { id: uid("n"), x: placeModal.x, y: placeModal.y, floor, ...data };
        pushNodes({ ...nodes, [floor]: [...(nodes[floor] || []), n] });
        setSelId(n.id);
        setSelEdgeId(null);
        setEdMode("select");
        setPlaceModal(null);
        showToast(`${NODE_TYPES[data.type]?.label} placed.`);
    };
    const handleNodeClick = (node) => {
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
                if (NODE_TYPES[fromNode?.type || ""]?.isEmergencyType || NODE_TYPES[node.type]?.isEmergencyType)
                    autoPt = "restricted";
                let dist = null;
                if (floorCalib && fromNode)
                    dist = parseFloat((pxDist(fromNode, node) / floorCalib.pxPerMeter).toFixed(1));
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
        setSelEdgeId(edgeId);
        setSelId(null);
    } };
    const handleNodeDrag = (id, x, y) => {
        if (isLocked)
            return;
        dragInProgress.current = true;
        setDragNodes(prev => { const base = prev ?? nodes; return { ...base, [floor]: (base[floor] || []).map(n => n.id === id ? { ...n, x, y } : n) }; });
    };
    const handleNodeDragEnd = (id, x, y) => {
        if (!dragInProgress.current)
            return;
        dragInProgress.current = false;
        const updated = dragNodes ?? nodes;
        push({ nodes: { ...updated, [floor]: (updated[floor] || []).map(n => n.id === id ? { ...n, x, y } : n) }, edges, calibration });
        setDragNodes(null);
    };
    const handleCalibConfirm = (data) => {
        pushAll(nodes, edges, { ...calibration, [floor]: data });
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
    const handleSaveNodeEdits = () => {
        if (!nodeEdits || !selectedId || isLocked)
            return;
        if (!nodeEdits.label.trim()) {
            setLabelError(true);
            showToast("Label is required for all nodes.", C.red);
            return;
        }
        pushNodes({ ...nodes, [floor]: nodes[floor].map(n => n.id === selectedId ? nodeEdits : n) });
        setNodeEditsDirty(false);
        setLabelError(false);
        showToast("Node properties saved.", C.green);
    };
    const deleteNode = () => {
        if (!selectedId || isLocked)
            return;
        push({ nodes: { ...nodes, [floor]: nodes[floor].filter(n => n.id !== selectedId) }, edges: { ...edges, [floor]: edges[floor].filter(e => e.from !== selectedId && e.to !== selectedId) }, calibration });
        setSelId(null);
        showToast("Node deleted.", C.red);
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
            const cfg = STATUS_CONFIG[s];
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>
          {!isLocked && (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <button onClick={handleSaveDraft} title="Save Draft (Ctrl+S)" style={{ display: "flex", alignItems: "center", gap: 5, background: unsaved ? "#F0FDF4" : "#F8FAFC", color: unsaved ? "#166534" : "#94A3B8", border: `1px solid ${unsaved ? "#BBF7D0" : C.border}`, borderRadius: 7, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "all 0.2s" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Draft
              </button>
              {savedAt && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: M }}>{savedAt.toLocaleTimeString()}</span>}
            </div>)}
          {!isLocked && (<button onClick={() => setConfirmAction("save")} style={{ display: "flex", alignItems: "center", gap: 5, background: C.blue, color: "#fff", border: `1px solid ${C.blue}`, borderRadius: 7, padding: "5px 13px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Save
            </button>)}
          {projectStatus === "node_mapping" && (<button onClick={() => setConfirmAction("submit")} style={{ display: "flex", alignItems: "center", gap: 5, background: "#D97706", color: "#fff", border: "1px solid #D97706", borderRadius: 7, padding: "5px 13px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Submit for Testing
            </button>)}
          {isLocked && (<button onClick={() => setConfirmAction("revert")} style={{ display: "flex", alignItems: "center", gap: 5, background: "#FEF9C3", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 7, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5.5 6.5 12 4 17.5 7.5S22 18 16 20"/></svg>
              Revert to Draft
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
              {projectStatus === "node_mapping" && "AR development team is working on this map."}
              {projectStatus === "navigation_testing" && "Map is under navigation testing."}
              {projectStatus === "ready_for_activation" && "Map is ready for activation."}
              {projectStatus === "live" && "This map is live and active."}
            </span>
          </div>
          <span style={{ fontSize: 10, color: statusCfg.color, fontFamily: M, opacity: 0.65, whiteSpace: "nowrap" }}>Use "Revert to Draft" to unlock</span>
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
                    {v.isPwdType && <span style={{ fontSize: 8, color: "#0F766E", fontFamily: M, fontWeight: 700 }}>ACC</span>}
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
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
            <NodeCanvas nodes={canvasFloorNodes} edges={floorEdges} mode={isLocked ? "select" : edMode} selectedId={selectedId} selectedEdgeId={selectedEdgeId} connectFrom={connectFrom} calibPts={calibPts} onCanvasClick={handleCanvasClick} onNodeClick={handleNodeClick} onNodeDrag={handleNodeDrag} onNodeDragEnd={handleNodeDragEnd} onEdgeClick={handleEdgeClick}/>
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
              {selEdge ? "Edge Properties" : "Node Properties"}
            </div>

            {selEdge && !selNode && (<EdgePanel edge={selEdge} nodes={liveFloorNodes} onChangeType={changeEdgeType} onDelete={deleteEdge} locked={isLocked}/>)}

            {selNode && !selEdge && (() => {
            const cfg = NODE_TYPES[selNode.type] || NODE_TYPES.WALKWAY;
            const lsn = nodeEdits ?? (liveFloorNodes.find(n => n.id === selectedId) || selNode);
            // Only current-floor store units
            const floorStores = STORE_UNITS.filter(s => s.floor === floor);
            const linked = STORE_UNITS.find(s => s.unit === lsn.related_store_id);
            return (<>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: M }}>{lsn.type}</span>
                    {isLocked && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: M, marginLeft: "auto" }}>🔒 read-only</span>}
                    {!isLocked && nodeEditsDirty && (<span style={{ fontSize: 9, color: C.orange, fontFamily: M, marginLeft: "auto", fontWeight: 700 }}>● unsaved</span>)}
                  </div>

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
                            const store = storeId ? STORE_UNITS.find(s => s.unit === storeId) : null;
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
                        {STALL_STORES.map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                      <div style={{ fontSize: 10, color: "#64748B", fontFamily: M, marginBottom: 8, lineHeight: 1.5 }}>
                        Not linked to a store unit — stalls are temporary / no unit number.
                      </div>
                    </>)}

                  {/* Accessible toggle */}
                  <button onClick={() => !isLocked && setNodeEditField("isPwd", !lsn.isPwd)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, border: `1px solid ${lsn.isPwd ? C.teal : C.border}`, background: lsn.isPwd ? C.tealL : "#F8FAFC", cursor: isLocked ? "not-allowed" : "pointer", marginBottom: 8, opacity: isLocked ? 0.7 : 1 }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, border: `2px solid ${lsn.isPwd ? C.teal : C.border}`, background: lsn.isPwd ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {lsn.isPwd && <span style={{ fontSize: 8, color: "#fff", fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: lsn.isPwd ? C.teal : "#475569", fontFamily: F }}>Accessible</span>
                  </button>

                  {/* Cross-floor link */}
                  {cfg.isFloorTransition && (() => {
                    const otherTransNodes = Object.entries(liveNodes)
                        .filter(([f]) => f !== floor)
                        .flatMap(([f, ns]) => ns.filter(n => NODE_TYPES[n.type]?.isFloorTransition).map(n => ({ ...n, floor: f })));
                    const linkedNode = otherTransNodes.find(n => n.id === lsn.cross_floor_link);
                    const isLinked = !!lsn.cross_floor_link && !!linkedNode;
                    return (<>
                        <SecHead color={C.violet}>Cross-Floor Link ⇅ <span style={{ fontSize: 8, color: C.red, fontWeight: 700 }}>REQUIRED</span></SecHead>
                        <div style={{ fontSize: 10, color: "#64748B", fontFamily: M, marginBottom: 6, lineHeight: 1.5 }}>
                          This {cfg.label} must connect to its counterpart on another floor. Required before final save.
                        </div>
                        {isLinked ? (<div style={{ background: C.violetL, border: `1px solid ${C.violetM}`, borderRadius: 7, padding: "7px 10px", marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{NODE_TYPES[linkedNode.type]?.icon || "⇅"}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.violet, fontFamily: F }}>{linkedNode.label || linkedNode.type}</div>
                              <div style={{ fontSize: 9, color: "#6D28D9", fontFamily: M }}>{linkedNode.floor} · {linkedNode.id}</div>
                            </div>
                            {!isLocked && (<button onClick={() => setNodeEditField("cross_floor_link", null)} style={{ fontSize: 9, color: C.red, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontFamily: M, fontWeight: 700, flexShrink: 0 }}>✕</button>)}
                          </div>) : (<div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 10, color: C.red, fontFamily: M, fontWeight: 600 }}>
                            ⚠ Not linked — will block final save
                          </div>)}
                        {!isLocked && (<select value={lsn.cross_floor_link || ""} onChange={e => setNodeEditField("cross_floor_link", e.target.value || null)} style={{ width: "100%", background: C.bg, border: `1px solid ${isLinked ? C.border : "#FECACA"}`, borderRadius: 6, padding: "6px 9px", fontSize: 11, color: C.txt, fontFamily: F, outline: "none", marginBottom: 8, cursor: "pointer" }}>
                            <option value="">— Select counterpart node —</option>
                            {FLOORS.filter(f => f !== floor).map(f => {
                                const fNodes = (liveNodes[f] || []).filter(n => NODE_TYPES[n.type]?.isFloorTransition);
                                if (fNodes.length === 0)
                                    return <optgroup key={f} label={`${f} (no transition nodes)`}><option disabled>No transition nodes on {f}</option></optgroup>;
                                return (<optgroup key={f} label={f}>
                                  {fNodes.map(n => (<option key={n.id} value={n.id}>{NODE_TYPES[n.type]?.icon} {n.label || n.type} ({n.id})</option>))}
                                </optgroup>);
                            })}
                          </select>)}
                        {isLocked && !isLinked && <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: M, marginBottom: 8 }}>No cross-floor link set.</div>}
                      </>);
                })()}

                  <SecHead color="#94A3B8">Position</SecHead>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
                    {["X", "Y"].map(k => (<div key={k}>
                        <div style={{ fontSize: 9, color: "#64748B", fontFamily: M, marginBottom: 3 }}>{k}</div>
                        <div style={{ background: "#F1F5F9", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", fontSize: 11, fontFamily: M, color: "#334155", fontWeight: 600 }}>
                          {Math.round(k === "X" ? lsn.x : lsn.y)}
                        </div>
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
                      <button onClick={handleSaveNodeEdits} disabled={!nodeEditsDirty} style={{
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

            {!selNode && !selEdge && (<div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, lineHeight: 1.6 }}>
                Select a node or edge to view its properties.
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
            const cfg = STATUS_CONFIG[s];
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
      {placeModal && !isLocked && (<PlaceModal x={placeModal.x} y={placeModal.y} floor={floor} onConfirm={handlePlaceConfirm} onCancel={() => setPlaceModal(null)}/>)}
      {calibModal && (<CalibrationModal floor={floor} calibPts={calibPts} onConfirm={handleCalibConfirm} onCancel={() => { setCalibModal(false); setCalibPts([]); }}/>)}
      {showData && (<DataTable nodes={nodes} edges={edges} calibration={calibration} onClose={() => setShowData(false)}/>)}

      {/* ── CONFIRM DIALOGS ── */}
      {confirmAction === "save" && (<ConfirmModal title="Save Map" body="This will validate all floor transitions, then lock editing and send the map to the AR development team. Continue?" confirmLabel="Validate & Save" confirmColor={C.blue} onConfirm={handleSave} onCancel={() => setConfirmAction(null)}/>)}
      {confirmAction === "submit" && (<ConfirmModal title="Submit for Testing" body="Submit this map for navigation testing? The map will enter the testing pipeline." confirmLabel="Submit" confirmColor="#D97706" onConfirm={handleSubmitForTesting} onCancel={() => setConfirmAction(null)}/>)}
      {confirmAction === "revert" && (<ConfirmModal title="Revert to Draft" body="This will unlock editing and move the map back to Pending status." confirmLabel="Revert" confirmColor={C.violet} onConfirm={handleRevertToDraft} onCancel={() => setConfirmAction(null)}/>)}

      {/* ── TRANSITION VALIDATION WARNING ── */}
      {transitionIssues && transitionIssues.length > 0 && (<TransitionWarningModal issues={transitionIssues} onClose={() => setTransitionIssues(null)}/>)}

      {toast && <Toast msg={toast.msg} color={toast.color}/>}
    </div>);
}
