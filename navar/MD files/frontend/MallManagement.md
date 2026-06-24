# Mall Management Page

## Overview
The Mall Management page provides a full listing of all registered malls in the NavAR system. It includes tabbed navigation, status-based filtering, a search bar, a detailed data table with per-row action buttons, and a full Add/Edit Mall modal system. Clicking any row opens a full info panel with mall details. From the info panel or table, you can manage stores (add, edit, deactivate/reactivate), units, and view additional information. A Stores feature allows brand selection from a predefined list or custom brand entry, unit assignment, and status mapping.

**Location:** `navar-frontend/src/pages/MallManagement.jsx`

---

## Page Layout

The page is a flex column layout with:
1. **Page Header** — Title, subtitle, and "+ Add Mall" button
2. **Tab Navigation** — Malls | Brands | Inquiries | Beacon Tickets
3. **Toolbar** — Status filter pills + search input
4. **Table** — Full mall data table with horizontal scroll for smaller screens
5. **Add/Edit Mall Modal** — Full-form modal triggered by "+ Add Mall" or row Edit button
6. **Floor Info Modal** — Sub-modal for entering floor number/label details

### Responsive Breakpoints:
- **Desktop (>1023px):** Full layout, toolbar in one row
- **Tablet (<1024px):** Toolbar stacks vertically, search goes full-width
- **Mobile (<768px):** Title shrinks, tabs and filters wrap naturally
- **Small mobile (<480px):** Further font size reductions

---

## Components

### 1. **MallsTable**
**File:** `src/components/mallManagement/MallsTable.jsx`

#### Purpose
Main component containing the tabbed interface, filters, search, and the data table for the Malls tab.

#### State
- `activeTab` — Currently selected tab (default: `'Malls'`)
- `activeFilter` — Currently selected status filter (default: `'All'`)
- `searchQuery` — Current search input value

#### Key Features
- **Tab navigation:** 4 tabs — Malls, Brands, Inquiries, Beacon Tickets. Non-Malls tabs show a placeholder.
- **Status filters:** All (17), Active (10), Grace Period (1), Suspended (1), Setup (5) — filters the table rows live
- **Search:** Filters by mall name or city, case-insensitive
- **Table columns:** Mall Name, City, No. of Floors, Agreement, Application, AR Development, Date Added, Last Updated, Actions
- **Overdue notes:** Shown in orange below the mall name when applicable (e.g. "27 days overdue")
- **Agreement cell:** Shows status text + tier (Premium/Standard/Basic) stacked
- **Action buttons:** Units (orange), Stores (blue), Beacons (purple), Edit (green) — always horizontally aligned in a single row using `flex-wrap: nowrap`. Stores and Units buttons open their respective full-screen panels
- **Row hover:** Light blue background highlight on hover

#### Subcomponents (defined inline)
- `AgreementCell` — Stacks agreement status and tier label
- `StatusBadge` — Renders colored badge text for application/AR development status
- `ActionButtons` — Horizontal row of 4 colored action buttons

---

## Navigation Integration

The Mall Management page is integrated into the app-level navigation:

- **`App.jsx`** lifts `activePage` state and passes `onNavigate` to Sidebar and `activePage` to TopBar
- **`SideBar.jsx`** no longer manages its own `activeItem` — it reads from `activePage` prop and calls `onNavigate` on click
- **`TopBar.jsx`** maps `activePage` to the correct icon and title using `pageIconMap`

### Supported Pages (with icons)
| Page | Icon |
|------|------|
| Dashboard | LayoutDashboard |
| Mall Management | Building2 |
| Application Management | FileText |
| AR Development | Layers |
| Account Management | Users |
| License Management | CreditCard |
| Analytics | BarChart2 |
| Email Logs | Mail |
| System Settings | Settings |
| Audit Logs | ClipboardList |

---

## Styles

### Files
- **`mallManagementLayout.css`** — Page wrapper, content layout, table card shell, responsive structure
- **`mallManagement.css`** — All component-level styles: header, tabs, filters, search, table, badges, action buttons

### Key CSS Classes

#### Layout
- `.mall-page` — Page root, flex column, max-width 1400px
- `.mall-content` — Main content flex column, 20px gap
- `.mall-header` — Flex row: info left, add button right, wraps on small screens
- `.mall-table-wrap` — White card with border and overflow hidden
- `.mall-table-scroll` — Horizontal scroll container for the table

#### Tabs
- `.mall-tabs` — Flex pill group for tab buttons
- `.mall-tab-btn` — Individual tab button
- `.mall-tab-btn--active` — Blue fill for active tab (#155DFC)

#### Filters
- `.mall-filters` — Flex row inside a bordered pill container
- `.mall-filter-btn` — Individual filter pill
- `.mall-filter-btn--active` — White background, black border, bold text
- `.mall-filter-count` — Small ellipse badge for counts
- `.mall-filter-count--active` — Blue count for active filter

#### Search
- `.mall-search-wrap` — White bordered input wrapper
- `.mall-search-input` — Transparent borderless input inside wrapper

#### Table
- `.mall-table` — Full-width table, min-width 900px, sticky header
- `.mall-table-row` — Clickable row with hover effect
- `.mall-name-text` — Mall name with optional grace/suspended color variants
- `.mall-overdue-note` — Orange italic overdue text below mall name
- `.mall-date-cell` — Nowrap date column text
- `.mall-agreement-cell` — Flex column: status + tier

#### Badges
- `.mall-status-badge` — Inline text badge (no background, just color)
- `.mall-status-badge--{variant}` — Variants: active, approved, live, suspended, unpublished, grace, setup, pending

#### Action Buttons
- `.mall-action-row` — Flex row, `flex-wrap: nowrap`, 5px gap
- `.mall-action-btn` — Colored pill button
- `.mall-action-btn--units` — Orange (#FF9233)
- `.mall-action-btn--stores` — Blue (#2563EB)
- `.mall-action-btn--beacons` — Purple (#6C1FCA)
- `.mall-action-btn--edit` — Green (#347545)

---

## Units Panel

### Component
**File:** `src/components/mallManagement/UnitsPanel.jsx`

### Trigger
Clicking the **Units** button in any table row opens a right-side drawer for that mall's unit management.

### Layout
A fixed right-side panel (width: ~480px, full height) with a semi-transparent overlay on the left. On screens ≤ 540px, the panel takes full width.

### Sections

#### Header
- Title: `Units — {Mall Name}` (Poppins 22px bold)
- Subtitle: city name (Fira Mono 14px, gray)
- X close button

#### Unit List (scrollable)
- Units are **grouped by floor** using `mall.floorDetails`
- Each floor shows its label as a section header (Fira Mono uppercase)
- Empty floors show: "No Units on this Floor yet."
- Each unit card contains:
  - **Unit number** (Fira Mono 22px bold, e.g., `G-01`, `L2-04`)
  - **Status badge**: OCCUPIED (blue) or VACANT (green)
  - **Action buttons**:
    - If occupied → "Mark Vacant" (green #347545)
    - If vacant → "Mark Occupied" (orange #FF9233) + "Remove" (red #D51D1D)

#### Add Unit Form (sticky bottom)
- Label: "ADD UNIT"
- **Floor dropdown**: options formatted as `FloorNo — Label` (e.g., `GF — Ground Floor`)
- **Unit No. input**: free text (e.g., G-01, L2-04); supports Enter key to add
- **+ button** (blue): adds new unit with `status: 'vacant'`
- Validates: floor selected, unit number entered, no duplicate unit on same floor
- **Cancel** (red) — closes panel without saving
- **Save** (blue) — commits units back to the mall's data in state

### Data Shape
Each unit object:
```javascript
{ id: number, floorNo: string, unitNo: string, status: 'occupied' | 'vacant' }
```

### CSS Classes (in `mallModal.css`)
| Class | Purpose |
|-------|---------|
| `.units-overlay` | Semi-transparent dark backdrop |
| `.units-panel` | Right-side fixed drawer |
| `.units-panel-title` | Panel header title |
| `.units-panel-subtitle` | City name under title |
| `.units-floor-section` | Floor grouping container |
| `.units-floor-label` | Floor name heading |
| `.units-empty-floor` | "No Units" message |
| `.units-card` | Individual unit row card |
| `.units-card-number` | Unit number in Fira Mono |
| `.units-badge--occupied` | Blue OCCUPIED badge |
| `.units-badge--vacant` | Green VACANT badge |
| `.units-action-btn--mark-vacant` | Green button |
| `.units-action-btn--mark-occupied` | Orange button |
| `.units-action-btn--remove` | Red button |
| `.units-add-select` | Floor dropdown |
| `.units-add-input` | Unit number text input |
| `.units-add-plus-btn` | Blue + button |
| `.units-footer-btn--cancel` | Red cancel |
| `.units-footer-btn--save` | Blue save |

---

## Mall Info Panel (Row Click Detail View)

### Component
**File:** `src/components/mallManagement/MallInfoPanel.jsx`

### Trigger
Clicking **any table row** opens the right-side info panel for that mall. Clicking action buttons or the floors pencil within the row stops propagation so they don't trigger the row click.

### Layout
Same right-side drawer shell as UnitsPanel (reuses `.units-overlay`, `.units-panel`, `.units-panel-header`, `.units-panel-divider`, `.units-panel-close`).

### Sections (scrollable body)
| Section Header | Fields |
|----------------|--------|
| MALL INFORMATION | Address, City/Province, Zip Code, Floors, Stores, Operating Hours, Logo |
| AGREEMENT | Status, Tier, Start Date, End Date, Annual Fee, Grace Period |
| STATUSES | Application, AR Development |
| BEACON | Major, No. of Beacons |
| RECORD | Date Added, Last Updated |
| Description / Notes | Free text in gray box |

Each section uses a two-column info row: **left** = Fira Mono label (gray), **right** = Poppins value (right-aligned).

### Logo Display
- If `mall.logoUrl` exists → `<img>` tag rendered
- If no logo → gray placeholder box with `<ImageIcon>` and "No logo" text

### Operating Hours Formatting
Reuses the same `formatDays` + `formatTime` logic from OperatingHoursBuilder. Multiple schedules are joined with newlines using `white-space: pre-line`.

### Footer Action Buttons & Stacking Behavior
Same four buttons as the table row: Units (orange), Stores (blue), Beacons (purple), Edit (green).
- **Units & Edit** → Open on top of the info panel (do NOT close the info panel); when you close the Units/Edit modal, the info panel remains visible beneath
- **Stores & Beacons** → Do not have stacking behavior (placeholder buttons, no action)

This allows you to open Units or Edit from the info panel, and when you close them with the X button, the info panel is still visible so you can interact with it again or close it separately.

### Data Fields Required on Each Mall Object
```javascript
{
  province: string,
  zipCode: string,
  storesCount: number,
  agreementStartDate: string | null,
  agreementEndDate: string | null,
  annualFee: string | null,
  gracePeriod: string | null,
  majorBeacons: number,
  beaconCount: number,
  description: string | null,
}
```

### CSS Classes (in `mallModal.css`)
| Class | Purpose |
|-------|---------|
| `.mall-info-panel-title` | Large mall name (Poppins 26px bold) |
| `.mall-info-body` | Scrollable content area |
| `.mall-info-section-header` | Fira Mono uppercase section label |
| `.mall-info-row` | Flex row: label left, value right |
| `.mall-info-label` | Gray Fira Mono label |
| `.mall-info-value` | Poppins right-aligned value, pre-line whitespace |
| `.mall-info-logo-wrap` | Right-aligned logo container |
| `.mall-info-logo` | Actual logo image (80×52px) |
| `.mall-info-logo-placeholder` | Gray box with icon when no logo |
| `.mall-info-notes` | Gray textarea-like box for description |
| `.mall-info-footer` | Bottom action buttons row |

---

## Add Mall — Field Requirement Changes
- **Logo** is now **required** — validation error shown if no file selected
- **Agreement Type** is now **optional** — asterisk removed from label, no validation
- Logo hint text updated to remove "Optional" prefix

---

## Data

Mock mall data is defined directly in `MallsTable.jsx`. Each mall entry includes:

```javascript
{
  id: number,
  name: string,
  city: string,
  floors: number | null,
  agreementStatus: 'Active' | 'Suspended' | 'Grace Period' | 'Setup',
  tier: 'Premium' | 'Standard' | 'Basic',
  application: 'Approved' | 'Draft' | 'For Revision',
  arDevelopment: 'Live' | 'Unpublished' | 'Pending',
  dateAdded: string,
  lastUpdated: string,
  note: string | null,
}
```

---

## Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| Add Mall button | Blue | #2563EB |
| Active tab | Blue | #155DFC |
| Units button | Orange | #FF9233 |
| Stores button | Blue | #2563EB |
| Beacons button | Purple | #6C1FCA |
| Edit button | Green | #347545 |
| Grace Period name | Orange | #F97316 |
| Suspended name | Red | #EF4444 |
| Overdue note | Orange | #F97316 |
| Active filter count | Blue | #2B63EB |
| Subtitle text | Gray | #9B9C9C |
| Unit OCCUPIED badge bg | Blue | rgba(69,163,222,0.36) |
| Unit OCCUPIED badge text | Blue | #155DFC |
| Unit VACANT badge bg | Green | #A0FFC3 |
| Unit VACANT badge text | Green | #016630 |
| Mark Vacant button | Green | #347545 |
| Mark Occupied button | Orange | #FF9233 |
| Remove button | Red | #D51D1D |

---

## Add / Edit Mall Modal System

### Components
| File | Purpose |
|------|---------|
| `src/components/mallManagement/AddMallModal.jsx` | Main Add/Edit form modal |
| `src/components/mallManagement/FloorInfoModal.jsx` | Sub-modal for floor details |
| `src/components/mallManagement/OperatingHoursBuilder.jsx` | Operating hours schedule builder |
| `src/styles/mallManagement/mallModal.css` | All modal and sub-component styles |

### AddMallModal
- Opens via the **"+ Add Mall"** button (add mode) or the **"Edit"** action button in any table row (edit mode)
- In edit mode, all fields are pre-populated from the row's mall data
- **Fields:**
  - `MALL NAME` (required text)
  - `CITY` (required text)
  - `ADDRESS` (required text)
  - `NO. OF FLOORS` (required number) — shows a **pencil icon button** when value > 0; hidden if 0 or empty
  - `AGREEMENT TYPE` (required dropdown: Premium / Standard / Basic)
  - `LOGO` (optional file input — image files only, max 5MB; browse button opens OS file picker)
  - `OPERATING HOURS` (required — uses OperatingHoursBuilder)
- Validation runs on Save; field-level error messages shown inline
- New malls are added with `agreementStatus: 'Setup'` and `application: 'Draft'`

### Floor Info Sub-Modal (FloorInfoModal)
- **Trigger — auto open:** When the No. of Floors field is blurred with a new non-zero value
- **Trigger — manual:** Clicking the pencil icon button next to the floors field
- **Trigger — table row:** Clicking the pencil icon in the No. of Floors column of a table row opens the Edit modal, which already shows the pencil
- Dynamically generates `N` rows of (FLOOR NO. *, FLOOR LABEL *) pairs based on floor count
- Changing the floor count re-opens the modal (previous entries preserved up to the new count)
- Pencil button is hidden when floors = 0 or not entered
- All fields required; inline error highlights on invalid save attempt

### OperatingHoursBuilder
- Day buttons: Mon, Tue, Wed, Thu, Fri, Sat, Sun — multi-select toggle
- Time pickers: Opens (time input) and Closes (time input)
- "Add Schedule" button appends the current selection to the list
- Added schedules display as: `Mon – Fri: 10:00 AM – 9:00 PM [×]`
- Consecutive day groups are auto-formatted (e.g., Mon+Tue+Wed → `Mon – Wed`)
- 7-day selections are formatted as `Daily`
- Each schedule has an × button to remove it
- At least one schedule required for form validation

### Floor Pencil in Table
- The No. of Floors column in the table shows the count + a small pencil icon button for malls with floors > 0
- Clicking the pencil opens the **Edit Mall modal** for that row (which pre-populates all fields including floor details)

---

## Stores Feature

### Components

**File:** `src/components/mallManagement/StoresPanel.jsx`

Full-screen right-side panel that displays all stores for a mall with category filtering, search, and CRUD operations.

#### Features
- **Category filtering:** All, Fashion & Apparel, Books & Hobby, Health & Beauty, Food & Beverage
- **Search:** Filters by store name or brand, case-insensitive
- **Table columns:** Store Name, Unit No., Floor, Brand, Category, Contact Person, Contact No., Email, Status, Description, Actions
- **Add Store:** Opens brand selection grid first (predefined brands + "Others" for custom entry)
- **Edit Store:** Pre-populates all fields including assigned units
- **Deactivate:** Shows confirmation modal; when deactivated, a mapped store becomes unmapped
- **Reactivate:** Shows confirmation modal; restores store to active status
- **Status badges:** Mapped (green), Unmapped (red)
- **Action buttons:** Edit, Deactivate (for active stores); Reactivate (for inactive stores)
- **Footer:** Shows count of stores displayed and units per floor breakdown

#### Data Structure
```javascript
{
  id: number,
  storeName: string,
  unitNos: string[],           // e.g., ['L2-04', 'G-01']
  floorLabel: string,          // e.g., '2nd Floor'
  brand: string,
  brandLogo: URL | null,       // File upload preview for custom brands
  category: string,
  contactPerson: string | null,
  contactNo: string | null,
  email: string | null,
  status: 'mapped' | 'unmapped',
  description: string | null,
  active: boolean,
  dateAdded: string,
  lastUpdated: string,
}
```

**File:** `src/components/mallManagement/SelectBrandModal.jsx`

Modal that displays 8 brand cards in a grid. Clicking a brand passes it to AddStoreModal.

#### Brands
1. Jollibee (Food & Beverage)
2. Zara (Fashion & Apparel)
3. H & M (Fashion & Apparel)
4. Starbucks (Food & Beverage)
5. Uniqlo (Fashion & Apparel)
6. National Book Store (Books & Hobby)
7. Mercury Drug (Health & Beauty)
8. Others (custom brand entry)

**File:** `src/components/mallManagement/AddStoreModal.jsx`

Form modal for adding or editing a store. Behavior differs based on whether a predefined brand or "Others" (custom) is selected.

#### Fields (All Stores)
- **Store Name** (required)
- **No. of Units** (required, 0+; when > 0, a pencil button appears)
  - Clicking pencil opens a sub-modal to select specific units from the mall's unit list
  - Selected units are listed as `Assigned: L2-04, G-01`
- **Contact Person** (optional)
- **Contact No.** (optional)
- **Email** (optional)
- **Status** (required): Mapped or Unmapped
  - When a mapped store is deactivated, it automatically becomes unmapped

#### Fields (Custom Brands Only - "Others")
- **Brand Name** (optional)
- **Category** (required): Fashion & Apparel, Books & Hobby, Health & Beauty, Food & Beverage, Electronics, Services, Others
- **Store Logo** (required): File upload with drag-drop UI; max 2MB image files (PNG, JPG)
  - Preview shown after upload
  - "Change" button to replace logo

#### Unit Assignment Sub-Modal
- Displays all units from the mall grouped by availability status
- User can select up to `N` units (where N is the No. of Units entered)
- Each unit shows: Unit No., Floor, Status badge (Occupied/Vacant)
- Save button commits selection; Cancel closes without saving

#### Confirmation Modals
Two styles:
1. **Deactivate Store** (red icon, red button) — "Are you sure you want to deactivate this store?"
2. **Reactivate Store** (green icon, green button) — "Are you sure you want to reactivate this store?"

### Stacking Behavior
- **Stores button from table row:** Opens StoresPanel standalone
- **Stores button from info panel:** Stacks StoresPanel on top of info panel with adjusted z-index
  - Info panel remains visible behind
  - Close StoresPanel with X to return to info panel
  - Then close info panel with X to exit
- **Add/Edit Store modal:** Stacks on top of StoresPanel (which may itself be stacked)
- **Deactivate/Reactivate confirmation:** Highest z-index, appears on top of all panels

### CSS Classes (see `mallModal.css`)
- `.stores-panel` / `.stores-panel--stacked`
- `.stores-panel-bg` / `.stores-panel-bg--stacked`
- `.sbrand-modal` / `.sbrand-overlay`
- `.add-store-modal` / `.add-store-overlay`
- `.confirm-modal` / `.confirm-modal-overlay`
- `.unit-assign-modal` / `.unit-assign-overlay`

---

## Notable Implementation Details

1. **Horizontal action buttons:** `flex-wrap: nowrap` on `.mall-action-row` ensures Units, Stores, Beacons, and Edit always sit on a single line
2. **Sticky table header:** Uses CSS `position: sticky; top: 0` to keep column headers visible during vertical scroll
3. **Horizontal scroll:** The table has `min-width: 900px` with a scroll wrapper — the table never squishes columns
4. **Live filtering + search:** Both the status filter and search query are applied simultaneously using `.filter()` on the malls array
5. **Tab placeholder:** Non-Malls tabs render a "coming soon" card rather than an empty state or error
6. **Logo preserved:** Uses the existing `navarLogo` PNG import from the sidebar — no Figma image assets used
7. **Modal layering & stacking:**
   - **Standalone modals** (Add Mall, Units from table row): Info Panel (z-index 350), Add/Edit modal (z-index 350), Floor modal (z-index 450)
   - **Stacked modals** (Add/Edit/Units opened from info panel): Info Panel (z-index 350), stacked modal (z-index 430), overlay (z-index 420)
   - Props `stackedOnInfoPanel` passed to UnitsPanel and AddMallModal determine which z-index classes to apply (`.units-panel--stacked`, `.mall-modal--stacked`, etc.)
8. **Logo file input:** `<input type="file" accept="image/*">` is hidden; a styled Browse button triggers it via `ref.current.click()`
9. **Operating hours formatting:** Consecutive days are collapsed into ranges using `DAYS.indexOf()` comparisons
10. **Floor detail sync:** `useEffect` watches `form.floors` and adjusts the `floorDetails` array length, preserving existing entries
