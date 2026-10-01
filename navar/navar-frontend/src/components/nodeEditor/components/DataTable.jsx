import { useState } from "react";
import { C, F, M, NODE_TYPES, FLOORS, PATH_TYPE, STORE_UNITS, STALL_STORES } from "../editorConstants";
const PathBadge = ({ type }) => {
    const pt = PATH_TYPE[type] || PATH_TYPE.normal;
    return (<span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700, fontFamily: M,
            color: pt.badgeTxt, background: pt.badge,
            border: `1px solid ${pt.color}30`,
            padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap",
        }}>
      {pt.label}
    </span>);
};
/** Look up a store by unit code and render brand + store name */
const StoreCell = ({ unitCode }) => {
    if (!unitCode)
        return <span style={{ color: "#94A3B8" }}>—</span>;
    const su = STORE_UNITS.find(s => s.unit === unitCode);
    if (!su)
        return <span style={{ fontFamily: M, color: C.blue, fontSize: 11 }}>{unitCode}</span>;
    return (<div>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.blue, fontFamily: F }}>{su.brand}</div>
      <div style={{ fontSize: 10, color: "#1D4ED8", fontFamily: F, lineHeight: 1.4 }}>{su.name}</div>
      <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
        <span style={{ fontSize: 9, fontFamily: M, fontWeight: 700, color: "#fff", background: C.blue, padding: "1px 5px", borderRadius: 3 }}>{su.unit}</span>
        <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: M }}>{su.floor}</span>
      </div>
    </div>);
};
/** Render a stall store name nicely */
const StallCell = ({ stallName }) => {
    if (!stallName)
        return <span style={{ color: "#94A3B8" }}>—</span>;
    const known = STALL_STORES.includes(stallName);
    return (<div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", fontFamily: F }}>{stallName}</div>
      <div style={{ fontSize: 9, color: "#92400E", fontFamily: M }}>
        {known ? "Stall / Kiosk" : "Custom · not in list"}
      </div>
    </div>);
};
export function DataTable({ nodes, edges, calibration, onClose }) {
    const [tab, setTab] = useState("nodes");
    const allNodes = Object.values(nodes).flat();
    const allEdges = Object.values(edges).flat();
    const tabs = [
        { id: "nodes", label: `Nodes (${allNodes.length})` },
        { id: "edges", label: `Edges (${allEdges.length})` },
        { id: "stores", label: `Store Units (${STORE_UNITS.length})` },
        { id: "scale", label: "Scale Calibration" },
    ];
    return (<div style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 400,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
        }}>
      <div style={{
            background: C.white, borderRadius: 14, width: "100%", maxWidth: 980,
            maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}>
        {/* Header */}
        <div style={{
            padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.txt, fontFamily: F }}>Map Data</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 20px", border: "none",
                borderBottom: `2px solid ${tab === t.id ? C.blue : "transparent"}`,
                background: "transparent",
                fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? C.blue : "#64748B",
                cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
            }}>
              {t.label}
            </button>))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* ── Nodes ── */}
          {tab === "nodes" && (<table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1F5F9", position: "sticky", top: 0 }}>
                  {["node_id", "floor", "type", "label", "linked_store_unit", "linked_store", "x", "y", "pwd", "cross_floor", "status"].map(h => (<th key={h} style={{
                    padding: "9px 13px", fontSize: 10, fontWeight: 700, color: "#475569",
                    letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M,
                    textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
                }}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {allNodes.map((n, i) => {
                const cfg = NODE_TYPES[n.type] || NODE_TYPES.WALKWAY;
                return (<tr key={n.id} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? C.white : "#F8FAFC" }}>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#64748B" }}>{n.id}</td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#475569" }}>{n.floor}</td>
                      <td style={{ padding: "8px 13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }}/>
                          <span style={{ fontSize: 11, fontFamily: M, color: "#334155" }}>{n.type}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 13px", fontSize: 12, fontFamily: F, color: "#0F172A", fontWeight: 500 }}>
                        {n.label || <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      {/* linked_store_unit — only meaningful for STORE_ENTRANCE nodes */}
                      <td style={{ padding: "8px 13px" }}>
                        {n.type === "STORE_ENTRANCE"
                        ? <StoreCell unitCode={n.related_store_id}/>
                        : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      {/* linked_store — only meaningful for STALL nodes */}
                      <td style={{ padding: "8px 13px" }}>
                        {n.type === "STALL"
                        ? <StallCell stallName={n.stall_name}/>
                        : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#475569" }}>{Math.round(n.x)}</td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#475569" }}>{Math.round(n.y)}</td>
                      <td style={{ padding: "8px 13px" }}>
                        {n.isPwd
                        ? <span style={{ fontSize: 10, color: "#0F766E", background: "#CCFBF1", border: "1px solid #99F6E4", padding: "2px 7px", borderRadius: 4, fontFamily: M, fontWeight: 700 }}>PWD</span>
                        : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 13px" }}>
                        {n.cross_floor_link
                        ? <span style={{ fontSize: 10, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "2px 7px", borderRadius: 4, fontFamily: M, fontWeight: 700 }}>⇅ {n.cross_floor_link}</span>
                        : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 13px" }}>
                        <span style={{
                        fontSize: 10, color: n.status === "active" ? "#15803D" : "#475569",
                        background: n.status === "active" ? "#DCFCE7" : "#F1F5F9",
                        border: `1px solid ${n.status === "active" ? "#BBF7D0" : "#CBD5E1"}`,
                        padding: "2px 7px", borderRadius: 4, fontFamily: M, fontWeight: 700,
                    }}>
                          {n.status}
                        </span>
                      </td>
                    </tr>);
            })}
              </tbody>
            </table>)}

          {/* ── Edges ── */}
          {tab === "edges" && (<table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1F5F9", position: "sticky", top: 0 }}>
                  {["edge_id", "from_node_id", "to_node_id", "floor_id", "distance_value", "path_type"].map(h => (<th key={h} style={{
                    padding: "9px 13px", fontSize: 10, fontWeight: 700, color: "#475569",
                    letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M,
                    textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
                }}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {allEdges.map((e, i) => {
                const fromNode = allNodes.find(n => n.id === e.from);
                const toNode = allNodes.find(n => n.id === e.to);
                return (<tr key={e.id} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? C.white : "#F8FAFC" }}>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#64748B" }}>{e.id}</td>
                      <td style={{ padding: "8px 13px" }}>
                        <div style={{ fontSize: 12, fontFamily: F, color: "#334155", fontWeight: 500 }}>
                          {fromNode?.label || <span style={{ fontFamily: M, color: "#94A3B8", fontSize: 11 }}>{e.from}</span>}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: M, color: "#94A3B8" }}>{e.from}</div>
                      </td>
                      <td style={{ padding: "8px 13px" }}>
                        <div style={{ fontSize: 12, fontFamily: F, color: "#334155", fontWeight: 500 }}>
                          {toNode?.label || <span style={{ fontFamily: M, color: "#94A3B8", fontSize: 11 }}>{e.to}</span>}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: M, color: "#94A3B8" }}>{e.to}</div>
                      </td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#475569" }}>{e.floor}</td>
                      <td style={{ padding: "8px 13px" }}>
                        {e.distance_value != null
                        ? <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: "#0F172A" }}>
                              {e.distance_value.toFixed(1)}{" "}
                              <span style={{ fontWeight: 400, color: "#64748B", fontSize: 10 }}>m</span>
                            </span>
                        : <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: M }}>— no scale</span>}
                      </td>
                      <td style={{ padding: "8px 13px" }}><PathBadge type={e.path_type}/></td>
                    </tr>);
            })}
              </tbody>
            </table>)}

          {/* ── Scale ── */}
          {tab === "scale" && (<div style={{ padding: 22 }}>
              {FLOORS.map(fl => {
                const cal = calibration[fl];
                return (<div key={fl} style={{
                        background: cal ? C.greenL : C.redL,
                        border: `1px solid ${cal ? C.greenM : C.redM}`,
                        borderRadius: 10, padding: "14px 18px", marginBottom: 12,
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cal ? 10 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cal ? C.green : C.red, fontFamily: F }}>{fl}</span>
                      <span style={{ fontSize: 11, fontFamily: M, fontWeight: 700, color: cal ? "#15803D" : "#B91C1C" }}>
                        {cal ? "✓ Calibrated" : "✗ Not calibrated"}
                      </span>
                    </div>
                    {cal && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
                        {[
                            ["Reference Line", cal.refLine || "—"],
                            ["Real Distance", `${cal.meters} m`],
                            ["px / meter", `${cal.pxPerMeter.toFixed(2)} px/m`],
                            ["Path Loss Exp.", cal.pathLossExponent != null ? `n = ${cal.pathLossExponent}` : "—"],
                        ].map(([l, v]) => (<div key={l} style={{ background: C.white, border: `1px solid ${C.greenM}`, borderRadius: 7, padding: "8px 12px" }}>
                            <div style={{ fontSize: 9, color: "#64748B", fontFamily: M, marginBottom: 3 }}>{l.toUpperCase()}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", fontFamily: l === "Reference Line" ? F : M }}>{v}</div>
                          </div>))}
                      </div>)}
                    {!cal && (<div style={{ fontSize: 12, color: "#B91C1C", fontFamily: F, marginTop: 6 }}>
                        Switch to Set Scale mode → draw the reference line on this floor to set the scale.
                      </div>)}
                  </div>);
            })}
            </div>)}

          {/* ── Store Units ── */}
          {tab === "stores" && (<table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1F5F9", position: "sticky", top: 0 }}>
                  {["unit", "brand", "store_name", "floor", "mapped_node"].map(h => (<th key={h} style={{
                    padding: "9px 13px", fontSize: 10, fontWeight: 700, color: "#475569",
                    letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M,
                    textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
                }}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {STORE_UNITS.map((s, i) => {
                const mappedNode = allNodes.find(n => n.related_store_id === s.unit);
                return (<tr key={s.unit} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? C.white : "#F8FAFC" }}>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, fontWeight: 700, color: C.blue }}>{s.unit}</td>
                      <td style={{ padding: "8px 13px", fontSize: 12, fontFamily: F, fontWeight: 600, color: "#0F172A" }}>{s.brand}</td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: F, color: "#475569" }}>{s.name}</td>
                      <td style={{ padding: "8px 13px", fontSize: 11, fontFamily: M, color: "#64748B" }}>{s.floor}</td>
                      <td style={{ padding: "8px 13px" }}>
                        {mappedNode
                        ? <span style={{ fontSize: 10, color: "#15803D", background: "#DCFCE7", border: "1px solid #BBF7D0", padding: "2px 8px", borderRadius: 4, fontFamily: M, fontWeight: 700 }}>
                              ✓ {mappedNode.id} · {mappedNode.label}
                            </span>
                        : <span style={{ fontSize: 10, color: C.orange, background: C.orangeL, border: `1px solid ${C.orangeM}`, padding: "2px 8px", borderRadius: 4, fontFamily: M, fontWeight: 700 }}>
                              ✗ unmapped
                            </span>}
                      </td>
                    </tr>);
            })}
              </tbody>
            </table>)}
        </div>

        {/* Footer */}
        <div style={{
            padding: "12px 22px", borderTop: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#475569", fontFamily: M }}>
            {allNodes.length} nodes · {allEdges.length} edges · {allEdges.filter(e => e.path_type === "accessible").length} accessible · {allEdges.filter(e => e.path_type === "restricted").length} restricted
            {" · "}{STORE_UNITS.filter(s => allNodes.some(n => n.related_store_id === s.unit)).length}/{STORE_UNITS.length} stores mapped
          </span>
          <button onClick={onClose} style={{
            background: C.white, color: "#334155", border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: F,
        }}>
            Close
          </button>
        </div>
      </div>
    </div>);
}
