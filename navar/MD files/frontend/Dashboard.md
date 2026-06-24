# Dashboard Page

## Overview
The Dashboard page is the main admin interface for managing mall partnerships, AR development status, and application pipelines. It provides an at-a-glance view of all key metrics, active agreements, and recent activities.

**Location:** `navar-frontend/src/pages/Dashboard.jsx`

---

## Page Layout

The Dashboard uses a responsive grid layout with three main sections:

1. **Alert Banner** — Top banner for critical notices (errors/warnings)
2. **Top Grid (3 cards)** — Summary cards for agreements, applications, and AR development
3. **Bottom Grid** — Mall table on left, AR usage stats and recent activity on right

### Responsive Breakpoints:
- **Desktop (>1200px):** 3-column top grid, 2-column bottom grid (table + right sidebar)
- **Tablet Landscape (1024-1199px):** Similar to desktop but right column narrower (260px)
- **Tablet Portrait (768-1023px):** 2-column top grid, full-width table, 2-column stats below
- **Mobile (<768px):** Single column, everything stacked vertically

---

## Components

### 1. **AlertBanner**
**File:** `src/components/dashboard/AlertBanner.jsx`

#### Purpose
Displays critical alerts and warnings at the top of the dashboard. Shows up to 2 alerts (scrollable if more exist).

#### Props
```javascript
alerts: [
  {
    type: 'error' | 'warning',      // Determines color scheme
    title: string,                  // Bold title text
    message: string,                // Additional message text
  },
  // ... more alerts
]
```

#### Key Features
- **Error alerts:** Red border-left, red icon, light red background (#FEF2F2)
- **Warning alerts:** Orange border-left, orange icon, light orange background (#FFFBEB)
- **Icons:** Uses Lucide React's `AlertTriangle` icon
- **Max height:** 96px with auto-scroll for multiple alerts

#### Styling
- Container: `dash-alert-scroll` — flex column with max-height 96px
- Individual alert: `dash-alert dash-alert--{type}`
- Uses border-left accent (4px) for visual emphasis
- Font size: 13.5px, line-height: 1.5

---

### 2. **AgreementSummary**
**File:** `src/components/dashboard/AgreementSummary.jsx`

#### Purpose
Shows contract status across all malls with breakdown of Setup, Active, Grace Period, and Suspended agreements.

#### Key Features
- **Header:** Green accent bar, "View All" link button
- **Stat Grid:** 2x2 grid of StatCard components showing:
  - Setup (green)
  - Active (green)
  - Grace Period (orange)
  - Suspended (red) — with highlight background
- **Expiry Section:** Shows contracts expiring within 60 days
  - Uses `CheckCircle` icon from Lucide React
  - Displays health status message

#### Styling
- Container: `dash-card` — white background, 16px border-radius, 1px border
- Stat grid: `dash-stat-grid` — 2 equal columns, 12px gap
- Each stat cell: min-height 88px, centered text, 12px border-radius
- Highlight variant: Light red background (#FFF1F2) with pink border

---

### 3. **ApplicationsPanel**
**File:** `src/components/dashboard/ApplicationsPanel.jsx`

#### Purpose
Visualizes the application submission pipeline with counts at each stage.

#### Key Features
- **Header:** Blue accent bar, "View All" link button
- **Stat Cards:** Two key metrics:
  - "Submitted For Review" (blue)
  - "Requested Revision — Waiting for response" (orange)
- **Pipeline Visualization:** Colored progress bars showing:
  - Draft (light blue)
  - Submitted (blue)
  - For Revision (orange)
  - Approved (green)
- Each pipeline row: colored dot, label, count (00 formatted), progress bar

#### Styling
- Pipeline container: `dash-pipeline` — flex column, 10px gap
- Pipeline row: 10px gap with dot, label, count, and bar
- Dots: 7px circles with color-coded backgrounds
- Progress bars: 6px height, full-width with fill percentage

---

### 4. **ARDevelopmentStatus**
**File:** `src/components/dashboard/ARDevelopmentStatus.jsx`

#### Purpose
Displays the current status of AR map development across all malls.

#### Key Features
- **Header:** Purple accent bar, "View All" link button
- **6 StatCard metrics:**
  - Pending (gray) — awaiting work
  - Node Mapping (blue) — mapping phase
  - Navigation Testing (purple) — testing phase
  - Ready for Activation (purple) — final preparation
  - Live (green) — active in production
  - Unpublished (red) — highlight variant

#### Styling
- Same as AgreementSummary: 2x2-3 grid layout with StatCard components
- Color-coded by status stage
- Unpublished has highlight background for emphasis

---

### 5. **MallTable**
**File:** `src/components/dashboard/MallTable.jsx`

#### Purpose
Comprehensive table displaying all malls with their tier, wallet balance, agreement status, application status, and AR development status.

#### Data Structure
Each mall includes:
```javascript
{
  name: string,                    // Mall name
  note: string | null,            // Optional note (e.g., "27 Days Overdue")
  tier: 'Premium' | 'Standard' | 'Basic',
  wallet: string,                 // Balance in PHP format
  agreement: string,              // Current agreement state
  agreementVariant: string,       // CSS variant for styling
  application: string,            // Application status
  applicationVariant: string,     // CSS variant
  arDev: string,                  // AR development status
  arDevVariant: string,           // CSS variant
}
```

#### Key Features
- **Header:** Green accent bar, "Mall Information Summary" title, 17 malls count, "Show All" button
- **Columns:** Mall, Tier, Wallet (₱), Agreement, Application, AR Development
- **Sticky header:** Stays visible when scrolling
- **Hover effect:** Light gray background on row hover
- **Mall name styling:** Dynamic color based on agreement status (grace = orange, suspended = red)
- **Badge components:** Colorful badges for status values
- **Scrollable:** Fixed height 697px on desktop, scrolls internally

#### Styling
- Table header: sticky, uppercase labels, 10.5px font, letter-spacing 0.08em
- Table cells: 13px font, 14px padding, 1px gray border-bottom
- Wallet values: Monospace font (Fira Mono)
- Mall notes: 11px, orange text, 500 weight

---

### 6. **ARUsageStats**
**File:** `src/components/dashboard/ARUsageStats.jsx`

#### Purpose
Shows aggregate AR usage metrics and highlights top-performing malls.

#### Key Features
- **Header:** Orange accent bar, "AR Usage Stats" title
- **Big Numbers Grid:** 2-column layout
  - Total Sessions: 22,570 (large orange number)
  - Live Maps: 5 (large orange number)
- **Top Malls Section:** Ranked list of top 3 malls
  - Rank number, mall name, session count
  - Visual bar chart showing relative usage (width = percentage of max)
  - Monospace font for numbers

#### Styling
- Big numbers: Fira Mono, 32px, bold, orange color (#F97316)
- Sublabel: 11px, gray, 500 weight
- Bar track: Light gray background (#F1F5F9), 5px height, rounded
- Bar fill: Orange background, matches percentage of max sessions

---

### 7. **RecentActivity**
**File:** `src/components/dashboard/RecentActivity.jsx`

#### Purpose
Lists recent actions and changes affecting malls and applications.

#### Key Features
- **Header:** Yellow accent bar, "Recent Activity" title, "Audit" link
- **Activity List:** Stack of activity items showing:
  - Colored dot indicator (dynamic color per activity)
  - Action title (e.g., "Requested Revision")
  - Mall name
  - User name and timestamp
- Example activities: revision requests, approvals, status changes

#### Styling
- Activity container: `dash-activity-list` — flex column, 16px gap
- Activity item: flex with 12px gap, aligned to start
- Dot: 8px circle, position 4px from top
- Title: 13px, bold (#1E293B)
- Meta: 11.5px, gray (#94A3B8), stacked

---

### 8. **StatCard** (Shared Component)
**File:** `src/components/dashboard/StatCard.jsx`

#### Purpose
Reusable component for displaying a single statistic with value, label, and optional highlight.

#### Props
```javascript
{
  value: string | number,        // The main number to display
  label: string,                 // Label below the value
  color: string,                 // Color of the value text (default: #1F2937)
  highlight: boolean,            // Optional red background variant
}
```

#### Styling
- Container: `dash-stat-cell` — centered flex, 18px padding, 88px min-height
- Value: Fira Mono, 28px, bold, custom color
- Label: 11.5px, gray, 500 weight
- Highlight variant: Light red background (#FFF1F2), pink border

---

### 9. **Badge** (UI Component)
**File:** `src/components/ui/Badge.jsx`

#### Purpose
Status indicator component used throughout the dashboard for displaying states.

#### Props
```javascript
{
  label: string,                 // Badge text
  variant: string,               // CSS variant class (default: 'default')
}
```

#### Variants & Styling
Each variant has a specific color scheme:

| Variant | Background | Text Color | Use Case |
|---------|-----------|-----------|----------|
| `active` | Green (#F0FDF4) | Green (#15803D) | Active agreements |
| `approved` | Green (#F0FDF4) | Green (#15803D) | Approved applications |
| `live` | Green (#F0FDF4) | Green (#15803D) | Live AR maps |
| `suspended` | Light Red (#FEF2F2) | Red (#DC2626) | Suspended status |
| `unpublished` | Light Red (#FEF2F2) | Red (#DC2626) | Unpublished content |
| `grace` | Light Orange (#FFF7ED) | Orange (#EA580C) | Grace period status |
| `revision` | Light Orange (#FFF7ED) | Orange (#EA580C) | Revision needed |
| `setup` | Light Blue (#EFF6FF) | Blue (#2563EB) | Setup status |
| `pending` | Light Gray (#F8FAFC) | Gray (#64748B) | Pending/neutral |
| `default` | Transparent | Gray (#94A3B8) | Default state |

- Styling: `dash-badge dash-badge--{variant}` — inline-flex, 3px padding, 6px border-radius, 12px font-weight 600

---

## Styles

### Global Dashboard Files
- **`dashboardLayout.css`** — Page layout, responsive grid structure
- **`dashboard.css`** — Card styling, component-specific styles, badge variants

### Key CSS Classes

#### Layout
- `.dash-page` — Main container, flex column, max-width 1400px
- `.dash-top-grid` — 3-column grid for top cards (responsive)
- `.dash-bottom-grid` — 2-column grid (table + right sidebar)
- `.dash-right-col` — Stacked AR Usage + Recent Activity

#### Cards
- `.dash-card` — Base card styling (white, bordered, rounded)
- `.dash-card--table` — Special table variant, fixed height 697px

#### Scrolling
- `.dash-alert-scroll` — Max height 96px with scrollbar
- `.dash-table-scroll` — Flex: 1, scrolls internally

#### Colors & Accents
- `.dash-card-accent` — 4px colored bar (green, blue, purple, orange, yellow)
- `.dash-badge--{variant}` — Status badges with color schemes

### Typography
- **Monospace:** Fira Mono (used for numbers: values, counts, wallets)
- **Default:** System font family
- **Labels:** 10px uppercase, letter-spacing 0.1em, gray (#94A3B8)
- **Values:** 28px bold for StatCard, 32px for big numbers

### Spacing
- **Gap between cards:** 20px
- **Card padding:** 24px
- **Gap within card sections:** 12-20px

### Responsive Behavior
- **Desktop:** Full 3-column top grid, 2-column bottom
- **Tablet:** 2-column top grid, stacked bottom
- **Mobile:** Single column everything, smaller table scroll area

---

## Data Flow

The Dashboard component receives hardcoded alert data and passes it to AlertBanner:
```javascript
const alerts = [
  {
    type: 'error',
    title: 'Parkmall is suspended.',
    message: 'AR navigation is offline. Awaiting reinstatement contact.',
  },
  {
    type: 'warning',
    title: 'Ayala Center Cebu — grace period.',
    message: '27 days overdue. AR still active. Contact mall to arrange payment.',
  },
]
```

All other components manage their own internal data (malls, activities, stats).

---

## Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Success/Active | Green | #22C55E, #15803D |
| Primary/Blue | Blue | #3B82F6, #2563EB |
| Purple/Secondary | Purple | #A855F7 |
| Warning/Orange | Orange | #F97316, #EA580C |
| Error/Red | Red | #EF4444, #DC2626 |
| Neutral/Gray | Gray | #94A3B8, #64748B, #475569 |
| Background | Light Gray | #F8FAFC, #F1F5F9 |
| Border | Light Gray | #E8ECF2, #E2E8F0 |
| Text | Dark Slate | #1E293B |

---

## Accessibility Features

- **Icon usage:** AlertTriangle and CheckCircle from Lucide React provide semantic meaning
- **Color coding:** Combined with text labels, not color-only
- **Semantic HTML:** Table uses proper `<table>`, `<thead>`, `<tbody>` elements
- **Font hierarchy:** Clear size differentiation for titles, values, and labels

---

## Notable Implementation Details

1. **Sticky Table Header:** Uses CSS `position: sticky` to keep column headers visible during scrolling
2. **Pipeline Visualization:** Uses colored dots and progress bars instead of just numbers
3. **Responsive Images:** The layout adapts seamlessly from 3-column to single-column
4. **Monospace Numbers:** Fira Mono ensures numbers align vertically for better readability
5. **Alert Scrolling:** Max 2 alerts visible at once with overflow scroll
6. **Badge Variants:** Consistent color scheme across the dashboard using variant classes
7. **Hover States:** Table rows highlight on hover, buttons have color changes

---

## Future Enhancement Opportunities

- Add filtering/sorting to MallTable
- Implement real-time updates for Recent Activity
- Add date range selection for AR Usage Stats
- Create detailed drill-down pages from dashboard cards
- Add export functionality for reports
- Implement search across mall names
