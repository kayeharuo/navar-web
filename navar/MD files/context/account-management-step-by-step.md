# NavAR Account Management: Step-by-Step Setup

This guide is for the first release only:

- Only `super_admin` accounts can be created in the interface.
- `mall_admin` and `store_admin` are prepared in the schema but are not available in the UI yet.
- `ADMIN_PASSWORD_HASH` is not used for new accounts.
- Supabase Auth owns passwords, invitations, sessions, JWTs, and recovery tokens.
- The `ADMIN` table owns role, status, profile, and scope.

Do not skip the authentication and backend authorization steps. Running the SQL alone does not secure the current API.

## Part 0: Make a Backup

1. Open [supabase.com](https://supabase.com/).
2. Sign in and open the correct organization and project.
3. Before changing the database, create a backup according to your Supabase plan, or export the current schema/data if your plan does not provide backups.
4. Confirm that you know which project is development and which project is production. Do not test this on production first.

## Part 1: Run the New SQL Migration

Do not edit `01_navar_schema.sql`. The new migration is:

`navar/navar-backend/database_schema/04_account_management_auth_preparation.sql`

Run it only after `01_navar_schema.sql` has been applied.

1. In the Supabase Dashboard, select the development project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Open `04_account_management_auth_preparation.sql` in VS Code.
5. Copy the entire file into the SQL Editor.
6. Click **Run**.
7. Confirm the result shows success and no SQL error.
8. If it fails, stop. Do not rerun random parts of the script or edit `01_navar_schema.sql`.

### Verify the Migration

Open another SQL Editor query and run:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'admin'
ORDER BY ordinal_position;
```

You should see:

- `auth_user_id` with type `uuid`
- `store_id` with type `integer`
- `admin_password_hash` still present but nullable during transition

Then run:

```sql
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'admin'
ORDER BY constraint_name;
```

You should see the Auth, role, status, scope, mall, and store constraints.

Do not run the commented cleanup statements at the bottom of the migration yet. They are only for after the backend has fully moved to Supabase Auth.

## Part 2: Configure Supabase Auth

The exact labels can change slightly in the Supabase Dashboard. Stop if a setting is unclear rather than enabling a less secure alternative.

### Enable Email Authentication

1. In the project Dashboard, click **Authentication**.
2. Open **Providers** or **Sign In / Providers**.
3. Open the **Email** provider.
4. Enable email sign-in.
5. Keep email confirmation enabled for invited users.
6. Save the provider settings.

Do not disable email confirmation just to make local testing easier. If you need local testing, use a separate development project.

### Configure URLs

1. Under **Authentication**, open **URL Configuration**.
2. Set the development **Site URL** to the actual frontend URL, normally `http://localhost:5173`.
3. Add only the exact redirect URLs that the application will implement, for example:

```text
http://localhost:5173/auth/callback
http://localhost:5173/auth/set-password
```

4. Do not add `*`, arbitrary domains, or untrusted preview URLs.
5. Later, add the production HTTPS URLs separately.
6. Save the settings.

Do not use `/auth/callback` or `/auth/set-password` until those routes exist in the frontend. A redirect URL is not a password reset implementation by itself.

### Configure Email Delivery

For development, Supabase's built-in email service may be enough but can be rate-limited. For a real deployment:

1. In Supabase Dashboard, open **Project Settings**.
2. Open **Authentication** or **SMTP Settings**.
3. Configure a trusted SMTP/Postmark sender.
4. Use a verified sending domain.
5. Do not put SMTP credentials in the frontend or commit them to the repository.
6. Send a test email to a controlled development address.

## Part 3: Prepare the First Super Admin

Do not create the first Super Admin through the current public backend. The current backend has no authentication middleware yet.

Use a controlled development bootstrap:

1. In Supabase Dashboard, click **Authentication**.
2. Open **Users**.
3. Click **Add user** or **Create user**.
4. Create the first Super Admin with the real email address of the person who will own the system.
5. Use the dashboard's invitation option if available. If the dashboard requires a password, generate a unique temporary password and deliver it privately; never put it in source code, chat, or logs.
6. Do not create a fake shared account.
7. Copy the created user's UUID from the Users table. The UUID is safe to store as a database foreign key, but do not copy any token or recovery link.

After the Auth user exists, insert the application profile in the SQL Editor:

```sql
INSERT INTO public.admin (
    auth_user_id,
    admin_role,
    admin_email,
    admin_full_name,
    admin_password_hash,
    admin_is_primary,
    admin_is_deactivated,
    admin_created_at,
    admin_updated_at,
    mall_id,
    store_id,
    admin_account_status
)
VALUES (
    'PASTE_AUTH_USER_UUID_HERE',
    'super_admin',
    'owner@example.com',
    'System Owner',
    NULL,
    TRUE,
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    'official'
);
```

Before running it:

- Replace the UUID, email, name, and timestamps with real values.
- Confirm the UUID belongs to the intended Auth user.
- Do not paste a password, access token, invitation token, or recovery URL.
- Run this only once.

Then verify:

```sql
SELECT admin_id, auth_user_id, admin_role, admin_email,
       admin_is_deactivated, admin_account_status
FROM public.admin
WHERE admin_role = 'super_admin';
```

## Part 4: Change the Backend Before Testing the UI

The current backend must be changed before it is exposed to any network other than local development.

### 4.1 Add token verification

In `server.js`, add server-side verification for:

```text
Authorization: Bearer <Supabase access token>
```

The middleware must:

1. Reject a missing token with `401`.
2. Ask Supabase Auth to verify the token.
3. Find the matching `ADMIN` row using `AUTH_USER_ID`.
4. Reject missing, deactivated, or incomplete admin profiles.
5. Attach a minimal identity object to the request.

### 4.2 Add Super Admin authorization

Create a separate authorization check that requires:

- `ADMIN_ROLE = 'super_admin'`
- `ADMIN_IS_DEACTIVATED = false`
- A valid linked `AUTH_USER_ID`

Do not accept role or account status from the request body.

### 4.3 Protect existing routes

Protect all administrative routes, including the current mall, brand, beacon, battery, and unit routes. Leave only a minimal health check public.

Do not rely on CORS or a hidden frontend route. A user must be denied by the backend even if they manually call an API URL.

## Part 5: Implement Super Admin Account Creation

Create a separate backend module for Account Management. Do not put it inside `mallManagement/routes.js`.

The first endpoint should be:

```text
POST /api/admin-accounts
```

The server must:

1. Verify the caller's Supabase token.
2. Verify the caller is an active Super Admin.
3. Accept only `super_admin` as the new role.
4. Validate email, name, and allowed profile fields.
5. Reject client-provided `auth_user_id`, status, password hash, `mall_id`, or `store_id`.
6. Create the invited Auth user using the backend-only Supabase Admin API.
7. Insert the matching `ADMIN` profile with the returned Auth UUID.
8. Set status to `partial`.
9. Set `mall_id` and `store_id` to `NULL`.
10. Return only safe profile data.
11. Compensate if the Auth user is created but the profile insert fails.

The service-role key may be used only in the backend environment for this server-side operation. Never send it to React.

## Part 6: Implement Invitation Setup

Create a frontend route such as `/auth/set-password`.

When the invited user opens the email link:

1. Supabase establishes the invitation session.
2. The page confirms that a valid session exists.
3. The user enters and confirms a strong password.
4. The frontend calls Supabase Auth to update the password.
5. The frontend calls a protected completion endpoint.
6. The backend verifies the session user matches the target Auth UUID.
7. The backend changes `admin_account_status` from `partial` to `official`.
8. The backend records the first login/setup timestamp.
9. The user is redirected to the protected dashboard.

Never change status based only on a React state value or URL query parameter.

## Part 7: Implement Resend Invitation

Add:

```text
POST /api/admin-accounts/:id/resend-invite
```

Requirements:

1. Only an active Super Admin can use the administrative resend action.
2. The pending user may have a separate generic self-resend action.
3. Rate-limit by IP, target account, and requester.
4. Supersede the previous invitation.
5. Never return the email link or token to React.
6. Never log the link or token.
7. Return a generic response that does not reveal whether an email exists.

## Part 8: Implement Super Admin-Generated Reset

Do not add a public Forgot Password button for Super Admins.

Add:

```text
POST /api/admin-accounts/:id/admin-reset
```

The backend must:

1. Require an active Super Admin caller.
2. Reject a caller resetting their own account through this endpoint.
3. Confirm the target is another active Super Admin.
4. Generate a short-lived Supabase recovery link server-side.
5. Send it through the trusted email provider.
6. Never return the link to the browser.
7. Revoke old sessions after the password is changed where supported.
8. Record the actor, target, and timestamp without recording the token.

If there is no other active Super Admin, use the controlled Supabase administrator recovery process. Do not create an unauthenticated emergency reset endpoint.

## Part 9: Replace the Prototype Login

Only after the backend is protected:

1. Open the frontend login page.
2. Replace the current `onLogin()` placeholder with Supabase Auth sign-in.
3. Keep only the Supabase public/anon key in frontend configuration.
4. Never use the service-role key in any `VITE_*` variable.
5. Update the shared API helper to send the current access token as a bearer token.
6. On `401`, clear the session and return to login.
7. Treat backend `403` responses as authoritative.

## Part 10: Security Testing Checklist

Before calling this complete, test each item:

- Request without a token returns `401`.
- Invalid or expired token returns `401`.
- Mall Admin or Store Admin cannot access Super Admin endpoints.
- Deactivated Super Admin cannot access protected endpoints.
- A Super Admin cannot reset their own password through the admin-reset route.
- A user cannot complete setup for another user.
- `mall_admin` and `store_admin` cannot be created by the first-release endpoint.
- Client-supplied role, status, mall, and store IDs cannot escalate access.
- Duplicate email is handled without leaking account existence.
- Invitation resend is rate-limited.
- Passwords, tokens, invitation links, and service keys never appear in responses or logs.
- Raw database errors are not sent to the client.
- Deactivation prevents future API access.

## Part 11: Final Database Cleanup

Only after the application no longer reads or writes `ADMIN_PASSWORD_HASH` and every admin has an `AUTH_USER_ID`:

1. Run a query to confirm no active admin has `AUTH_USER_ID IS NULL`.
2. Make `AUTH_USER_ID` not nullable.
3. Drop `ADMIN_PASSWORD_HASH`.
4. Review `APP_USER.USER_PWHASH` separately before changing it.
5. Take another backup before cleanup.

Use the commented statements at the bottom of `04_account_management_auth_preparation.sql` only at this stage.

## Important Stop Conditions

Stop and ask for review if:

- The SQL migration fails.
- The Auth user and `ADMIN` profile do not match.
- The service-role key appears in frontend code.
- A route is accessible without a token.
- A client can choose its own role or account status.
- A recovery or invitation token appears in logs, API responses, analytics, or screenshots.
- The only Super Admin loses access and there is no documented recovery administrator.
