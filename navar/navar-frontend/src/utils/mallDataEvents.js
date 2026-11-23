export const MALL_BEACONS_UPDATED = 'navar:mall-beacons-updated';
export function notifyMallBeaconsUpdated(mallId) {
 const detail = { mallId: String(mallId), changedAt: Date.now() };
 window.dispatchEvent(new CustomEvent(MALL_BEACONS_UPDATED, { detail }));
 // Refresh other open tabs too. Storage may be unavailable in private sessions.
 try { localStorage.setItem(MALL_BEACONS_UPDATED, JSON.stringify(detail)); } catch { /* Same-tab event still works. */ }
}
