# Application Management Page

## Overview
The Application Management page is the admin interface for reviewing mall operator submissions before AR development begins. It has two tabs: **New Applications** for initial AR development submissions, and **Stall Applications** for adding new stalls to previously published AR maps.

**Location:** `navar-frontend/src/pages/ApplicationManagement.jsx`

---

## Workflow Summary

### New Applications
1. Mall submits initial application with floor plans, calibration, and infrastructure details
2. Admin reviews and approves or requests revision
3. Approved application moves to AR Development phase
4. Once AR is Live, mall can submit stall applications

### Stall Applications
1. Mall admin adds each new store or stall in **Mall Management → Store Management**
2. Store Management checks the mall's combined tenant-node allowance (stores + stalls) against its agreed subscription tier
3. If the addition exceeds the allowance, Store Management shows the extra-stall count, the ₱3,500-per-stall charge, the total due, and the mall wallet balance
4. The addition is blocked until the mall admin agrees to the charge and the wallet can cover the total; if the balance is short, the mall admin must top up before confirming
5. Once payment is confirmed, Store Management adds the new stores or stalls to the store list
6. Only malls with **Live/Published AR** can submit a stall application using stalls already in that store list
7. Admin reviews stall details and verifies the submitted stalls are in the store list
8. Admin approves stall application → Current AR is unpublished
9. AR Development tab shows "To Be Added Stalls" button
10. Development team adds stalls and republishes AR

**Key Constraint:** Stall applications can only be submitted if:
- The mall has an approved new application
- The AR development status is **Live** (published)
- Every submitted stall has already been added to the mall's store list through Store Management
- Any required additional-stall charge has been accepted and paid from the mall wallet
- Stall applications do not use Draft status; they only move through Submitted, For Revision, and Approved

---

## Page Layout

The page uses a responsive flex layout with:

1. **Tabs** — Switch between "New Applications" and "Stall Applications"
2. **Page Header** — Title, subtitle with pending count
3. **Flow Diagrams** — Visual flow charts (New Applications only)
4. **Toolbar** — Status filter tabs + search input
5. **Table** — Application data table with review actions
6. **Review Panel** — Right-side drawer showing full details and actions

### Responsive Breakpoints:
- **Desktop (>1023px):** Full layout, wide table
- **Tablet (768-1023px):** Tighter spacing, responsive table
- **Mobile (<768px):** Stacked layout, compact spacing

---

## New Applications Tab

### Status Flow
- **Draft** → Not submitted yet (new applications only)
- **Submitted** → Awaiting admin review
- **For Revision** → Admin sent back for changes
- **Approved** → Application approved, enters AR development

### Columns
| Column | Type | Notes |
|--------|------|-------|
| MALL NAME | string | Clickable, shows admin email below |
| CITY | string | Mall location |
| ADMIN | string | Contact name + email |
| VERSION | number | Application version |
| NO. OF FLOORS | number | Floor count |
| AGREEMENT | string | Contract status |
| APPLICATION | badge | Current status |
| AR DEVELOPMENT | badge | AR development status (- until approved) |
| SUBMITTED | date | Application date |
| LAST UPDATED | date | Most recent change |
| ACTION | button | Review button (blue) |

### Table Sorting
- Pending/Revision applications appear first
- Approved applications sorted to bottom (grayed out, opacity 0.6)

---

## Stall Applications Tab

### Eligibility
Only shows stall applications from malls that:
- Have an approved new application
- Have **Live AR status** (published)
- Have every submitted stall already added to the mall's store list
- Have accepted and paid any additional-stall charge required when the store or stall was added
- Any mall without published AR is excluded from the stall queue until it goes live

### Store Management Capacity and Payment Gate
Store Management applies this gate before a new store or stall is added to the store list:
- The allowance is a combined pool of stores and stalls: **Basic: 75**, **Standard: 260**, **Premium: 650** tenant nodes.
- Calculate the overage as `max(0, current tenant nodes + additions - tier allowance)`.
- Each tenant node beyond the allowance costs **₱3,500**. Display the extra-stall count, rate, total due, and current wallet balance before confirmation.
- When the wallet balance is less than the total due, block the addition and prompt the mall admin to top up the shortfall.
- When the balance covers the total, require the mall admin to explicitly agree to the charge, deduct the total from the wallet, and then add the stores or stalls to the store list.
- No stall application can be created until the relevant stalls appear in the store list. The existing application review, AR unpublish, development handoff, and republish steps then continue unchanged.

### Status Flow
- **Submitted** → Awaiting admin review
- **For Revision** → Admin sent back for changes (must add stalls to store list)
- **Approved** → Stall application approved, unpublishes AR

**Note:** Stall applications have NO Draft status. They can only be Submitted, For Revision, or Approved.

### Columns
| Column | Type | Notes |
|--------|------|-------|
| MALL NAME | string | Clickable row |
| CITY | string | Mall location |
| ADMIN | string | Contact name |
| TIER | string | Subscription tier |
| CURRENT STORES | number | Existing stores |
| NEW STALLS | number | Stalls being added |
| TOTAL AFTER | number | Current + new |
| EXTRA STALLS | number | How many exceed tier limit |
| COST (if payable) | currency | ₱ per extra stall |
| APPLICATION | badge | Status |
| SUBMITTED | date | Submission date |
| ACTION | button | Review button (blue) |

### Cost Calculation
- Based on the agreed subscription tier's combined tenant-node allowance
- Extra stores or stalls are charged at ₱3,500 per tenant node beyond the allowance
- Formula: `max(0, current tenant nodes + additions - tier allowance) * 3500`
- The charge is calculated, shown to the mall admin, agreed to, and paid from the wallet in Store Management before the new stalls can be included in a stall application
- Application Management displays the recorded extra-stall count and paid amount for review; it does not collect payment again

### Table Sorting
- Pending/Revision applications first
- Approved applications sorted to bottom

---

## Review Panel (Stall Applications)

### Panel Header
- **Mall Name** (Poppins 28px bold)
- **City · Admin Name** (Fira Mono gray)
- **Badge:** "Stalls to Be Added" (green)
- **Close button (X)** top-right

### Tabs
- **Submission** (default) — Shows stall details and store list status
- **Thread** — Visible for stall applications so admins can request revision updates

### Submission Tab Contents

#### Stall Application Details Section
- Subscription Tier
- Max Tenants (from subscription)
- Current Stores
- Submitted New Stalls
- Total After Approval
- Store-list status for every submitted stall
- If the Store Management capacity gate applied: Exceeds By (stalls), paid amount (₱), and wallet transaction reference

#### Floor Plans Section
- List of uploaded PDF files
- File name, size, download button

#### Submitted Stalls Section
- List of each stall with status
- Each stall shows:
  - **Stall Number** (bold)
  - **Floor** (gray text)
  - **Description** (12px, body text)
  - **Status Badge:**
    - Pending (orange)
    - ✓ Added (green) — If added to store list

#### Validation Alert (if not all stalls added or paid)
- Red alert for missing stores: "[Mall] hasn't added the new stalls to the store list yet. Request revision to have them add the stalls in Store Management first."
- Red alert for an unresolved overage: "[Mall] must accept and pay the ₱3,500-per-stall additional-stall charge in Store Management before these stalls can be added or applied for."

### Action Buttons
Both buttons appear if status ≠ Approved:
1. **Request Revision** (red button)
   - Opens modal
   - Text explains: "Verify all stalls have been added in store list. Status → For Revision"
   - Admin can note issues (e.g., "Floor 2 stalls still pending in store list")

2. **Approve Stall Addition** (green button)
   - Opens confirmation modal
   - Checks: All stalls have status "added_to_store_list" and any required additional-stall charge is paid
   - On confirm: Unpublishes current AR for this mall
   - Modal shows the Store Management payment record when an overage was charged

### AR Development Handoff
When a stall application is approved:
- The current live AR for that mall is marked Unpublished in AR Development
- The approved stall list is attached as the project's "To Be Added Stalls"
- The AR Development stall modal is read-only and does not show thread or revision actions

---

## Review Panel (New Applications)

### Panel Header
- **Mall Name** (Poppins 28px bold)
- **City · Admin Name** (Fira Mono gray)
- **4-step stepper** showing Draft → Submitted → For Revision → Approved
- **Badges:** Agreement status, Application status, Submitted date

### Tabs
- **Submission** (default) — All submitted details
- **Thread** — Message history with mall admin

### Submission Tab Contents (New Applications)

#### Mall Profile Section
- Address, City/Province, Floors, Stores, Operating Hours, Logo

#### Floor Plans Section
- PDF files with download buttons

#### Scale Reference Section
- Callout box explaining calibration purpose
- Reference line, length (meters), floor

#### Accessibility Routes & Emergency Exits Section
- **PWD Accessible Routes** (yellow accent)
  - List of routes per floor
- **Emergency Exits & Fire Exits** (red accent)
  - List of exits with notes

#### Entry Points Section
- List of entry locations with floor badges

### Action Buttons
1. **Request Revision** (red) → Changes status to "For Revision", adds thread message
2. **Approve Application** (green) → Changes status to "Approved", sets AR to "Pending"

---

## Request Revision Modal

### Fields
- **Title:** "Request Revision [MallName]?"
- **Description:** Explains status change and notification
- For stall applications: Adds note about verifying stalls in store list
- **Textarea:** "REVISION NOTES *" (required)

### Behavior
- On submit:
  1. Changes status to "For Revision"
  2. Adds admin message to thread with notes
  3. For new apps: Auto-switches to Thread tab
  4. Updates lastUpdated timestamp

---

## Approve Modal

### Fields
- **Title:** "Approve [MallName]?"
- **Icon:** Green checkmark (50x50px)
- **Description (varies by type):**
  - New app: "Marks application as Approved, sets AR to Pending, enters dev queue"
  - Stall app: "Marks stall addition as Approved, unpublishes current AR to incorporate new stalls"

### Behavior
- On confirm:
  - **New app:** Status → Approved, arStatus → Pending
  - **Stall app:** Status → Approved, unpublishes AR for that mall
- Closes modal and panel
- Row grays out and moves to bottom

---

## Data Structure

### New Application Object
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
  floorPlans: [ { floor, filename, size } ],
  scaleReference: { referenceLine, lengthInMeters, floor },
  accessibilityRoutes: [ { floor, description } ],
  emergencyExits: [ { floor, description, note } ],
  entryPoints: [ { name, note, floor } ],
  thread: [ { id, sender, name, isAdmin, date, message } ],
}
```

### Stall Application Object
```javascript
{
  id: number,
  mallName: string,
  city: string,
  adminName: string,
  adminEmail: string,
  tier: string, // 'Basic' | 'Standard' | 'Premium'
  currentStores: number,
  submittedStalls: number,
  tierAllowance: number,
  extraStalls: number,
  additionalStallRate: number, // 3500
  additionalStallCost: number,
  paymentStatus: 'not_required' | 'paid',
  walletTransactionReference: string | null,
  applicationStatus: 'Submitted' | 'For Revision' | 'Approved',
  submittedDate: string,
  lastUpdated: string,
  floorPlans: [ { floor, filename, size } ],
  stalls: [
    {
      id: number,
      stallNumber: string,
      floor: string,
      description: string,
      status: 'pending' | 'added_to_store_list',
      paymentStatus: 'not_required' | 'paid',
    }
  ],
  thread: [ { id, sender, name, isAdmin, date, message } ],
}
```

---

## State Management

### App-Level (App.jsx)
- `arIncomingProjects` — List of approved apps with AR status
- `liveProjects` — Filtered to only Live/Published AR projects
- Passed to ApplicationManagement as `arProjects`

### Page-Level (ApplicationManagement.jsx)
- `activeTab` — 'new' or 'stall'
- `applications` — New applications array
- `stallApplications` — Stall applications array
- `reviewingApp` — Currently open review panel
- `liveProjects` — Computed from `arProjects`, only Live status

### Component-Level (ReviewPanel.jsx)
- `activeTab` — 'submission' or 'thread'
- `showRevisionModal` — Boolean
- `showApproveModal` — Boolean
- `isStallApplication` — Passed prop

---

## Event Handlers

### handleRequestRevision(id, notes, isStallApplication)
1. Finds app by id
2. Changes applicationStatus to "For Revision"
3. Adds admin thread message with notes
4. Updates lastUpdated timestamp
5. For new apps: Switches to Thread tab

### handleApprove(id, isStallApplication)
1. For stall apps, verifies every submitted stall is in the store list and any required additional-stall charge is paid
2. Changes applicationStatus to "Approved"
3. **New apps:** Sets arDevelopment to "AR: Pending", calls onAppApproved
4. **Stall apps:** Calls onStallAppApproved to unpublish AR

### handleSendNote(id, note, isStallApplication)
1. Adds admin thread message
2. Updates lastUpdated timestamp

---

## Styling

### Review Panel (Stall Applications Specific)
- Thread tab is hidden (`display: none`)
- Action buttons show "Approve Stall Addition" instead of "Approve Application"
- Stall list cards show status as "Pending" (orange) or "✓ Added" (green)

### Color Palette
- **Blue (#2563EB):** Primary, active tabs, Review button
- **Green (#16A34A):** Approved, success states
- **Red (#D51D1D):** Revision, errors
- **Orange (#EA580C):** Warning, extra stalls
- **Gray (#9B9C9C):** Neutral, disabled

---

## Recent Changes (Stall Application Workflow)

1. **Review Button Color:** Stall applications Review button now uses `.app-mgmt-review-btn` (blue) to match New Applications
2. **Removed Draft Status:** Stall applications only support: Submitted, For Revision, Approved
3. **Restricted Eligibility:** Stall applications only show for malls with Live AR
4. **Unpublish on Approval:** Approving a stall application unpublishes the current AR
5. **No Thread for Stalls:** Thread tab is hidden; stall apps use request revision for communication
6. **Store Management Gate:** New stores and stalls that exceed the agreed tenant-node allowance require an explicit ₱3,500-per-stall payment agreement and sufficient wallet balance before they are added to the store list.
7. **Store-List Prerequisite:** A stall application can only be submitted after its stalls are present in the store list; Application Management verifies this and any required payment before approval.
8. **To Be Added Stalls Button:** AR Development table shows button to view pending stalls (see ARDevelopment.md)

---

## Future Enhancements

- Bulk approval/revision for multiple applications
- Export application summary as PDF
- Real-time notifications for revision responses
- Application history timeline (all status changes)
- Custom revision templates for common issues
- Integration with email notifications
- Advanced search filters (date range, agreement type, etc.)
- Analytics dashboard for conversion rates
- Payment receipt details and wallet transaction history links for paid additional-stall charges
