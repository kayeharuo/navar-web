# Progress

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
