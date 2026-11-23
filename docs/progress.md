# Progress

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
