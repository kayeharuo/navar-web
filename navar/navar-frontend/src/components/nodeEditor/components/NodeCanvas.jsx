import { useRef, useCallback, useEffect, useState } from "react";
import { C, M, F, NODE_TYPES, PATH_TYPE } from "../editorConstants";
const W = 740;
const H = 490;
const localDist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export function NodeCanvas({ nodes, edges, mode, selectedId, connectFrom, calibPts, onCanvasClick, onNodeClick, onNodeDrag, onNodeDragEnd, onEdgeClick, selectedEdgeId, }) {
    const ref = useRef(null);
    const drag = useRef(null);
    const didDrag = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const draw = useCallback(() => {
        const cv = ref.current;
        if (!cv)
            return;
        const ctx = cv.getContext("2d");
        ctx.clearRect(0, 0, W, H);
        // Grid
        ctx.strokeStyle = "#E4E8EF";
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= W; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y <= H; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        // Floor plan area
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(50, 50, W - 100, H - 100);
        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(50, 50, W - 100, H - 100);
        ctx.setLineDash([]);
        ctx.font = `500 11px ${M}`;
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Floor plan image renders here", W / 2, 32);
        // ── Edges ──
        edges.forEach(e => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b)
                return;
            const pt = PATH_TYPE[e.path_type] || PATH_TYPE.normal;
            const isSel = e.id === selectedEdgeId;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isSel ? pt.color : pt.color + "90";
            ctx.lineWidth = isSel ? 4 : 2.5;
            ctx.setLineDash(pt.dash);
            ctx.stroke();
            ctx.setLineDash([]);
            if (isSel) {
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                ctx.save();
                ctx.translate(mx, my);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(-5, -4);
                ctx.lineTo(0, 0);
                ctx.lineTo(-5, 4);
                ctx.strokeStyle = pt.color;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
            if (e.distance_value != null) {
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                ctx.font = `600 9px ${M}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const txt = `${e.distance_value.toFixed(1)}m`;
                const tw = ctx.measureText(txt).width;
                ctx.fillStyle = C.white;
                ctx.fillRect(mx - tw / 2 - 3, my - 7, tw + 6, 14);
                ctx.fillStyle = pt.color;
                ctx.fillText(txt, mx, my);
            }
        });
        // Calibration points
        if (calibPts.length === 1) {
            ctx.beginPath();
            ctx.arc(calibPts[0].x, calibPts[0].y, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#F59E0B";
            ctx.fill();
        }
        if (calibPts.length === 2) {
            ctx.beginPath();
            ctx.moveTo(calibPts[0].x, calibPts[0].y);
            ctx.lineTo(calibPts[1].x, calibPts[1].y);
            ctx.strokeStyle = "#F59E0B";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            [calibPts[0], calibPts[1]].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#F59E0B";
                ctx.fill();
            });
            const mx = (calibPts[0].x + calibPts[1].x) / 2;
            const my = (calibPts[0].y + calibPts[1].y) / 2;
            const pxL = Math.round(localDist(calibPts[0], calibPts[1]));
            ctx.font = `700 10px ${M}`;
            ctx.fillStyle = "#FFFBEB";
            ctx.fillRect(mx - 28, my - 9, 56, 18);
            ctx.fillStyle = "#92400E";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${pxL} px`, mx, my);
        }
        // ── Nodes ──
        nodes.forEach(n => {
            const cfg = NODE_TYPES[n.type] || NODE_TYPES.WALKWAY;
            const sel = n.id === selectedId;
            const cf = n.id === connectFrom;
            const r = cfg.size;
            if (sel || cf) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = cf ? "#F59E0B25" : "#2563EB20";
                ctx.fill();
                ctx.strokeStyle = cf ? "#F59E0B" : "#2563EB";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            if (cfg.isPwdType || n.isPwd) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
                ctx.strokeStyle = "#0D948860";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = cfg.color + "20";
            ctx.fill();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = sel ? 2.5 : 1.5;
            ctx.stroke();
            if (cfg.icon && cfg.icon !== "·" && cfg.icon !== "✛" && cfg.icon !== "○") {
                ctx.font = `${Math.max(r - 1, 10)}px serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = cfg.color;
                ctx.fillText(cfg.icon, n.x, n.y);
            }
            else if (cfg.icon === "✛") {
                ctx.strokeStyle = cfg.color;
                ctx.lineWidth = 1.5;
                const s = r * 0.55;
                ctx.beginPath();
                ctx.moveTo(n.x - s, n.y);
                ctx.lineTo(n.x + s, n.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(n.x, n.y - s);
                ctx.lineTo(n.x, n.y + s);
                ctx.stroke();
            }
            else {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = cfg.color;
                ctx.fill();
            }
            // Cross-floor link pill
            if (cfg.isFloorTransition && n.cross_floor_link) {
                const pill = "⇅", pw = 14;
                ctx.fillStyle = "#7C3AED22";
                ctx.strokeStyle = "#7C3AED";
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.roundRect(n.x - pw / 2, n.y - r - 14, pw, 10, 3);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "#7C3AED";
                ctx.font = `bold 9px ${M}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(pill, n.x, n.y - r - 4);
            }
            if (n.label) {
                ctx.font = `600 9px ${F}`;
                ctx.textBaseline = "top";
                ctx.textAlign = "center";
                const truncated = n.label.length > 15 ? n.label.slice(0, 14) + "…" : n.label;
                const lw = ctx.measureText(truncated).width;
                ctx.fillStyle = "rgba(255,255,255,0.75)";
                ctx.fillRect(n.x - lw / 2 - 2, n.y + r + 3, lw + 4, 11);
                ctx.fillStyle = "#0F172A";
                ctx.fillText(truncated, n.x, n.y + r + 4);
            }
        });
        // Hint text
        ctx.globalAlpha = 1;
        ctx.font = `500 10px ${M}`;
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const hint = mode === "calibrate"
            ? calibPts.length === 0 ? "Click point A on the reference line"
                : calibPts.length === 1 ? "Click point B"
                    : "Line drawn — enter real distance"
            : mode === "place" ? "Click floor plan to place node"
                : mode === "connect"
                    ? connectFrom ? "Click another node to connect" : "Click a node to start edge"
                    : "Click to select · Drag to move";
        ctx.fillText(hint, 8, 8);
    }, [nodes, edges, selectedId, connectFrom, mode, calibPts, selectedEdgeId]);
    useEffect(() => { draw(); }, [draw]);
    // ── Hit detection ──
    const hitNode = (x, y) => {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const r = (NODE_TYPES[n.type]?.size || 7) + 8;
            if (Math.hypot(x - n.x, y - n.y) <= r)
                return n;
        }
        return null;
    };
    const hitEdge = (x, y) => {
        for (const e of edges) {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b)
                continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy;
            if (len2 === 0)
                continue;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
            const px = a.x + t * dx, py = a.y + t * dy;
            if (Math.hypot(x - px, y - py) <= 7)
                return e.id;
        }
        return null;
    };
    // ── Mouse handlers ──
    const onMD = (ev) => {
        const rect = ref.current.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        if (mode !== "select")
            return;
        const h = hitNode(x, y);
        if (h) {
            drag.current = { id: h.id, ox: x - h.x, oy: y - h.y, lx: h.x, ly: h.y };
            didDrag.current = false;
            setIsDragging(true);
        }
    };
    const onMM = (ev) => {
        if (!drag.current || mode !== "select")
            return;
        const rect = ref.current.getBoundingClientRect();
        const nx = Math.max(10, Math.min(W - 10, ev.clientX - rect.left - drag.current.ox));
        const ny = Math.max(10, Math.min(H - 10, ev.clientY - rect.top - drag.current.oy));
        if (!didDrag.current) {
            if (Math.hypot(nx - drag.current.lx, ny - drag.current.ly) > 3)
                didDrag.current = true;
        }
        if (didDrag.current) {
            drag.current.lx = nx;
            drag.current.ly = ny;
            onNodeDrag(drag.current.id, nx, ny);
        }
    };
    const onMU = () => {
        if (drag.current && didDrag.current) {
            onNodeDragEnd(drag.current.id, drag.current.lx, drag.current.ly);
        }
        drag.current = null;
        setIsDragging(false);
    };
    const onCl = (ev) => {
        if (didDrag.current) {
            didDrag.current = false;
            return;
        }
        const rect = ref.current.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        const h = hitNode(x, y);
        if (h) {
            onNodeClick(h);
        }
        else if (mode === "select") {
            const eid = hitEdge(x, y);
            if (eid)
                onEdgeClick(eid);
            else
                onCanvasClick(x, y);
        }
        else {
            onCanvasClick(x, y);
        }
    };
    const getCursor = () => {
        if (isDragging)
            return "grabbing";
        if (mode === "calibrate" || mode === "place")
            return "crosshair";
        if (mode === "connect")
            return "cell";
        if (mode === "select")
            return "grab";
        return "default";
    };
    return (<canvas ref={ref} width={W} height={H} style={{ display: "block", cursor: getCursor(), borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, userSelect: "none" }} onClick={onCl} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}/>);
}
