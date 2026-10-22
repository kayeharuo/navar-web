# Super Admin inquiry backend

This change connects the existing inquiry screen to Supabase. It does not seed sample inquiries or change the screen's styling. Inquiry details come from `inquiry`, prices from `subscription_tier`, and saved correspondence from `inquiry_message`.

## Enable the database changes

1. Use the same Supabase project as Mall Platform and Mall Admin.
2. Ensure Mall Admin's existing owner-onboarding migrations (including 22 and 25, with their prerequisites) are already applied. The new workflow calls `public.provision_inquiry_mall(bigint,bigint,uuid,bigint,jsonb)`; it does not replace that onboarding flow.
3. Run `database_schema/21_inquiry_workflow.sql`, `22_inquiry_inbox.sql`, `23_inquiry_review_decisions.sql`, and `24_inquiry_followup.sql` in order in the Supabase SQL editor (only those not already applied). Migration 23 introduces review decisions; migration 24 adds invitation recovery, correction links, revision history, private notes, read receipts and duplicate review. These migrations do not insert sample business records. Authenticated browser roles cannot query these inquiry tables directly; the authenticated Super Admin backend serves them. The existing public submission RPC remains the public inquiry entry point.
4. Restart the Super Admin backend.

The migration has been tested locally with PostgreSQL-compatible PGlite. It has **not** been applied to your hosted database by this change.

## Backend environment

Keep the existing server-side Supabase configuration. Set these in `navar-backend/.env`, never a frontend environment file:

```dotenv
MALL_ADMIN_ORIGIN=http://localhost:5174
# Public origin of this Super Admin BACKEND (serves the correction form):
INQUIRY_PUBLIC_ORIGIN=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-address
SMTP_PASS=your-provider-app-password
SMTP_FROM_NAME=NavAR
# Optional; must be a sender authorized by your mail provider:
# SMTP_FROM=your-sending-address
INQUIRY_REFUND_TERMS="Your approved refund terms"
INQUIRY_FEE_DETAILS="Your approved explanation of onboarding and subscription fees"
```

Use your approved policy wording, not the example placeholders. Prices remain database-driven. The existing shared agreement version is used by the provisioning RPC; no new hardcoded agreement is created here. In production set `MALL_ADMIN_ORIGIN` to the HTTPS Mall Admin origin. Add that origin's `/complete-setup` URL to Supabase Auth's allowed redirect URLs.

## Behavior and checks

- List, search, counts, details and thread use saved records. A missing tier is shown as not selected, not replaced with a guessed price.
- New/In Progress changes persist. Converted/approved inquiries cannot move back to review.
- Approve & Invite opens a read-only review of the submitted inquiry. It provisions the owner using the existing onboarding function and copies only submitted mall information. It does not invent floor labels, coordinates, beacon counts or operating schedules. The owner supplies missing details during onboarding. Provisioning and the invitation message commit together; failures roll back those database writes.
- Reject requires a reason, saves the decision and a conversation message atomically, and queues an email to the contact. Both decisions reject stale versions and finalized inquiries. Request IDs prevent duplicate decisions.
- Statuses are New, In Progress, Approved and Rejected. Historical Converted records display as Approved without rewriting them. Approval grants access to owner setup; it does not mark payment, the mall application or AR development complete.
- Owner Auth identity/link preparation happens before that transaction, and email is sent afterward. A failed database conversion may leave an Auth identity without an app profile; retry can reuse that identity. It does not grant mall access on its own.
- The server gets the acting Super Admin from the verified session. Client-supplied actor IDs, tier prices and Auth IDs are not trusted.
- Reply and conversion request IDs prevent duplicate records when requests are retried. Version checks reject stale status/conversion updates.
- SMTP delivery is claimed once. An uncertain delivery result is saved and reported, never blindly retried. `sent` means the SMTP server accepted it, not proof of inbox delivery. Failed/uncertain owner invitation delivery currently needs investigation and deliberate reissue through an account invitation recovery workflow; this screen has no resend control.
- PNG/JPEG conversion logos are limited to 2 MB and checked server-side.
- Incoming replies can now be imported from the shared NavAR Gmail inbox after applying migration 22 and enabling INQUIRY_INBOX_ENABLED. See the inbox setup section below.

Run `npm run test:inquiries` in the backend and `npm run build` in the frontend. Local tests cover mapping, input validation, all endpoint authentication guards, transactional rollback, retry safety, stale writes and function permissions. The SQL test stubs the existing owner-provisioning dependency; it is not a live end-to-end payment or email test.

After applying the migrations, verify with an inquiry submitted from Mall Platform: confirm the record appears, update its status and reload, send a reply to a mailbox you control, then approve it. Check that the secure setup email reaches the submitted contact and opens Mall Admin's complete-setup page. Verify the owner can create their password and proceed through subscription selection, payment and profile completion. Use a separate inquiry to check rejection and its reason. No live email was sent during local automated tests.


## Shared NavAR Gmail inbox (incoming replies)

SMTP and read-only IMAP authentication were verified locally without sending email or reading message bodies. The backend now uses SMTP_USER as the shared Gmail for inquiry emails. The Super Admin name still appears in the message. Reply-To uses a Gmail plus-address tied to the saved outgoing message, so both the email app Reply command and the email template button can match the inquiry. The token is not a login credential and cannot authorize an inquiry update without a matching authenticated sender.

### Required database step

Run `navar-backend/database_schema/22_inquiry_inbox.sql` in the Supabase SQL editor. It adds an inbound Message-ID uniqueness constraint, a private mailbox cursor table, and a service-only import function. This migration has not been applied remotely by Codex. No records need to be deleted or reseeded.

The backend `.env` has `INQUIRY_INBOX_ENABLED=true`. It reuses SMTP_USER and SMTP_PASS for Gmail IMAP over TLS on port 993. No passwords belong in frontend variables. Restart the backend after applying the migration. If the migration is missing, the inquiry thread shows a setup warning and the worker does not access mailbox contents.

### Test the complete flow

1. Use an inquiry whose contact email is a real mailbox you control, distinct from the shared NavAR Gmail.
2. Send a new reply from Super Admin. Previously sent emails addressed replies to a personal admin mailbox and cannot be automatically recovered by this new integration.
3. From the contact mailbox, reply using either the native Reply action or Reply to NavAR button. Leave the generated recipient intact.
4. Keep the backend running. The inbox connection stays open and Gmail new-mail notifications trigger scanning. A 3-second fallback scan covers missed notifications. An authenticated live event stream refreshes the open conversation after import; a 3-second browser poll covers disconnected streams without resetting the composer or showing loading on each poll. Provider delivery and processing time still apply.
5. Verify the new message appears once, then refresh the page to confirm persistence.

The integration opens INBOX read-only; it does not mark mail read, move, delete, or automatically answer emails. Initial synchronization examines at most the most recent 500 message UIDs, 50 per scan. Later scans resume from a database cursor. Database failures do not advance past the affected message. Multiple imports of the same Message-ID remain a single database record.

Only messages with a matching saved outgoing reference or reply address, the inquiry owner's exact sender email, and Gmail's DMARC pass are imported. Subject-only matches, automatic replies, ambiguous threads, unrelated mail, messages over 10 MB and reply text over 20,000 characters are skipped and remain in Gmail. Log warnings include a UID and reason, never message bodies or credentials. Mail in Spam/Trash is not scanned; move a legitimate reply into Inbox for processing. Attachments are not imported. Plain text is displayed, with common quoted-history sections removed; HTML is not rendered in the chatbox.

Checks: `npm run test:inquiries` covers matching, sender authorization, SQL deduplication, mailbox cursor recovery, reply routing and SMTP reuse. `node scripts/verify-inquiry-mailbox.js` verifies IMAP without fetching message bodies. The browser build was also checked. A real send-and-reply test remains for the owner after the database migration; no real email was sent during automated testing.

References: [ImapFlow read-only mailbox access](https://imapflow.com/docs/guides/mailbox-management/), [Gmail client configuration](https://support.google.com/mail/answer/7126229), [MailParser](https://nodemailer.com/extras/mailparser).


### Faster outgoing replies

Clicking Send now waits only for database persistence. The API returns HTTP 202 with the saved message; the frontend inserts it immediately, clears the composer, and leaves the existing conversation visible. Email delivery runs in the background using existing `inquiry_message` pending records as the durable queue. A new reply wakes the sender immediately; a 5-second queue sweep recovers pending replies after backend restarts. No additional migration is needed beyond migrations 21 and 22.

The message displays Email queued, Email sending / awaiting confirmation, Email accepted by mail server, or Email delivery unconfirmed. Mail-server acceptance is not proof of inbox delivery. Duplicate API requests reuse their saved message, and the atomic delivery claim still prevents duplicate sending. Replies with uncertain delivery, including a process interruption during SMTP, are not automatically sent again. Inspect the sending mailbox before manually resending these. Owner setup/conversion emails retain their existing synchronous behavior.

Targeted tests cover the queue, save-before-email behavior, connection reuse, inbound matching, database deduplication, cursor recovery, protected live events, email conversation context and inquiry decisions. Decision tests include rollback, replay safety, stale versions, service-only function permissions and server-derived actor IDs. The SQL review test stubs the existing provisioning dependency; it is not a live owner onboarding test. No live email was sent by those tests.

### Deploy the review workflow

If migrations 21 and 22 are already installed, apply only `navar-backend/database_schema/23_inquiry_review_decisions.sql`, then restart the backend and reload the frontend. The new approval/rejection endpoints require it. Existing mall records are not reseeded or modified by this migration.

Super Admin does not assign or email passwords. Approval sends an invitation/magic link to `/complete-setup` using the submitted contact email. Missing subscription selection remains supported by the existing provisioning flow. The older `/convert` endpoint is retained as an alias for approval and ignores client-supplied mall edits. Approval email delivery remains synchronous and uncertain delivery is never automatically retried; inspect the sending mailbox before reissuing an invitation.

### Follow-up, recovery and owner corrections (migration 24)

Apply `database_schema/24_inquiry_followup.sql` after migration 23, then restart the backend and reload the frontend. It adds new service-only tables/functions; the updated application needs this migration. This migration has been tested locally but has not been applied to hosted Supabase by Codex.

- **Follow-up panel:** opens from the conversation header. Shows private notes, reviewer names, decision dates/reasons, delivery history and before/after inquiry revisions. Each section shows the latest 100 records. Pre-existing decision metadata is displayed where recorded; missing historical events are not fabricated.
- **Reissue invitation:** available for approved inquiries whose primary owner is still partial and has not completed setup. It sends a new secure setup link without creating a second mall or owner. Reservations and request UUIDs prevent duplicate sends from repeated clicks. A 10-minute cooldown applies from the last invitation, including initial approval. Uncertain prior delivery requires checking the sending mailbox and acknowledging it before reissue. Setup-link preparation/delivery failures remain visible; links are never silently resent. Existing Supabase Auth expiry rules still govern setup links.
- **Corrections:** available before approval/rejection. The admin specifies what needs changing; the owner receives a single-use link valid for 72 hours. The same inquiry is updated and remains In Progress. The owner cannot change their email, subscription choice, reviewer, status or mall assignment through this form. Original conversation text and before/after snapshots are retained. Reissuing a correction link revokes unused older links. Approval/rejection immediately blocks outstanding correction submissions.
- **Public correction URL:** set `INQUIRY_PUBLIC_ORIGIN` to the externally reachable HTTPS origin of this backend in deployment, for example `https://api.example.com`. The backend serves `/inquiry-corrections` and its own script/style assets, so no admin login or cross-origin frontend configuration is required. Localhost works only on the machine running the backend. Setup links still use `MALL_ADMIN_ORIGIN`, not this correction origin.
- **Correction security:** random 256-bit tokens; only SHA-256 hashes stored. Tokens travel in the email URL fragment, are removed from browser history after loading and sent to the backend in POST bodies. Do not enable request-body logging for this endpoint. Read-only link opening does not consume the token. The public API is rate limited; submissions lock/recheck the inquiry and token atomically. Token consumption, revision recording and the conversation update commit together. Links cannot change finalized inquiries or overwrite details changed after link issuance.
- **Unread/follow-up:** per-admin read receipts, unread badges, waiting-since indicators and filters for unread or awaiting-response conversations. Opening a visible conversation marks only the messages fetched by that reviewer as read. Summary indicators refresh every 15 seconds; open message threads retain live events and 3-second polling.
- **Owner progress:** shows Invitation pending, Account setup completed, Onboarding underway or Onboarding completed from existing saved milestones. It does not claim that an email was opened. No email-open tracking was added.
- **Duplicate warnings:** exact case-insensitive email or mall-name matches across saved inquiries are flagged. Approval requires reviewer acknowledgment, also enforced in SQL and recorded in history. Matches do not auto-merge/delete inquiries and may be legitimate branches or repeat submissions. Existing owner identity checks still prevent creating another admin for the same contact.

Verify after deployment with controlled mailboxes: request corrections, submit changed fields, confirm original/revised data and unread indicators, then approve. Check setup-link delivery and complete the existing owner setup. Test invitation recovery separately before completing setup. No real emails were sent by the automated tests.

### Email context and live updates

Each outgoing email pairs the admin reply with the latest saved mall message preceding that reply, including its timestamp. The original inquiry text is used only when no earlier mall message exists. Later messages and messages from other inquiries are excluded. The existing email layout is preserved.

Restart the backend and reload the frontend to use these changes. No new migration is required beyond migrations 21 and 22. The live event endpoint requires Super Admin authentication; it sends inquiry IDs only and reconnects periodically to revalidate access. In production, allow streaming responses through the reverse proxy without buffering (the endpoint sends `X-Accel-Buffering: no`). Polling remains available if streaming is unavailable.

Approximately three seconds after Gmail receives a reply is a target, not an end-to-end guarantee. Gmail delivery, connection recovery, database latency and processing backlog can take longer; the fallback intervals can also add together. Measure the complete send-and-reply journey with a mailbox you control before promising an arrival SLA.
