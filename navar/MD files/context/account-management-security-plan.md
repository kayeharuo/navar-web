# NavAR Account Management Security Plan

## Scope

This plan covers the first Account Management release:

- Only `super_admin` accounts can be created from the interface.
- A signed-in active Super Admin can create another Super Admin.
- Mall Admin and Store Admin creation are deferred.
- `store_admin` is represented in the data model but is not exposed in this interface yet.
- The current login page is not authentication. Do not treat it as a security boundary.

The backend must remain local or tightly controlled until authentication and authorization are implemented.

## Security Model

Use two separate systems for two separate responsibilities:

| Responsibility | System |
|---|---|
| Identity, password hashing, sessions, JWTs, email confirmation, recovery tokens | Supabase Auth (`auth.users`) |
| Application role, account status, mall/store assignment, display profile, audit data | Application tables, primarily `ADMIN` |

Never store or verify application passwords in the `ADMIN` table. Never expose a Supabase service-role key to the frontend.

## Current Schema Review

The current `ADMIN` table contains:

- `ADMIN_ROLE`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- profile fields
- `MALL_ID`
- `STORE_ID`
- `ADMIN_ACCOUNT_STATUS`

`STORE_ID` is already nullable and has a foreign key to `STORE(STORE_ID)`. This is correct for future Store Admins because Super Admins and Mall Admins do not need a store assignment.

The current schema also contains `ACCOUNT_INVITE`. Do not use its plaintext `A_INVITE_TOKEN` for Supabase invitation links. Supabase Auth should create and validate invitation tokens. Keep `ACCOUNT_INVITE` only if it is redesigned as a metadata/audit table that stores no usable token.

## Database Changes

Apply these changes in order. Create a new migration file rather than rewriting an already-applied schema in Supabase.

### 1. Link `ADMIN` to `auth.users`

Add a nullable column first so existing rows can be migrated safely:

```sql
ALTER TABLE ADMIN
ADD COLUMN AUTH_USER_ID UUID;

ALTER TABLE ADMIN
ADD CONSTRAINT uq_admin_auth_user_id UNIQUE (AUTH_USER_ID);

ALTER TABLE ADMIN
ADD CONSTRAINT fk_admin_auth_user_id
FOREIGN KEY (AUTH_USER_ID) REFERENCES auth.users(id)
ON DELETE RESTRICT;
```

Use `AUTH_USER_ID` as the identity link. Do not use email as the permanent link because an email address can change.

After all existing admin records are linked and verified, make it non-null:

```sql
ALTER TABLE ADMIN
ALTER COLUMN AUTH_USER_ID SET NOT NULL;
```

Do not run this final statement while unlinked records still exist.

### 2. Stop using application password hashes

For a new Supabase Auth implementation:

1. Stop reading `ADMIN_PASSWORD_HASH` in application code.
2. Stop writing `ADMIN_PASSWORD_HASH` for new records.
3. Make it nullable during the transition:

```sql
ALTER TABLE ADMIN
ALTER COLUMN ADMIN_PASSWORD_HASH DROP NOT NULL;
```

4. Migrate or remove old values only after confirming that no code depends on them.
5. Drop the column after the migration is complete:

```sql
ALTER TABLE ADMIN
DROP COLUMN ADMIN_PASSWORD_HASH;
```

Do the same design review for `APP_USER.USER_PWHASH`. Supabase Auth should own passwords for any account that uses Supabase Auth.

### 3. Add safe role and status constraints

Use one canonical spelling everywhere:

- `super_admin`
- `mall_admin`
- `store_admin`

Recommended constraints, after cleaning existing data:

```sql
ALTER TABLE ADMIN
ADD CONSTRAINT ck_admin_role
CHECK (ADMIN_ROLE IN ('super_admin', 'mall_admin', 'store_admin'));

ALTER TABLE ADMIN
ADD CONSTRAINT ck_admin_account_status
CHECK (ADMIN_ACCOUNT_STATUS IN ('partial', 'official', 'deactivated'));
```

Do not add these constraints until existing rows have valid values.

### 4. Enforce assignment rules

For the current release, Super Admins must not have mall or store scope:

```sql
ALTER TABLE ADMIN
ADD CONSTRAINT ck_admin_scope
CHECK (
    (ADMIN_ROLE = 'super_admin' AND MALL_ID IS NULL AND STORE_ID IS NULL)
    OR (ADMIN_ROLE = 'mall_admin' AND MALL_ID IS NOT NULL AND STORE_ID IS NULL)
    OR (ADMIN_ROLE = 'store_admin' AND STORE_ID IS NOT NULL)
);
```

When Store Admin is implemented, also enforce that the store belongs to the assigned mall. A simple check constraint cannot verify a relationship across tables; enforce that relationship in a transaction, database trigger, or a controlled backend function.

## Supabase Auth Configuration

Before writing Account Management code:

1. Enable the required email provider in Supabase Auth.
2. Configure the production site URL and exact redirect URLs.
3. Use HTTPS outside local development.
4. Set invitation and recovery link expiry as short as the workflow allows.
5. Configure email templates without including passwords or sensitive profile information.
6. Configure SMTP/Postmark through a trusted server-side integration if Supabase's default email service is not sufficient.
7. Keep the service-role key only in the backend environment.
8. Do not put the service-role key in Vite variables or any `VITE_*` value.

## First Super Admin Bootstrap

Do not create the first Super Admin through a public API endpoint.

Use one controlled bootstrap process:

1. Create the first identity in Supabase Auth Dashboard or a protected one-time server-side script.
2. Confirm the email through the controlled process.
3. Insert its `AUTH_USER_ID` and profile into `ADMIN`.
4. Set `ADMIN_ROLE` to `super_admin`.
5. Set `MALL_ID` and `STORE_ID` to `NULL`.
6. Set `ADMIN_ACCOUNT_STATUS` to `official` only after the password/session setup is complete.
7. Disable or remove the bootstrap mechanism immediately after use.
8. Record the bootstrap action without logging tokens or passwords.

There must always be a recovery path through another active Super Admin or a documented Supabase administrator procedure.

## Backend Work Order

Implement these steps in order.

### Step 1: Add authentication middleware

In `server.js`:

1. Read the `Authorization: Bearer <JWT>` header.
2. Reject missing or malformed headers with `401`.
3. Verify the token using Supabase Auth server-side.
4. Load the matching `ADMIN` row by `AUTH_USER_ID`.
5. Reject missing, deactivated, or incomplete admin profiles.
6. Attach only the minimum safe identity data to `request.admin`.

Keep `/health` public. Keep `/api/health` limited to a non-sensitive status response. Protect Account Management and all administrative data routes.

### Step 2: Add Super Admin authorization

Create a separate authorization guard after authentication:

- Require `request.admin.ADMIN_ROLE === 'super_admin'`.
- Require `ADMIN_IS_DEACTIVATED = false`.
- Never accept the role from the request body as proof of permission.
- Never trust a frontend route guard as authorization.

### Step 3: Add account-management endpoints

Create dedicated backend routes rather than placing account creation inside the mall-management route file:

```text
POST /api/admin-accounts
GET  /api/admin-accounts
POST /api/admin-accounts/:id/resend-invite
POST /api/admin-accounts/:id/admin-reset
POST /api/admin-accounts/:id/complete-setup
PATCH /api/admin-accounts/:id/deactivate
```

For the first release:

- `POST /api/admin-accounts` accepts only `super_admin`.
- Reject `mall_admin` and `store_admin` with a clear, non-sensitive error until those workflows exist.
- Do not allow changing the first or last active Super Admin without a deliberate recovery policy.
- Do not allow a Super Admin to use the administrative reset endpoint on their own account.

### Step 4: Create a Super Admin account

The server-side transaction should be:

1. Authenticate and authorize the requesting Super Admin.
2. Validate email, name, role, and allowed fields.
3. Normalize email consistently for uniqueness checks.
4. Check for an existing active or pending identity/profile.
5. Create the Supabase Auth user through the backend Admin API with an invitation email.
6. Insert the `ADMIN` profile using the returned Auth user ID.
7. Set status to `partial`.
8. Set both `MALL_ID` and `STORE_ID` to `NULL`.
9. Return a safe profile response without tokens, links, or secrets.
10. If profile creation fails, disable/delete the newly created Auth user through a controlled compensating action and log the failure without secrets.

Use a database transaction or a carefully designed compensation path so Auth and `ADMIN` cannot silently diverge.

### Step 5: Complete invitation setup

The invited user opens the one-time Supabase invitation link.

The setup page must:

1. Verify that a valid Supabase Auth session exists.
2. Require a strong password and confirmation.
3. Set the password through Supabase Auth.
4. Call `/api/admin-accounts/:id/complete-setup` with the authenticated session.
5. Have the backend verify that the session user matches the target `AUTH_USER_ID`.
6. Change `ADMIN_ACCOUNT_STATUS` from `partial` to `official`.
7. Record the first successful setup/login timestamp.
8. Redirect to the protected dashboard.

The backend must perform the status change. Never change `partial` to `official` based only on a frontend callback.

## Resend Invitation

Provide two controlled paths:

- A pending user can request a resend from the setup page.
- An active Super Admin can resend from Account Management.

For both paths:

1. Rate-limit requests by IP, account, and authenticated requester.
2. Invalidate or supersede the old invitation.
3. Use a short expiry.
4. Never return the invitation URL or token to the browser.
5. Never log the token or URL.
6. Return a generic response that does not reveal whether an email exists.
7. Record an audit event without the token.

## Super Admin Password Reset

Do not build a public Forgot Password button for Super Admins in the application.

For an administrator-generated reset:

1. An active Super Admin selects another active Super Admin.
2. The backend verifies the requester and target.
3. The backend rejects self-reset through this endpoint.
4. The backend asks Supabase Auth to generate a short-lived recovery link.
5. Send the link through the trusted configured email service; do not return it to the frontend.
6. The recipient sets a new password on the recovery page.
7. Revoke existing sessions for the target account after successful reset where supported.
8. Keep the target account status unchanged unless the reset is also completing an invitation.
9. Record who initiated the reset and when, without storing the link or token.

If there is no other active Super Admin, use the documented Supabase administrator recovery procedure. Do not add an unauthenticated emergency reset endpoint.

## Frontend Work Order

After the backend flow is protected:

1. Replace the current prototype login handler with Supabase Auth sign-in.
2. Keep the Supabase public client key only in frontend configuration; never use the service-role key.
3. Send the access token as a bearer token through the shared API helper.
4. Handle `401` by clearing the local session and returning to login.
5. Show Account Management only to an authenticated Super Admin.
6. Treat backend `403` responses as authoritative even when the UI appears to allow an action.
7. Do not place invitation or recovery tokens in application state, analytics, logs, or URLs after the Auth SDK has consumed them.
8. Do not show whether an arbitrary email is already registered.

## Audit Events

Record at least:

- Super Admin account invited
- Invitation resent
- Invitation setup completed
- Administrator reset requested
- Password setup completed
- Account deactivated
- Account reactivated
- Role changed
- Assignment changed
- Privileged action denied

Store actor, target, action, timestamp, and safe metadata. Do not store passwords, JWTs, invitation tokens, recovery links, or raw request bodies.

## Required Security Tests

Before calling the feature complete, test:

- No token receives `401`.
- Invalid or expired token receives `401`.
- Mall Admin or Store Admin cannot access Super Admin account routes.
- Deactivated Super Admin cannot access protected routes.
- A Super Admin cannot reset their own password through the admin-reset endpoint.
- A user cannot complete setup for another Auth user.
- Duplicate email and duplicate `AUTH_USER_ID` are handled safely.
- `mall_admin` and `store_admin` cannot be created through the first-release endpoint.
- Client-supplied role, status, `MALL_ID`, and `STORE_ID` cannot escalate privileges.
- An account cannot be assigned both a mall and a store when the role rules forbid it.
- Invitation resend is rate-limited.
- Passwords, tokens, links, and service keys never appear in API responses or logs.
- Raw database errors are not returned to clients.
- Existing sessions are denied after deactivation or reset according to the session-revocation policy.

## Definition of Done for the First Release

The Super Admin Account Management release is ready only when:

- `ADMIN.AUTH_USER_ID` links every active admin to `auth.users`.
- Application code no longer uses `ADMIN_PASSWORD_HASH`.
- The first Super Admin was bootstrapped through a controlled process.
- All account endpoints require a valid Supabase token and active Super Admin role.
- Only `super_admin` creation is available in the UI.
- Invitation, setup, resend, and administrator-reset flows are server-authorized.
- Status changes happen on the backend.
- Rate limits, validation, generic errors, and audit logging are present.
- Security tests cover authentication, authorization, IDOR, replay, and sensitive-data leakage.
- The remaining Mall Admin and Store Admin work is explicitly deferred rather than partially exposed.
