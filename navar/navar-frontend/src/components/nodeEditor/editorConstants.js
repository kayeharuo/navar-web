export const F = "'Plus Jakarta Sans', sans-serif";
export const M = "'DM Mono', monospace";
export const C = {
    bg: "#F7F8FA", white: "#FFFFFF", border: "#E4E8EF", line: "#F1F5F9",
    blue: "#2563EB", blueL: "#EFF4FF", blueM: "#DBEAFE",
    green: "#16A34A", greenL: "#F0FDF4", greenM: "#DCFCE7",
    red: "#DC2626", redL: "#FFF5F5", redM: "#FEE2E2",
    orange: "#EA580C", orangeL: "#FFF7ED", orangeM: "#FFEDD5",
    violet: "#7C3AED", violetL: "#F5F3FF", violetM: "#EDE9FE",
    teal: "#0D9488", tealL: "#F0FDFA", tealM: "#CCFBF1",
    gold: "#D97706", goldL: "#FFFBEB", goldM: "#FEF3C7",
    txt: "#0F172A", sub: "#64748B", muted: "#94A3B8", dim: "#F8FAFC",
};
export const PATH_TYPE = {
    normal: { color: "#2563EB", label: "Normal", dash: [], badge: "#EFF4FF", badgeTxt: "#1D4ED8" },
    accessible: { color: "#0D9488", label: "Accessible", dash: [4, 3], badge: "#F0FDFA", badgeTxt: "#0F766E" },
    restricted: { color: "#DC2626", label: "Restricted", dash: [5, 4], badge: "#FFF5F5", badgeTxt: "#B91C1C" },
};
export const NODE_TYPES = {
    // ── Navigation ──────────────────────────────────────────────────────────────
    WALKWAY: { label: "Walkway", color: "#94A3B8", size: 7, icon: "·", group: "Navigation", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    JUNCTION: { label: "Junction", color: "#64748B", size: 9, icon: "✛", group: "Navigation", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    STORE_ENTRANCE: { label: "Store Entrance", color: "#2563EB", size: 13, icon: "🏪", group: "Navigation", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    STALL: { label: "Stall / Kiosk", color: "#D97706", size: 11, icon: "🛒", group: "Navigation", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    EXIT: { label: "Mall Exit", color: "#16A34A", size: 13, icon: "🚶", group: "Navigation", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    // ── Floor Transition ─────────────────────────────────��───────────────────────
    STAIRS: { label: "Stairs", color: "#7C3AED", size: 13, icon: "🪜", group: "Floor Transition", isPwdType: false, isFloorTransition: true, isEmergencyType: false },
    ESCALATOR: { label: "Escalator", color: "#7C3AED", size: 13, icon: "⬆", group: "Floor Transition", isPwdType: false, isFloorTransition: true, isEmergencyType: false },
    ELEVATOR: { label: "Elevator", color: "#0D9488", size: 13, icon: "🛗", group: "Floor Transition", isPwdType: true, isFloorTransition: true, isEmergencyType: false },
    RAMP: { label: "Ramp", color: "#0D9488", size: 11, icon: "♿", group: "Floor Transition", isPwdType: true, isFloorTransition: true, isEmergencyType: false },
    // ── Emergency ────────────────────────────────────────────────────────────────
    EMERGENCY_EXIT: { label: "Emergency Exit", color: "#DC2626", size: 13, icon: "🚨", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    FIRE_EXTINGUISHER: { label: "Fire Extinguisher", color: "#DC2626", size: 10, icon: "🧯", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    FIRE_HOSE: { label: "Fire Hose Cabinet", color: "#DC2626", size: 10, icon: "🚒", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    FIRST_AID: { label: "First Aid", color: "#DC2626", size: 11, icon: "🏥", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    AED: { label: "AED Station", color: "#DC2626", size: 10, icon: "❤", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    ASSEMBLY_AREA: { label: "Assembly Area", color: "#DC2626", size: 13, icon: "⛶", group: "Emergency", isPwdType: false, isFloorTransition: false, isEmergencyType: true },
    // ── Facilities ───────────────────────────────────────────────────────────────
    RESTROOM: { label: "Restroom", color: "#D97706", size: 11, icon: "🚻", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    MALE_RESTROOM: { label: "Male Restroom", color: "#2563EB", size: 10, icon: "🚹", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    FEMALE_RESTROOM: { label: "Female Restroom", color: "#DB2777", size: 10, icon: "🚺", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    PWD_RESTROOM: { label: "PWD Restroom", color: "#0D9488", size: 11, icon: "♿", group: "Facilities", isPwdType: true, isFloorTransition: false, isEmergencyType: false },
    NURSING_ROOM: { label: "Nursing Room", color: "#DB2777", size: 11, icon: "🍼", group: "Facilities", isPwdType: true, isFloorTransition: false, isEmergencyType: false },
    PRAYER_ROOM: { label: "Prayer Room", color: "#D97706", size: 11, icon: "🕌", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    LOCKER: { label: "Coin Locker", color: "#475569", size: 10, icon: "🔑", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    LOST_AND_FOUND: { label: "Lost & Found", color: "#D97706", size: 10, icon: "🏷", group: "Facilities", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    // ── Landmarks ──────────────────────────────────────────────────────────────
    INFO_DESK: { label: "Info Desk", color: "#D97706", size: 11, icon: "ℹ", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    CUSTOMER_SERVICE: { label: "Customer Service", color: "#D97706", size: 11, icon: "🎫", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    SECURITY_DESK: { label: "Security Desk", color: "#475569", size: 11, icon: "💂", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    ATM: { label: "ATM", color: "#D97706", size: 10, icon: "💳", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    FOOD_COURT: { label: "Food Court", color: "#D97706", size: 12, icon: "🍜", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    PARKING_ENTRANCE: { label: "Parking Entrance", color: "#475569", size: 12, icon: "🅿", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    CHARGING_STATION: { label: "Charging Station", color: "#D97706", size: 10, icon: "🔌", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    MALL_DIRECTORY: { label: "Mall Directory", color: "#D97706", size: 11, icon: "🗺", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    WATER_FOUNTAIN: { label: "Water Fountain", color: "#2563EB", size: 9, icon: "💧", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    SEATING_AREA: { label: "Seating Area", color: "#64748B", size: 10, icon: "🪑", group: "Landmarks", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
    // ── Other ────────────────────────────────────────────────────────────────────
    OTHER: { label: "Other", color: "#94A3B8", size: 9, icon: "○", group: "Other", isPwdType: false, isFloorTransition: false, isEmergencyType: false },
};
export const NODE_GROUPS = ["Navigation", "Floor Transition", "Emergency", "Facilities", "Landmarks", "Other"];
export const FLOORS = ["Ground Floor", "Level 2", "Level 3"];
export const STORE_UNITS = [
    // ── Ground Floor ────────────────────────────────────────────────────────────
    { unit: "G-01", brand: "Jollibee", name: "Jollibee SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-02", brand: "Starbucks", name: "Starbucks SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-03", brand: "Nike", name: "Nike SM Seaside City Cebu", floor: "Ground Floor" },
    // Multi-floor example: Zara occupies G-04 (Ground Floor) AND L2-04 (Level 2)
    { unit: "G-04", brand: "Zara", name: "Zara SM Seaside City Cebu (Ground Floor)", floor: "Ground Floor" },
    { unit: "G-05", brand: "Mercury Drug", name: "Mercury Drug SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-06", brand: "McDonald's", name: "McDonald's SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-07", brand: "Watsons", name: "Watsons SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-08", brand: "Miniso", name: "Miniso SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-09", brand: "Krispy Kreme", name: "Krispy Kreme SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-10", brand: "BDO", name: "BDO Unibank SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-11", brand: "Globe", name: "Globe Telecom SM Seaside City Cebu", floor: "Ground Floor" },
    { unit: "G-12", brand: "The SM Store", name: "The SM Store Seaside City Cebu", floor: "Ground Floor" },
    // ── Level 2 ─────────────────────────────────────────────────────────────────
    { unit: "L2-01", brand: "Adidas", name: "Adidas SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-02", brand: "H&M", name: "H&M SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-03", brand: "Uniqlo", name: "Uniqlo SM Seaside City Cebu", floor: "Level 2" },
    // Multi-floor example: Zara also has a Level 2 entrance (L2-04)
    { unit: "L2-04", brand: "Zara", name: "Zara SM Seaside City Cebu (Level 2)", floor: "Level 2" },
    { unit: "L2-05", brand: "Levi's", name: "Levi's SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-06", brand: "Aldo", name: "Aldo SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-07", brand: "Charles & Keith", name: "Charles & Keith SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-08", brand: "Cotton On", name: "Cotton On SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-09", brand: "Forever 21", name: "Forever 21 SM Seaside City Cebu", floor: "Level 2" },
    { unit: "L2-10", brand: "Mango", name: "Mango SM Seaside City Cebu", floor: "Level 2" },
    // ── Level 3 ─────────────────────────────────────────────────────────────────
    { unit: "L3-01", brand: "Penshoppe", name: "Penshoppe SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-02", brand: "Goldilocks", name: "Goldilocks SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-03", brand: "National Bookstore", name: "National Bookstore SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-04", brand: "Reebok", name: "Reebok SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-05", brand: "Timberland", name: "Timberland SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-06", brand: "Toy Kingdom", name: "Toy Kingdom SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-07", brand: "Sports Central", name: "Sports Central SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-08", brand: "Game One", name: "Game One SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-09", brand: "Mothercare", name: "Mothercare SM Seaside City Cebu", floor: "Level 3" },
    { unit: "L3-10", brand: "Timezone", name: "Timezone SM Seaside City Cebu", floor: "Level 3" },
];
export const formatStore = (s) => `${s.brand} — ${s.name} [${s.unit}]`;
// ── Stall / Kiosk Stores (not linked to any unit) ─────────────────────────────
// These are tenants that operate in temporary stalls or kiosks without a
// permanent unit number. Listed here so STALL nodes can reference them.
export const STALL_STORES = [
    "Don Macchiato",
    "BreadTalk",
    "Potato Corner",
    "Chatime",
    "Gong Cha",
    "Creamline",
    "Serenitea",
    "Buko ni Frutas",
    "Auntie Anne's",
    "Cinnabon",
    "Wetzel's Pretzels",
    "Tokyo Milk Cheese Factory",
    "Turks",
    "Macao Imperial Tea",
    "Boba Bears",
    "The Dough Project",
    "Nono's",
    "Fruitas",
    "Chooks-to-Go",
    "Mang Larry's",
];
/** @deprecated kept as alias; use STORE_UNITS */
export const STORES = STORE_UNITS;
/**
 * Replaces the sample floors / units / stalls with the real ones for the mall being
 * edited. The arrays are filled IN PLACE because several components import them by
 * name. Call it once, before the editor renders (mapApi.loadNodeMap does this).
 *   floors     : ["Ground Floor", ...]               (display labels, in order)
 *   storeUnits : [{ unit, brand, name, floor, unitId }]
 *   stallStores: ["Potato Corner", ...]
 */
export function setEditorCatalog({ floors, storeUnits, stallStores }) {
    FLOORS.length = 0;
    FLOORS.push(...floors);
    STORE_UNITS.length = 0;
    STORE_UNITS.push(...storeUnits);
    STALL_STORES.length = 0;
    STALL_STORES.push(...stallStores);
}
let _id = 200;
export const uid = (p = "n") => `${p}${++_id}`;
export const pxDist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
