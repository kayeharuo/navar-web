import { useState } from "react";
import { C, F, M, NODE_TYPES } from "../editorConstants";

export function TransitionGroupPicker({ type, value, groups, nodes, floor, nodeId, disabled, onChange, onCreate, onRename }) {
    const [action, setAction] = useState(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const selected = groups.find(g => g.id === value);
    const matching = groups.filter(g => g.type === type);
    const occupied = new Set((nodes[floor] || []).filter(n => n.id !== nodeId).map(n => n.transition_group_id));
    const field = { width: "100%", boxSizing: "border-box", background: disabled ? "#F8FAFC" : C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, color: C.txt, fontFamily: F, outline: "none" };
    const button = { border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: "#475569", padding: "5px 10px", fontSize: 11, fontWeight: 600, fontFamily: F, cursor: "pointer" };
    const begin = (next) => { setAction(next); setName(next === "rename" ? selected?.name || "" : ""); setError(""); };
    const submit = () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 100) { setError("Enter a name of 1 to 100 characters."); return; }
        if (matching.some(g => g.name.toLowerCase() === trimmed.toLowerCase() && (action !== "rename" || g.id !== value))) { setError("A group with this name already exists. Choose it from the list."); return; }
        if (action === "rename") onRename(value, trimmed);
        else onCreate({ id: crypto.randomUUID(), type, name: trimmed });
        setAction(null); setName(""); setError("");
    };
    return <div style={{ marginBottom: 12 }}>
        <select aria-label="Transition group" disabled={disabled} value={value || ""} style={{ ...field, cursor: disabled ? "not-allowed" : "pointer" }} onChange={e => {
            if (e.target.value === "__create") begin("create");
            else { setAction(null); setError(""); onChange(e.target.value); }
        }}>
            <option value="">Select {NODE_TYPES[type]?.label?.toLowerCase()} group...</option>
            {matching.map(g => <option key={g.id} value={g.id} disabled={occupied.has(g.id)}>{g.name}{occupied.has(g.id) ? " (already on this floor)" : ""}</option>)}
            <option value="__create">+ Create new group...</option>
        </select>
        {selected && onRename && !disabled && !action && <button type="button" style={{ ...button, marginTop: 6, color: C.violet, borderColor: C.violetM, background: C.violetL }} onClick={() => begin("rename")}>Rename group</button>}
        {action && !disabled && <div style={{ padding: "10px 12px", marginTop: 8, background: C.violetL, border: `1px solid ${C.violetM}`, borderRadius: 7 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, fontFamily: M, color: C.violet, marginBottom: 6 }}>{action === "rename" ? "RENAME GROUP" : "NEW GROUP"}
                <input aria-label="Group name" autoFocus maxLength={100} value={name} style={{ ...field, marginTop: 6, background: C.white }} placeholder={`e.g. ${NODE_TYPES[type]?.label} A`} onChange={e => { setName(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
            </label>
            {action === "rename" && <div style={{ fontFamily: M, fontSize: 10, color: "#64748B", lineHeight: 1.5, marginBottom: 8 }}>Updates the name on every floor. Connections stay intact.</div>}
            {error && <div role="alert" style={{ fontSize: 10, fontFamily: M, color: C.red, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button type="button" style={button} onClick={() => setAction(null)}>Cancel</button>
                <button type="button" style={{ ...button, background: C.blue, borderColor: C.blue, color: "#fff" }} onClick={submit}>{action === "rename" ? "Save name" : "Create group"}</button>
            </div>
        </div>}
    </div>;
}
