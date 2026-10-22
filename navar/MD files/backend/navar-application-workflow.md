# NavAR: Application and AR Development Workflow

Status: ready for team review. Items marked **[Suggested]** are additions that were not explicitly specified. Section 12 lists what is still undecided.

---

## 1. Overview

Each mall can have multiple **versions**. A version is one floor plan plus the AR map built from it. Every version has two linked records:

- an **Application** (what the mall submits and the super admin reviews), and
- an **AR Development** entry (the team's build work, created once the application is approved).

A new version always means a new floor plan, so its nodes and AR content are **rebuilt from scratch**, even where parts of the layout match the previous version. This is why new versions are limited by a quota and a cooldown.

Two roles interact with this flow:

- **Mall admin:** pays the onboarding fee, submits applications, replies in threads, approves the finished AR.
- **Super admin:** reviews applications, builds and tracks AR development, and publishes.

---

## 2. Tier configuration

| Tier | Annual fee | Onboarding fee | Grace period (days) | Map updates / year |
|---|---|---|---|---|
| Basic | 60,000 | 187,500 | 15 | 1 |
| Standard | 150,000 | 594,600 | 30 | 2 |
| Premium | 350,000 | 1,585,000 | 45 | 3 |

- Map updates / year is stored in `subscription_tier.s_tier_map_updates_per_year`. The earlier values (2 / 4 / 8) are replaced by **1 / 2 / 3** (confirmed).
- Version 1 is covered by the onboarding fee and does **not** use a map update.
- Versions 2 and above have **no extra fee**, but each one uses one map update.
- The quota is consumed when a new version request is **accepted**, not when it is submitted or rejected.
- The quota counts per **contract term** (resets on renewal, not on January 1).
- **[Suggested]** The `contract` table already copies the tier's annual fee, onboarding fee, grace period and reinstatement rate. Copy the map update allowance there too (`contract_map_updates_per_year`), so later tier changes do not alter existing contracts.

---

## 3. Statuses

### 3.1 Application statuses

| Status (UI) | Suggested DB key | Meaning |
|---|---|---|
| Draft | `draft` | v1 only. Not submitted yet. |
| Pending | `pending` | v2+ only. Submitted, waiting for the super admin to accept or reject. No AR development entry yet. |
| Submitted | `submitted` | Needs review by the super admin. |
| For Revision | `for_revision` | Sent back to the mall for changes or more details. |
| Approved | `approved` | Unlocks AR development. |
| Rejected | `rejected` | v2+ only. Declined, with a reason in the thread. The mall may dispute. |
| Disputed | `disputed` | v2+ only. The mall contested a rejection. |
| Rejected (final) | `rejected_final` | v2+ only. The dispute limit was reached with the request still rejected. |

"Pending" can mean two things in the UI: a v1 application not submitted yet (Draft), or a v2+ request awaiting accept or reject. Keep distinct DB keys even if the label is the same. AR statuses are stored in a separate table, so "AR: Pending" does not conflict.

### 3.2 AR development statuses

Stored in the `ar_development` table, separate from applications.

| Status (UI) | DB key | Meaning |
|---|---|---|
| AR: Pending | `pending` | In the work queue. |
| Node Mapping | `node_mapping` | Team is mapping nodes. |
| Testing | `testing` | QA phase. |
| On Hold | `on_hold` | Temporarily halted because the application was sent back for revision. (Replaces "Suspended".) |
| Ready | `ready` | Pre-activation. Waiting for the mall admin to review and approve. |
| Live | `live` | Public. |
| Unpublished | `unpublished` | Hidden. Has an unpublish reason. |

"Suspended" is reserved for **subscription** suspension so the two are never confused.

---

## 4. Version model

- Each mall has an ordered list of versions: ver 1, ver 2, and so on.
- Only the **latest** version can be edited or acted on.
- Older versions stay in the lists (Applications and AR Development) but are **read-only**.
- Opening any version shows an info panel with **tabs** for the other versions, so the super admin can compare, for example ver 1 against ver 2 before deciding on a new request.
- An application linked to a **Live** AR development can never be modified.
- The version number becomes final only once a request is **accepted**. Until then a v2+ request carries a provisional number (see 6.5).

Example, Applications list for one mall:

| Row | Status | Notes |
|---|---|---|
| SM ver 2 | Pending | Awaiting accept or reject. No AR development entry yet. |
| SM ver 1 | Approved | Linked AR is Live. Read-only: no thread messages, no revision request, no approve. |

Clicking ver 1 shows its details read-only. The tab for ver 2 opens the ver 2 panel, where the super admin can accept or reject.

---

## 5. Version 1 workflow

0. **Onboarding (before applying).** After the mall logs in, the system suggests a plan based on the mall profile (such as GFA). The mall chooses the plan they will stay with and pays the **onboarding fee** through the payment checkout. The application can only be started after the payment is confirmed.
1. **Draft.** The mall admin fills in the application for the chosen plan.
2. **Submitted.** The mall submits.
3. **Review.** The super admin either **approves** or **requests revision** (For Revision, with notes in the application thread).
4. The mall edits the same application and confirms its corrections in the application thread. Approve Application is available to the super admin immediately while For Revision; the super admin decides when to approve again. No separate resubmission is required, and the version and attempt remain unchanged. This repeats until approved.
5. **Approved** creates the AR development entry (AR: Pending).

Rules:

- **v1 is never rejected.** The only tool is Request Revision.
- Cancelling a v1 application that NavAR cannot serve is a manual super admin action outside this flow.

---

## 6. Version 2+ workflow

### 6.1 Eligibility (checked in the mall admin UI before Submit is enabled)

- The latest version's AR is **Live**. If it is Unpublished (for any reason), the mall cannot request a new version until it is Live again.
- At least **45 days** have passed since that AR went live. The UI shows the date they can apply, for example "You can request a new version on 12 Dec."
- Map updates remain for the current contract term.
- No other open request or version in progress. Open means Pending, Disputed, Submitted, For Revision, or Approved with AR not yet Live. A final rejection is not open.
- **[Suggested]** The subscription is valid: active, not in its grace period and not suspended (see section 10). Check this first, so the mall sees the real reason for being blocked.
- The request keeps the **same floors** as the current version (see 11.5).

### 6.2 Request

The mall submits the same application content as v1 (floor plans, accessibility routes, emergency routes, entry points), plus a **reason for the new version** (category plus notes, for example a structural change). The reason is **required only for version 2 and above**; v1 has no reason field. It helps the super admin judge whether a new version is really needed. A new attempt after a rejection (see 6.5) also needs a reason, since it is still a v2+ request.

The record is created with status **Pending**. No AR development entry exists yet.

### 6.3 Accept / Reject gate

On a Pending request, the super admin sees **Accept** and **Reject** (not Request Revision).

- **Accept:** the version is finalized, one map update is consumed, status becomes **Submitted**, and from here the flow is **identical to v1** (review, For Revision loop, Approved, AR development).
- **Reject:** a reason is required and appears in the application thread. Status becomes **Rejected**.

### 6.4 Dispute

- After a rejection, the mall admin sees a **Dispute** button and must enter their reasons. The text appears in the application thread and status becomes **Disputed**.
- The super admin then **accepts** or **rejects again** (a reason is required each time).
- **Dispute limit [Suggested]: 2 disputes per request.** If the request is still rejected after the second dispute, status becomes **Rejected (final)** and the Dispute button disappears.
- If accepted at any point, the request continues as in 6.3.

### 6.5 New request after a final rejection

- The mall can submit a **new request** (a new attempt) once the previous one is Rejected (final), or after any rejection they choose not to dispute.
- The new attempt reuses the same provisional version number. The number is only final once a request is accepted, so rejected attempts never use up a version.
- Earlier attempts stay visible as history, read-only.

### 6.6 Review after acceptance

After acceptance, the super admin can still send the application back (For Revision) if more details are needed, as long as AR development has not reached Ready (see 7.4).

---

## 7. AR development workflow

### 7.1 Normal progression

`AR: Pending` → `Node Mapping` → `Testing` → `Ready`

Forward progression uses the existing buttons ("Submit for Testing", "Mark as Ready", and so on).

### 7.2 Change Status button (new)

Every AR development action menu gets a **Change Status** button so the super admin can move **backwards** freely.

Allowed backward moves:

- Testing → Node Mapping
- Ready → Testing
- Ready → Node Mapping

Rules:

- A status can **never go back to AR: Pending** once it has reached Node Mapping.
- On Hold is **system-controlled** (see 7.3), not selectable here.
- No reason has to be typed. The mall admin is **notified on every status change** (section 8). An optional note can be added.
- The button is disabled for read-only versions, for a Live version, and **once the mall has approved a Ready AR** (see 7.5).

The current code has no way to go from Testing to Node Mapping or from Ready to Testing. This must be added.

### 7.3 On Hold

- **Trigger:** an Approved application is sent back to For Revision while AR status is AR: Pending, Node Mapping or Testing.
- **Effect:** AR status becomes `on_hold` (shown as "On Hold"). The system stores the previous status.
- **Resume:** when the application is Approved again, AR returns to the stored status (for example back to Testing).
- If the revision changed the floor plan significantly, the super admin can then use Change Status to move the work backwards.

### 7.4 Limit on revision requests

A revision request on an Approved application is only possible while AR is Pending, Node Mapping or Testing. Once AR is **Ready**, the application locks, because Ready means the AR should already work. Testing is allowed because testing can reveal missing details the mall can supply.

### 7.5 Ready: mall review

When AR is Ready:

- The mall admin sees an **Approve** button. **There is no Reject button.**
- The UI must make clear that **checking is the mall's responsibility** and that they should review the AR carefully before approving. **[Suggested]** Show a confirmation step with a required acknowledgement before Approve is accepted.
- If something is lacking or needs improvement, the mall does **not** approve. They send a message in the **AR thread**, which the super admin sees (images can be attached).
- **Once the mall approves, the super admin can no longer change the AR status** until it is published. This prevents changes to something the mall already approved.

### 7.6 AR thread

- A **View Thread** button appears for both roles **only once AR has reached Ready at least once**.
- The thread **stays** even if the super admin changes the status back (for example Ready → Testing). Both roles can still see it, and the mall sees the status change.
- When the status returns to Ready, the mall can approve or raise concerns again. This loops until the mall approves.
- Read-only for old versions.
- **[Suggested]** Create the AR thread the first time AR reaches Ready. Its existence then tells you the AR has been Ready before.

### 7.7 Approval and publishing

**Version 1:**

1. Mall approves the Ready AR.
2. The mall pays the **first subscription (annual) fee**. (The onboarding fee was already paid before applying.)
3. Once the payment is confirmed, AR is **published** (`live`) and the subscription term starts.

**Version 2+:**

1. Mall approves the Ready AR.
2. There is **no extra fee**. If the subscription is valid, AR is **published automatically** on approval.
3. The previous version becomes **Unpublished** (reason: superseded).
4. If the subscription is **not valid** at approval, the approval is recorded and **publishing happens automatically once the subscription is renewed**.

Until the new version is published, the previous version stays marked **Live**.

### 7.8 Idle Ready: reminders

If the mall has not approved a Ready AR, they are reminded **from time to time**. Because in-app notifications are useless if nobody logs in, reminders are also **emailed to all mall admins of that mall**.

**[Suggested]** cadence: 3, 7 and 14 days after the AR became Ready, then every 14 days until approved. The clock restarts if the AR goes back to Testing and becomes Ready again. The super admin sees how long each AR has been waiting for mall approval.

### 7.9 Display rules for version tabs (AR Development)

- Older versions are listed and read-only.
- Info panels have tabs per version.
- For the newest version, **until it is Ready (or has been Ready before)**, the panel only shows: "This version is not ready yet." The thread and other details appear once it is Ready or has been marked Ready.

---

## 8. Threads and notifications

| | Application thread | AR thread |
|---|---|---|
| Purpose | Revision requests, rejection reasons, disputes | Mall's concerns about the finished AR, super admin replies |
| Available | From submission | From the first time AR reaches Ready |
| Who writes | Both roles | Both roles |
| After Live or superseded | Read-only | Read-only |

### Notifications

Status changes do not require a typed reason. The other party is notified automatically (in-app, plus email where noted) for:

- Application status changes (Submitted, For Revision, Approved, Rejected, Disputed, and so on).
- AR status changes, including backward moves (for example Ready → Testing) and On Hold / resume.
- New thread messages.
- Idle Ready reminders (in-app and email, see 7.8).

The AR thread only appears once AR has been Ready, so early-stage AR status changes are communicated through notifications alone.

---

## 9. Who can do what

| Action | Super admin | Mall admin |
|---|---|---|
| Approve application (Submitted) | Yes | No |
| Request revision (Submitted, or Approved while AR before Ready) | Yes | No |
| Accept / Reject a v2+ request (Pending, Disputed) | Yes | No |
| Dispute a rejection (within the limit) | No | Yes |
| Edit the existing application and confirm corrections in its thread | No | Yes |
| Approve the same application directly from For Revision | Yes | No |
| Change AR status (before mall approval) | Yes | No |
| Approve finished AR (Ready) | No | Yes |
| Reject finished AR | No | **Not available** |
| Post in a thread | Yes (not on read-only versions) | Yes (not on read-only versions) |
| Edit an application linked to Live AR | No | No |

---

## 10. Interaction with subscription and payments

- The **onboarding fee** is paid once, right after login, and unlocks applying. The **first annual subscription fee** is paid after the mall approves the Ready AR (v1). The subscription term starts when the map is published.
- Both payments fit the existing `contract_payment_request` table (`fee_type`: onboarding or subscription) and the checkout record in `mall_payment_checkout`.
- The plan is fixed for the contract term. Changing plans is out of scope for this workflow (section 14).
- **Valid subscription [Suggested]:** the contract is current, within its term, **not in its grace period** and not suspended. During the grace period the existing Live map keeps running, but the mall cannot request a new version, and a version that was already approved waits until renewal before publishing. Work already in progress is not cancelled.
- Subscription suspension (after the grace period) leads to **Live → Unpublished** with an unpublish reason of subscription suspended. When the mall pays, auto-republish only those unpublished for that reason. The existing `suspension` table records the suspension.
- Grace period per tier: Basic 15 days, Standard 30, Premium 45. A reinstatement rate (10% to 20% by tier) applies when reinstating after suspension.
- Renewal approach under discussion: manual renewal with reminders before expiry, then a grace period, and suspension only after grace ends.

### 10.1 What the subscription work must provide

The application and AR workflow depends on only a few things from the subscription side, so it can be built now and wired up later:

| Needed from the subscription side | Used for |
|---|---|
| A subscription state per mall: `active`, `grace`, `suspended` or `none`. It can be derived from the contract dates, grace days and the `suspension` table. | `isSubscriptionValid`: valid means `active` only. |
| Onboarding fee paid | `isOnboardingPaid` gates starting an application. |
| First annual fee paid | `isFirstSubscriptionPaid` gates publishing a v1 AR. |
| Map update allowance | `getMapUpdateAllowance` reads `contract_map_updates_per_year`. |
| Event: payment or renewal confirmed | Call `tryPublish` for any AR waiting after mall approval. |
| Event: subscription suspended | Set Live ARs to Unpublished (reason `subscription_suspended`). |
| Event: subscription reinstated | Republish ARs unpublished for `subscription_suspended`. |

Until the subscription flow exists, the four gate functions return permissive defaults (see the agent prompt) and the three events are not wired.

---

## 11. Alignment with the current database

### 11.1 Already in place (reuse)

| Need | Existing table |
|---|---|
| Applications and versions | `application` (`application_version`, `application_status`) |
| Floor plan per version and floor | `application_floor_plan` |
| AR build per version | `ar_development` (`ar_development_status`, `ar_development_version`, `ar_development_activated_at`) |
| Application and AR threads | `thread` (links to `application_id` or `ar_development_id`), `thread_message`, `thread_message_attachment` (images up to 5 MB) |
| Plan, fees, term, grace | `contract`, `subscription_tier` |
| Onboarding and subscription payments | `contract_payment_request`, `mall_payment_checkout` |
| Suspension | `suspension` |
| Mall-admin notifications | `admin_notification` (one row per recipient admin) |
| Email records | `email_log` |
| Status history | `audit_log` |
| Onboarding steps | `mall_onboarding` (links the contract and the v1 application) |

Use `ar_development_activated_at` as the "went live" time for the 45-day cooldown.

### 11.2 Schema changes (illustrative, not executed)

```sql
-- Tier quota (confirmed 1 / 2 / 3)
UPDATE subscription_tier
SET s_tier_map_updates_per_year = CASE s_tier_key
  WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3 END;

-- Contract: snapshot of the tier's quota (run after the tier update)
ALTER TABLE contract ADD COLUMN contract_map_updates_per_year integer;
UPDATE contract c
SET contract_map_updates_per_year = t.s_tier_map_updates_per_year
FROM subscription_tier t
WHERE t.s_tier_id = c.s_tier_id;
ALTER TABLE contract ALTER COLUMN contract_map_updates_per_year SET NOT NULL;

-- Application (reason fields are only filled for version 2 and above)
ALTER TABLE application
  ADD COLUMN application_attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN application_reason_category varchar,
  ADD COLUMN application_reason_notes text,
  ADD COLUMN application_accepted_at timestamptz,
  ADD COLUMN application_dispute_count integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT application_mall_version_attempt_key
    UNIQUE (mall_id, application_version, application_attempt);

-- AR development
ALTER TABLE ar_development
  ADD COLUMN ar_development_resume_status varchar,
  ADD COLUMN ar_development_ready_at timestamptz,
  ADD COLUMN ar_development_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN ar_development_mall_approved_at timestamptz,
  ADD COLUMN ar_development_unpublish_reason varchar;

-- Node versioning
ALTER TABLE node
  ADD COLUMN ar_development_id bigint REFERENCES ar_development(ar_development_id);
-- Backfill existing nodes with the mall's current AR development, then:
-- ALTER TABLE node ALTER COLUMN ar_development_id SET NOT NULL;
ALTER TABLE node
  ADD CONSTRAINT node_id_ar_development_key UNIQUE (node_id, ar_development_id);

-- Keep edges and beacon assignments consistent with their nodes
ALTER TABLE edge
  ADD CONSTRAINT edge_start_node_same_version FOREIGN KEY (start_node_id, ar_development_id)
    REFERENCES node (node_id, ar_development_id),
  ADD CONSTRAINT edge_end_node_same_version FOREIGN KEY (end_node_id, ar_development_id)
    REFERENCES node (node_id, ar_development_id);

ALTER TABLE beacon_node_assigment
  ADD CONSTRAINT assignment_node_same_version FOREIGN KEY (node_id, ar_development_id)
    REFERENCES node (node_id, ar_development_id),
  ADD CONSTRAINT assignment_one_node_per_beacon_per_version UNIQUE (ar_development_id, beacon_id);
```

Quota check: count applications for the mall with version greater than 1 and `application_accepted_at` within the current contract term, compared with `contract_map_updates_per_year`.

### 11.3 Decided from the schema review

1. **Nodes are versioned.** `node` gets an `ar_development_id`, matching `edge`, `floor_calibration` and `beacon_node_assigment`. Mapping is rebuilt per version, even where parts of the layout match, and ver 2 mapping never touches the Live ver 1 nodes.
2. **Wallet tables are untouched for now**, pending the teammate working on payments. `payment.wallet_id` is NOT NULL, so payment records still depend on a wallet until that is changed.
3. **The contract stores its own copy of the quota** (`contract_map_updates_per_year`), like it already does for fees and grace period.

### 11.4 New AR development columns

| Column | What it holds | Set when | Used for |
|---|---|---|---|
| `ar_development_resume_status` | The status AR was in before On Hold (for example `testing`). | The application goes from Approved to For Revision while AR is Pending, Node Mapping or Testing. | When the application is approved again, AR returns to this status, then the value is cleared. |
| `ar_development_ready_at` | When AR last became Ready. | Every time the status changes to Ready (again after Ready → Testing → Ready). | Starts the idle reminder clock. Also shows the super admin how long the mall has been waiting. |
| `ar_development_reminder_count` | How many idle-Ready reminders were sent for the current Ready period. | Incremented per reminder, reset to 0 whenever AR becomes Ready again. | With `ready_at`, decides the next reminder (3, 7, 14 days, then every 14), so none are duplicated. |
| `ar_development_mall_approved_at` | When the mall admin approved the Ready AR. | The mall clicks Approve. | Locks Change Status; marks the AR as waiting for the first subscription payment (v1) or renewal (v2+); triggers publishing once that is satisfied. |
| `ar_development_unpublish_reason` | Why a version is Unpublished: `superseded`, `subscription_suspended` or `manual`. | Live → Unpublished. | Auto-republish only the `subscription_suspended` ones when the mall pays. `superseded` versions are never republished. |

`ar_development_activated_at` already exists and serves as the "went live" time for the 45-day cooldown.

### 11.5 Floors and mall info

- **Floors are fixed after onboarding.** Adding or removing a floor is **not part of a new version request**. `floor` rows belong to the mall, not to a version, and stores, units, nodes and promotions all reference them, so changing the floor set while the old version is Live could break existing data. A new version covers the **same floors** as the current one.
- Because the floor set never changes, **mall info does not need versioning**. `mall_floor_count`, `mall_coverage_area` and the floor labels stay as they are.
- Since every version is rebuilt from scratch, the request must include a **plan for every existing floor** (one `application_floor_plan` row per floor). The layout inside a floor can change (walls, entrances, escalators, emergency routes), but the floor itself cannot be added or removed.
- Validation: block submission of a v2+ request whose floors differ from the mall's current floors.
- A real change in the number of floors is very rare and is handled manually by the super admin, outside this workflow.

### 11.6 Beacons

- Physical beacons are mall-level (`beacon`). The same beacon can be used by ver 1 and ver 2 but may sit at a different node in each.
- `beacon_node_assigment` is the per-version link, so it **keeps its `ar_development_id`**. Since `node` now has one too, the composite foreign key above makes sure an assignment can never point to a node from another version, and the unique constraint keeps one node per beacon per version.
- When a new version is published, scans are resolved with the Live version's assignments, so the switch needs no change to the physical beacons.
- The table name is spelled `beacon_node_assigment` (missing the "n"). If you want to rename it, do so before more code depends on it.

---

## 12. Changes needed in the current code

- Add the v2+ Accept / Reject / Dispute flow, including the dispute limit and new-attempt handling.
- Add application statuses Pending, Rejected, Disputed, Rejected (final).
- Add AR status On Hold with the resume logic.
- Add the Change Status button with the backward-move rules and the lock after mall approval.
- Add the Approve button and acknowledgement on the mall side, with no reject option.
- Add the AR thread and the View Thread visibility rule.
- Add version tabs and read-only handling for older versions in both lists.
- Add the 45-day cooldown, quota check and eligibility checks in the mall admin UI.
- Gate applying on the onboarding payment; add the first subscription payment after mall approval (v1).
- Add auto-publish for v2+ and the wait-for-renewal case.
- Add notifications for application and AR status changes, plus idle Ready reminders by email.
- Version the `node` table and add the consistency constraints (11.2).
- Validate that a v2+ request has a floor plan for every existing floor, with no floors added or removed (11.5).

---

## 13. Decisions log

| Topic | Decision |
|---|---|
| Lock after mall approval | Yes. No status changes by the super admin until published. |
| Rejected requests | Mall can submit a new attempt; version number is final only on acceptance. |
| Dispute limit | Allowed; limit set at 2 per request **[Suggested]**. |
| Idle Ready | Periodic reminders, including email to the mall's admins. |
| Invalid subscription at v2+ approval | Publishing waits until renewal. |
| Map updates per year | 1 / 2 / 3 (Basic / Standard / Premium). |
| Status change reasons | Not required; notifications instead. |
| Rename of "Suspended" in AR | "On Hold" (`on_hold`). |
| New version reason | Required for v2+ requests only; v1 submits the normal application content. |
| Node versioning | `node` gets `ar_development_id`; `beacon_node_assigment` keeps its own, kept consistent by a composite foreign key. |
| Contract quota snapshot | `contract_map_updates_per_year` added to `contract`. |
| Wallet tables | Untouched for now, pending a teammate. |
| Floors | Fixed after onboarding. Adding or removing a floor is not part of a version request. Mall info is not versioned. |
| Plan changes | Not handled in this workflow. The plan is fixed for the contract term (section 14). |
| Unpublished or grace period **[Suggested]** | No new version requests while the latest AR is Unpublished, or while the subscription is in its grace period or suspended. |

Still open: confirm the dispute limit (2) and the reminder cadence (3, 7, 14 days, then every 14).

---

## 14. Out of scope for now

Kept out on purpose so the workflow stays simple:

- **Adding or removing floors** through a new version (11.5).
- **Versioning mall info.** Not needed while the floor set is fixed.
- **Plan upgrades and downgrades during a contract term.** The plan is fixed for the term. A mall might want a different plan because the building became larger or smaller, or because it needs a different update allowance or support level. The simplest place to handle that is **renewal**: the mall renews on a different tier as a new contract (the `contract` table already has `contract_version` and `contract_is_current`). This belongs to the subscription and renewal workflow, not the application workflow.
- **Wallet clean-up**, which waits on the teammate working on payments.
