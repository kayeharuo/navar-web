# Super Admin account management

## Apply the database change
If migration 25 is already applied, run only `navar-backend/database_schema/26_account_management_repair.sql`. For a fresh setup, apply 25 then 26 after the existing migrations. Do not rerun migration 04: it requires empty account tables. Migration 25 adds a service-only transaction for account changes and an email-request cooldown table; it does not populate or delete accounts.

Restart the Super Admin backend, then reload Account Management. The repair has been tested locally; it has not been applied to your hosted database by this change. Migration 26 permits audit entries without a mall ID for Super Admin accounts, repairs edit permissions, and adds atomic creation of Super Admin/Mall Admin profiles. It does not populate or delete existing accounts.

## Behavior
- Super Admin and Mall Admin tabs use the actual account roles and saved mall names. Store/tenant accounts are excluded from this directory.
- Partial/official lifecycle remains separate from deactivation. Reactivating a pending account does not make it official.
- Active Super Admins can create and edit accounts. Deactivation, reactivation and password-link reissues remain primary-Super-Admin actions. Self-deactivation and deactivation of primary Super Admin accounts are blocked.
- Mall assignment and primary-owner designation are read-only when editing. When creating a Mall Admin, choose an existing mall; the database enforces account quotas and rejects a duplicate active primary admin. This does not replace inquiry approval or provision a new mall.
- Account creation persists the Auth identity, application profile and password-link request before sending an invitation. A delivery failure leaves the saved account visible for explicit resend, rather than sending a broken link or pretending delivery succeeded.
- Email actions are serialized per account, limited to one per minute and API rate-limited. No automatic email retries.
- Super Admin setup links use `/auth/set-password`; resets use `/auth/reset-password`. Mall links use the Mall Admin website's `/complete-setup` or `/reset-password`.
- Deactivation blocks application access first. Reactivation requires successful Auth unban before restoring application access. Failed Auth operations are reported.
- Edits, lifecycle changes and email reservations are audited. No passwords are stored in application tables.

## Configuration
Keep `SUPABASE_URL`, service key, `SMTP_USER`, `SMTP_PASS` and SMTP settings server-side. Set `APP_BASE_URL` or `FRONTEND_ORIGIN` to the Super Admin origin, and `MALL_ADMIN_ORIGIN` to the Mall Admin origin. Local defaults are ports 5173 and 5174; production requires HTTPS. Allow the matching callback URLs in Supabase Auth redirect settings. Never put service keys in Vite variables.

## Verify
Run `npm run test:accounts` in navar-backend and `npm run build` in navar-frontend.
With your primary Super Admin account, check each tab against the database, edit a secondary account, deactivate/reactivate it, and confirm partial status is preserved. Use a mailbox you control to check invitation/reset links; local tests deliberately send no real emails. Delivery success means SMTP accepted the message, not guaranteed arrival in the inbox.

## Account page behavior
Creation supports both roles. Form modals close only through their visible controls. Clicking a table row opens full account details; action buttons do not open the panel. Table rows remain on one line and Actions stays pinned during horizontal scrolling. Realtime reloads were removed from this page: initial navigation and completed account actions load records, without login timestamp updates repeatedly replacing tables with a spinner.
