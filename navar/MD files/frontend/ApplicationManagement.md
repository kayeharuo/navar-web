# Application Management Page

## Overview
The Application Management page is the admin interface for reviewing mall operator submissions before AR development begins. Admins can view application details, request revisions, approve applications, and communicate with mall operators through a threaded messaging system.

**Location:** `navar-frontend/src/pages/ApplicationManagement.jsx`

---

## Page Layout

The page uses a responsive flex layout with:

1. **Page Header** — Title, subtitle with pending count
2. **Flow Diagrams** — Two visual flow charts showing application and AR development pipelines
3. **Toolbar** — Status filter tabs + search input
4. **Table** — Full application data table with review actions
5. **Review Panel** — Right-side drawer (opens on row click) showing full details, submission, thread, and action buttons

### Responsive Breakpoints:
- **Desktop (>1023px):** Full layout, wide table
- **Tablet (768-1023px):** Tighter spacing, responsive table
- **Mobile (<768px):** Stacked layout, compact spacing

---

## Components

### 1. **Page Header**
**File:** `ApplicationManagement.jsx` (lines 675-684)

**Purpose:** Displays page title and submission status alert.

**Key Features:**
- Title: "Application Management" (Poppins 28px bold)
- Subtitle: Review instructions with pending count in red
- Pending count dynamically shows "X submissions awaiting review"

**Example:**
```
Application Management
Review mall submissions before AR development begins. 2 submissions awaiting review.
```

---

### 2. **Flow Diagrams**
**File:** `ApplicationManagement.jsx` (lines 641-670, 838-857)

**Purpose:** Visual representation of the two application workflows.

#### Application Flow
- **Draft** (gray) → Not Submitted
- **Submitted** (blue) → Needs Review
- **For Revision** (red) ↕ Sent back
- **Approved** (green) → Unlocks AR dev

#### AR Development Flow
- **AR: Pending** (orange) → In work queue
- **Node Mapping** (blue) → Team Mapping
- **Testing** (purple) → QA Phase
- **Ready** (yellow) → Pre-activation
- **Live** (green) ↕ Public
- **Unpublished** (red) → Hidden

**Styling:**
- Light border (`#e8ecf2`), 10px padding
- Color-coded badges with status labels
- Swap arrows (↕) show reversible transitions

---

### 3. **Status Filter Tabs**
**File:** `ApplicationManagement.jsx` (lines 730-747)

**Purpose:** Filter table by application status.

**Available Filters:**
- **All** — All applications
- **Submitted** — Awaiting review
- **For Revision** — Sent back to mall
- **Approved** — Completed review
- **Draft** — Not yet submitted

**Styling:**
- Active tab: white background, black text, subtle border
- Count badges in bottom-right of tab text
- Active count badge: blue background

---

### 4. **Search Input**
**File:** `ApplicationManagement.jsx` (lines 748-752)

**Purpose:** Real-time search across mall name, city, and admin name.

**Behavior:**
- Case-insensitive matching
- Combines with active filter (AND logic)
- Searches mall name, city, admin name

---

### 5. **Applications Table**
**File:** `ApplicationManagement.jsx` (lines 859-917)

**Purpose:** Display all applications with status indicators and quick actions.

**Data Structure:**
```javascript
{
  id: number,
  mallName: string,
  city: string,
  adminName: string,
  adminEmail: string,
  version: number,
  floors: number,
  address: string,
  cityProvince: string,
  storesCount: number,
  operatingHours: string,
  logo: string,
  agreement: string,
  applicationStatus: 'Draft' | 'Submitted' | 'For Revision' | 'Approved',
  arDevelopment: string,
  submittedDate: string,
  lastUpdated: string,
  floorPlans: Array,
  scaleReference: Object,
  accessibilityRoutes: Array,
  emergencyExits: Array,
  entryPoints: Array,
  thread: Array, // Messages
}
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| MALL NAME | string | Clickable row; admin email below in gray |
| CITY | string | Mall location |
| ADMIN | string | Contact person name + email |
| VERSION | number | Application version |
| NO. OF FLOORS | number | Floor count |
| AGREEMENT | string | Contract status |
| APPLICATION | badge | Status: Submitted / For Revision / Approved / Draft |
| AR DEVELOPMENT | badge | Current AR status |
| SUBMITTED | date | Submission date |
| LAST UPDATED | date | Last change date |
| ACTION | button | "Review" button (blue) |

**Row Styling:**
- **Default row:** White background, light hover
- **Approved row:** Grayed out (opacity 0.6), sorted to bottom
- Click any row to open Review Panel
- Click "Review" button to open Review Panel (stops row click propagation)

---

### 6. **Review Panel (Right Drawer)**
**File:** `ApplicationManagement.jsx` (lines 525-761)

**Purpose:** Detailed view of single application with submission details, threading, and actions.

**Sections:**

#### Panel Header
- Mall name (Poppins 28px bold)
- City · Admin Name · Email (Fira Mono 13px gray)
- 4-step progress stepper with states (done/active/warning/inactive)
- Badges: Agreement + Application Status + Submitted date

#### Tabs
- **Submission Tab** (default) — All submitted details
- **Thread Tab** — Message thread with mall operator

#### Submission Tab Contents

**Mall Profile Section:**
- Address, City/Province, Floors, Stores, Operating Hours, Logo

**Floor Plans Section:**
- List of PDF files with file size
- Download buttons for each floor

**Scale Reference Section:**
- Callout box (blue) explaining purpose
- Reference line description, length in meters, floor number

**Accessibility Routes & Emergency Paths Section:**
- Callout box (red) with verification note
- **Subsection: PWD Accessible Routes** (yellow accent)
  - Color-coded cards with floor badge and description
- **Subsection: Emergency Exits & Fire Exits** (red accent)
  - Gray cards with description and optional notes

**Entry Points Section:**
- List of entry locations with floor badges
- Format: Name + Note (gray) | Floor Badge

#### Thread Tab Contents

**Message List:**
- **Admin messages** (right-aligned, blue background):
  - Sender name (blue) + "Admin" badge
  - Timestamp (gray, right side)
  - Message text
- **Mall messages** (left-aligned, white background):
  - Sender name (gray)
  - Timestamp
  - Message text

**Note Input Area:**
- Textarea: "Add a note..." placeholder
- "Send Note" button (blue, bottom-right)
- Keyboard: Enter sends, Shift+Enter for newline

#### Panel Footer
- **Request Revision** (red button) — Opens modal
- **Approve Application** (green button) — Opens modal
- Buttons hidden if already approved

---

### 7. **Request Revision Modal**
**File:** `ApplicationManagement.jsx` (lines 451-479)

**Purpose:** Capture revision requirements before sending back to mall.

**Fields:**
- **Modal Title:** "Request Revision {MallName}?"
- **Description:** Explains status change to "For Revision" and mall notification
- **Text Area:** "REVISION NOTES *" (required)

**Behavior:**
- Opens when "Request Revision" button clicked
- On submit:
  1. Changes applicationStatus to "For Revision"
  2. Adds admin message to thread with revision notes
  3. **Auto-switches to Thread tab** so user sees message immediately
  4. Updates lastUpdated date
- Cancel button closes without saving

**Buttons:**
- **Cancel** — Closes modal
- **Send Revision Request** (red) — Submits and closes

---

### 8. **Approve Modal**
**File:** `ApplicationManagement.jsx` (lines 481-499)

**Purpose:** Confirmation before approving application.

**Fields:**
- **Modal Title:** "Approve {MallName}?"
- **Description:** Explains status change to "Approved", AR dev status becomes "Pending"
- **Icon:** Green checkmark circle (50x50px)

**Behavior:**
- Opens when "Approve Application" button clicked
- On confirm:
  1. Changes applicationStatus to "Approved"
  2. Sets arDevelopment to "AR: Pending"
  3. Updates lastUpdated date
  4. Row moves to bottom and grays out
  5. Closes modal and panel
- Cancel button closes without saving

**Buttons:**
- **Cancel** — Closes modal
- **Approve Application** (green) — Confirms and closes

---

## State Management

### Application State
```javascript
const [applications, setApplications] = useState(INITIAL_APPLICATIONS)
const [activeFilter, setActiveFilter] = useState('All')
const [searchQuery, setSearchQuery] = useState('')
const [reviewingApp, setReviewingApp] = useState(null)

// Derived state: keeps reviewingApp in sync with applications
const currentReviewApp = reviewingApp
  ? applications.find(a => a.id === reviewingApp.id) ?? null
  : null
```

### Review Panel State
```javascript
const [activeTab, setActiveTab] = useState('submission')
const [showRevisionModal, setShowRevisionModal] = useState(false)
const [showApproveModal, setShowApproveModal] = useState(false)
```

### Thread Input State
```javascript
const [noteText, setNoteText] = useState('')
```

---

## Event Handlers

### handleRequestRevision(id, notes)
1. Updates applications array: finds app by id
2. Changes applicationStatus to "For Revision"
3. Adds thread message from admin with notes
4. Updates lastUpdated timestamp
5. Auto-switches activeTab to 'thread'

### handleApprove(id)
1. Updates applications array: finds app by id
2. Changes applicationStatus to "Approved"
3. Sets arDevelopment to "AR: Pending"
4. Updates lastUpdated timestamp

### handleSendNote(id, note)
1. Adds thread message from admin with note
2. Uses current date as timestamp
3. Keeps existing messages intact

---

## Styling

### CSS Files
- **`applicationManagementLayout.css`** — Page layout, responsive grid
- **`applicationManagement.css`** — Component styles, colors, typography

### Key Classes

#### Layout
- `.app-mgmt-page` — Main container (flex column, 12px padding, 10px gaps)
- `.app-mgmt-header` — Page title area
- `.app-mgmt-flows` — Flow diagram container (flex column, 8px gap)
- `.app-mgmt-toolbar` — Filter + search row

#### Table
- `.app-mgmt-table-wrap` — Table card with light border
- `.app-mgmt-table` — Full table, min-width 1100px
- `.app-mgmt-table thead` — Sticky header
- `row--approved` — Grayed out row for approved apps

#### Review Panel
- `.review-overlay` — Semi-transparent backdrop (fixed, z-index 400)
- `.review-panel` — Right drawer (575px wide, flex column)
- `.review-panel-header` — Title, stepper, badges
- `.review-panel-body` — Scrollable content area (flex: 1)
- `.review-panel-footer` — Action buttons

#### Tabs
- `.review-tabs` — Tab button row
- `.review-tab-btn` — Individual tab (active = blue underline)

#### Sections
- `.review-section-header` — Section title with colored accent bar
- `.review-info-table` — Key-value pairs (2-column)
- `.review-floor-plans` — Floor card list

#### Badges & Colors
- `.review-badge-pill` — Status badge (green/blue/red border)
- `.flow-step--{color}` — Color-coded flow badges
- `.app-status-badge--{variant}` — Application status colors

#### Modals
- `.app-modal-overlay` — Centered modal backdrop (fixed, z-index 500)
- `.app-modal-box` — Modal content card (540px wide)
- `.app-modal-textarea` — Required text input

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Primary/Blue | Blue | #2563EB |
| Success/Green | Green | #16A34A |
| Error/Red | Red | #D51D1D |
| Warning/Orange | Orange | #EA580C |
| Purple/Secondary | Purple | #9E5BF0 |
| Yellow | Yellow | #D3A62B |
| Gray/Neutral | Gray | #9B9C9C, #979797 |
| Light Border | Light | #e8ecf2 |
| Background | Off-white | #F7F8FA |
| Text | Dark | #000, #1F384C |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Poppins | 28px | 700 |
| Section Headers | Fira Mono | 12px | 700 |
| Panel Title | Poppins | 28px | 700 |
| Table Header | Poppins | 13px | 500 |
| Badge Text | Poppins | 12-14px | 500-600 |
| Body Text | Poppins | 12-13px | 400-500 |
| Mono/Codes | Fira Mono | 10-13px | 400-600 |

---

## Data Flow

1. User lands on Application Management page
2. Table shows all applications, sorted: non-approved first, approved last (grayed)
3. User filters by status or searches by name/city/admin
4. User clicks row or "Review" button → Review Panel opens
5. User views Submission tab with full details
6. User can:
   - **Request Revision:** Opens modal → Submit notes → Auto-switches to Thread tab
   - **Approve Application:** Opens modal → Confirm → Row grays out, moves to bottom
   - **Send Note:** In Thread tab, type message → Send → Appears in thread
7. User closes panel with X button

---

## Mock Data

**INITIAL_APPLICATIONS** contains 17 sample malls:
- **SM Seaside City Cebu** — Status: Submitted, Pending review
- **Ayala Center Cebu** — Status: Approved, Live (grayed out)
- **Pacific Mall Cebu** — Status: For Revision, Awaiting response
- **Gaisano Grand Liloan** — Status: Draft, Not submitted
- **SM City Cebu** — Status: Approved, Node Mapping
- **11 additional malls** — All Approved with various AR statuses

Each application includes:
- Full contact information
- Multiple floor plans with file sizes
- Scale reference details
- Accessibility routes by floor
- Emergency exits
- Entry points with descriptions
- Thread history (where applicable)

---

## Accessibility & UX

### Visual Hierarchy
- Approved applications are grayed out (opacity 0.6) and sorted to bottom
- Active tabs have blue underline and text
- Color-coded badges indicate status at a glance
- Stepper shows progress through approval workflow

### Interaction Patterns
- Row click opens panel (except Action button which stops propagation)
- Request Revision auto-switches to Thread tab for immediate feedback
- Modals require explicit confirmation (prevent accidental actions)
- All form inputs have placeholder text and helper labels

### Keyboard Support
- In Thread tab: Enter sends message, Shift+Enter for newline
- Tab navigation through filter buttons and search
- Escape closes panel (via overlay click)

---

## Notable Implementation Details

1. **Stepper Logic:** `getStepState()` determines circle state (done/active/warning/inactive) based on current applicationStatus
2. **Derived State:** `currentReviewApp` stays in sync with applications via `applications.find()`
3. **Auto-Switch:** Thread tab selected after revision submission so user sees their message
4. **Sorting:** Approved apps move to bottom via `[non-approved, ...approved]` array order
5. **Status Badges:** Color variants mapped in `getAppStatusVariant()` and `getArStatusVariant()`
6. **Modal Confirmation:** Both revision and approve modals prevent accidental state changes
7. **Thread Messages:** Admin messages auto-dated and marked with "Admin" badge

---

## Future Enhancement Opportunities

- Add bulk approval/revision for multiple applications
- Export application summary as PDF
- Real-time notifications when malls respond to revisions
- Scheduled automatic reminders for pending revisions
- Application history timeline (all status changes)
- Custom revision templates for common issues
- Integration with email notifications to mall admins
- Advanced search filters (date range, agreement type, etc.)
- Analytics dashboard for application conversion rates
