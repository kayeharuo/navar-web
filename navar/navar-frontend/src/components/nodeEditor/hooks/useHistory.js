import { useRef, useState, useCallback } from "react";
const MAX_HISTORY = 60;
export function useHistory(initial) {
    const historyRef = useRef([initial]);
    const idxRef = useRef(0);
    const [snapshot, setSnapshot] = useState(initial);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const syncFlags = () => {
        setCanUndo(idxRef.current > 0);
        setCanRedo(idxRef.current < historyRef.current.length - 1);
    };
    const push = useCallback((next) => {
        const sliced = historyRef.current.slice(0, idxRef.current + 1);
        sliced.push(next);
        if (sliced.length > MAX_HISTORY)
            sliced.shift();
        historyRef.current = sliced;
        idxRef.current = sliced.length - 1;
        setSnapshot(next);
        syncFlags();
    }, []);
    const undo = useCallback(() => {
        if (idxRef.current <= 0)
            return;
        idxRef.current--;
        const s = historyRef.current[idxRef.current];
        setSnapshot(s);
        syncFlags();
        return s;
    }, []);
    const redo = useCallback(() => {
        if (idxRef.current >= historyRef.current.length - 1)
            return;
        idxRef.current++;
        const s = historyRef.current[idxRef.current];
        setSnapshot(s);
        syncFlags();
        return s;
    }, []);
    return { snapshot, push, undo, redo, canUndo, canRedo };
}
