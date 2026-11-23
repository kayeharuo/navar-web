import { C, F, M } from "../editorConstants";

export function EmergencyToggle({ checked, onChange, disabled = false }) {
    return <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", marginBottom: 14, borderRadius: 7, border: `1px solid ${checked ? C.redM : C.border}`, background: checked ? C.redL : C.bg, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
        <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: F, fontSize: 12, fontWeight: 700, color: checked ? C.red : C.txt }}>Emergency node</span>
            <span style={{ display: "block", fontFamily: M, fontSize: 10, color: "#64748B", marginTop: 3 }}>Mark this location for emergency use.</span>
        </span>
        <span aria-hidden="true" style={{ width: 32, height: 18, padding: 2, boxSizing: "border-box", borderRadius: 10, background: checked ? C.red : "#CBD5E1", flexShrink: 0 }}>
            <span style={{ display: "block", width: 14, height: 14, borderRadius: "50%", background: C.white, transform: checked ? "translateX(14px)" : "translateX(0)", transition: "transform 0.15s" }} />
        </span>
    </button>;
}
