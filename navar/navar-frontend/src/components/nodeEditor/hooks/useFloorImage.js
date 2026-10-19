import { useEffect, useRef, useState } from "react";

// Loads the floor-plan image for the active floor and keeps the decoded images
// cached, so switching floors back and forth does not download them again.
// status: "none" (no plan was submitted) | "loading" | "ready" | "error"
export function useFloorImage(url) {
    const cache = useRef(new Map());
    const [state, setState] = useState({ url: null, image: null, status: "none" });
    useEffect(() => {
        if (!url) {
            setState({ url: null, image: null, status: "none" });
            return;
        }
        const cached = cache.current.get(url);
        if (cached) {
            setState({ url, image: cached, status: "ready" });
            return;
        }
        let cancelled = false;
        setState({ url, image: null, status: "loading" });
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
            if (cancelled)
                return;
            cache.current.set(url, img);
            setState({ url, image: img, status: "ready" });
        };
        img.onerror = () => {
            if (!cancelled)
                setState({ url, image: null, status: "error" });
        };
        img.src = url;
        return () => { cancelled = true; };
    }, [url]);
    // Never show the previous floor's image while the next one is loading.
    if (state.url !== (url || null))
        return { image: null, status: url ? "loading" : "none" };
    return { image: state.image, status: state.status };
}
