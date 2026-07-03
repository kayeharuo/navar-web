# System Settings Page

## Overview
The System Settings page provides global, platform-wide configuration for the NavAR system. It currently covers two areas: **Subscription Tiers** (pricing, limits, and features per tier) and **Beacon config** (the iBeacon UUID and identifier structure shared across every deployed beacon). The **Categories** tab shown in the original Figma design was intentionally excluded — category management already lives inside Mall Management (Brands tab, Store/Brand category dropdowns) and does not need a duplicate global settings screen.

**Location:** `navar-frontend/src/pages/SystemSettings.jsx`

---

## Page Layout

The page follows the same structure as other management pages:
1. **Page Header** — Title ("System Settings") and subtitle ("Global configuration for the NavAR platform.")
2. **Tab Navigation** — Subscription Tiers | Beacon config
3. **Content Card** — White bordered card containing the active tab's panel

### Responsive Breakpoints
- **Desktop (>1023px):** Full layout, 3-column beacon identifier grid
- **Tablet (<1024px):** Beacon identifier grid drops to 2 columns
- **Mobile (<768px):** Title shrinks, tabs wrap, beacon UUID box stacks vertically, identifier grid drops to 1 column
- **Small mobile (<480px):** Further font size reductions

---

## Components

### 1. **SystemSettingsTabs**
**File:** `src/components/systemSettings/SystemSettingsTabs.jsx`

Main tab container. Holds `activeTab` state (default: `'Subscription Tiers'`) and renders the page header, tab buttons, and the active panel inside `.settings-card`.

### 2. **SubscriptionTiersTab**
**File:** `src/components/systemSettings/SubscriptionTiersTab.jsx`

#### Purpose
Editable table of tier features and limits, grouped into sections, with a warning banner and a Save Changes button.

#### Data source
Values are seeded from `NavAR_Subscription_Tiers.md`, Section 7 ("Full Tier Table"), grouped into four sections for readability:
- **Coverage & Capacity** — Max Coverage Area (GFA), Max Floors, Included Tenant Nodes, Beacon Allocation
- **Pricing & Billing** — Annual Subscription Fee, Onboarding & AR Dev Fee, Grace Period, Reinstatement Fee, Additional Stall Fee
- **Platform Access** — Map Updates / Year, Mall Admin Accounts, Analytics History, AR Development Queue
- **Maintenance & Hardware** — Remote Response, On-site Dispatch, Diagnosis/Replacement/Recalibration, Replacement Unit Cost, Spare Units On-Site, Battery (Coin Cell) Swap

#### Key Features
- **Grouped table:** Each section renders as a labeled group row followed by its feature rows, inside one continuous table
- **Tier badges:** Basic (gray), Standard (blue), Premium (purple) pill badges in the column headers
- **Editable cells:** Every feature/tier combination is a text input (`.tier-input`), bound to local component state
- **Warning banner:** "Changing tier details only affects new malls signing up. Existing active contracts are unaffected."
- **Save Changes button:** Shows a temporary "Changes Saved" confirmation with a check icon for 2.5s (no backend persistence yet)

#### State
- `values` — `{ [rowKey]: { basic, standard, premium } }`, initialized from the row definitions
- `saved` — controls the Save button's temporary confirmation state

### 3. **BeaconConfigTab**
**File:** `src/components/systemSettings/BeaconConfigTab.jsx`

#### Purpose
Displays the network-wide iBeacon Proximity UUID and explains the UUID / Major / Minor identifier structure used across the platform.

#### Key Features
- **iBeacon System UUID section:** Description + warning banner explaining the UUID is hardcoded into the mobile app and every physical beacon
- **Proximity UUID box:** Monospace UUID value with a "Copy UUID" button (`navigator.clipboard.writeText`), showing "Copied!" for 2s after a successful copy
- **iBeacon Identifier Structure:** Three color-coded cards explaining scope:
  - **UUID** (purple) — system-wide, identifies all NavAR beacons
  - **Major** (blue) — per mall, identifies which mall a beacon belongs to
  - **Minor** (green) — per unit, identifies the specific beacon within the mall

#### State
- `copied` — controls the "Copy UUID" / "Copied!" button label toggle

---

## Navigation Integration

No changes to navigation config were needed — `System Settings` already existed in `NAV_ITEMS` (`src/config/navigation.js`) pointing at `/system-settings`. Previously this route rendered the generic `PlaceholderPage`; it now renders the real `SystemSettings` page.

**`App.jsx` changes:**
- Imported `SystemSettings` from `./pages/SystemSettings`
- Added `<Route path="/system-settings" element={<SystemSettings />} />`
- Added `/system-settings` to the excluded-paths list so it no longer falls through to `PlaceholderPage`

---

## Styles

### Files
- **`systemSettingsLayout.css`** — Page wrapper, content layout, tab content card shell, responsive structure
- **`systemSettings.css`** — All component-level styles: header, tabs, panel header, warning banner, tier table, badges, inputs, save button, beacon UUID box, identifier cards

### Key CSS Classes

#### Layout
- `.settings-page` — Page root, flex column, max-width 1400px
- `.settings-content` — Main content flex column, 20px gap
- `.settings-card` — White bordered card wrapping the active tab panel

#### Tabs
- `.settings-tabs` — Flex pill group for tab buttons
- `.settings-tab-btn` — Individual tab button
- `.settings-tab-btn--active` — Blue fill for active tab (#155DFC)

#### Panel header
- `.settings-panel-title` / `.settings-panel-desc` — Section title + gray Fira Mono description
- `.settings-warning-banner` — Yellow banner with `AlertTriangle` icon

#### Tier table
- `.tier-table-wrap` / `.tier-table-scroll` — Card shell + horizontal scroll container
- `.tier-table` — Full-width table, min-width 720px, sticky header
- `.tier-table-group-row` — Section divider row (e.g. "Coverage & Capacity")
- `.tier-row-label` / `.tier-row-sublabel` — Feature name + optional helper text
- `.tier-badge--basic` / `.tier-badge--standard` / `.tier-badge--premium` — Column header pills
- `.tier-input` — Editable text input per cell

#### Beacon config
- `.beacon-uuid-box` — Gray bordered row containing the UUID value and Copy button
- `.beacon-copy-btn` — White bordered copy button
- `.beacon-structure-grid` — 3-column responsive grid (2 col tablet, 1 col mobile)
- `.beacon-structure-card--uuid` / `--major` / `--minor` — Color-coded identifier cards (purple / blue / green)

---

## Notable Implementation Details

1. **No backend persistence:** Both tabs manage state locally in the component; "Save Changes" and "Copy UUID" are UI-only interactions, consistent with the rest of the app's current mock-data approach.
2. **Grouped table via `Fragment`:** `SubscriptionTiersTab` uses `Fragment` with a `key` per group so each group's divider row and feature rows render as siblings inside `<tbody>` without wrapping `<div>`s breaking table semantics.
3. **Categories intentionally omitted:** Per product decision, the Categories tab from the Figma design was not built here since category data/management already exists under Mall Management.
4. **Section 7 sourcing:** All Subscription Tiers figures come directly from `NavAR_Subscription_Tiers.md` Section 7, not the placeholder figures shown in the original Figma mock.
