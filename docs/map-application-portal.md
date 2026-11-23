# Version 2+ application portal

The separate assisted Mall Admin pages are `/mall-portal/map-applications/12` for Gaisano Fiesta Mall and `/mall-portal/map-applications/5` for SM Seaside. They require the existing authenticated Super Admin session and record both the initiating administrator and the mall administrator whose workflow is being assisted. They do not use the Super Admin sidebar or expose submission controls in the review list.

## Submitting and reviewing

1. The page loads the latest Live application's plans, scale references, accessibility and emergency routes, and entry points. Unchanged floors reuse their existing images and details. Edit supporting details or replace images for affected floors, and provide a reason for the structural update.
2. Submission atomically creates a Pending version request, separate plan and entry-point records for every floor, provenance records, a requested service, and an application thread. It does not overwrite the Live application or create an AR development yet. A submission token prevents duplicate applications when retrying the same write.
3. Super Admin opens Application Management > New Applications and filters Pending or Disputed. Accept and Reject use the standard confirmation modal styling. Rejection requires an explanation. Acceptance changes the request to Submitted and produces the authoritative changed-floor quote.
4. The mall page shows any payment due. Its assisted payment checkbox is restricted to Super Admin; the actual Mall Admin API has no manual payment bypass. Included single-floor Premium requests proceed without a charge. Payment uses the existing request and settlement infrastructure, with a separate private manual receipt and audit provenance.
5. After payment or included allowance, Super Admin may approve or request revisions. The mall edits a For Revision application in place and explains corrections in its thread; its status stays For Revision so Super Admin can approve it directly. The quoted set of changed floors is locked during corrections to prevent unbilled additions.
6. Approval creates Pending AR development. Mapping, testing, Ready and mall confirmation use the existing workflow. The previous structural version stays Live until publication of its replacement. Confirmation publishes using the active subscription, without another annual payment.

Two disputes are available per request: Reject, Dispute, Reject, Dispute, Reject Final. A new attempt keeps the provisional version number and increments its attempt. Rejected attempts have no issued update payment because pricing is issued after acceptance.

## Reason categories

The application pages share four structural categories: Major renovation or layout reconfiguration; Store or unit restructuring; Corridor or access restructuring; Other structural change. These cover physical changes requiring remapping, rather than routine node, route, label or beacon corrections in the editor. The selected label is stored in `application.application_reason_category`; explanatory notes remain required. Historical free-text categories remain visible when viewing existing applications.

## Rules and billing

An active subscription and latest AR Live are required. New requests cannot overlap another map application, AR build or stall request. There is no publication waiting period and no maximum based on free included benefits. Server quotes use configured map-update prices and reserve included benefits by contract term. Only declared changed floors are billable; every unchanged floor is still represented in the application.

Reused plans get separate version-owned records and retain source IDs. They do not copy operational nodes or beacon assignments automatically. Changed images clear calibration; changed route/scale metadata does not retain incompatible calibration or route JSON. New plans accept PNG/JPEG up to 10 MB per image, within the request's 60 MB body limit. A shared image loader supports both stored image bytes and legacy Storage paths in the review panel and node editor.

## Integration

Migration 72 replaces fixed map-update fees with 50% Basic, 40% Standard and 30% Premium of the mall's original paid onboarding amount divided by its original onboarding floor count, for each payable changed floor. `subscription_tier.s_tier_map_update_rate` is editable in System Settings; the old fixed-fee column is deprecated and zeroed. Original floor count is frozen in `mall_onboarding.onboarding_floor_count`, using the onboarding quote or original version's plans for legacy records. New quotes snapshot the amount, original denominator, tier rate, unit fee in centavos and allowance. Round the unit price to centavos, then multiply by payable floors. Previously issued quotes and onboarding/subscription snapshots stay unchanged unless explicitly corrected.

The Premium included benefit still covers a single-floor update request; it does not partially discount a multi-floor request. Both structural intake and the older service approval entry point calculate prices on the server, ignoring supplied fee amounts. Missing confirmed onboarding data blocks acceptance with a clear error instead of treating a missing price as free.

The explicitly requested Gaisano Fiesta manual payment correction uses `reprice_gaisano_fiesta_map_update.sql`: PHP 30,178.50 / 3 original floors × 50% × 1 payable floor = PHP 5,029.75. Quote, payment request and private manual receipt agree; Paid/fulfilled and development status remain unchanged. The before-records and new calculation are retained in the audit log. The immutable payment trigger is disabled only inside the exclusively locked correction transaction and restored before commit. No payment is collected or refunded by this data correction.

Migrations 65-67 install `map_application_portal`, floor provenance and submission/payment receipts; updates the version insert guard; removes the legacy hard quota; and delegates through existing owner-confirmation and stall wrappers. They also correct the earlier structural rejection path that ended after only one dispute, preserve confirmation while a subscription awaits recovery, and align mapping starts with the approved Pending AR queue rather than unapproved service requests.

Super Admin-assisted APIs: GET `/api/map-portal/:mallId`, GET `/api/map-portal/:mallId/plans/:planId`, and POST actions `submit`, `pay`, `revise`, `dispute`, `message`, `confirm`.

Actual Mall Admin APIs: GET `/api/mall/map-applications`, its `/plans/:planId` route, and the same POST actions except `pay`. Actor identity and mall ownership come from the authenticated administrator, never body fields. The separate Mall Admin repository can integrate these endpoints; its source was not changed here. Provider payment confirmation remains a trusted backend operation.

The review list and open panel refresh from database events, with polling and focus recovery.

The older application intake remains available for first applications and directs later versions to the separate portal, preventing a second version from bypassing service creation.

Verification includes authenticated route tests, updated no-cooldown eligibility tests, browser checks with mocked APIs, and rolled-back live SQL in `test/live-map-application-intake.sql` and `test/live-map-application-security.sql`. Publication fixtures create a separate version-owned graph only inside the rolled-back test. No permanent version application, payment or subscription was created by verification.
