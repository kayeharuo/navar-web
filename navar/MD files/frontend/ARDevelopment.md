# AR Development Page

## Overview
The AR Development page is the admin interface for managing the complete AR map creation and deployment workflow. Admins track projects through distinct stages (mapping, testing, activation), handle stall additions, and manage communication with mall admins via threaded discussions.

**Location:** `navar-frontend/src/pages/ARDevelopment.jsx`

---

## Page Layout

The page uses a responsive flex layout with:

1. **Page Header** — Title, subtitle with completion status count
2. **Flow Diagram** — Visual representation of the AR development pipeline
3. **Toolbar** — Status filter tabs + search input
4. **Table** — Complete AR project data table with stage-appropriate actions
5. **Modals** — Testing error display, thread discussion, publish confirmation, stall details

### Responsive Breakpoints:
- **Desktop (>1023px):** Full layout, wide table
- **Tablet (768-1023px):** Tighter spacing, responsive toolbar
- **Mobile (<768px):** Stacked layout, compact spacing

---

## AR Development Workflow

The AR Development workflow progresses through distinct, ordered stages:

### Status Progression (Linear)
1. **Pending** (orange) — Initial state, awaiting mapping to begin
2. **Node Mapping** (blue) — Team is mapping navigation nodes
3. **Navigation Testing** (purple) — QA phase, testing map functionality
4. **Ready for activation** (yellow) — Awaiting mall admin approval
5. **Live** (green) — Published and active in production
6. **Unpublished** (red) — Was live, now hidden (reversible to Live)

### Workflow Triggers & Rules

#### Pending → Node Mapping
- **Action:** "Start Mapping" button
- **Handler:** `handleStartMapping()` in ARDevTable
- **No conditions:** Available from Pending state

#### Node Mapping → Navigation Testing
- **Action:** "Submit for Testing" button opens modal
- **Modal:** Shows potential testing errors
- **Outcomes:**
  - If no errors: Click "Proceed" → status becomes "Navigation Testing"
  - If errors found: Display error list, user must fix and resubmit
- **Handler:** `handleTestingProceed()` in ARDevTable

#### Navigation Testing → Ready for activation
- **Action:** "Mark as Ready" button
- **Handler:** `handleMarkAsReady()` in ARDevTable
- **Backend Context:** Sends project info to mall admin for review
- **No API call yet:** Currently frontend-only state change

#### Ready for activation → Live
- **Action:** "View Thread" opens discussion modal
- **Communication:** Mall admin approves/discusses in thread
- **Approval Gate:** Admin message in thread required before "Publish" activates
- **Publish Button:** Only clickable if thread contains admin message
- **Handler:** `handlePublishConfirm()` in ARDevTable
- **Result:** Status becomes "Live"

#### Live ↔ Unpublished (Reversible)
- **Publish to Unpublished:**
  - **Action:** "Unpublish" button (shown when Live)
  - **Handler:** Updates status to "Unpublished"
  - **Trigger:** When a stall application is approved in Application Management
- **Unpublished to Live:**
  - **Action:** "Reactivate" button (shown when Unpublished)
  - **Handler:** Updates status back to "Live"

---

## Stall Addition Workflow

### Integration with Stall Applications

When a stall application is approved in Application Management:

1. **Approval Trigger:** Admin clicks "Approve Stall Addition" in Stall Application review
2. **AR Update:** Current Live AR for that mall becomes **Unpublished**
3. **AR Development Display:** Project shows "Unpublished" status
4. **New Button Appears:** "To Be Added Stalls" button with count of pending stalls
5. **Development Work:** AR Development team reviews stalls and adds them to map
6. **Republish:** Once stalls are incorporated, AR is republished as Live
7. **Read-only Review:** The AR Development stall modal shows the same stall submission details as Application Management, including floor plans and stall metadata, but it omits thread messages and revision actions

### To Be Added Stalls Button

**Visibility:** Shows when:
- Project has `stallAdditions` array with items
- Coming from approved stall applications

**Behavior:**
- Click button → Opens read-only modal with stall details
- Shows:
  - Mall name + city + admin info (header)
  - List of stalls to be added
  - Each stall shows: number, floor, description
  - Count of pending stalls
- No edit capability (unlike ARDevDetail which can mark stalls as published)
- Purpose: Review and understand what stalls need to be incorporated before republishing
- Uses the approved stall application data attached from Application Management

**Data Flow:**
```
StallApplication (Approved)
  → onStallAppApproved() callback
  → App.jsx: handleStallAppApproved()
  → Sets arStatus to 'Unpublished' for matching mall
  → ARDevTable receives updated items
  → stallAdditions array populated from stall application data
  → "To Be Added Stalls" button appears
```

---

## Queue Ordering Logic

Projects are ordered by two criteria:

### Primary Sort: Status Grouping
- **Non-Live First:** Pending, Node Mapping, Navigation Testing, Ready for activation
- **Live/Unpublished Last:** All live and unpublished projects grouped at bottom
- **Within each group:** Sorted by tier then date added

### Secondary Sort: Tier + Date
**Tier Order:** Premium > Standard > Basic
- Each tier is sorted by `dateAdded` (ascending = oldest first)
- New projects append to the **end** of their tier within the current status group

### Example Queue
```
Premium projects (non-live, by date)
  - SM Seaside City Cebu (Pending, added 2024-11-01)
  - Ayala Center Cebu (Node Mapping, added 2024-11-02)
Standard projects (non-live, by date)
  - Pacific Mall Cebu (Pending, added 2024-11-03)
Basic projects (non-live, by date)
  - Gaisano Grand Minglanilla (Navigation Testing, added 2024-11-04)
---
Premium/Standard/Basic (Live or Unpublished, by date)
  - [... any live/unpublished, sorted by tier then date]
```

---

## Integration with Application Management

### New Application Approval

When an application is approved in Application Management:

1. **Approval Trigger:** User clicks "Approve" in ApplicationManagement component
2. **Data Handoff:** `handleAppApproved()` callback lifts approval to `App.jsx`
3. **Queue Entry:** New AR project created with:
   - **Status:** "Pending"
   - **Tier:** Determined by mall name (via `TIER_MAP` in App.jsx)
   - **Date Added:** Current date
   - **Thread:** Empty array (no discussion yet)
4. **Queue Placement:** Appended to end of its tier in non-live section
5. **Display:** Immediately visible in AR Development table

### Stall Application Approval

When a stall application is approved in Application Management:

1. **Approval Trigger:** User clicks "Approve Stall Addition"
2. **Data Handoff:** `onStallAppApproved()` callback with stall app data
3. **AR Update:** Finds matching Live AR for that mall
4. **Status Change:** Sets `arStatus` to "Unpublished"
5. **Stall Data:** `stallAdditions` array populated with stall details
6. **Button Appears:** "To Be Added Stalls" button now visible on that project
7. **Development Queue:** Project remains in queue for team to incorporate stalls

---

## Components

### 1. **ARDevTable** (Main Feature Component)
**File:** `src/components/arDevelopment/ARDevTable.jsx`

**Purpose:** Core AR Development interface with full workflow management.

**Key Sections:**

#### State Management
```javascript
const [items, setItems] = useState([...initialProjects, ...incomingProjects])
const [activeFilter, setActiveFilter] = useState('All')
const [searchQuery, setSearchQuery] = useState('')
const [testingProject, setTestingProject] = useState(null)
const [threadProject, setThreadProject] = useState(null)
const [publishProject, setPublishProject] = useState(null)
const [detailProject, setDetailProject] = useState(null)
const [stallsModalProject, setStallsModalProject] = useState(null)  // NEW
```

#### Workflow Handlers
- **`handleStartMapping(id)`** — Updates status to "Node Mapping"
- **`handleSubmitForTesting(project)`** — Opens testing modal
- **`handleTestingProceed()`** — Advances to "Navigation Testing" if no errors
- **`handleMarkAsReady(id)`** — Updates status to "Ready for activation"
- **`handleViewThread(project)`** — Opens thread modal for discussion
- **`handlePublishConfirm()`** — Publishes project (Live) after admin approval
- **`handleUnpublish(id)`** — Sets status to "Unpublished" (stall additions)
- **`handleReactivate(id)`** — Sets status back to "Live"
- **`handleStallStatusChange(projectId, stallId, newStatus)`** — Updates individual stall status (for ARDevDetail)
- **`updateItem(id, updates)`** — Generic updater for status changes
- **`handleSendNote(id, note)`** — Adds user message to thread

#### Filtering & Search
- **Status filters:** All, Pending, Node Mapping, Navigation Testing, Ready for activation, Live
- **Dynamic counts:** Shows count in each filter tab
- **Search:** Real-time matching across mall name, city, admin name

#### Table Columns
| Column | Type | Notes |
|--------|------|-------|
| MALL NAME | string | Name with tier subtitle |
| CITY | string | Location |
| ADMIN | string | Name with email |
| VERSION | number | Project version |
| NO. OF FLOORS | number | Floor count |
| AGREEMENT | string | Contract status |
| APPLICATION | badge | "Approved" |
| AR DEVELOPMENT | badge | Current stage |
| DATE ADDED | date | When approved |
| LAST UPDATED | date | Latest change |
| ACTIONS | buttons | Context-specific |

#### Action Buttons (Context-Sensitive)

**Pending:** "Start Mapping"

**Node Mapping:** "Submit for Testing"

**Navigation Testing:** "Mark as Ready"

**Ready for activation:**
- "View Thread"
- "Publish" (enabled only if thread has mall admin message)

**Live:**
- "To Be Added Stalls" (if `stallAdditions` array exists)
- "Unpublish"

**Unpublished:**
- "To Be Added Stalls" (if `stallAdditions` array exists)
- "Reactivate"

---

### 2. **ToBeAddedStallsModal** (NEW)
**File:** `src/components/arDevelopment/ToBeAddedStallsModal.jsx`

**Purpose:** Read-only display of stalls from approved stall applications.

**Props:**
```javascript
{
  stallAdditions: Array,      // Array of stall objects
  mallName: string,           // Mall name for header
  city: string,               // City for subheader
  adminName: string,          // Admin name for subheader
  onClose: Function,          // Close modal callback
}
```

**Key Features:**
- **Header:** Mall name, city · admin name, "Stalls to Be Added" badge
- **Content:** Displays each stall with:
  - Stall Number (bold)
  - Floor (gray text, 12px)
  - Description (body text)
- **Info Banner:** Shows count of stalls to be added
- **Read-Only:** No buttons to modify stall status (unlike ARDevDetail)
- **Purpose:** Allows team to review stalls before incorporating into AR map

**Modal Styling:**
- Uses `.review-panel` and `.review-overlay` classes (same as review panels)
- Same visual style as ApplicationManagement review panels for consistency

---

### 3. **TestingModal**
**File:** `src/components/arDevelopment/TestingModal.jsx`

**Purpose:** Display testing results and allow user to proceed or abort.

**Props:**
```javascript
{
  mallName: string,           // Mall name for title
  errors: Array,              // Array of test errors
  onCancel: Function,         // Close modal callback
  onProceed: Function,        // Advance to testing status
}
```

**Features:**
- **Error Display:** Red banner with error list (if any)
- **Success Display:** Green banner if no errors found
- **Actions:** "Cancel" and "Proceed" buttons
- **Proceed Gate:** Only clickable if no errors

---

### 4. **ThreadModal**
**File:** `src/components/arDevelopment/ThreadModal.jsx`

**Purpose:** Threaded discussion between admin and mall admin about AR project.

**Props:**
```javascript
{
  project: ProjectObject,    // The project with thread data
  onClose: Function,         // Close modal callback
  onSendNote: Function,      // Send message callback
  onPublish: Function,       // Publish callback (optional)
}
```

**Key Features:**

#### Approval State Detection
- Checks if any message in thread has `sender: 'mall'`
- If mall message exists: banner shows "Mall Admin confirmed. Ready to Activate."
- If no mall message: banner shows "Awaiting mall admin confirmation for activation"

#### Thread Message Format
```javascript
{
  id: number,
  sender: 'admin' | 'mall',
  name: string,
  date: string,
  message: string,
  isAdmin: boolean,  // Approval gate flag
}
```

#### UI Elements
- **Header:** Project title, subtitle
- **Approval Banner:** Blue (waiting) or green (approved)
- **Messages:** Chat-like display with names, timestamps
- **Admin Badge:** Blue label on admin messages
- **Input Area:** Textarea for new messages
- **Send Button:** Disabled if empty

---

### 5. **PublishModal**
**File:** `src/components/arDevelopment/PublishModal.jsx`

**Purpose:** Confirmation modal before publishing AR map to production.

**Props:**
```javascript
{
  mallName: string,          // Mall name for title
  onCancel: Function,        // Cancel callback
  onConfirm: Function,       // Publish callback
}
```

**Features:**
- **Icon:** Green checkmark for confirmation
- **Title:** "Publish [MallName]?"
- **Description:** Confirms AR map will be made live
- **Actions:** "Cancel" and "Publish" buttons

---

### 6. **ARDevDetail** (Existing)
**File:** `src/components/arDevelopment/ARDevDetail.jsx`

**Purpose:** Detailed view and editing of AR project stall additions.

**Use Case:**
- When development team needs to track which stalls have been published to the main AR
- Allows marking individual stalls as published
- Shows stall list with edit capabilities

**Relationship to ToBeAddedStallsModal:**
- **ToBeAddedStallsModal:** Read-only view of stalls to be added (from approved stall app)
- **ARDevDetail:** Full detail view with edit capability for publishing stalls

---

## Data Structure

### Project Object (Extended)
```javascript
{
  id: number,
  mallName: string,
  tier: string,               // 'Premium' | 'Standard' | 'Basic'
  city: string,
  adminName: string,
  adminEmail: string,
  version: number,
  floors: number,
  nodes: number,
  edges: number,
  agreement: string,
  applicationStatus: 'Approved',
  arStatus: 'Pending' | 'Node Mapping' | 'Navigation Testing' | 'Ready for activation' | 'Live' | 'Unpublished',
  dateAdded: string,
  lastUpdated: string,
  thread: ThreadMessage[],
  testErrors: string[],
  stallAdditions: StallObject[],    // NEW: From approved stall applications
}
```

### Stall Object
```javascript
{
  id: number,
  stallNumber: string,
  floor: string,
  description: string,
  status: 'pending' | 'added_to_store_list',  // Initially 'pending' from stall app
}
```

### Thread Message
```javascript
{
  id: number,
  sender: 'admin' | 'system' | 'mall',
  name: string,
  date: string,
  message: string,
  isAdmin: boolean,  // Approval gate flag (for old data)
}
```

---

## State Management

### App-Level (App.jsx)
- `arIncomingProjects` — Approved apps ready for AR development
- `handleAppApproved()` — Adds new AR projects
- `handleStallAppApproved()` — Unpublishes AR, adds stall data

### Page-Level (ARDevelopment.jsx)
- Passes `incomingProjects` to ARDevTable

### Component-Level (ARDevTable.jsx)
- `items` — All projects (initial + incoming)
- `activeFilter`, `searchQuery` — Filtering/search state
- `testingProject`, `threadProject`, `publishProject` — Active modals
- `detailProject` — ARDevDetail modal state
- `stallsModalProject` — ToBeAddedStallsModal state (NEW)

---

## Event Handlers

### handleStartMapping(id)
```javascript
updateItem(id, { arStatus: 'Node Mapping' })
```

### handleSubmitForTesting(project)
```javascript
setTestingProject(project)  // Opens TestingModal
```

### handleTestingProceed()
```javascript
updateItem(testingProject.id, { arStatus: 'Navigation Testing' })
setTestingProject(null)
```

### handleMarkAsReady(id)
```javascript
// Creates system message with project summary
// Sets arStatus to 'Ready for activation'
// Adds message to thread
```

### handleViewThread(project)
```javascript
setThreadProject(project)  // Opens ThreadModal
```

### handlePublishConfirm()
```javascript
updateItem(publishProject.id, { arStatus: 'Live' })
setPublishProject(null)
```

### handleUnpublish(id)
```javascript
updateItem(id, { arStatus: 'Unpublished' })
```

### handleReactivate(id)
```javascript
updateItem(id, { arStatus: 'Ready for activation' })
```

### handleStallStatusChange(projectId, stallId, newStatus)
```javascript
// Updates individual stall status in stallAdditions array
// Used by ARDevDetail for marking stalls as published
```

---

## Styling

### Global AR Development Files
- **`arDevelopmentLayout.css`** — Page wrapper, content spacing, responsive layout
- **`arDevelopment.css`** — Component-specific styles, table, modals, buttons

### Key CSS Classes

#### Layout
- `.ar-dev-page` — Main container, flex column
- `.ar-dev-content` — Inner content wrapper, flex column

#### Page Header
- `.ar-dev-header` — Title + subtitle container
- `.ar-dev-title` — "AR Development" heading (Poppins 28px bold)
- `.ar-dev-subtitle` — Descriptive text
- `.ar-dev-subtitle-alert` — Red alert styling

#### Toolbar
- `.ar-dev-toolbar` — Filter tabs + search
- `.ar-dev-filters` — Filter tab container
- `.ar-dev-filter-btn` — Individual filter button
- `.ar-dev-filter-btn--active` — Active filter (white bg, blue underline)
- `.ar-dev-search-wrap` — Search input wrapper
- `.ar-dev-search-input` — Search input field

#### Table
- `.ar-dev-table-wrap` — Table card container
- `.ar-dev-table` — Table element
- `.ar-dev-table thead` — Sticky header
- `.ar-dev-table tbody tr` — Data rows
- `.row--live` — Live/unpublished row styling (faded)
- `.ar-dev-action-cell` — Action buttons cell
- `.ar-dev-action-btn` — Individual action button
- `.ar-dev-action-btn--{type}` — Button variants (start, test, publish, unpublish, etc.)
- `.ar-dev-action-btn--stall-additions` — To Be Added Stalls button

#### Status Badges
- `.ar-status-badge` — Base badge
- `.ar-status-badge--{variant}` — Color variants (pending, node-mapping, nav-testing, ready, live, unpublished)

#### Modals
- `.ar-detail-overlay` — Full-screen backdrop
- `.ar-detail-panel` — Modal container
- `.ar-detail-header` — Modal header
- `.ar-detail-tabs` — Tab buttons
- `.ar-detail-body` — Content area
- `.review-panel` — (Used for ToBeAddedStallsModal)
- `.review-overlay` — (Used for ToBeAddedStallsModal)

---

## Recent Changes (Stall Application Integration)

1. **To Be Added Stalls Modal:** New `ToBeAddedStallsModal` component displays stalls from approved stall applications (read-only)
2. **AR Unpublish on Stall Approval:** When stall application approved, matching Live AR becomes Unpublished
3. **Stall Data Integration:** `stallAdditions` array populated from stall application data when AR unpublished
4. **Button Appearance:** "To Be Added Stalls" button appears when stallAdditions exist
5. **App.jsx Integration:** `handleStallAppApproved()` callback manages AR status updates

---

## Future Enhancements

- Automatic email notifications to mall admin at each stage transition
- Stall publishing workflow (mark stalls as added, auto-update main AR)
- Real-time map preview in modal
- Testing error auto-assignment to team members
- SLA tracking for development timeline
- Bulk operations for same-tier projects
- Advanced reporting on AR development metrics
