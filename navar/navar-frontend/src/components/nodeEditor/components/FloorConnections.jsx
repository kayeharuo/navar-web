import { C, F, M, NODE_TYPES } from "../editorConstants";
export function FloorConnections({ node, nodes, edges, floorMeta, locked, onChange }) {
    const all = Object.values(nodes).flat();
    const members = all.filter(n => n.id !== node.id && node.transition_group_id && n.transition_group_id === node.transition_group_id && n.type === node.type);
    const connected = edges.filter(e => e.from === node.id || e.to === node.id);
    const update = (id, fields) => onChange(edges.map(e => e.id === id ? { ...e, ...fields } : e));
    const style = { width: "100%", boxSizing: "border-box", background: locked ? "#F8FAFC" : C.bg, color: C.txt, padding: "6px 9px", marginTop: 4, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: F, fontSize: 11, outline: "none", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.7 : 1 };
    const labelStyle = { display: "block", fontSize: 9, fontWeight: 700, color: "#64748B", fontFamily: M, letterSpacing: "0.06em", marginTop: 9 };
    const hintStyle = { fontSize: 10, color: "#64748B", fontFamily: M, lineHeight: 1.5, margin: "0 0 8px" };
    return <div style={{ fontFamily: F, fontSize: 11 }}>
        <p style={hintStyle}>Connections are created automatically and appear on both floors. Edit path type and direction below.</p>
        {connected.map(e => {
            const target = all.find(n => n.id === (e.from === node.id ? e.to : e.from));
            const from = all.find(n => n.id === e.from), to = all.find(n => n.id === e.to);
            return <div key={e.id} style={{ padding: "10px 12px", background: C.white, border: `1px solid ${C.violetM}`, borderRadius: 7, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, background: C.violetL, color: C.violet, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{NODE_TYPES[node.type]?.icon || "?"}</span>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.violet, fontWeight: 700, fontSize: 11, overflowWrap: "anywhere" }}>{target?.label || "Landing"}</div>
                        <div style={{ fontSize: 9, fontFamily: M, color: "#64748B", marginTop: 2 }}>{target?.floor}</div>
                    </div>
                </div>
                <label style={labelStyle}>PATH TYPE<select aria-label="Connection path type" disabled={locked} style={style} value={e.path_type} onChange={event => update(e.id, { path_type: event.target.value })}>
                    <option value="normal">Normal</option><option value="accessible">Accessible</option><option value="restricted">Restricted</option>
                </select></label>
                <label style={labelStyle}>DIRECTION<select aria-label="Connection direction" disabled={locked} style={style} value={e.direction || "both"} onChange={event => update(e.id, { direction: event.target.value })}>
                    <option value="both">Both directions</option><option value="forward">{from?.floor} to {to?.floor}</option><option value="reverse">{to?.floor} to {from?.floor}</option>
                </select></label>

            </div>;
        })}
        {!connected.length && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 10px", fontSize: 10, color: "#92400E", fontFamily: M, lineHeight: 1.5, marginBottom: 8 }}>{!node.transition_group_id ? "Choose a transition group to connect this landing automatically." : members.length ? "Matching group members are listed below. Stairs, ramps and escalators need a landing on each neighboring floor to connect." : "This group has no other landings yet. Place a matching node on another floor and select this group; it will connect automatically."}</div>}
        {members.length > 0 && <div style={{ marginBottom: 8 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>OTHER LANDINGS IN THIS GROUP</div>
            {members.map(member => <div key={member.id} style={{ border: `1px solid ${C.violetM}`, background: C.violetL, borderRadius: 6, padding: "7px 10px", marginBottom: 5 }}>
                <div style={{ color: C.violet, fontWeight: 700 }}>{member.label}</div>
                <div style={{ fontSize: 10, fontFamily: M, color: "#64748B", marginTop: 2 }}>{member.floor} ? {member.dbId || member.id}</div>
            </div>)}
        </div>}
        <p style={hintStyle}>Landings in the same group connect automatically. Add a matching landing on the neighboring floor; elevators connect their served floors. Use Save Draft to persist changes.</p>
    </div>;
}
