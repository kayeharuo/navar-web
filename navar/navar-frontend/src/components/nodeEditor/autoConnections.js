// Keep existing direction/path settings when rebuilding a group's landing chain.
export function autoConnect(snapshot, floorMeta) {
    const all = Object.values(snapshot.nodes).flat();
    const existing = new Map((snapshot.edges.__crossFloor || []).map(e => [[e.from, e.to].sort().join("::"), e]));
    const connections = [];
    const floorNumber = floor => { const value = floorMeta[floor]?.floorNum; return value == null || value === "" ? NaN : Number(value); };
    const floorNumbers = Object.keys(floorMeta).map(floorNumber);
    for (const group of snapshot.groups || []) {
        const landings = all.filter(n => n.transition_group_id === group.id && n.type === group.type).sort((a,b) => floorNumber(a.floor) - floorNumber(b.floor));
        for (let i=1; i<landings.length; i++) {
            const lower=landings[i-1], upper=landings[i];
            const low=floorNumber(lower.floor), high=floorNumber(upper.floor);
            if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) continue;
            if (group.type !== "ELEVATOR" && floorNumbers.some(n => n>low && n<high)) continue;
            const key=[lower.id,upper.id].sort().join("::");
            connections.push(existing.get(key) || {id:`auto-${key}`,from:upper.id,to:lower.id,direction:"both",path_type:upper.isEmergency || lower.isEmergency ? "restricted" : "normal"});
        }
    }
    return {...snapshot,edges:{...snapshot.edges,__crossFloor:connections}};
}
