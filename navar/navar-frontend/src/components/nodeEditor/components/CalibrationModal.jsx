import { useState } from "react";
import { C, F, M } from "../editorConstants";
const pxDist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
// Common PLE reference values for quick-fill presets
const PLE_PRESETS = [
    { label: "Free space", value: 2.0, desc: "Unobstructed outdoor / ideal open space" },
    { label: "Open retail floor", value: 2.5, desc: "Wide mall corridors, minimal obstacles" },
    { label: "Typical indoor", value: 3.0, desc: "Retail floor with shelves and fixtures" },
    { label: "Dense indoor", value: 3.5, desc: "Crowded environment, heavy furnishings" },
    { label: "Heavy obstruction", value: 4.5, desc: "Concrete walls, elevator shafts, metal" },
];
const Label = ({ children }) => (<div style={{
        fontSize: 10, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase",
        fontFamily: M, marginBottom: 6,
    }}>
    {children}
  </div>);
export function CalibrationModal({ floor, calibPts, onConfirm, onCancel }) {
    const [meters, setMeters] = useState("");
    const [refLine, setRefLine] = useState("");
    const [ple, setPle] = useState("2.0");
    const pxLen = calibPts.length === 2 ? Math.round(pxDist(calibPts[0], calibPts[1])) : 0;
    const mVal = parseFloat(meters);
    const pleVal = parseFloat(ple);
    const pxPerM = pxLen > 0 && mVal > 0 ? pxLen / mVal : 0;
    const pleOk = !isNaN(pleVal) && pleVal >= 1.0 && pleVal <= 6.0;
    const canSave = mVal > 0 && pxLen > 0 && pleOk;
    // PLE quality indicator
    const pleHint = !ple ? null
        : !pleOk ? { label: "Out of range", color: C.red }
            : pleVal < 2.0 ? { label: "Below free-space — unusual", color: C.orange }
                : pleVal <= 2.2 ? { label: "Free space / open hall", color: C.teal }
                    : pleVal <= 2.8 ? { label: "Open retail / wide corridor", color: C.teal }
                        : pleVal <= 3.4 ? { label: "Typical indoor environment", color: C.green }
                            : pleVal <= 4.0 ? { label: "Dense indoor / heavy fixtures", color: C.gold }
                                : { label: "Heavy obstruction / walls", color: C.orange };
    return (<div style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
        }}>
      <div style={{
            background: C.white, borderRadius: 14, padding: 28,
            width: 480, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, fontFamily: F, marginBottom: 2 }}>
          Set Scale — {floor}
        </div>
        <div style={{ fontSize: 11, color: "#64748B", fontFamily: M, marginBottom: 20 }}>
          Line drawn: <b>{pxLen} px</b>
        </div>

        {/* Reference Line Name */}
        <div style={{ marginBottom: 14 }}>
          <Label>Reference Line Name</Label>
          <input value={refLine} onChange={e => setRefLine(e.target.value)} placeholder="e.g. Main corridor width" style={{
            width: "100%", background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "8px 10px",
            fontSize: 12, color: C.txt, fontFamily: F, outline: "none", boxSizing: "border-box",
        }}/>
        </div>

        {/* Real-world Length */}
        <div style={{ marginBottom: 20 }}>
          <Label>Real-world Length (meters)</Label>
          <input type="number" min="0.1" step="0.1" value={meters} onChange={e => setMeters(e.target.value)} placeholder="e.g. 15" style={{
            width: "100%", background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "8px 10px",
            fontSize: 12, color: C.txt, fontFamily: F, outline: "none", boxSizing: "border-box",
        }}/>
          {meters && mVal > 0 && (<div style={{ marginTop: 8, fontSize: 11, color: C.teal, fontFamily: M }}>
              → {pxPerM.toFixed(2)} px/m
            </div>)}
        </div>

        {/* ── Path Loss Exponent ── */}
        <div style={{ marginBottom: 20 }}>
          <Label>
            Path Loss Exponent (n){" "}
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#94A3B8" }}>
              — BLE signal model
            </span>
          </Label>

          {/* Explainer */}
          <div style={{
            background: "#EFF6FF", border: `1px solid ${C.blueM}`,
            borderRadius: 8, padding: "8px 11px", marginBottom: 10,
            fontSize: 10, color: "#1D4ED8", fontFamily: F, lineHeight: 1.65,
        }}>
            <b>n</b> controls how fast BLE signal strength (RSSI) decays with distance.{" "}
            Higher values model environments with more signal obstruction.
            Formula: <span style={{ fontFamily: M }}>RSSI = RSSI₀ − 10·n·log₁₀(d)</span>
          </div>

          {/* Quick-fill presets */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {PLE_PRESETS.map(p => (<button key={p.value} onClick={() => setPle(String(p.value))} title={p.desc} style={{
                padding: "3px 10px", borderRadius: 6,
                border: `1.5px solid ${parseFloat(ple) === p.value ? C.blue : C.border}`,
                background: parseFloat(ple) === p.value ? C.blueL : "#F8FAFC",
                color: parseFloat(ple) === p.value ? C.blue : "#475569",
                fontSize: 10, fontWeight: parseFloat(ple) === p.value ? 700 : 500,
                cursor: "pointer", fontFamily: M, whiteSpace: "nowrap",
            }}>
                {p.value} · {p.label}
              </button>))}
          </div>

          {/* Input */}
          <input type="number" min="1.0" max="6.0" step="0.1" value={ple} onChange={e => setPle(e.target.value)} placeholder="1.0 – 6.0" style={{
            width: "100%", background: C.bg,
            border: `1px solid ${!ple ? C.border : pleOk ? C.border : "#FECACA"}`,
            borderRadius: 7, padding: "8px 10px",
            fontSize: 13, fontWeight: 700, color: C.txt,
            fontFamily: M, outline: "none", boxSizing: "border-box",
        }}/>

          {/* Quality indicator */}
          {pleHint && (<div style={{
                marginTop: 7, display: "flex", alignItems: "center", gap: 6,
                background: pleHint.color + "12",
                border: `1px solid ${pleHint.color}30`,
                borderRadius: 6, padding: "5px 10px",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: pleHint.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 10, color: pleHint.color, fontFamily: F, fontWeight: 600 }}>
                {pleHint.label}
              </span>
              <span style={{ fontSize: 9, color: "#64748B", fontFamily: M, marginLeft: "auto" }}>
                n = {ple}
              </span>
            </div>)}

          {/* Range reference */}
          <div style={{ marginTop: 8, fontSize: 9, color: "#94A3B8", fontFamily: M, lineHeight: 1.7 }}>
            Typical range: <b style={{ color: "#475569" }}>2.0</b> (open space) –{" "}
            <b style={{ color: "#475569" }}>4.5</b> (heavy obstruction). Value must be 1.0–6.0.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: C.white, color: "#334155", border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F,
        }}>
            Cancel
          </button>
          <button disabled={!canSave} onClick={() => onConfirm({
            pxPerMeter: pxPerM,
            refLine,
            meters: mVal,
            pathLossExponent: pleVal,
        })} style={{
            background: canSave ? C.blue : "#94A3B8",
            color: "#fff", border: "none",
            borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600,
            cursor: canSave ? "pointer" : "not-allowed",
            fontFamily: F, transition: "background 0.15s",
        }}>
            Save Calibration
          </button>
        </div>
      </div>
    </div>);
}
