# Application rejection history

Migration 68 records an immutable review snapshot after every rejection of a version 2+ application. `application_review_history` is read-only to the backend service role and unavailable to browser database roles. Only trusted workflow functions insert snapshots; application edits never update them.

The Super Admin review panel groups each submission with its review-history tabs. Review 2.1.1 means version 2, submission attempt 1, review round 1; 2.1.2 and 2.1.3 are its later rejected reviews. A new submission remains attempt 2 in the existing `application` record model. Neither AR version numbers nor dispute limits change.

History includes the rejection explanation, status at that review, application reasons, floor plans and entry points, mall/floor details, and thread messages/attachment metadata through the recorded decision. Historical plan previews resolve saved plan content rather than the current mutable plan record. Historical views are read-only and do not poll current application state over their saved data. Current views refresh review-history metadata along with workflow state.

Existing unaccepted rejected requests can be recovered only when audit timestamps identify their rejection messages and the floor plans/entry points have not changed since the first rejection. The recovered rows are marked internally. Gaisano Fiesta application 38 recovered three recorded reviews, with thread cutoffs of 1, 3 and 5 messages respectively. Its newer accepted application and payment were preserved.

## Payment lock

The fixed review header uses compact metadata and a horizontally scrolling version/attempt selector. Application context, reasons and payment information sit inside a collapsible section in the scrollable Submission tab, leaving the Thread tab's body available for conversation.

Migrations 69–71 separate conversation permissions from submission editing. The latest version/attempt remains writable across workflow statuses. A newly added version immediately closes older application, AR and stall conversations, even before acceptance or publication. Another attempt within the same version closes writes through preceding application/AR attempts.

Application readers combine all source threads belonging to that mall/version into one shared conversation. The inbox groups it once and links to the latest attempt; read receipts remain attached to original messages and source threads. Earlier attempt tabs can read that shared history but cannot reply. Existing messages, attachments and immutable rejection snapshots are preserved. Future rejection snapshots capture the shared conversation only through the recorded decision. Database triggers verify the latest attempt/version, authenticated sender identity and mall ownership for every client.

AR development rows stay adjacent by mall, with versions descending inside each group. Mall group order preserves the existing queue ordering, and displayed queue numbers continue to represent the actual work queue.

Both Approve Application and Request Revision are disabled until the map-update service is queued/in progress and either:

- Its quote is zero and covered by the included allowance, with no payment request required; or
- Its matching payment is Paid, fulfilled, has no reconciliation issue, and matches the quoted amount.

The same rule is enforced by the database workflow for both actions, so other interfaces cannot bypass it. A queued status alone does not prove payment. The buttons remain visible but grey while payment is outstanding.

Validation: `test/application-review-history.test.cjs` covers immutable snapshots, review rounds, thread cutoffs, saved plan URLs and paid/included/unpaid gates. Browser checks exercise all three historical tabs, read-only state, disabled/unlocked buttons and historical polling protection. Live read-only API checks verified Gaisano Fiesta's recovered histories and archived plan preview.
