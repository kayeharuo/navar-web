# Progress

## 24 November 2026 - Agreement labels follow the current subscription

Removed hardcoded Setup labels from application lists/details and the AR list's fallback. A shared formatter shows Onboarding before a subscription starts and the current contract's readable status thereafter. Historical application versions also reflect the mall's current subscription. No onboarding contract or payment is created or modified. Five focused tests passed, covering list/detail consistency, inactive historical contracts, pre-subscription state, subscription statuses and latest-AR regression. Existing virtual Draft rows are not proof of payment: Minglanilla's recorded onboarding request is still pending, and Robinsons has no recorded onboarding payment request. Those records were left untouched.

## 24 November 2026 - Latest AR status in mall summaries

Mall summaries incorrectly hid AR status without a subscription and queried AR only for the latest application. They now select the highest existing AR development version across the mall's applications, regardless of subscription or a newer application awaiting development. Latest Application remains independent. The shared response fixes Mall Management, its info panel and Dashboard and includes `arDevelopmentVersion`. A dash now means the mall actually has no AR development. Four focused tests passed. Read-only live route checks confirmed Minglanilla V1 Testing, South Town V1 On Hold, SM Seaside V1 Live despite its V2 application, and Gaisano Fiesta V2 Node Mapping. No database records were changed.

## 24 November 2026 - Publication handover, protected cleanup and ticket presentation

Never delete records belonging to Gaisano Fiesta Mall (12), SM Seaside City Cebu (5), or Robinsons Galleria (21). This cleanup explicitly excludes all three. Before/after fingerprints matched for 1,653 related records across 67 tables.

Applied migration 78: publication serializes by mall and automatically changes an older Live AR version to Unpublished when its replacement becomes Live. Existing readiness, payment and mall approval guards remain in force. Beacon ticket states are Faulty, Investigating, Under Maintenance and Resolved; old producers sending Pending are normalized to Faulty at the database boundary. Ticket badges and timeline actions use readable capitalization, including Marked as Faulty. Removed Pending filters, counts and approval controls.

Ran the reviewed, transactional `cleanup_unlinked_applications_and_subscriptions.sql`, first with rollback and then committed. Ayala Central Bloc application 15 and SM J Mall application 10 retain their IDs and become Draft; floor plans, entry points and submission details were cleared. Removed contracts 6 (South Town Centre), 9 (Gaisano Tabunok), and 12 (SM Hyper Market), which had no Live AR; the last had four related suspension records. Original submissions, subscriptions and suspension history are retained in owner-only `app_private.workflow_cleanup_archive`. No mall profiles, onboarding payments, store records, conversations or protected mall records were deleted. This is a one-time cleanup, not an automatic subscription deletion rule: first subscriptions must still be allowed before publication.

Minglanilla's notes contained internal onboarding intake text, and the flex layout shrank its notes box below the text height. Notes now retain their full height and wrap long URLs; edit fields have a proper multiline layout. Replaced that mall's internal intake notes with a brief description. Removed Accessible from edge type choices and new automatic edge generation; elevator/ramp/stair connector types retain their separate meaning. Historical edge data remains readable without rewriting saved snapshots. Onboarding store capacity remains one combined total for stores and stalls; no separate stall quota was introduced. Removed the requested paid-map-update explanatory sentence from System Settings.

Validation: 16 focused database/editor tests passed, including publication handover, stale-publication rejection, cleanup exclusions/idempotency, ticket compatibility and automatic connector edges. Browser checks verified long notes fit their container, Pending is absent and timeline casing is correct. Production build passed; focused lint has no errors, with three pre-existing node editor hook warnings. Live checks confirm enabled triggers, private archives, no unsupported ticket states and no mall with multiple Live versions. Existing bundle-size warning remains.

## 24 November 2026 - Mall forms, establishment capacity, beacon health and exports

Brand editing preserves stored categories, including older categories outside the standard dropdown. Consolidated the two extra Leylam brands into the brand used by Gaisano Fiesta; preserved all four real store records and archived the original references in the audit log. Mall lists use creation time descending in Mall Management and Dashboard. Mall information displays operating hours Sunday through Saturday. Add/edit forms expose store and tenant counts and prefill linked onboarding counts and floor areas. Linked quote counts remain authoritative; capacity includes both stores and stalls plus paid, approved stall additions.

Applied NavAR migrations 74–77. Database guards enforce active establishment capacity, including reactivation and mall transfers, while preserving the existing requirement for approved post-publication additions. Beacon health now controls `node.node_is_active`; unavailable nodes and incident edges are excluded from normal navigation reads. Recovery restores availability. A replacement can take a deactivated beacon's assignment without affecting other AR versions, and assignment counts remain accurate. Mobile clients with cached graphs must refresh their data to observe database changes. Service-backed map editing retains access to inactive nodes and displays their state.

Beacon tickets failed because unassigned floor IDs were sent as null values in a bigint lookup. The endpoint now excludes null lookup IDs and supports tickets without assigned beacons/floors. Mall, brand, store and beacon operations use shared success/failure dialogs styled like the existing application modals.

The analytics export below is superseded by Download CSV Tables: a ZIP containing 12 rectangular CSV datasets and a README. Each table has one header, escaped UTF-8 values and spreadsheet formula protection. Print / Save PDF provides the report's charts and selectable text with a dedicated print layout.

Verification: 22 targeted backend tests passed; focused frontend lint and production build passed (existing bundle-size warning). Rolled-back live database checks covered beacon fault/recovery/replacement and capacity rejection, leaving no permanent test changes. Read-only live endpoints verified mall ordering, onboarding capacity, duplicate cleanup and ticket loading. Isolated browser checks with intercepted writes covered stored category retrieval, success/failure dialogs, quote counts/floor areas, weekday order, capacity controls, ticket rendering, ZIP download and selectable-text PDF generation. Windows successfully extracted all 13 ZIP entries and parsed the mall CSV.

## 24 November 2026 - Database analytics, complete CSV and dashboard refresh

Replaced Analytics sample series, rankings, user counts and financial totals with a Super Admin-only `/api/analytics` report. Navigation uses `navigation_session`, store/node destinations and lifetime recorded history for first-time/returning classification. Dates and hourly buckets use Asia/Manila; default range is the latest 30 calendar days and explicit ranges may span up to 366 days. Empty periods keep real zero counts and unavailable rankings/durations. The backend paginates source reads rather than accepting the default row cap. Paid payment requests are authoritative; legacy `payment` records with matching mall/reference are excluded to prevent double counting. Pending and reconciliation-flagged records are excluded. Current active annual subscription value is separate from recorded period payments.

Export All CSV downloads one UTF-8 CSV of the displayed report snapshot, with uniform columns and a Section field covering summary, all chart data, user types, monthly payments, payment types, mall breakdown, store rankings, definitions and data-quality counts. Embedded commas/quotes/newlines are escaped and spreadsheet formula prefixes are neutralized. No raw mobile identities are exposed. Chart window tabs do not truncate the exported report period.

Dashboard AR Usage uses the same report. Existing database-backed dashboard cards now refresh on relevant database events, focus and a 60-second polling fallback; recent-activity failures show errors rather than empty history. The subscription response includes an as-of timestamp for expiry calculations. Read-only live verification reconciled 123 navigation sessions (67 SM Seaside, 56 Gaisano Fiesta), 2 Live malls and PHP 32,229.75 in recorded payments for 26 October–24 November 2026. No analytics records were inserted or changed.

Validation: six targeted analytics/export tests cover Manila boundaries, historical user classification, duration validity, payment deduplication, empty data, pagination, authorization, CSV completeness/escaping and failure handling. Browser checks exercised the actual CSV download, every exported section, date-picker empty states and matching dashboard totals. Frontend lint and production build passed.

## 25 October 2026 - Beacon links per AR version

Beacon add/edit now loads actual AR development IDs, nodes and saved assignments for the mall. Each version has a single optional node selector; counts come from real assignments. Backend validation rejects duplicate versions and mismatched nodes. Applied backend-only SECURITY INVOKER RPC `save_beacon_with_assignments` to save beacon details, links and battery changes atomically. The existing unique constraint enforces one node per beacon per AR development. AR Development now displays the same bidirectional For Revision / Approved application-flow arrow as Application Management.

Verification: two focused tests pass (including PostgreSQL transaction rollback and cross-mall/version rejection), focused frontend lint and backend syntax pass, production build passes with the existing bundle-size warning, and the live mall read-back endpoint passes. Live RPC existence, role privileges and validation were verified. Browser interactions were not tested.

## 25 October 2026 - Beacon assignment table spelling

Applied `rename_beacon_node_assignment` to the NavAR Supabase project. Renamed the table in place, its four named constraints and two named RLS policies; updated the live `save_node_map` function in the same transaction. Verified the table OID, row count (0 before and after), all grants, three policies and six constraints are preserved, and no database function references the old spelling. Updated SQL setup/verification/rollback scripts and current usage documentation. Mall Management uses `beacon` directly and needs no JavaScript changes. External Unity clients must query `beacon_node_assignment`. Historical comparison snapshots below retain the original spelling.

## 21 October 2026 - Application and AR workflow

Implemented the super-admin workflow and database/backend support described in [the handoff](navar-workflow-handoff.md). No mall screens, wallet/payment changes or renewal logic. Migration 23 remains unapplied. Existing uncommitted edits preserved.

Files created:
- navar/navar-backend/database_schema/23_application_ar_workflow.sql
- navar/navar-backend/database_schema/23_workflow_prechecks.sql
- navar/navar-backend/database_schema/23_workflow_verification.sql
- navar/navar-backend/database_schema/23_workflow_rollback.sql
- navar/navar-backend/modules/applicationManagement/arService.js
- navar/navar-backend/modules/applicationManagement/subscriptionGate.js
- navar/navar-backend/modules/applicationManagement/mallWorkflowRoutes.js
- navar/navar-backend/modules/applicationManagement/reminders.js
- navar/navar-backend/modules/applicationManagement/workflow.test.js
- docs/navar-workflow-handoff.md and docs/progress.md

Files changed:
- navar/MD files/context/CONTEXT.md (nodes are versioned)
- navar/navar-backend/modules/applicationManagement/routes.js and versionRules.js
- navar/navar-backend/modules/applicationTesting/routes.js
- navar/navar-backend/modules/nodeMap/routes.js
- navar/navar-backend/server.js
- navar/navar-frontend/src/pages/ApplicationManagement.jsx and ApplicationManagementTesting.jsx
- navar/navar-frontend/src/components/applicationManagement/ApplicationsTable.jsx, ApproveModal.jsx, RequestRevisionModal.jsx, ReviewPanel.jsx, ThreadTab.jsx
- navar/navar-frontend/src/components/arDevelopment/ARDevTable.jsx, ARDevDetail.jsx, ThreadModal.jsx
- Renamed AR component SuspendedModal.jsx to OnHoldModal.jsx
- navar/navar-frontend/src/styles/applicationManagement/applicationManagement.css and styles/arDevelopment/arDevelopment.css

Manual tests, assumptions, Unity query changes, subscription callback signatures, remaining integration work and click-by-click Supabase steps are in the handoff. The backend guard/service suite passes 9 tests; focused lint and backend syntax checks pass; production frontend build passes with a large-bundle warning. No SQL migration or workflow mutation was executed. Unity must select nodes, edges, beacon_node_assigment and calibration by the Live AR version under its existing RLS policies.

Subscription hooks: isOnboardingPaid, isFirstSubscriptionPaid, isSubscriptionValid (permissive TODO stubs), getMapUpdateAllowance (current contract snapshot/null), plus bound AR service tryPublish(arDevelopmentId).
