# Subscription Management Page

## Overview
Subscription Management replaces the earlier "License Management" placeholder. It manages the lifecycle of a mall's paid subscription: onboarding, active billing, grace period, suspension, and reinstatement. All "license" / "contract" terminology has been renamed to "subscription" throughout this page, its nav entry, the Audit Logs module list, and related notification copy. Business rules follow `MD files/Subscription/NavAR_Subscription_Tiers.md` — there is no more "down payment"; the one-time setup cost is the **Onboarding Fee**, separate from the recurring **Annual Subscription Fee**.

**Location:** `navar-frontend/src/pages/SubscriptionManagement.jsx`
**Route:** `/subscription-management` (previously `/license-management`)

---

## Page Layout
1. **Page Header** — Title + subtitle
2. **Notifications** — Dismissible urgent-notice list (fixed max-height, scrolls independently) with a "Clear All" action and a per-item X dismiss button
3. **Stat Cards** — Total Malls, Active, Grace Period, Suspended, Setup
4. **Toolbar** — Status filter pills + search
5. **Table** — One row per mall, "Click any row to view full details." hint below it (matching the Audit Logs pattern)
6. **Subscription Info Panel** — Right-side drawer opened by row click or the "View" button
7. **Suspend Modal** / **Lift Suspension Modal** — Triggered from the info panel footer

---

## Components

### 1. `SubscriptionsTable`
**File:** `src/components/subscriptionManagement/SubscriptionsTable.jsx`

- Holds all mock mall data, notifications, filters, search, and the three action states (`viewMall`, `suspendMall`, `liftMall`)
- `TIERS` constant defines per-tier `annualFee`, `onboardingFee`, `gracePeriodDays`, `reinstatementRate`, sourced from `NavAR_Subscription_Tiers.md` Section 7 (Basic ₱60,000/₱187,500, Standard ₱150,000/₱594,600, Premium ₱350,000/₱1,585,000)
- Table columns: **Mall, Tier, Onboarding Fee, Annual Fee, Wallet, Subscription Start, Subscription End, Status, Days Left, Actions** — Onboarding Fee is the new column added next to Tier
- Row click or "View" button opens `SubscriptionInfoPanel`
- `handleSuspendConfirm` / `handleLiftConfirm` update mall state, tier/payment/suspension history in place (mock only, no backend)

### 2. `SubscriptionInfoPanel`
**File:** `src/components/subscriptionManagement/SubscriptionInfoPanel.jsx`

Right-side drawer sections:
- Status + Tier badges
- Wallet balance box (annual fee + contextual days-left label)
- Setup note (Setup status only): onboarding fee paid, subscription starts once AR is published live
- Suspension callout (Suspended status only): reason, date, notes, and reason-specific guidance
- **SUBSCRIPTION DETAILS** — Tier, Annual Fee, Onboarding Fee, Subscription Start/End, Grace Period, Reinstatement Rate
- **SUBSCRIPTION TIER HISTORY** — combines what used to be separate "contract history" and "tier history" into one list (version, tier, date range, fee, note)
- **PAYMENT HISTORY** — no down payment row; entries are Onboarding Fee, Annual Subscription Fee, Renewal Fee, or Reinstatement Payment, each with a Paid/Awaiting verification status
- **SUSPENSION HISTORY** — reason, date range (open-ended if ongoing), notes, resolution once lifted
- Footer actions vary by status (see Suspension Rules below)

### 3. `SuspendModal`
**File:** `src/components/subscriptionManagement/SuspendModal.jsx`

- Warning banner: suspending immediately halts AR navigation
- Reason radio cards: **Non-Payment**, **Operational**, **Breach of Contract**, **Other** — each with its own description and downstream behavior
- **Breach of Contract** requires a Penalty Amount (₱) and Notes
- **Other** has an optional Penalty Amount (₱) and requires Notes
- Live summary: Annual Fee, Subscription End, and a computed "To Reinstate" value that updates per reason
- Confirm is disabled until required fields for the selected reason are filled

### 4. `LiftSuspensionModal`
**File:** `src/components/subscriptionManagement/LiftSuspensionModal.jsx`

- For **Operational** suspensions: no fee, restores immediately
- For **Breach of Contract** / **Other**: shows Annual Fee + Penalty + Total to Reinstate before confirming
- **Non-Payment** suspensions have no lift modal at all — see Suspension Rules below

---

## Suspension Rules (per `NavAR_Subscription_Tiers.md` + product decision)

| Reason | Money involved? | How it's lifted |
|---|---|---|
| **Non-Payment** | Yes — annual fee + tier reinstatement % | Not manual. Auto-lifts once the mall's wallet balance covers the amount owed. The info panel shows this as an informational note only; there is no "Lift Suspension" button for this reason. |
| **Operational** | No | Voluntary pause (e.g. renovation). Subscription clock keeps running. Lift anytime via the "Lift Suspension" button, no fee. |
| **Breach of Contract** | Yes — annual fee + admin-entered penalty | Must be lifted manually. Reinstating requires paying the annual fee again plus the penalty, even if the subscription term hasn't ended. |
| **Other** | Optional — annual fee + optional penalty | Same manual-lift + repay behavior as Breach of Contract; penalty is optional and notes are required to explain the case. |

**Setup status:** the onboarding fee has been paid but the AR map is not yet live/published, so the annual subscription term hasn't started. No suspend/lift actions are available while in Setup — the subscription begins the moment AR goes live for public use.

---

## Navigation & Terminology Changes

- `src/config/navigation.js`: `License Management` → `Subscription Management`, path `/license-management` → `/subscription-management` (icon unchanged: `CreditCard`)
- `src/App.jsx`: added the real route + import, removed it from the placeholder-page fallback list
- `src/components/layout/TopBar.jsx`: `pageIconMap` key renamed to `Subscription Management`
- `src/pages/AuditLogs.jsx`: `License Management` module renamed to `Subscription Management` in `MODULE_COLORS` and all log entries; "License renewed" → "Subscription renewed", "Contract expired" → "Subscription expired", etc.
- `src/components/panels/NotificationsPanel.jsx`: mock notification copy updated from "License Management" / "Contract period" / "Annual Renewal Contract" to subscription-equivalent wording

---

## Other Requested Fixes Bundled Into This Change

### "Click any row to view full details." hint
Added below the table in the two other management tables that were missing it, matching the existing Audit Logs pattern (`audit-hint`):
- `src/components/mallManagement/MallsTable.jsx` (Malls tab table) — new class `.mall-table-hint` in `mallManagement.css`
- `src/components/applicationManagement/ApplicationsTable.jsx` — new class `.app-mgmt-hint` in `applicationManagement.css`

### Notification mechanism
The urgent-notice block in Subscription Management (`.sub-mgmt-notif-wrap`) now:
- Renders inside a fixed-max-height (`150px`) list that scrolls vertically on its own (`.sub-mgmt-notif-list`), independent of the rest of the page
- Shows a per-notification **X** dismiss button (`.sub-mgmt-notif-dismiss`)
- Shows a **Clear All** button (`.sub-mgmt-notif-clear`) that empties the whole list

---

## Styles

### Files
- `src/styles/subscriptionManagement/subscriptionManagementLayout.css` — page wrapper, table shell, hint text, responsive structure
- `src/styles/subscriptionManagement/subscriptionManagement.css` — header, notifications, stat cards, toolbar, table, tier/status badges, view button, and the full info-panel styling (wallet box, callouts, history cards, payment rows, footer)
- `src/styles/subscriptionManagement/subscriptionModal.css` — Suspend and Lift Suspension modal styling (reason cards, fields, summary, footer buttons)

### Key CSS Classes
- `.sub-mgmt-stat-card--{blue,green,orange,red,navy}` — Total/Active/Grace/Suspended/Setup stat cards
- `.sub-status-badge--{active,grace,suspended,setup}` / `.sub-tier-badge--{basic,standard,premium}`
- `.sub-panel`, `.sub-wallet-box`, `.sub-suspension-callout`, `.sub-history-card`, `.sub-payment-row`
- `.sub-reason-card`, `.sub-modal-summary` (Suspend modal)
- `.sub-modal-btn-lift` (Lift Suspension modal)

---

## Mock Data

8 malls seeded directly in `SubscriptionsTable.jsx`, matching the stat counts (Total 8 / Active 3 / Grace 2 / Suspended 2 / Setup 1):

| Mall | Tier | Status | Suspension Reason |
|---|---|---|---|
| SM Seaside City Cebu | Premium | Active | — |
| Pacific Mall Cebu | Basic | Active | — |
| Gaisano Grand Fiesta Mall | Standard | Active | — |
| Ayala Center Cebu | Basic | Grace Period | — |
| Robinsons Galleria Cebu | Premium | Grace Period | — |
| Parkmall Cebu | Basic | Suspended | Non-Payment |
| Pier One Mall | Standard | Suspended | Breach of Contract |
| SM City Consolacion Cebu | Standard | Setup | — |

No backend integration yet — all actions (suspend, lift, dismiss notification) update local component state only.
