# AR Development Page

## Overview
The AR Development page is the admin interface for managing the complete AR map creation and deployment workflow. Admins track projects through distinct stages (mapping, testing, activation) and manage communication with mall admins via threaded discussions.

**Location:** `navar-frontend/src/pages/ARDevelopment.jsx`

---

## Page Layout

The page uses a responsive flex layout with:

1. **Page Header** — Title, subtitle with completion status count
2. **Flow Diagram** — Visual representation of the AR development pipeline
3. **Toolbar** — Status filter tabs + search input
4. **Table** — Complete AR project data table with stage-appropriate actions
5. **Modals** — Testing error display, thread discussion, and publish confirmation

### Responsive Breakpoints:
- **Desktop (>1023px):** Full layout, wide table
- **Tablet (768-1023px):** Tighter spacing, responsive toolbar
- **Mobile (<768px):** Stacked layout, compact spacing

---

## Components

### 1. **Page Header**
**File:** `ARDevTable.jsx` (lines 251-259)

**Purpose:** Displays page title and development progress status.

**Key Features:**
- Title: "AR Development" (Poppins 28px bold)
- Subtitle: "Track and manage AR map development for approved mall partners."
- Status count: Shows number of malls awaiting AR development completion (not yet Live)
- Dynamic count in red alert style when malls are in development

**Example:**
```
AR Development
Track and manage AR map development for approved mall partners. 3 malls awaiting AR development completion.
```

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
- **Unpublished to Live:**
  - **Action:** "Reactivate" button (shown when Unpublished)
  - **Handler:** Updates status back to "Live"

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

---

## Components

### 1. **ARDevTable** (Main Feature Component)
**File:** `src/components/arDevelopment/ARDevTable.jsx`

**Purpose:** Core AR Development interface with full workflow management.

**Key Sections:**

#### State Management
```javascript
const [projects, setProjects] = useState([...initialProjects, ...incomingProjects])
const [filteredProjects, setFilteredProjects] = useState([])
const [activeFilter, setActiveFilter] = useState('All')
const [searchQuery, setSearchQuery] = useState('')
const [testingProject, setTestingProject] = useState(null)
const [thread, setThread] = useState(null)
const [publishProject, setPublishProject] = useState(null)
```

#### Workflow Handlers
- **`handleStartMapping(id)`** — Updates status to "Node Mapping"
- **`handleSubmitForTesting(project)`** — Opens testing modal
- **`handleTestingProceed()`** — Advances to "Navigation Testing" if no errors
- **`handleMarkAsReady(id)`** — Updates status to "Ready for activation"
- **`handleViewThread(project)`** — Opens thread modal for discussion
- **`handlePublishConfirm()`** — Publishes project (Live) after admin approval
- **`updateItem(id, updates)`** — Generic updater for status changes
- **`handleSendNote(text)`** — Adds user message to thread

#### Filtering & Search
- **Status filters:** All, Pending, Node Mapping, Navigation Testing, Ready, Live, Unpublished
- **Dynamic counts:** Shows count in each filter tab
- **Search:** Real-time matching across mall name, city, admin name

#### Table Columns
- **Mall Name** — Mall name with tier subtitle (Premium/Standard/Basic)
- **Admin** — Admin name with email
- **AR Status** — Color-coded status badge
- **Actions** — Context-specific buttons (Start, Submit, Mark Ready, View Thread, Publish, etc.)

**Key Logic:**

Publish button gating (lines 386-397):
```javascript
{project.arStatus === 'Ready for activation' && (
  <>
    <button className="ar-dev-action-btn ar-dev-action-btn--view-thread" 
            onClick={() => handleViewThread(project)}>
      View Thread
    </button>
    {(() => {
      const isApproved = project.thread && project.thread.some(msg => msg.isAdmin)
      return (
        <button
          className={`ar-dev-action-btn ar-dev-action-btn--publish${!isApproved ? ' ar-dev-action-btn--publish-disabled' : ''}`}
          onClick={() => isApproved && setPublishProject(project)}
          disabled={!isApproved}
        >
          Publish
        </button>
      )
    })()}
  </>
)}
```

---

### 2. **TestingModal**
**File:** `src/components/arDevelopment/TestingModal.jsx`

**Purpose:** Display testing results and allow user to proceed or abort.

**Props:**
```javascript
{
  project: ProjectObject,              // The project being tested
  errors: ErrorArray,                  // Array of test errors found
  onClose: Function,                   // Callback to close modal
  onProceed: Function,                 // Callback when "Proceed" clicked
}
```

**Features:**
- **Error Display:** Red banner with error list (if any)
- **Success Display:** Green banner if no errors found
- **Actions:** "Cancel" and "Proceed" buttons
- **Proceed Gate:** Only clickable if no errors

**Error Item Format:**
```javascript
{
  id: string,
  message: string,  // e.g., "Node 5 has invalid coordinates"
}
```

---

### 3. **ThreadModal**
**File:** `src/components/arDevelopment/ThreadModal.jsx`

**Purpose:** Threaded discussion between admin and mall admin about AR project.

**Props:**
```javascript
{
  project: ProjectObject,              // The project with thread data
  onClose: Function,                   // Close modal callback
  onSendNote: Function,                // Send message callback
}
```

**Key Features:**

#### Approval State Detection
- Checks if any message in thread has `isAdmin: true`
- If admin message exists: banner shows "Mall Admin confirmed. Ready to Activate or Publish."
- If no admin message: banner shows "Awaiting mall admin confirmation for activation"

#### Thread Message Format
```javascript
{
  sender: 'admin' | 'mall',           // Who sent the message
  senderName: string,                 // Display name
  message: string,                    // Message text
  timestamp: string,                  // Date string
  isAdmin: boolean,                   // Whether sender is mall admin (approval gate)
}
```

#### UI Elements
- **Header:** Project title, subtitle showing approval state
- **Approval Banner:** Blue (waiting) or green (approved) banner with status text
- **Messages:** Chat-like display with avatars, names, timestamps
- **Admin Badge:** Blue label on admin messages for visual distinction
- **Input Area:** Textarea for typing new messages
- **Send Button:** Disabled if empty

#### Styling
- Admin messages: Blue background (#EFF4FF), reversed alignment
- Mall messages: White background, normal alignment
- Banner waiting: Blue theme (#E1F3FF background, #2563EB text)
- Banner approved: Green theme (#DCF3E8 background, #16A34A text)

---

### 4. **PublishModal**
**File:** `src/components/arDevelopment/PublishModal.jsx`

**Purpose:** Confirmation modal before publishing AR map to production.

**Props:**
```javascript
{
  project: ProjectObject,              // The project to publish
  onCancel: Function,                  // Cancel callback
  onConfirm: Function,                 // Publish callback
}
```

**Features:**
- **Icon:** Checkmark or similar visual confirmation symbol
- **Title:** "Publish AR Map"
- **Description:** "This will make the AR map live for mall visitors."
- **Actions:** "Cancel" and "Confirm" buttons

---

## Styles

### Global AR Development Files
- **`arDevelopmentLayout.css`** — Page wrapper, content spacing, responsive layout
- **`arDevelopment.css`** — Component-specific styles, table, modals, buttons

### Key CSS Classes

#### Layout
- `.ar-dev-page` — Main container, flex column, max-width 1400px, NO padding (inherited from parent)
- `.ar-dev-content` — Inner content wrapper, flex column, 20px gap

#### Page Header
- `.ar-dev-header` — Title + subtitle container
- `.ar-dev-title` — "AR Development" heading (Poppins 28px bold)
- `.ar-dev-subtitle` — Descriptive text with status count
- `.ar-dev-subtitle-alert` — Red alert styling for count when malls in development

#### Flow Diagram
- `.ar-dev-flows` — Flow card container
- `.ar-dev-flow-card` — Individual flow stage card
- `.ar-dev-flow-label` — Flow label (monospace, 12px, uppercase)
- `.ar-dev-flow-steps` — Step badges container
- `.ar-dev-flow-step` — Individual step
- `.ar-dev-flow-step-badge` — Step color-coded badge
- `.flow-step--{color}` — Color variants (grey, blue, green, orange, purple, yellow, red)

#### Toolbar
- `.ar-dev-toolbar` — Filter tabs + search container
- `.ar-dev-filters` — Filter tab container with border
- `.ar-dev-filter-btn` — Individual tab button
- `.ar-dev-filter-btn--active` — Active tab styling (white bg, black text)
- `.ar-dev-filter-count` — Badge with count number
- `.ar-dev-filter-count--active` — Active count badge (blue)
- `.ar-dev-search-wrap` — Search input wrapper
- `.ar-dev-search-input` — Search field

#### Table
- `.ar-dev-table-wrap` — Table card container (white, bordered, rounded)
- `.ar-dev-table-scroll` — Scrollable table wrapper
- `.ar-dev-table` — Table element
- `.ar-dev-table thead th` — Header cells (sticky, gray background)
- `.ar-dev-table tbody tr` — Data rows (hover effect, border-bottom)
- `.ar-dev-table tbody tr.row--live` — Live/unpublished row styling (faded, gray bg)
- `.ar-dev-table td` — Data cells
- `.ar-dev-mall-name` — Mall name cell
- `.ar-dev-mall-tier` — Tier subtitle under mall name
- `.ar-dev-admin-name` — Admin name cell
- `.ar-dev-admin-email` — Admin email under name

#### Status Badges
- `.ar-status-badge` — Base badge styling (Poppins 13px 500)
- `.ar-status-badge--pending` — Orange
- `.ar-status-badge--node-mapping` — Blue
- `.ar-status-badge--nav-testing` — Purple
- `.ar-status-badge--ready` — Yellow
- `.ar-status-badge--live` — Green
- `.ar-status-badge--unpublished` — Red

#### Action Buttons
- `.ar-dev-action-btn` — Base button styling (Poppins 12px 500, inline-block)
- `.ar-dev-action-btn--start` — Cyan background, Start Mapping
- `.ar-dev-action-btn--test` — Yellow background, Submit for Testing
- `.ar-dev-action-btn--mark-ready` — Purple background, Mark as Ready
- `.ar-dev-action-btn--view-thread` — Orange background, View Thread
- `.ar-dev-action-btn--publish` — Green background, Publish
- `.ar-dev-action-btn--publish-disabled` — Green 45% opacity, not-allowed cursor
- `.ar-dev-action-btn--unpublish` — Red background, Unpublish
- `.ar-dev-action-btn--reactivate` — Green background, Reactivate

#### Modals (Testing, Thread, Publish)
- `.ar-modal-overlay` — Full-screen dark backdrop (z-index 500)
- `.ar-modal-box` — Modal container (white, rounded, shadowed)
- `.ar-modal-title` — Modal heading (Poppins 20px 700)
- `.ar-modal-subtitle` — Modal subtext
- `.ar-modal-errors-label` — "Errors Found" label (red, monospace)
- `.ar-modal-errors-list` — Error list container
- `.ar-modal-error-item` — Individual error with icon
- `.ar-modal-success` — Success banner (green theme)
- `.ar-modal-actions` — Button container (flex, right-aligned)

#### Thread Modal Specific
- `.ar-thread-overlay` — Full-screen backdrop
- `.ar-thread-box` — Thread modal container
- `.ar-thread-header` — Title + close button
- `.ar-thread-title` — "View Thread" heading
- `.ar-thread-subtitle` — Approval state text (monospace)
- `.ar-thread-close` — Close button (×)
- `.ar-thread-approval-banner` — Approval state banner
- `.ar-thread-approval-banner--waiting` — Blue (awaiting)
- `.ar-thread-approval-banner--approved` — Green (confirmed)
- `.ar-thread-messages` — Scrollable message container
- `.ar-thread-msg-row` — Individual message row
- `.ar-thread-msg-row--admin` — Admin message (flex-direction: row-reverse)
- `.ar-thread-msg-avatar` — Avatar circle (36px, initials)
- `.ar-thread-msg-avatar--admin` — Blue theme
- `.ar-thread-msg-avatar--mall` — Gray theme
- `.ar-thread-msg-bubble` — Message content box
- `.ar-thread-msg-bubble--admin` — Blue border + background
- `.ar-thread-msg-bubble--mall` — Gray border, white background
- `.ar-thread-msg-admin-badge` — Small "ADMIN" label
- `.ar-thread-textarea` — Message input field
- `.ar-thread-send-btn` — Send button (blue)

---

## Data Flow

### Initial Projects
Each project in the queue has this structure:
```javascript
{
  id: string,                         // Unique identifier
  mallName: string,                   // Mall name (e.g., "SM Seaside City Cebu")
  tier: 'Premium' | 'Standard' | 'Basic',
  city: string,
  adminName: string,
  adminEmail: string,
  version: string,
  floors: number,
  agreement: string,
  applicationStatus: 'Approved',
  arStatus: 'Pending' | 'Node Mapping' | 'Navigation Testing' | 'Ready for activation' | 'Live' | 'Unpublished',
  dateAdded: string,                  // Date string (e.g., "November 1, 2024")
  lastUpdated: string,
  thread: [
    {
      sender: 'admin' | 'mall',
      senderName: string,
      message: string,
      timestamp: string,
      isAdmin: boolean,               // Flags admin approval
    }
  ],
  testErrors: [                       // Errors from testing phase
    {
      id: string,
      message: string,
    }
  ],
}
```

### State Lifting in App.jsx
```javascript
const [arIncomingProjects, setArIncomingProjects] = useState([])

function handleAppApproved(app) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  setArIncomingProjects(prev => {
    const alreadyExists = prev.some(p => p.id === app.id)
    if (alreadyExists) return prev
    return [...prev, {
      id: app.id,
      mallName: app.mallName,
      tier: TIER_MAP[app.mallName] || 'Basic',
      // ... other fields
      arStatus: 'Pending',
      dateAdded: now,
      thread: [],
      testErrors: [],
    }]
  })
}
```

---

## Color Palette

| Status | Color | Hex |
|--------|-------|-----|
| Pending | Orange | #EA580C |
| Node Mapping | Blue | #2563EB |
| Navigation Testing | Purple | #9E5BF0 |
| Ready for activation | Yellow | #D3A62B |
| Live | Green | #16A34A |
| Unpublished | Red | #D51D1D |
| Admin Text | Blue | #2563EB |
| Mall Text | Gray | #979797 |

---

## Key Implementation Details

1. **Publish Button Gating:** Button is disabled (opacity 0.45) until thread contains admin message
2. **Live Row Styling:** Rows with Live or Unpublished status appear faded (opacity 0.7) and grouped at table bottom
3. **Queue Stability:** New approved applications append to end of their tier, not inserted in date order
4. **Modal State Sync:** Thread updates sync both table state and open modal state
5. **No Edit Map Yet:** "Edit Map" button not implemented; restricted to workflow actions only
6. **Approval Detection:** Thread approval is client-side flag (`isAdmin: true`); actual backend approval TBD

---

## Future Enhancement Opportunities

- Implement real map editing interface for Node Mapping stage
- Add automated testing engine instead of hardcoded errors
- Integrate actual backend approval mechanism for mall admins
- Add batch operations (publish multiple, bulk status change)
- Implement time-tracking and SLA monitoring
- Add activity audit log per project
- Create drill-down detailed project view
- Implement real-time notifications for status changes
