# Stall applications

Super Admin uses `/application-management/stall-applications` only to list applications, review submissions, approve or request revisions, and use threads. Submission and payment controls are on a separate page, `/mall-portal/stall-applications/:mallId`, outside the Super Admin navigation shell. For Gaisano Fiesta Mall use mall ID 12; for SM Seaside use mall ID 5. The assisted page still requires authenticated Super Admin access and uses the actual mall administrator identity for workflow actions; assistance is recorded in the audit log. Legacy `/application-management/stalls/:mallId` links redirect to the separate page.

## Flow

1. Enter stall counts for affected floors. Unaffected floors can remain zero. Counts are locked once the request is created.
2. Review the server-calculated quote and record payment using the acknowledgment checkbox. Only Super Admin can record a manual payment; Mall Admin endpoints cannot bypass payment. Fully included requests proceed without a payment.
3. Enter the exact purchased quantity on each floor. Each stall requires a name, catalog brand and location description. Contact person, mobile number and email are optional. An updated PNG, JPEG or PDF floor plan is optional, with a 2 MB limit per floor.
4. Save each floor, then submit. The database creates the Super Admin submission notification. The application has its own conversation thread.
5. Super Admin reviews and approves, or requests corrections. Approval creates the Mall Management stall records without units and returns the existing AR development to Node Mapping. Stall node placement is restricted to the submitted floor. Existing plans and calibration remain when no new plan was supplied; a replacement plan requires calibration.
6. Continue mapping, testing and marking Ready. Mall Admin confirms the update and it becomes Live using the active subscription. No additional annual subscription payment or contract is created.

An active subscription and Live AR are required to start an application. Pending requests and structural map updates cannot compete for the same mall. Existing historical payment quotes are retained.

## Pricing

Current configured addon prices are Basic ₱1,100 per stall, Standard ₱1,000 and Premium ₱1,000. Premium includes 10 stalls per contract year. The database reads the current tier configuration when quoting, subtracts available included stalls, and preserves that quote for payment. The quoted ₱815 is not the current stall addon price.

## Storage and integration

Migrations 60–62 implement the paid workflow, assisted portal and current configured addon rates. Application and floor counts use `stall_application`, `stall_expansion` and `stall_expansion_floor`; stall details use `stall_expansion_item`. Payments use `contract_payment_request` and the existing settlement machinery. Manual receipts are retained in owner-only `app_private.stall_payment_receipt`. Approved stalls use the existing store and stall records. Threads and notifications use the existing database workflow infrastructure.

Super Admin APIs are `/api/stall-applications` and `/api/stall-portal/:mallId`. Mall Admin APIs are `/api/mall/stall-applications` and its action routes, bound to the authenticated administrator's own mall. Manual payment recording is intentionally excluded from Mall Admin routes. Existing first-subscription owner-confirmation wrappers are preserved.

## Verification

Automated backend and node-placement checks cover authorization, identity binding, application IDs, active subscriptions and floor restrictions. Live SQL checks in `test/live-paid-stall-applications.sql` and `test/live-stall-application-security.sql` exercise payment through publication, included allowances, notifications and rejected unauthorized or incomplete actions. They roll back all fixtures. Browser checks exercise counts, payment feedback, optional plans, exact details, submission, review and confirmation. No permanent stall application was created by verification.
