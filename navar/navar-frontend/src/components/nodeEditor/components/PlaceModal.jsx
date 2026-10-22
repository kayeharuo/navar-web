import { useState } from "react";
import { C, F, M, NODE_TYPES, NODE_GROUPS, STORE_UNITS, STALL_STORES, formatStore } from "../editorConstants";
const Btn = ({ children, v = "default", onClick, disabled, sm }) => {
    const styles = {
        default: { background: C.white, color: "#334155", border: `1px solid ${C.border}` },
        primary: { background: C.blue, color: "#fff", border: `1px solid ${C.blue}` },
        warn: { background: C.orange, color: "#fff", border: `1px solid ${C.orange}` },
    };
    const s = styles[v] || styles.default;
    return (<button onClick={onClick} disabled={disabled} style={{
            ...s, borderRadius: 7,
            padding: sm ? "5px 11px" : "8px 18px",
            fontSize: sm ? 11 : 13, fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: F, opacity: disabled ? 0.45 : 1,
        }}>
      {children}
    </button>);
};
export function PlaceModal({ x, y, floor, onConfirm, onCancel }) {
    const [type, setType] = useState("WALKWAY");
    const [label, setLabel] = useState("");
    const [storeUnit, setStoreUnit] = useState("");
    const [stallName, setStallName] = useState("");
    const cfg = NODE_TYPES[type];
    // Only stores on the current floor
    const floorStores = STORE_UNITS.filter(s => s.floor === floor);
    const selectedUnit = storeUnit ? STORE_UNITS.find(s => s.unit === storeUnit) : null;
    const handleStoreChange = (unit) => {
        setStoreUnit(unit);
        if (unit) {
            const found = STORE_UNITS.find(s => s.unit === unit);
            if (found && !label)
                setLabel(found.brand);
        }
    };
    const handleTypeChange = (k) => {
        setType(k);
        setLabel("");
        setStoreUnit("");
        setStallName("");
    };
    // The effective label the node will get
    const effectiveLabel = label.trim() ||
        (type === "STORE_ENTRANCE" && storeUnit ? STORE_UNITS.find(s => s.unit === storeUnit)?.brand || "" : "") ||
        (type === "STALL" ? stallName : "");
    const canPlace = !!effectiveLabel &&
        (type !== "STORE_ENTRANCE" || !!storeUnit) &&
        (type !== "STALL" || !!stallName);
    const handleConfirm = () => {
        if (!canPlace)
            return;
        onConfirm({
            type,
            label: effectiveLabel,
            related_store_id: type === "STORE_ENTRANCE" ? storeUnit || null : null,
            stall_name: type === "STALL" ? stallName || undefined : undefined,
            isPwd: cfg.isPwdType,
            status: "active",
        });
    };
    return (<div style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)", zIndex: 600,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
      <div style={{
            background: C.white, borderRadius: 14, padding: 28,
            width: 500, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}>
        {/* Header */}
        <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, fontFamily: F, marginBottom: 2 }}>
          Place Node
        </div>
        <div style={{ fontSize: 11, color: "#64748B", fontFamily: M, marginBottom: 18 }}>
          {floor} · x={x.toFixed(1)} px, y={y.toFixed(1)} px
        </div>

        {/* Node Type */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M, marginBottom: 10 }}>
          Node Type
        </div>
        {NODE_GROUPS.map(g => (<div key={g} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: M, marginBottom: 6, fontWeight: 700, letterSpacing: "0.06em" }}>
              {g.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(NODE_TYPES).filter(([, v]) => v.group === g).map(([k, v]) => (<button key={k} onClick={() => handleTypeChange(k)} style={{
                    padding: "5px 11px", borderRadius: 6,
                    border: `1.5px solid ${type === k ? v.color : C.border}`,
                    background: type === k ? `${v.color}18` : C.white,
                    fontSize: 11, fontWeight: type === k ? 700 : 500,
                    color: type === k ? v.color : "#475569",
                    cursor: "pointer", fontFamily: F,
                    display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 12 }}>{v.icon !== "·" && v.icon !== "✛" && v.icon !== "○" ? v.icon : ""}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: v.color, display: "inline-block", flexShrink: 0 }}/>
                  {v.label}
                </button>))}
            </div>
          </div>))}

        {/* Accessible Banner */}
        {cfg.isPwdType && (<div style={{ background: C.tealL, border: `1px solid ${C.tealM}`, borderRadius: 7, padding: "8px 13px", fontSize: 12, color: C.teal, fontFamily: F, marginBottom: 12 }}>
            ♿ Accessible type — connected edges will default to <b>accessible</b>.
          </div>)}

        {/* Emergency Banner */}
        {cfg.isEmergencyType && (<div style={{ background: C.redL, border: `1px solid ${C.redM}`, borderRadius: 7, padding: "8px 13px", fontSize: 12, color: C.red, fontFamily: F, marginBottom: 12 }}>
            🚨 Emergency type — connected edges will default to <b>restricted</b>.
          </div>)}

        {/* Floor Transition Banner */}
        {cfg.isFloorTransition && (<div style={{ background: C.violetL, border: `1px solid ${C.violetM}`, borderRadius: 7, padding: "8px 13px", fontSize: 12, color: C.violet, fontFamily: F, marginBottom: 12 }}>
            ⇅ Floor transition — link to a counterpart node on another floor via the properties panel after placing.
          </div>)}

        {/* Linked Store Unit — current floor only */}
        {type === "STORE_ENTRANCE" && (<div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M, marginBottom: 6 }}>
              Linked Store Unit — {floor} <span style={{ color: C.red }}>*</span>
            </label>
            {floorStores.length === 0 ? (<div style={{ fontSize: 11, color: C.orange, fontFamily: F, padding: "8px 10px", background: C.orangeL, border: `1px solid ${C.orangeM}`, borderRadius: 7 }}>
                No store units defined for {floor}.
              </div>) : (<select value={storeUnit} onChange={e => handleStoreChange(e.target.value)} style={{
                    width: "100%", background: C.bg,
                    border: `1px solid ${!storeUnit ? "#FECACA" : C.border}`,
                    borderRadius: 7, padding: "8px 10px",
                    fontSize: 11, color: storeUnit ? C.txt : "#94A3B8",
                    fontFamily: M, outline: "none",
                }}>
                <option value="">— Select store unit —</option>
                {floorStores.map(s => (<option key={s.unit} value={s.unit}>{formatStore(s)}</option>))}
              </select>)}

            {/* Store preview card */}
            {selectedUnit && (<div style={{ marginTop: 8, background: C.blueL, border: `1px solid ${C.blueM}`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>🏪</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, fontFamily: F, marginBottom: 2 }}>
                    {selectedUnit.brand}
                  </div>
                  <div style={{ fontSize: 11, color: "#1D4ED8", fontFamily: F, marginBottom: 4 }}>
                    {selectedUnit.name}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontFamily: M, fontWeight: 700, color: "#fff", background: C.blue, padding: "1px 7px", borderRadius: 4 }}>
                      {selectedUnit.unit}
                    </span>
                    <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: M }}>{selectedUnit.floor}</span>
                  </div>
                </div>
              </div>)}
          </div>)}

        {/* Store / Brand Name (Stall only) */}
        {type === "STALL" && (<div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M, marginBottom: 6 }}>
              Store / Brand <span style={{ color: "#94A3B8", fontWeight: 400, textTransform: "none" }}>(no permanent unit)</span>
            </label>
            <select value={stallName} onChange={e => {
                setStallName(e.target.value);
                if (!label && e.target.value)
                    setLabel(e.target.value);
            }} style={{
                width: "100%", background: C.bg,
                border: `1px solid ${C.goldM}`,
                borderRadius: 7, padding: "8px 10px",
                fontSize: 12, color: stallName ? C.txt : "#94A3B8",
                fontFamily: F, outline: "none", cursor: "pointer",
            }}>
              <option value="">— Select stall store —</option>
              {STALL_STORES.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
            {stallName && (<div style={{ marginTop: 8, background: C.goldL, border: `1px solid ${C.goldM}`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>🛒</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", fontFamily: F }}>{stallName}</div>
                  <div style={{ fontSize: 10, color: "#92400E", fontFamily: M, marginTop: 2 }}>Stall / Kiosk · No permanent unit number</div>
                </div>
              </div>)}
          </div>)}

        {/* Label — mandatory */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: M, marginBottom: 6 }}>
            Label <span style={{ color: C.red }}>*</span>
          </label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={type === "STORE_ENTRANCE" ? (storeUnit ? STORE_UNITS.find(s => s.unit === storeUnit)?.brand || "Store label" : "Auto-filled from store, or type custom")
            : type === "STALL" ? (stallName || "Enter stall name or pick above")
                : cfg.label} style={{
            width: "100%", background: C.bg,
            border: `1px solid ${!effectiveLabel ? "#FECACA" : C.border}`,
            borderRadius: 7, padding: "8px 10px",
            fontSize: 12, color: C.txt, fontFamily: F, outline: "none", boxSizing: "border-box",
        }}/>
          {!effectiveLabel && (<div style={{ fontSize: 10, color: C.red, fontFamily: M, marginTop: 4 }}>Label is required for all node types.</div>)}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn v="default" onClick={onCancel}>Cancel</Btn>
          <Btn v="primary" disabled={!canPlace} onClick={handleConfirm}>
            Place Node
          </Btn>
        </div>
      </div>
    </div>);
}
