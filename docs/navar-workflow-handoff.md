# Application and AR workflow handoff

Date: 21 October 2026. Scope: this repository's super-admin interface and workflow backend. No mall-admin screens, payment processing, wallet changes, or renewal implementation.

## Apply the database changes manually

The agent has NOT applied any SQL migration or changed database rows. Read-only checks after cleanup found 3 nodes and 2 edges; no shared-version nodes, missing AR records, or edge/assignment version mismatches. Rerun the checks immediately before applying.

1. Open https://supabase.com/dashboard and select this project's database.
2. Open **SQL Editor** in the left sidebar, then **New query** (or the **+** tab).
3. Paste `navar/navar-backend/database_schema/23_workflow_prechecks.sql` and click **Run**. The shared-node, missing-AR, proposed-version mismatch, duplicate-application-version and unsupported-status result sets must be empty. The constraint/status/tier-backup result sets are informational. Stop on any incompatible AR CHECK constraint; do not remove it blindly.
4. Save the returned `rollback_tier_sql` statements locally. They preserve your actual tier allowances. Also take a project database backup before applying; an immediate schema rollback cannot recover later workflow history.
5. Create another query. Paste ONLY `23_application_ar_workflow.sql` and click **Run**. The transaction repeats the mapping checks and aborts on a mismatch; it never clones nodes or picks ownership from edges. Do not run the rollback or verification files as migrations.
6. Create another query, paste `23_workflow_verification.sql`, and click **Run**. Expect unversioned_nodes=0, no mismatched references, no suspended ARs, tier allowances 1/2/3, RLS enabled, and both public workflow-function privileges false.
7. Restart the backend and frontend using their existing `npm run dev` commands. Use a real super-admin account.
8. To enable reminders, add `WORKFLOW_REMINDERS_ENABLED=true` to your backend environment, then restart. Keep your existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` configuration. The hourly job runs once on startup too. With SMTP credentials absent, emails remain queued; they are not reported as sent.

SQL Editor background: https://supabase.com/docs/guides/database/overview . RLS background: https://supabase.com/docs/guides/database/postgres/row-level-security . RPC background: https://supabase.com/docs/reference/javascript/rpc .

## Rollback

Stop the backend and restore the previous application code. For an immediate rollback before using the new workflow, open `23_workflow_rollback.sql`, insert the saved tier UPDATE statements just before its final tier-restore guard, and add `SET LOCAL navar.rollback_tiers_restored = 'true';` after those statements. Paste the entire edited file into a new SQL Editor query and click Run. The transaction refuses rollback if workflow audit activity, retry attempts, or multiple node versions exist. After real usage, restore the pre-migration database backup instead; dropping workflow columns would discard history. RLS stays enabled and empty migration-created AR threads stay as harmless history.

## What changed

Phase 1 database/backend:
- Migration 23 adds the contract allowance snapshot, application attempts/reasons/acceptance/dispute count, On Hold resume state, Ready reminder state, mall approval timestamp, unpublish reason, node versioning and consistency constraints.
- Replaces migration 21's trigger in migration 23; leaves migrations 01-22 untouched. Keeps the trigger minimal: sequential versions, Live prerequisite, and retry numbering. Removes migration 19's old version-only unique index, which would otherwise block retries.
- Workflow actions lock the mall and application, then change status, write audit entries, and notify the other role in one transaction. Acceptance checks quota under the same lock. Publishing atomically supersedes the old Live version.
- Backend eligibility checks active-subscription stub first, latest AR Live, 45-day cooldown, contract allowance, and open work. The development submission route also enforces required v2 reasons and exact floor coverage. Acceptance rechecks floor coverage.
- Existing application 6 has two legacy application-thread rows. They are preserved; reads combine their messages, and new posts use the earliest thread. No messages were reassigned or deleted. Thread creation uses a mall lock to avoid adding more duplicates through the workflow.
- Version-scoped node reads and saves prevent mapping a new version from modifying Live nodes. Fixed the touched node-map audit field from audit_log_mall_id to the schema's mall_id.
- Reminder claims create notifications and queued email_log rows transactionally at days 3, 7, 14, 28, 42, etc. Each Ready transition resets the count and clock. SMTP delivery uses the existing nodemailer dependency.

Phase 2 interface:
- Application reason display, accept/reject with mandatory rejection explanation, newest-first version/attempt tabs, read-only history, and revision/approval availability from backend state.
- Revision notes are optional. Rejections and disputes still require explanations.
- AR Testing/Ready/status changes and publish retries now use the backend instead of changing React state only. Mall approval is a timestamp, never inferred from a thread message.
- Ready-ever thread visibility, persistent AR threads with images, wait duration and On Hold resume status, read-only Live/older versions, and mobile cards with previous/next navigation.
- Removed prototype manual Unpublish/Reactivate controls: superseding a Live version is handled atomically by publishing its replacement.
- Updated CONTEXT.md to state that nodes are versioned by node.ar_development_id.
- Searched backend, frontend and database SQL for suspended/Suspended. Runtime AR references were replaced in the application routes, AR table, OnHoldModal component and AR CSS. Subscription suspension and browser audio-context suspension remain unchanged. Migration 23 converts historical AR rows; its CHECK permits on_hold and excludes suspended. The precheck lists existing database AR CHECK constraints for review, and the rollback intentionally restores the old status.

Phase 3 validation:
- `node --test --test-isolation=none modules/applicationManagement/workflow.test.js`: 9 tests passed (auth/role boundaries, cross-mall denial, malformed/oversized input, backward-only menu, verified actor dispatch, publish prerequisites/idempotency, waiting gates, Unpublished eligibility, retry numbering and cooldown).
- JavaScript syntax checks passed for touched backend modules and server.
- Focused frontend ESLint checks and production build were run. The production build passes with the existing large-bundle warning.
- These tests use fake database responses and make no live writes. SQL transitions, SMTP delivery, browser interactions, and RLS execution still require the manual checks below after applying migration 23. No migration was executed, even against a local database.

## Manual workflow checklist

Use disposable development data and genuine authenticated accounts. The existing `/application-management-testing` page stays a super-admin development tool; it is not mall authentication and does not bypass eligibility. Check App.jsx for the exact testing route if your route differs.

1. **v1:** use a mall with no application. Submit all floor plans through the testing page. Check Submitted and application-thread availability. Request Revision without notes: the status change must work and notify the mall. After the separate mall client resubmits, approve; exactly one Pending AR must appear. Reject must never appear for v1.
2. **On Hold:** start Node Mapping, then request revision on its Approved application. Check On Hold and resume_status=node_mapping. Resubmit via the authenticated mall API below, approve again, and confirm it resumes Node Mapping rather than Pending. Repeat from Testing. Revision must fail after Ready has been reached.
3. **v2 accepted:** use a mall with its latest AR Live for at least 45 days and remaining contract allowance. Confirm blocked reasons in the testing options for unmet conditions. Supply reason category/notes and exactly one plan per existing floor. Confirm Pending has no AR. Accept: Submitted, accepted_at recorded, quota consumed once. Then follow the normal revision/approval loop.
4. **v2 rejected/disputed:** reject with an explanation; confirm it appears in the application thread. Authenticate as that mall and dispute with notes. Reject again, dispute again, reject: Rejected Final. A third dispute must fail. A new development request uses the same provisional version and attempt+1; earlier attempts stay read-only. Rejected requests consume no quota.
5. **Ready loop:** Node Mapping -> Testing -> Ready creates the AR thread. Change Status permits Testing -> Node Mapping and Ready -> Testing/Node Mapping only. It never offers Pending or On Hold. Check notifications on each transition. The thread persists after moving backward. Return to Ready; ready_at and reminder_count reset.
6. **Mall approval:** concerns are thread messages, not rejection or approval. POST mall_approve without acknowledgement must fail. With acknowledgement, the timestamp locks super-admin status edits. Permissive subscription gates publish immediately. For v2, its predecessor becomes Unpublished with reason superseded in the same transaction. New nodes/edges/beacon assignments/calibration must belong to the new version.
7. **Read-only:** open older version/attempt tabs and Live versions. No thread composer or mutating actions. Direct API attempts must also fail. Opening a newest AR that has never been Ready shows only "This version is not ready yet." in its info body. Early-stage table actions remain available to the super admin.
8. **Notifications/reminders:** use a disposable Ready record in a development database. At Ready ages just before/at 3, 7, 14, 28 days, run the enabled job and check recipient-specific admin_notification rows and queued/sent email_log rows for every official active mall admin. A repeated run at the same age must not re-send the same milestone. Approval stops new reminders. Returning to Ready restarts the clock.
9. **Responsive:** at phone width, step through cards, open details, switch versions, read/send a thread image, and verify sidebar behavior remains unchanged.

## Authentication and cross-mall requests

From PowerShell with backend running locally, unauthenticated read must return 401:

```powershell
curl.exe -i http://localhost:3000/api/applications
```

Set `$env:MALL_TOKEN` to a real mall admin's access token obtained through that mall's existing Supabase login (never commit it). Replace `123` with an application belonging to a DIFFERENT mall. This must return 404 without changing data:

```powershell
Invoke-WebRequest -Method Post -Uri 'http://localhost:3000/api/mall/applications/123/mall_approve' -Headers @{ Authorization = "Bearer $env:MALL_TOKEN" } -ContentType 'application/json' -Body '{"acknowledged":true}'
```

The same token on super-admin `/api/applications` must return 403. A super-admin token on `/api/mall/workflow/eligibility` must return 403. Do not treat a cross-mall super-admin read as unauthorized; super admins intentionally see all malls.

Separate mall API handoff (application ID in the URL, mall scope always from verified identity):
- GET `/api/mall/workflow/eligibility`
- POST `/api/mall/applications/:id/dispute` with `{ "notes": "required explanation" }`
- POST `/api/mall/applications/:id/resubmit` with `{}` after the separate mall implementation has saved the revised content
- POST `/api/mall/applications/:id/mall_approve` with `{ "acknowledged": true }`

These are narrow new workflow routes. Existing global auth and the super-admin-only frontend were not relaxed. The database RPCs remain service-role-only; the mall app must call the authenticated backend, not pass actor IDs to RPCs directly.

## Subscription handoff

All four hooks live in `modules/applicationManagement/subscriptionGate.js`:
- isOnboardingPaid(mallId): true, TODO(subscription).
- isFirstSubscriptionPaid(mallId): true, TODO(subscription).
- isSubscriptionValid(mallId): true, TODO(subscription); future active only, excluding grace and suspension.
- getMapUpdateAllowance(mallId): current contract's contract_map_updates_per_year, or null if there is no current contract.

Get the bound publishing callback with `const { tryPublish } = require('./modules/applicationManagement/arService')(supabase)` and call `await tryPublish(arDevelopmentId)` after payment/renewal confirmation. The named utility export also accepts the database client explicitly. No gate opens a payment checkout, starts a term, renews contracts, or changes wallet data. Recorded mall approval stays intact while a gate refuses publication.

## Unity impact

Resolve the mall's Live ar_development first through its application.mall_id. Use that exact ar_development_id for ALL node, edge, beacon_node_assigment and floor_calibration queries. node now requires ar_development_id for every insert. No table/column was renamed, including beacon_node_assigment. floor remains mall-level and fixed. Existing nodes are backfilled; new versions start with no copied nodes. Composite keys prohibit cross-version edges, beacon assignments and cross-floor node links.

RLS stays deny-by-default. Migration 23 adds no anonymous or authenticated grants/policies to expose maps. The Unity team must verify its existing authenticated Live-map SELECT policies permit the matching rows in each table. If those policies do not exist, direct Unity reads remain denied; no service-role key belongs in Unity.

## Assumptions and remaining work

- Dispute limit 2 and reminder cadence 3/7/14 then every 14 days are adopted from the approved request.
- Official, non-deactivated mall admins receive reminders. A current contract with unset term dates blocks quota accounting instead of assuming an arbitrary term; no current contract means unlimited allowance for this stub phase.
- Previous uncommitted edits in mall routes, mall components, documentation and application code were preserved. Wallet/payment/renewal code was not changed. No new libraries were installed.
- The separate mall repository still owns its UI, application drafting/editing/upload integration, and connecting its submissions and thread actions to the workflow backend. Do not write status fields directly and expect the backend's transition notifications to run. The included mall routes cover dispute/resubmit/Ready approval only; mall thread and submission endpoints need integration in that repository/backend handoff.
- No real mall credentials were available for live access tests. Automated guard tests passed; run the requests above with genuine sessions after applying the migration.
- SMTP sends cannot be transactionally committed with Postgres. Emails use queued -> sending -> sent/failed; inspect failed or stuck sending entries before manually retrying to avoid duplicate delivery. Existing queued emails are not cancelled if an AR is approved between claim and delivery.
- Existing health response metadata and unrelated account/tenant/subscription features were left unchanged. This pass is not a global auth/security refactor.
- SQL execution, full browser walkthroughs, real SMTP delivery and Unity policy/query validation remain unperformed. The migration and rollback are supplied for your review and manual execution.
