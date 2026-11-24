# NavAR: Application and AR Development Workflow

Updated: 23 November 2026.

This document describes the agreed application and AR development workflow, including the current onboarding, subscription, payment, stall and snapshot model. It replaces the earlier design draft. Section 13 identifies the implemented portal and the integration required in the separately maintained Mall Admin client.

## 1. Applications, AR versions and snapshots

- A map application contains the mall's plans and supporting details for an AR version.
- An AR development record tracks mapping, testing, mall review and publication for that version.
- A new structural map application creates a new AR version after review. A stall addition updates the current AR development through its separate application flow.
- Editor snapshots are named, immutable saved layouts within one AR development. They are separate from mall AR version numbers.
- Current operational data must not be overwritten merely by opening or restoring an editor snapshot. Save & Validate applies the selected editor state to the mall's stored map and beacon data.
- Database status values are lowercase. UI labels start with capital letters, for example `node_mapping` displays as Node Mapping.

## 2. Onboarding and subscriptions

### One-time onboarding

1. Mall Admin logs in and completes the information needed for an onboarding quote.
2. The onboarding fee is calculated for that mall and paid once before its first application.
3. Confirmed payment unlocks the first application.

Onboarding is independent of a subscription tier and subscription contract. It belongs directly to the mall through `mall_id`. Its payment requests and receipts retain that mall association and have no subscription contract link. Paying onboarding must never create a subscription contract or start a subscription term.

The onboarding fee is based on the configured rate card and mall inputs, including floor areas, stores, connector points and rental information. It is not a fixed fee per subscription tier. Finalized quotes retain their own amounts and rate snapshots.

### Subscription

The mall reviews its first Ready AR and chooses and pays for a subscription. Both the required mall confirmation and settled subscription payment must be recorded before publication. The paid subscription creates the subscription contract; onboarding does not. Subscription dates are governed by the subscription/payment workflow and must not be reset for ordinary map or stall updates.

Subsequent map or stall updates use the existing active subscription. They do not require another annual subscription payment merely because AR becomes Ready again. Separate service charges can still apply to the update itself.

### Current configured rates

Verified against `subscription_tier` on 23 November 2026. System Settings and server quotes are the operational source of truth; these figures can change for future quotes.

| Item | Basic | Standard | Premium |
|---|---|---|---|
| Annual subscription | PHP 25,000 | PHP 33,000 | PHP 47,000 |
| Grace period | 15 days | 30 days | 45 days |
| Map update charge per changed floor | 50% of original onboarding cost per floor | 40% of original onboarding cost per floor | 30% of original onboarding cost per floor after included allowance |
| Included map updates | None | None | First update per contract year, up to one floor |
| Additional stall | PHP 1,100 | PHP 1,000 | First 10 per contract year included, then PHP 1,000 |

The old 1 / 2 / 3 maximum-map-update quota and the statement that every later version is free are obsolete. An included allowance is a pricing benefit, not a maximum number of applications. Additional eligible updates can be paid for. Do not charge for an unchanged floor solely because its plan is included for version completeness.

Included benefits are accounted for within the subscription contract term. Existing finalized quotes, payment history and contract snapshots remain intact when settings change. Server-side quoting determines the exact amount and available allowance; clients must not calculate the authoritative payment amount.

## 3. Statuses

### Map applications

| UI status | Database key | Meaning |
|---|---|---|
| Draft | `draft` | Mall-side preparation, not submitted for review |
| Pending | `pending` | Version 2+ request awaiting Accept / Reject |
| Submitted | `submitted` | Accepted for normal application review |
| For Revision | `for_revision` | Mall needs to correct or clarify details |
| Approved | `approved` | Application approved for AR development |
| Rejected | `rejected` | Version 2+ request declined; a dispute may be available |
| Disputed | `disputed` | Mall contests a rejection |
| Rejected Final | `rejected_final` | Request declined after the final permitted dispute |

Application status and AR development status are separate. Pending request review does not mean the AR development queue already has an entry.

### AR development

`Pending` -> `Node Mapping` -> `Testing` -> `Ready` -> `Live`.

`on_hold` pauses work during an application revision and remembers the preceding development status. `unpublished` hides a formerly published version and records the reason. Subscription suspension and development On Hold are different concepts.

### Stall applications

Super Admin sees only Submitted, For Revision and Approved. Published stall applications remain Approved in that interface; AR development tracks publication separately. Draft, Awaiting Payment, Cancelled and the internal completion state belong to mall-side workflow tracking and are not Super Admin review filters.

## 4. First application and AR version 1

1. Confirm the mall's one-time onboarding payment.
2. Mall Admin completes the application, including floor plans, route information and entry points, then submits.
3. Super Admin approves or requests revisions. Version 1 uses the revision process rather than the version 2+ rejection gate.
4. Corrections update the same application and its thread. Super Admin can approve the corrected application from For Revision without creating another version or attempt.
5. Approval creates AR development in Pending.
6. The team completes Node Mapping and Testing, then marks the AR Ready.
7. Mall Admin reviews the finished AR. Required mall confirmation and the first subscription payment unlock publication.
8. AR becomes Live under the paid subscription.

A mall's inability to be served or a cancellation requiring exceptional handling is a separate Super Admin action, not a routine version 1 Reject button.

## 5. Version 2+ eligibility and floor plans

A mall may submit a new structural map application when:

- Its subscription is active, within its valid term, and not suspended. Grace period does not permit a new application.
- Its latest published AR version is Live. An Unpublished AR must be restored before the mall submits a new version request.
- There is no competing open map application, AR build or stall application for the mall.
- Required application details, change reasons, floor coverage and applicable update payment requirements are satisfied.

There is no minimum number of days after publication, three-month restriction, or waiting period between eligible applications. Super Admin evaluates whether the proposed update is justified through Accept / Reject.

### Floor plans: replace changed floors and reuse unchanged floors

Every existing floor must be represented exactly once in the new application. For each floor, Mall Admin selects one of:

- **Changed floor:** upload its updated plan and describe the structural changes.
- **Unchanged floor:** explicitly reuse that floor's plan from the current Live version. No replacement upload is required.

For example, if only Floor 2 changes in a three-floor mall, submit its updated plan and reuse the current plans for Floors 1 and 3. Reused floors are not newly changed billable floors.

Record which prior application/floor plan was reused. Preserve a version-owned plan record or immutable reference so later editing cannot change the older Live version. Reuse associated scale and calibration information only if it remains valid for the unchanged plan. Application completeness checks must accept explicit reuse as well as a replacement upload.

Reusing a plan does not automatically publish new nodes, copy beacon assignments or apply an editor snapshot. The resulting AR map still needs version isolation, validation, testing and mall confirmation.

Floors belong to the mall. A normal version application covers the existing floor set; adding or removing an entire floor requires a separate administrative process to preserve stores, nodes, units and other references.

## 6. Version 2+ request, acceptance and disputes

1. Mall submits a reason category and explanatory notes, identifies changed floors, and supplies replacement or explicitly reused plans for all existing floors.
2. The new request is Pending with a provisional version number. It has no AR development entry yet.
3. Super Admin chooses Accept or Reject. This gate assesses whether a new structural version is justified.
4. Acceptance finalizes the version and moves the application to Submitted for normal content review. Applicable included-benefit use or payment settlement follows the server-side update quote. Acceptance is not another annual subscription purchase.
5. Normal review allows Request Revision and Approve. Approval creates the new AR development in Pending.

### Rejection and disputes

- Reject requires an explanation recorded in the application thread.
- Mall Admin can dispute a rejection with an explanation.
- A disputed request returns to Super Admin for Accept / Reject.
- Each request permits two disputes. Rejection after the second dispute is Rejected Final. This permits up to three rejection decisions, not just two.
- Rejected attempts do not finalize a version number or consume an accepted update. Any paid-request cancellation or refund must follow its actual payment reconciliation rules; rejection alone must not invent a refund.
- The mall may create a new attempt after final rejection, or choose a new attempt instead of disputing. The provisional version number is reused and the attempt increases. Earlier attempts remain read-only history.

The previous AR stays Live during the new application's review and development. Only publication of the replacement changes which structural version is Live.

## 7. AR development and queue

### Pending queue

- All first builds take priority over later structural updates, regardless of subscription tier.
- First builds use first come, first served, based on application approval/queue-entry time.
- Later structural updates prioritize Premium, then Standard, then Basic; within each tier use first come, first served.
- Queue numbers are calculated positions, not permanent stored numbers.
- Once work enters Node Mapping, it leaves the Pending queue and no longer displays a queue number.

### Mapping, testing and Ready

Forward actions move Node Mapping to Testing and Testing to Ready. Super Admin may move backward from Testing to Node Mapping, or from Ready to Testing or Node Mapping. Work cannot return to Pending after mapping has started. On Hold is controlled by the revision workflow rather than a manual menu choice.

When an approved application needs revision while AR is Pending, Node Mapping or Testing, AR goes On Hold. Approval of the corrections resumes the stored preceding status. Significant plan changes may require a further backward move to Node Mapping.

Once AR reaches Ready, application revision actions lock. If further mapping or testing is needed, use the permitted development workflow and communicate through the AR thread. After the mall has confirmed a Ready AR, Super Admin cannot silently change the approved map or status before publication.

### Mall confirmation and publication

Mall Admin reviews the Ready AR and confirms with an acknowledgment. There is no finished-AR Reject button; unresolved concerns go in the AR thread and the team corrects the map before confirmation.

For an update under an active subscription, confirmation permits publication without another annual payment. Publishing a replacement structural version makes the previous one Unpublished with the superseded reason. If the subscription becomes invalid before publication, retain the approval and gate publication on the applicable subscription recovery requirements.

Idle Ready reminders occur at 3, 7 and 14 days, then every 14 days until confirmation. Returning to Ready restarts that Ready-period clock. These are review reminders, not eligibility waiting periods for new applications.

## 8. Editor snapshots and beacons

- Snapshots are named, immutable captures of the editor's map and beacon state within one AR development.
- Editing after saving a snapshot does not modify it. Save another snapshot to preserve the edited state.
- Before requiring a new snapshot, compare the current editor state with all existing snapshots. An identical state can use an existing matching snapshot.
- Restoring previews the saved state in the editor. It does not apply that state to the mall's operational records by itself.
- Save & Validate applies the validated map, nodes, edges, floor connections, calibration and beacon details/assignments to the relevant mall data.
- Deleting a beacon-linked node clears that assignment. It must never reassign the beacon to a neighboring node merely because they shared an edge.
- Confirm affected beacon unassignments before applying the map.
- Mall Management remains the view of applied operational beacon data. Editor beacon management follows the editor/snapshot state until validation.

Map reuse, AR versioning and editor snapshots must not allow a new development to modify an older Live version's graph or beacon assignments.

## 9. Stall applications after Live

Stalls are floor-associated stores without unit assignments. They use a separate paid application workflow; see `docs/stall-application-workflow.md` for the integration details.

1. Active subscription and Live AR are required to start.
2. Mall specifies counts for affected floors; unaffected floors may have zero.
3. Server quotes the exact quantity and available included allowance. Payment is completed before stall details can be submitted; fully included requests have no payment due.
4. Mall enters the exact purchased quantity per floor, including stall name, catalog brand and a required location description. Contact details are optional.
5. An updated floor plan per affected floor is optional. If none is supplied, retain the current plan and valid calibration.
6. Submit creates a Super Admin notification and exposes the application for review and its thread.
7. Super Admin approves or requests revisions. Approval adds the stall records and returns the same AR development to Node Mapping.
8. The team maps and tests, marks Ready, then Mall Admin confirms publication using the active subscription. No new annual subscription is required.

Approval notifications must describe the approved application and return to mapping; payment has already been settled or covered by an included allowance.

## 10. Threads, notifications and history

- Each map application has a thread for revisions, rejection reasons and disputes.
- AR review threads become available when AR first reaches Ready and remain accessible if it returns to Testing or Node Mapping.
- Stall applications have their own thread.
- Application conversations are shared across submission attempts of the same mall/version. Only the latest attempt of the latest version accepts replies; earlier attempts and versions remain readable. A newly added version closes older application and AR conversations immediately, without waiting for acceptance or publication. Workflow status alone does not close the latest conversation. Stall conversations close when a newer mall version exists.
- Editing permissions remain separate from conversation permissions. Saved rejection-review snapshots are immutable, including their recorded message history; opening one never permits changes to current operational data. Open the latest submission to continue its current version's conversation. Review labels use version.submission.review, such as 2.1.1 and 2.1.2.
- Application, AR and payment state notifications are driven by database changes, so they work across interfaces. Clients must not be responsible for manufacturing notifications on clicks.
- Relevant notifications include onboarding settlement, application submission, revisions, rejection/dispute/approval, update payments, Ready confirmation, publication, subscription events, post-publication store or stall removal, and thread messages.
- Per-administrator read receipts keep incoming messages unread independently of outgoing messages. Inbox and notifications use realtime refresh with polling recovery.
- Product labels should not contain testing or simulation wording. Manual-assisted actions still retain their provenance and actor identity in audit/payment records.

## 11. Subscription validity and payment records

- Active subscription is required for new map and stall applications. The existing Live map may remain available during grace according to subscription policy, but grace does not permit new submissions.
- Suspension hides affected Live AR with a subscription-specific unpublish reason. Reinstatement must not revive versions that were superseded by a newer Live version.
- Contract records describe subscriptions only. One-time onboarding is mall-owned and is not renewed.
- Service charges for structural floor updates and added stalls are distinct from the annual subscription.
- Use `contract_payment_request`, the relevant checkout/settlement records and payment history. Keep real provider references and manual payment provenance accurate.
- The assisted mall pages support explicit authorized payment recording without requiring a PayMongo account. That facility is not an unrestricted payment bypass for ordinary Mall Admin API callers.

## 12. Data and integration responsibilities

| Concern | Main records or components |
|---|---|
| Mall-owned onboarding | `mall_onboarding`, `onboarding_quote`, `contract_payment_request.mall_id`, `payment.mall_id` |
| Subscription and rates | `contract`, `subscription_tier`, rate cards and finalized quote snapshots |
| Version requests and attempts | `application`, its reason fields, acceptance timestamp and dispute count |
| Floor coverage | `floor`, version-owned `application_floor_plan` and supporting entry-point records |
| Development | `ar_development`, node/edge graph, floor calibration and version-scoped assignments |
| Editor snapshots | Snapshot storage introduced in migrations 48 and 49 |
| Paid stall requests | `stall_application`, `stall_expansion`, floor/item records and `mall_service_request` |
| Approved stalls | Existing store/stall records with floor association and no unit requirement |
| Conversations | `thread`, `thread_message`, attachments and per-admin read receipts |
| Notifications and audit | `admin_notification`, database workflow monitoring, `email_log`, `audit_log` |

Use deployed migrations for database changes; this document is not a SQL migration script. Do not rerun the obsolete illustrative ALTER TABLE statements from the earlier draft.

The separately maintained Mall Admin client must connect its forms to authenticated, ownership-checked backend workflows. Service-role credentials must never be shipped to a browser or mobile app.

## 13. Implementation and portal integration

Migrations 65-67 and the separate map application portal implement the latest version 2+ rules in this repository:

- No publication waiting period, with active-subscription and latest-AR-Live checks enforced on the server and at application insertion.
- Paid updates after the configured included benefit is exhausted, rather than a hard maximum application quota.
- Plans, scale references, accessibility/emergency routes and entry points prefilled from the Live application. Reused and replacement plans get independent version-owned records and provenance.
- Pending request review with Accept / Reject, two disputes, final rejection and correctly numbered retry attempts.
- A changed-floor quote issued after acceptance, payment before application approval, in-place corrections, AR development and publication under the existing subscription.
- Existing owner-confirmation and stall workflows preserved through delegation.

Use `/mall-portal/map-applications/:mallId` for the separate assisted submission page. Gaisano Fiesta Mall is ID 12; SM Seaside is ID 5. Super Admin reviews through Application Management > New Applications, including the Pending and Disputed filters. The older application intake directs version 2+ requests to this page and remains available for first applications.

See `docs/map-application-portal.md` for API integration and verification. The separately maintained Mall Admin client still needs to integrate the provided ownership-checked Mall Admin routes; this repository's assisted page does not modify that other client.

Dedicated migrations and handoff documents cover onboarding separation, subscriptions, editor snapshots, paid stalls, notification monitoring and lowercase statuses. Older documents describing a cooldown or the old hard quota are historical implementation notes; this workflow supersedes those design-era rules.
