import { useRef, useEffect, useState, useCallback } from "react";
import { C, M, F, NODE_TYPES, PATH_TYPE } from "../editorConstants";

// World space = floor-plan IMAGE pixels (origin top-left, y grows down).
// Nodes keep a constant on-screen size, so zooming in never makes them bigger:
// it only makes every click land on a more precise pixel of the plan.
const MIN_K = 0.02;
const MAX_K = 40;
const NODE_R = 4.5;
const HIT_NODE = 10;
const HIT_EDGE = 6;
const CLICK_SLOP = 4;
const BAR_METERS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const NO_ICON = new Set(["·", "✛", "○"]);
const PLAIN = new Set(["WALKWAY", "JUNCTION"]);
const FIELDS = ["INPUT", "TEXTAREA", "SELECT"];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function NodeCanvas({ nodes, edges, mode, editable, selectedId, selectedEdgeId, connectFrom, calibPts, savedRef, image, imageStatus, pxPerMeter, onCanvasClick, onNodeClick, onNodeDrag, onNodeDragEnd, onNodeNudge, onEdgeClick, }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const gesture = useRef(null);
    const fitted = useRef(false);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
    const [cursor, setCursor] = useState(null);
    const [showLabels, setShowLabels] = useState(true);
    const [showIcons, setShowIcons] = useState(false);
    const W = image?.naturalWidth || 0;
    const H = image?.naturalHeight || 0;
    const ready = imageStatus === "ready" && W > 0;

    const fit = useCallback(() => {
        if (!ready || !size.w || !size.h)
            return;
        const k = Math.min(size.w / W, size.h / H) * 0.96;
        setView({ k, tx: (size.w - W * k) / 2, ty: (size.h - H * k) / 2 });
    }, [ready, size.w, size.h, W, H]);
    useEffect(() => {
        if (ready && size.w && !fitted.current) {
            fitted.current = true;
            fit();
        }
    }, [ready, size.w, fit]);
    const zoomAt = useCallback((sx, sy, factor) => {
        setView(v => {
            const k = clamp(v.k * factor, MIN_K, MAX_K);
            const f = k / v.k;
            return { k, tx: sx - (sx - v.tx) * f, ty: sy - (sy - v.ty) * f };
        });
    }, []);
    useEffect(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ w: Math.floor(width), h: Math.floor(height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    useEffect(() => {
        const el = canvasRef.current;
        if (!el)
            return;
        const onWheel = (e) => {
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAt]);
    // Space + drag pans. Arrow keys nudge the selected node by 1 screen pixel (Shift = 10).
    useEffect(() => {
        const down = (e) => {
            if (FIELDS.includes(e.target?.tagName))
                return;
            if (e.code === "Space") {
                setSpaceHeld(true);
                e.preventDefault();
                return;
            }
            if (!editable || !selectedId || !e.key.startsWith("Arrow"))
                return;
            const n = nodes.find(x => x.id === selectedId);
            if (!n || !W)
                return;
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) / view.k;
            const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
            const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
            onNodeNudge(n.id, clamp(n.x + dx, 0, W), clamp(n.y + dy, 0, H));
        };
        const up = (e) => { if (e.code === "Space")
            setSpaceHeld(false); };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    }, [editable, selectedId, nodes, view.k, W, H, onNodeNudge]);

    const toScreen = (x, y) => [x * view.k + view.tx, y * view.k + view.ty];
    const toWorld = (sx, sy) => [(sx - view.tx) / view.k, (sy - view.ty) / view.k];

    // ── Drawing (runs after every render; the canvas is cheap to repaint) ──
    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv || !size.w || !size.h)
            return;
        const dpr = window.devicePixelRatio || 1;
        if (cv.width !== Math.round(size.w * dpr) || cv.height !== Math.round(size.h * dpr)) {
            cv.width = Math.round(size.w * dpr);
            cv.height = Math.round(size.h * dpr);
        }
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#E9EDF3";
        ctx.fillRect(0, 0, size.w, size.h);
        if (!ready)
            return;
        ctx.imageSmoothingEnabled = view.k < 2;
        ctx.drawImage(image, view.tx, view.ty, W * view.k, H * view.k);
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 1;
        ctx.strokeRect(view.tx - 0.5, view.ty - 0.5, W * view.k + 1, H * view.k + 1);

        const byId = new Map(nodes.map(n => [n.id, n]));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const e of edges) {
            const a = byId.get(e.from), b = byId.get(e.to);
            if (!a || !b)
                continue;
            const pt = PATH_TYPE[e.path_type] || PATH_TYPE.normal;
            const sel = e.id === selectedEdgeId;
            const [ax, ay] = toScreen(a.x, a.y), [bx, by] = toScreen(b.x, b.y);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = sel ? pt.color : pt.color + "B0";
            ctx.lineWidth = sel ? 3.5 : 2;
            ctx.setLineDash(pt.dash);
            ctx.stroke();
            ctx.setLineDash([]);
            if (showLabels && e.distance_value != null && Math.hypot(bx - ax, by - ay) > 46) {
                const txt = `${e.distance_value.toFixed(1)}m`;
                ctx.font = `600 10px ${M}`;
                const tw = ctx.measureText(txt).width;
                const mx = (ax + bx) / 2, my = (ay + by) / 2;
                ctx.fillStyle = "rgba(255,255,255,0.92)";
                ctx.fillRect(mx - tw / 2 - 3, my - 7, tw + 6, 14);
                ctx.fillStyle = pt.color;
                ctx.fillText(txt, mx, my);
            }
        }
        // Scale reference: the saved one (faint) or the one being drawn (amber)
        const drawRef = (p, q, alpha) => {
            const [px, py] = toScreen(p.x, p.y), [qx, qy] = toScreen(q.x, q.y);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(qx, qy);
            ctx.strokeStyle = "#F59E0B";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            for (const [x, y] of [[px, py], [qx, qy]]) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = "#F59E0B";
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        };
        if (savedRef && calibPts.length === 0)
            drawRef(savedRef.refStart, savedRef.refEnd, 0.5);
        if (calibPts.length === 1) {
            const [x, y] = toScreen(calibPts[0].x, calibPts[0].y);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#F59E0B";
            ctx.fill();
        }
        if (calibPts.length === 2) {
            drawRef(calibPts[0], calibPts[1], 1);
            const [px, py] = toScreen(calibPts[0].x, calibPts[0].y), [qx, qy] = toScreen(calibPts[1].x, calibPts[1].y);
            const txt = `${Math.hypot(calibPts[1].x - calibPts[0].x, calibPts[1].y - calibPts[0].y).toFixed(1)} px`;
            ctx.font = `700 11px ${M}`;
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle = "#FFFBEB";
            ctx.fillRect((px + qx) / 2 - tw / 2 - 5, (py + qy) / 2 - 9, tw + 10, 18);
            ctx.fillStyle = "#92400E";
            ctx.fillText(txt, (px + qx) / 2, (py + qy) / 2);
        }

        // Nodes: constant on-screen size, whatever the zoom
        for (const n of nodes) {
            const cfg = NODE_TYPES[n.type] || NODE_TYPES.WALKWAY;
            const sel = n.id === selectedId, from = n.id === connectFrom;
            const [x, y] = toScreen(n.x, n.y);
            if (x < -30 || y < -30 || x > size.w + 30 || y > size.h + 30)
                continue;
            const r = PLAIN.has(n.type) ? NODE_R - 0.5 : NODE_R + 1;
            if (sel || from) {
                ctx.beginPath();
                ctx.arc(x, y, r + 5, 0, Math.PI * 2);
                ctx.fillStyle = from ? "#F59E0B30" : "#2563EB25";
                ctx.fill();
                ctx.strokeStyle = from ? "#F59E0B" : "#2563EB";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            if (cfg.isPwdType || n.isPwd) {
                ctx.beginPath();
                ctx.arc(x, y, r + 3, 0, Math.PI * 2);
                ctx.strokeStyle = "#0D9488";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = cfg.color;
            ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (showIcons && cfg.icon && !NO_ICON.has(cfg.icon) && cfg.icon !== "✛") {
                ctx.font = "12px serif";
                ctx.fillStyle = cfg.color;
                ctx.fillText(cfg.icon, x, y - r - 8);
            }
            if (cfg.isFloorTransition && n.cross_floor_link) {
                ctx.font = `bold 10px ${M}`;
                ctx.fillStyle = "#7C3AED";
                ctx.fillText("⇅", x + r + 7, y - r - 2);
            }
            if (showLabels && n.label && (sel || view.k >= 0.35 || !PLAIN.has(n.type))) {
                ctx.font = `600 10px ${F}`;
                const label = n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label;
                const lw = ctx.measureText(label).width;
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillRect(x - lw / 2 - 2, y + r + 3, lw + 4, 12);
                ctx.fillStyle = "#0F172A";
                ctx.fillText(label, x, y + r + 9);
            }
        }
        // Crosshair for precise clicking
        if (cursor && (mode === "place" || mode === "calibrate")) {
            ctx.strokeStyle = "rgba(37,99,235,0.55)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cursor.sx + 0.5, 0);
            ctx.lineTo(cursor.sx + 0.5, size.h);
            ctx.moveTo(0, cursor.sy + 0.5);
            ctx.lineTo(size.w, cursor.sy + 0.5);
            ctx.stroke();
        }
        // Live coordinate read-out: image pixels, plus meters once the floor has a scale
        if (cursor) {
            const [wx, wy] = toWorld(cursor.sx, cursor.sy);
            const txt = `${wx.toFixed(1)}, ${wy.toFixed(1)} px` + (pxPerMeter ? `  =  ${(wx / pxPerMeter).toFixed(2)}, ${(wy / pxPerMeter).toFixed(2)} m` : "");
            ctx.font = `600 11px ${M}`;
            ctx.textAlign = "left";
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle = "rgba(15,23,42,0.82)";
            ctx.fillRect(8, size.h - 26, tw + 14, 20);
            ctx.fillStyle = "#F8FAFC";
            ctx.fillText(txt, 15, size.h - 16);
            ctx.textAlign = "center";
        }
        // Scale bar in real meters, only when the floor is calibrated
        if (pxPerMeter) {
            const target = 110 / (pxPerMeter * view.k);
            const meters = BAR_METERS.find(m => m >= target) || BAR_METERS[BAR_METERS.length - 1];
            const len = meters * pxPerMeter * view.k;
            const x0 = size.w - len - 18, y0 = size.h - 18;
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.fillRect(x0 - 8, y0 - 20, len + 16, 30);
            ctx.strokeStyle = "#0F172A";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0, y0 - 4);
            ctx.lineTo(x0, y0);
            ctx.lineTo(x0 + len, y0);
            ctx.lineTo(x0 + len, y0 - 4);
            ctx.stroke();
            ctx.font = `700 10px ${M}`;
            ctx.fillStyle = "#0F172A";
            ctx.fillText(`${meters} m`, x0 + len / 2, y0 - 10);
        }
    });

    // ── Pointer handling ──
    const localPoint = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };
    const hitNode = (sx, sy) => {
        let best = null, bestD = HIT_NODE;
        for (const n of nodes) {
            const [x, y] = toScreen(n.x, n.y);
            const d = Math.hypot(sx - x, sy - y);
            if (d <= bestD) {
                best = n;
                bestD = d;
            }
        }
        return best;
    };
    const hitEdge = (sx, sy) => {
        const byId = new Map(nodes.map(n => [n.id, n]));
        for (const e of edges) {
            const a = byId.get(e.from), b = byId.get(e.to);
            if (!a || !b)
                continue;
            const [ax, ay] = toScreen(a.x, a.y), [bx, by] = toScreen(b.x, b.y);
            const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
            if (!len2)
                continue;
            const t = clamp(((sx - ax) * dx + (sy - ay) * dy) / len2, 0, 1);
            if (Math.hypot(sx - (ax + t * dx), sy - (ay + t * dy)) <= HIT_EDGE)
                return e.id;
        }
        return null;
    };
    const onPointerDown = (e) => {
        if (!ready || (e.button !== 0 && e.button !== 1))
            return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const [sx, sy] = localPoint(e);
        const node = e.button === 0 ? hitNode(sx, sy) : null;
        gesture.current = { sx, sy, moved: false, node, forcePan: e.button === 1 || spaceHeld, startView: view };
    };
    const onPointerMove = (e) => {
        const [sx, sy] = localPoint(e);
        setCursor({ sx, sy });
        const g = gesture.current;
        if (!g)
            return;
        if (!g.moved && Math.hypot(sx - g.sx, sy - g.sy) > CLICK_SLOP) {
            g.moved = true;
            g.kind = g.node && editable && mode === "select" && !g.forcePan ? "node" : "pan";
            setDragging(true);
        }
        if (!g.moved)
            return;
        if (g.kind === "pan") {
            setView({ ...g.startView, tx: g.startView.tx + (sx - g.sx), ty: g.startView.ty + (sy - g.sy) });
            return;
        }
        const [wx, wy] = toWorld(sx, sy);
        g.last = [clamp(wx, 0, W), clamp(wy, 0, H)];
        onNodeDrag(g.node.id, g.last[0], g.last[1]);
    };
    const endGesture = (e, cancelled) => {
        const g = gesture.current;
        gesture.current = null;
        setDragging(false);
        if (!g || cancelled)
            return;
        if (g.moved) {
            if (g.kind === "node" && g.last)
                onNodeDragEnd(g.node.id, g.last[0], g.last[1]);
            return;
        }
        const [sx, sy] = localPoint(e);
        if (g.node)
            return onNodeClick(g.node);
        if (mode === "select") {
            const edgeId = hitEdge(sx, sy);
            if (edgeId)
                return onEdgeClick(edgeId);
        }
        const [wx, wy] = toWorld(sx, sy);
        if (wx < 0 || wy < 0 || wx > W || wy > H)
            return;
        // Two decimals of a pixel: sub-pixel precision when zoomed in
        onCanvasClick(Math.round(wx * 100) / 100, Math.round(wy * 100) / 100);
    };

    const cursorStyle = dragging ? "grabbing" : spaceHeld ? "grab" : mode === "place" || mode === "calibrate" ? "crosshair" : mode === "connect" ? "cell" : "default";
    const btn = { width: 30, height: 30, border: `1px solid ${C.border}`, background: C.white, borderRadius: 7, cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#334155", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center" };
    const chip = (on) => ({ padding: "0 9px", height: 26, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blueL : C.white, color: on ? C.blue : "#64748B", borderRadius: 7, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: M });
    const hint = mode === "calibrate"
        ? calibPts.length === 0 ? "Click point A at one end of a known distance" : calibPts.length === 1 ? "Click point B at the other end" : "Line drawn — enter the real distance"
        : mode === "place" ? "Click the exact spot to place a node"
            : mode === "connect" ? connectFrom ? "Click another node to connect" : "Click a node to start an edge"
                : "Click to select · drag a node to move · arrow keys nudge · drag empty space to pan · scroll to zoom";
    const message = imageStatus === "loading" ? "Loading floor plan…"
        : imageStatus === "error" ? "The floor plan image could not be loaded. Reload the editor."
            : "No floor plan was submitted for this floor.";
    const overlay = { position: "absolute", background: "rgba(255,255,255,0.92)", fontFamily: M };
    return (<div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", background: "#E9EDF3" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: cursorStyle, touchAction: "none", userSelect: "none" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)} onPointerLeave={() => { if (!gesture.current)
        setCursor(null); }}/>
      {!ready && (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: F, fontSize: 13, color: imageStatus === "error" ? C.red : "#475569", fontWeight: 600 }}>{message}</div>)}
      {ready && (<>
          <div style={{ ...overlay, top: 8, left: 8, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 10, color: "#475569", fontWeight: 600, pointerEvents: "none", maxWidth: "70%" }}>{hint}</div>
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
            <button title="Zoom in" style={btn} onClick={() => zoomAt(size.w / 2, size.h / 2, 1.5)}>+</button>
            <button title="Zoom out" style={btn} onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.5)}>−</button>
            <button title="Fit the whole floor plan" style={{ ...btn, fontSize: 10, fontFamily: M }} onClick={fit}>Fit</button>
            <button title="Actual image pixels (1:1)" style={{ ...btn, fontSize: 10, fontFamily: M }} onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / view.k)}>1:1</button>
            <div style={{ ...overlay, position: "static", fontSize: 10, color: "#475569", padding: "2px 7px", borderRadius: 5 }}>{Math.round(view.k * 100)}%</div>
            <button style={chip(showLabels)} onClick={() => setShowLabels(v => !v)}>Labels</button>
            <button style={chip(showIcons)} onClick={() => setShowIcons(v => !v)}>Icons</button>
          </div>
        </>)}
    </div>);
}
