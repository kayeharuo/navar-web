# NavAR Account Management: Step-by-Step Guide (v2)

Replaces `account-management-step-by-step.md` (the original is untouched; delete or archive it once you trust this one).
Written for: **Super Admin accounts only**. Mall Admin and Store Admin come later.
Assumes: `ADMIN` and `APP_USER` tables are **empty**, and nothing has been run in Supabase yet.
Read `CONTEXT.md` (Mandatory Security Rules) first. This guide follows it.

---

## How to read this guide

Every step is tagged with **where** you do it:

| Tag | Meaning |
|---|---|
| **[SUPABASE]** | In the Supabase website (supabase.com/dashboard), in your browser |
| **[VS CODE]** | In your editor (files, integrated terminal, Copilot) |
| **[TERMINAL]** | A command you type in the VS Code terminal |
| **[BROWSER]** | Testing the running NavAR web app in your browser |

Each step says what to **do**, what you should **see**, and what to do **if not**.

**Dashboard labels change.** Supabase renames and moves menu items fairly often. If a label below does not match exactly, look for the closest one. Tell Copilot or me the exact label you see and we will adjust.

**Windows note:** in PowerShell, `curl` is an alias for something else. Always type `curl.exe`.

---

## Part 0: What changed, decisions, and safety rules

### 0.1 What is different from the first guide

- `ADMIN_PASSWORD_HASH` and `USER_PWHASH` are **dropped** (tables are empty, so there is nothing to migrate).
- The Auth link columns are **`ADMIN.ADMIN_AUTH_USER_ID`** and **`APP_USER.USER_AUTH_USER_ID`** (UUID, NOT NULL, unique, FK to `auth.users(id)`).
- Emails are stored **lowercase** in the database. The backend must lowercase every email before saving or looking it up.
- Email is **read-only after an account is created** (see Part 7).
- One new SQL file, `05_lock_down_public_schema.sql`, turns on Row Level Security everywhere. It must run before any frontend uses a Supabase key.
- There is no "final cleanup" phase any more. Everything is in `04`.

### 0.2 Open decisions (defaults are pre-selected so you can keep going)

| # | Decision | Default in this guide | Where it matters |
|---|---|---|---|
| 1 | Does the **mobile app query Supabase tables directly**? | **No.** All data goes through the backend. | Part 2 (05 blocks direct access) |
| 2 | Protected logo images (`<img>` tags cannot send a login token) | Fetch logos through the API as blobs (Part 7.9) | Part 6 and 7 |
| 3 | `AUDIT_LOG.MALL_ID` is NOT NULL, so Super Admin events cannot be logged | Make it nullable in a new `06` file (Part 9) | Part 9 |
| 4 | Where the web session is stored | Supabase default (browser localStorage), accepted for now | Part 7.2 |

If your answer to #1 is "yes, the mobile app reads tables directly", **stop before Part 2.5** and tell me. Some tables will need explicit RLS policies first.

### 0.3 Safety rules for the whole guide

1. Use a **development** Supabase project only.
2. The **secret key** (or legacy `service_role` key) goes only in `navar-backend/.env`. Never in the frontend, never in a `VITE_` variable, never in a screenshot or chat.
3. Access tokens, invite/recovery links, and passwords are never pasted into chats, issues, or logs.
4. `.env` files must not be committed or zipped and shared. (The project zip you uploaded contained `navar-backend/.env`. If it holds real keys, rotate them in Supabase after this guide: Settings, API Keys.)
5. If any step fails, **stop**. Do not re-run random parts of a script.

---

## Part 1: Supabase project and where things are

### 1.1 Open your project

1. **[SUPABASE]** Go to https://supabase.com/dashboard and sign in.
2. Click your **development project**. (Create one with **New project** if you do not have it. Pick a strong database password and save it in a password manager. You will not need it in this guide.)
3. You should now see the project home with a **left sidebar**. The items you will use:
   - **SQL Editor**
   - **Table Editor**
   - **Authentication**
   - **Advisors** (sometimes under Database)
   - **Project Settings** (gear icon at the bottom of the sidebar)

### 1.2 Note the project URL

1. **[SUPABASE]** Click **Connect** at the top of the dashboard (or open **Project Settings**, then **Data API**).
2. Copy the **Project URL**. It looks like `https://abcdefghijklmno.supabase.co`.
3. Keep it handy. The letters before `.supabase.co` are your **project ref**.

---

## Part 2: Run the SQL files in order

Files live in `navar/navar-backend/database_schema/`:

`01_navar_schema.sql`, then `02_mall_management_grants.sql`, then `03_beacon_floor_and_codes_migration.sql`, then `04_account_management_auth_preparation.sql`, then `05_lock_down_public_schema.sql`.

### 2.1 Check what already exists

1. **[SUPABASE]** Left sidebar, **SQL Editor**, then **New query** (the **+** button).
2. Paste and run:

```sql
SELECT count(*) AS tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

3. To run: click **Run** (bottom right) or press **Ctrl+Enter**.
4. **You should see:** `0` if nothing is applied yet, or `55` if `01` was already applied.
   - `0`: continue from 2.2.
   - `55`: skip 2.2, but check whether 02 and 03 were applied (ask me if unsure).
   - Any other number: stop and ask.

### 2.2 Run 01, 02, 03

For **each** file, in order:

1. **[VS CODE]** Open the file. Press **Ctrl+A**, then **Ctrl+C**.
2. **[SUPABASE]** SQL Editor, **New query**, click in the editor, **Ctrl+V**.
3. Click **Run**.
4. **You should see:** "Success. No rows returned" (or a success message). If Supabase asks about tables without RLS, choose **Run without RLS** for these three files. `05` will enable RLS on everything in one go.
5. **If you see a red error:** stop. Copy the error text (it contains no secrets) and ask for help. Do not edit `01`.

### 2.3 Run 04

1. **[VS CODE]** Open `04_account_management_auth_preparation.sql`, **Ctrl+A**, **Ctrl+C**.
2. **[SUPABASE]** SQL Editor, **New query**, paste, **Run**.
3. Supabase may show a confirmation about a **destructive operation** (the file drops two columns). This is expected. Click **Run this query**.
4. **You should see:** success.
5. **If you see** `ADMIN table is not empty` or `APP_USER table is not empty`: the safety guard stopped it. Nothing was changed. Do not force it; ask me.
6. **If you see** `relation "admin" does not exist`: `01` was not applied. Go back to 2.2.

### 2.4 Verify 04

Run each query in a new SQL Editor query.

**Admin columns:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin'
ORDER BY ordinal_position;
```

You should see **16 rows**, including `admin_auth_user_id` with `uuid` and `NO`, and `store_id` with `integer` and `YES`. There must be **no** `admin_password_hash`.

**App user columns:**

```sql
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'app_user'
ORDER BY ordinal_position;
```

You should see **10 rows**, including `user_auth_user_id` with `uuid` and `NO`, and `user_email` with length `100`. There must be **no** `user_pwhash`.

**Constraints:**

```sql
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint
WHERE conrelid IN ('public.admin'::regclass, 'public.app_user'::regclass)
ORDER BY 1, 2;
```

You should see (among others): `ck_admin_role`, `ck_admin_account_status`, `ck_admin_scope`, `ck_admin_deactivation_consistent`, `ck_admin_email_lowercase`, `uq_admin_auth_user_id`, `fk_admin_auth_user_id`, `uq_app_user_auth_user_id`, `fk_app_user_auth_user_id`, `ck_app_user_email_lowercase`.

**Case-insensitive email indexes:**

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('ux_admin_email_case_insensitive', 'ux_app_user_email_case_insensitive');
```

You should see both names.

### 2.5 Run 05 (lock down direct access)

> Only continue if decision #1 in Part 0.2 is "No, the mobile app does not read tables directly." Otherwise stop.

1. **[VS CODE]** Read the comment block at the top of `05_lock_down_public_schema.sql`. This is a permissions change, so `CONTEXT.md` requires you to understand its effect first: after it runs, only the backend (secret/service_role key) can reach your tables.
2. Copy the whole file, **[SUPABASE]** paste in a new query, **Run**.
3. **You should see:** success.

### 2.6 Verify 05

**RLS is on for every table:**

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

Every row must say `true` (55 rows).

**Public roles have no table access:**

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
LIMIT 20;
```

You should see **no rows**.

**Security Advisor:**

1. **[SUPABASE]** Sidebar, **Advisors** (or **Database**, then **Advisors**), tab **Security Advisor**, click **Refresh** if offered.
2. **You should see:** no "RLS disabled in public" errors. You will likely see informational notes like "RLS enabled, no policy". That is expected. It means deny-by-default.

---

## Part 3: Configure Supabase Auth

### 3.1 Email sign-in

1. **[SUPABASE]** Sidebar, **Authentication**, then **Sign In / Providers** (older dashboards: **Providers**).
2. Click **Email**.
3. Make sure:
   - **Enable Email provider** is ON.
   - **Confirm email** is ON.
   - Minimum password length is **12** or more (the field may be called "Minimum password length").
   - If offered, require a mix of lowercase, uppercase, digits, and symbols.
4. Click **Save**.

### 3.2 User signups

On the same **Sign In / Providers** page, find **Allow new users to sign up**.

- Leave it **ON**. Mobile users create their own accounts, and Supabase has one global switch for this.
- Consequence: **anyone can create a login**. That is fine because login does not equal access. Admin access exists only if the backend finds an active `ADMIN` row (Part 6). This is why that check is critical.

### 3.3 URL Configuration (where email links may send people)

1. **[SUPABASE]** Sidebar, **Authentication**, then **URL Configuration**.
2. **Site URL:** `http://localhost:5173`  (Vite's default port. Check the terminal when you run `npm run dev` in the frontend to confirm.)
3. **Redirect URLs:** click **Add URL** and add these two, exactly:
   - `http://localhost:5173/auth/set-password`
   - `http://localhost:5173/auth/reset-password`
4. Click **Save**.
5. Rules: no wildcards (`*`, `**`), and no production URLs until you deploy (add those later, with `https://`).

### 3.4 Email templates

1. **[SUPABASE]** Sidebar, **Authentication**, then **Emails** (the **Templates** tab; older dashboards: **Email Templates**).
2. Open **Invite user**. Confirm the body contains `{{ .ConfirmationURL }}`. Do not remove it. Edit only the wording. Suggested text:
   - Subject: `You have been invited to NavAR`
   - Body: a short line saying an administrator created an account for them and they must click the button to set a password. Do not include a password, the person's role, or other personal details.
3. Open **Reset password**. Same rule: keep `{{ .ConfirmationURL }}`. Suggested subject: `Reset your NavAR password`.
4. Save each template.

### 3.5 Email delivery limits (this is the most common reason testing stalls)

Supabase's built-in email sender is meant for trying things out. It has a **very low hourly limit**, and it may only deliver to addresses that belong to members of your Supabase organization. If invites to other addresses never arrive, that is why.

For testing, you can:

- Use your own email address and a second address you control (use a plus-address like `you+admin2@gmail.com`; remember emails must be stored **lowercase**), or
- Set up **custom SMTP**:
  1. **[SUPABASE]** **Authentication**, then **Emails**, tab **SMTP Settings** (or **Project Settings**, then **Authentication**, **SMTP Settings**).
  2. Turn on **Enable custom SMTP**.
  3. Fill **Host**, **Port** (587 or 465), **Username**, **Password**, **Sender email**, **Sender name** from an email provider (for example Resend, Brevo, SendGrid). Free-tier rules and domain-verification requirements differ per provider and change, so check the provider's current rules first.
  4. **Save**, then send yourself a test invite (Part 5).

### 3.6 Leave these on defaults for now, revisit later

- **Authentication, Rate Limits:** keep defaults.
- **Authentication, Attack Protection:** CAPTCHA and leaked-password protection (leaked-password protection may need a paid plan). Worth enabling before public launch, especially for mobile self-signup.
- **Authentication, Multi-Factor:** strongly recommended for Super Admins later (Part 11).

---

## Part 4: API keys and environment files

### 4.1 Copy your keys

1. **[SUPABASE]** **Project Settings** (gear icon), then **API Keys**.
2. Two tabs may exist:
   - **Publishable and secret API keys** (newer). Publishable = `sb_publishable_...` (safe in the browser). Secret = `sb_secret_...` (backend only).
   - **Legacy API Keys**: `anon` (browser) and `service_role` (backend). These still work but are being phased out by the end of 2026.
3. If you only see legacy keys and there is a **Create new API keys** button, click it. It adds the new keys next to the old ones without breaking anything.
4. Copy the **publishable** key and the **secret** key into a password manager first, not a chat.

### 4.2 Backend environment

1. **[VS CODE]** Open `navar-backend/.env`.
2. Set (replace values; keep the variable names):

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
FRONTEND_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5173
```

   If you are still on legacy keys, you may use `SUPABASE_SERVICE_ROLE_KEY` for the secret and `SUPABASE_ANON_KEY` for the publishable value. Tell Copilot which names you chose.
3. **Never** wrap these in quotes with trailing spaces, and never commit the file.

### 4.3 Frontend environment

1. **[VS CODE]** Create `navar-frontend/.env`:

```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

2. Rule: **only** the publishable key goes here. Vite exposes every `VITE_` variable to the browser. The secret key must never have a `VITE_` name.

### 4.4 Confirm `.env` is ignored by git

**[TERMINAL]** From the `navar` folder:

```
git check-ignore -v navar-backend/.env navar-frontend/.env
```

You should see a line for each file naming the ignore rule. If a file prints nothing, it is **not** ignored: add `.env` to `.gitignore` before committing anything.

---

## Part 5: Create the first Super Admin (manual bootstrap)

This is the only account created by hand. Everything after this goes through the invite flow.

### 5.1 Create the login in Supabase Auth

1. **[SUPABASE]** Sidebar, **Authentication**, then **Users**.
2. Click **Add user** (top right), then **Create new user**.
3. Fill:
   - **Email:** your real address, **all lowercase**.
   - **Password:** generate 16+ characters in a password manager. Do not reuse one.
   - **Auto Confirm User:** tick it. (The normal invite needs the set-password page, which you have not built yet.)
4. Click **Create user**.
5. **You should see:** the user in the list with the email you entered.

### 5.2 Copy the user's UID

1. **[SUPABASE]** Click the user's row. A side panel opens.
2. Copy the **User UID** (a 36-character value like `123e4567-e89b-12d3-a456-426614174000`).

### 5.3 Create the matching `ADMIN` profile

1. **[SUPABASE]** SQL Editor, **New query**. Paste this, replacing the three placeholders (email in lowercase, your name, the UID):

```sql
INSERT INTO public.admin (
    admin_role, admin_email, admin_full_name, admin_contact_num, admin_job_title,
    admin_is_primary, admin_is_deactivated, admin_deactivated_on, admin_last_login,
    admin_created_at, admin_updated_at, mall_id, store_id, admin_account_status,
    admin_auth_user_id
) VALUES (
    'super_admin', 'YOUR-EMAIL-LOWERCASE', 'YOUR FULL NAME', NULL, 'System Administrator',
    FALSE, FALSE, NULL, NULL,
    NOW(), NOW(), NULL, NULL, 'official',
    'PASTE-THE-UID-HERE'
);
```

2. Click **Run** once.
3. **You should see:** success (1 row affected).
4. **If you see** a foreign key error mentioning `fk_admin_auth_user_id`: the UID is wrong. Recopy it.
5. **If you see** a check constraint error mentioning `ck_admin_email_lowercase`: use lowercase.

### 5.4 Verify the link

```sql
SELECT a.admin_id, a.admin_role, a.admin_account_status,
       a.admin_email, u.email AS auth_email
FROM public.admin a
JOIN auth.users u ON u.id = a.admin_auth_user_id;
```

You should see exactly **one row**: role `super_admin`, status `official`, and the two emails identical.

---

## Part 6: Backend changes (VS CODE)

Goal: no API route works without a valid login **and** an active `ADMIN` row with the right role.

> For each step you can give Copilot the prompt shown. Start every prompt with:
> *"Read MD files/context/CONTEXT.md and follow the Mandatory Security Rules. Do not weaken any security check."*

### 6.1 Fix `server.js` basics

Two things in the current `server.js` are unsafe.

1. **Line 14** falls back to the anon key if the secret key is missing:
   `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY`.
   A silent fallback to a weaker key hides mistakes. Change it to **fail closed**: require `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) and stop the server with a clear error if it is missing. No fallback.
2. **`/api/health`** queries a `users` table that does not exist and can leak database status. Keep `/health` (returns `{ status: 'ok' }`) public and minimal, and remove the database probe from public routes.

Create the backend client with options that stop it storing sessions:

```js
const supabase = createClient(process.env.SUPABASE_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
```

Never call `signInWithPassword` on this client. Signing a user in on it would change the client's identity for every later request.

### 6.2 Install two security packages

**[TERMINAL]** In `navar-backend`:

```
npm install @fastify/helmet @fastify/rate-limit
npm audit
```

Review anything `npm audit` reports before continuing.

### 6.3 Create the auth guard

**[VS CODE]** Create `navar-backend/modules/auth/authGuard.js`. The core logic (you or Copilot fill in the rest):

```js
'use strict'

function tokenUsedPassword(token) {
  // Only call this AFTER getUser(token) succeeded, so the token is already verified.
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return Array.isArray(payload.amr) && payload.amr.some(a => a.method === 'password')
  } catch {
    return false
  }
}

function createAuthGuards(supabase) {
  function requireAuth({ allowPartial = false } = {}) {
    return async function (request, reply) {
      const header = request.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
      if (!token || token.length > 4096) {
        return reply.code(401).send({ message: 'Authentication required.' })
      }

      // Ask Supabase Auth to verify the token. Do not trust it by decoding it yourself.
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) {
        return reply.code(401).send({ message: 'Authentication required.' })
      }

      // A valid login is NOT admin access. Require an active ADMIN row.
      const { data: admin, error: adminError } = await supabase
        .from('admin')
        .select('admin_id, admin_role, admin_email, admin_full_name, admin_account_status, admin_is_deactivated, mall_id, store_id')
        .eq('admin_auth_user_id', data.user.id)
        .maybeSingle()

      if (adminError) {
        request.log.error({ code: adminError.code }, 'admin lookup failed')
        return reply.code(500).send({ message: 'Something went wrong.' })
      }
      if (!admin || admin.admin_is_deactivated || admin.admin_account_status === 'deactivated') {
        return reply.code(403).send({ message: 'Access denied.' })
      }
      if (admin.admin_account_status !== 'official' && !allowPartial) {
        return reply.code(403).send({ message: 'Access denied.' })
      }

      request.admin = {
        id: admin.admin_id,
        role: admin.admin_role,
        email: admin.admin_email,
        name: admin.admin_full_name,
        status: admin.admin_account_status,
        mallId: admin.mall_id,
        storeId: admin.store_id,
        authUserId: data.user.id,
        usedPassword: tokenUsedPassword(token),
      }
    }
  }

  async function requireSuperAdmin(request, reply) {
    if (request.admin?.role !== 'super_admin') {
      return reply.code(403).send({ message: 'Access denied.' })
    }
  }

  return { requireAuth, requireSuperAdmin }
}

module.exports = createAuthGuards
```

Rules this enforces:

- The role is read from the **`ADMIN` table**, never from the token's `user_metadata` (users can edit that themselves) and never from the request body.
- Mobile users and any other Supabase login get **403** on admin routes because they have no `ADMIN` row.
- Never put the raw token on `request` or in logs.

### 6.4 Protect the existing routes

In `server.js`, replace `registerMallManagementRoutes(app)` with:

```js
const createAuthGuards = require('./modules/auth/authGuard')
const { requireAuth, requireSuperAdmin } = createAuthGuards(supabase)

app.register(async (protectedApp) => {
  protectedApp.addHook('preHandler', requireAuth())
  protectedApp.addHook('preHandler', requireSuperAdmin)
  registerMallManagementRoutes(protectedApp)
})
```

For now every existing route (`/api/malls...`, `/api/brands...`) requires an active **super_admin**, because that is the only role that exists. When Mall Admin is built, each route must additionally check that the mall in `:id` belongs to the requester (see `CONTEXT.md`, IDOR rule).

**Side effect to plan for:** `/api/malls/:id/logo` and `/api/brands/:id/logo` are loaded with `<img src=...>` tags. Browsers do not send a login token with image tags, so these will return 401 once protected. Part 7.9 fixes this without making them public. (Alternative, only with your explicit approval and a written reason: leave the two logo GET routes public. Logo IDs are guessable, so this is the weaker option.)

### 6.5 Add security headers, rate limiting, and safe errors

Prompt for Copilot:

> Register @fastify/helmet and @fastify/rate-limit in navar-backend/server.js. Global limit 100 requests per minute per IP. Add a setErrorHandler that logs the real error server-side (no tokens, no request bodies) and returns only `{ message: 'Something went wrong.' }` with the right status. Set a body size limit. Keep CORS restricted to FRONTEND_ORIGIN. Do not expose stack traces or database messages to clients.

Also change existing route handlers that send `error.message` from the database to the client (for example in `routes.js`, `reply.code(...).send({ message: error.message })`) so they send a generic message and log the detail instead. Do this route by route with Copilot; it is a long list.

### 6.6 Create the account endpoints

Create `navar-backend/modules/accountManagement/routes.js`. All routes require `requireAuth()` + `requireSuperAdmin` unless marked.

| Route | Purpose |
|---|---|
| `GET /api/admin-accounts` | List admin accounts (super admins only for now). Return only fields the UI needs. |
| `POST /api/admin-accounts` | Create a Super Admin and send the invite. |
| `PATCH /api/admin-accounts/:id` | Edit **name, job title, contact number** only. Never email, role, status, mall, store, or auth id. |
| `POST /api/admin-accounts/:id/resend-invite` | Resend the invite to a `partial` account. |
| `POST /api/admin-accounts/:id/reset-password` | Send a password-reset email to another Super Admin. |
| `POST /api/admin-accounts/:id/deactivate` | Deactivate an account. |
| `POST /api/auth/login-complete` | Uses `requireAuth({ allowPartial: true })` only. Marks first login and updates last login. |
| `GET /api/auth/me` | Returns the caller's own name and role for the UI. |

**Create (POST /api/admin-accounts), in this exact order:**

1. Guards pass (active super admin).
2. Validate the body with a Fastify JSON schema: `additionalProperties: false`, email format and max 100, name max 100, job title max 100, contact max 20. **Reject** `role`, `status`, `mall_id`, `store_id`, `auth_user_id` if a client sends them. The role is decided by the server (`super_admin` for now). If the UI sends `mall-admin`, return 400 "Not available yet."
3. Lowercase and trim the email.
4. Check `admin` has no row with that email. If it does, return a generic error ("This account cannot be created.").
5. Call `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: APP_BASE_URL + '/auth/set-password' })`. Do **not** pass `data` containing roles or profile info. This creates the Auth user and sends the invite email. This call is also how you **resend** an invite.
6. Insert the `admin` row: `admin_role='super_admin'`, `admin_account_status='partial'`, `admin_is_deactivated=false`, `mall_id` and `store_id` NULL, `admin_auth_user_id` = the id returned in step 5, `admin_is_primary=false`, timestamps now.
7. **If step 6 fails**, call `supabase.auth.admin.deleteUser(thatId)` so you do not leave a login with no profile. Log the error server-side, return a generic error.
8. Write an audit event (Part 9).
9. Return only `{ id, name, email, status: 'pending' }`. Never return links, tokens, or the auth id.

**Resend:** target must be `partial`. Rate limit tightly (for example 1 per minute and 5 per hour per target; for per-user keys configure the rate limiter to run in `preHandler`). Call `inviteUserByEmail` again. Return a generic success. Never return the link.

**Reset password:**

- The target must be an `official` Super Admin.
- The caller **cannot** be the target. (A Super Admin who forgot their own password must ask another Super Admin.)
- Send the email with `resetPasswordForEmail(target.email, { redirectTo: APP_BASE_URL + '/auth/reset-password' })` using a **second** Supabase client made with the **publishable** key (same no-session options as above). The email always goes to the address on file, never to the caller. Return a generic success. Never return the link.

**Deactivate:**

- Caller cannot deactivate themselves.
- Refuse if the target is the **last active Super Admin**.
- Update `admin_account_status='deactivated'`, `admin_is_deactivated=true`, `admin_deactivated_on=now()` (these two fields must always change together; the database rejects mismatches).
- Also block login at the Auth level: `supabase.auth.admin.updateUserById(authUserId, { ban_duration: '876000h' })`.
- Existing token access is already stopped by the guard, because it rejects deactivated admins.

**login-complete:**

- Uses `requireAuth({ allowPartial: true })`.
- If status is `partial`: only continue if `request.admin.usedPassword` is true (the token came from a password login, not from the invite link). Then set status to `official`. Use `.eq('admin_account_status', 'partial')` in the update so it cannot run twice.
- Always set `admin_last_login` to now.
- Return `{ id, name, role, status }`.

Prompt for Copilot (one route at a time is safer than all at once):

> Implement POST /api/admin-accounts in navar-backend/modules/accountManagement/routes.js exactly as steps 1-9 in MD files/context/account-management-step-by-step-v2.md Part 6.6. Use a Fastify JSON schema with additionalProperties false. Roll back the Auth user if the ADMIN insert fails. Never return tokens or links.

### 6.7 Restart and smoke-test the backend

1. **[TERMINAL]** In `navar-backend`: `npm run dev`.
2. In a second terminal: `curl.exe -i http://localhost:3000/api/malls`
3. **You should see:** `HTTP/1.1 401` with `Authentication required.` If you get data, a route is unprotected. Stop and fix.

---

## Part 7: Frontend changes (VS CODE)

Today `App.jsx` decides you are logged in from `localStorage.getItem('navar_logged_in') === 'true'`. Anyone can type that into the browser console. It must be replaced by a real Supabase session.

### 7.1 Install the Supabase client

**[TERMINAL]** In `navar-frontend`:

```
npm install @supabase/supabase-js
```

### 7.2 Create the client

Create `navar-frontend/src/config/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
```

Notes:

- Do **not** set `flowType: 'pkce'` on this client. Invite and recovery links sent from the backend arrive with the tokens in the URL, and (as far as I know) the client rejects that format when PKCE is forced. Leave the default.
- By default the session is kept in browser storage. That is an accepted risk for now (decision #4). It makes XSS prevention important (helmet on the backend, no unsafe HTML in React). Moving to HttpOnly cookies is a later hardening step.

### 7.3 Make API calls carry the login token

In `navar-frontend/src/config/api.js`, `apiRequest` must:

1. Get the session: `const { data } = await supabase.auth.getSession()`.
2. Add `Authorization: Bearer ${data.session.access_token}` when a session exists.
3. **Fix the header merge.** Right now `...options` comes after `headers`, so passing `options.headers` **replaces** the whole headers object. Build the merged headers first, then spread `options` before it:
   `{ ...options, headers: { 'Content-Type': 'application/json', ...(options.headers||{}), Authorization } }`.
4. If the API returns 401, sign the user out and show the login page.

### 7.4 Replace the fake login gate in `App.jsx`

1. Remove the `navar_logged_in` localStorage logic completely (also run `localStorage.removeItem('navar_logged_in')` once).
2. On load, call `supabase.auth.getSession()` and subscribe with `supabase.auth.onAuthStateChange`.
3. After a session exists, call `POST /api/auth/login-complete`, then `GET /api/auth/me`.
4. If the API says 403 (no admin profile, deactivated, or wrong role), call `supabase.auth.signOut()` and show "You do not have access to this system."
5. Show the main layout only when a session exists **and** `/api/auth/me` says the role is `super_admin`.
6. Logout button calls `supabase.auth.signOut()`.

Important: `App.jsx` currently returns `<LoginPage>` whenever you are not logged in, **before** it reaches the router. The set-password page (7.6) must be reachable while logged out, so the two `/auth/...` routes must be handled **before** that check.

### 7.5 Real login page

`LoginPage.jsx` currently calls `onLogin()` without checking anything. Change it to:

- Field label "Email address" (login is by email, not username).
- `supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })`.
- On any failure show one generic message: "Invalid email or password." Do not say whether the email exists.
- Disable the button while loading. Do not log the password or the response.

### 7.6 Set-password and reset-password pages

Create routes `/auth/set-password` (invited users) and `/auth/reset-password` (reset). They can share one component with different wording. Behavior:

1. On mount, wait for Supabase to read the link (`onAuthStateChange` fires `SIGNED_IN` or `PASSWORD_RECOVERY`). If no session appears within a few seconds, show: "This link is invalid or expired. Ask a Super Admin to send a new one."
2. Immediately clear the token from the address bar: `window.history.replaceState({}, '', window.location.pathname)`.
3. Show two fields: new password and confirm password. Require 12+ characters and both fields equal.
4. On submit: `await supabase.auth.updateUser({ password })`.
5. Then **always** `await supabase.auth.signOut({ scope: 'global' })`. This ends every session for that account, including any old ones. This is how "reset password revokes old sessions" is achieved.
6. Redirect to the login page with the message "Password saved. Please sign in."
7. Never log the password, the URL, or the session.

The status changes from `partial` to `official` on the **next** step: the user's first password login, which calls `login-complete` (Part 6.6).

### 7.7 Account Management page

`AccountManagement.jsx` currently shows mock arrays (`INIT_SUPER_ADMINS`, etc.). Replace with API calls.

- **Map values.** Database `super_admin` = UI `super-admin`; `partial` = `pending`; `official` = `active`; `deactivated` = deactivated list.
- **Mall Admin tab:** disable it with "Coming soon".
- **Email field:** editable only on create. In edit mode it is read-only. If an address is wrong, deactivate and invite again.
- Replace the text "A magic link will be sent to the email upon creation." with "An invitation email will be sent. The recipient must set a password before signing in."
- Buttons: **Resend invite** (only when pending), **Reset password** (only for active super admins other than yourself), **Deactivate** (not on yourself). Ask for confirmation before Reset and Deactivate.
- Show simple messages: "Invitation sent", "Reset email sent". Never display a link or token.
- The UI hides options as a convenience only. The backend enforces every rule.

### 7.8 Sign out on 401 and 403

Whenever an API call returns 401, sign out and go to login. When it returns 403 on a page load, show a plain "Access denied" screen.

### 7.9 Logo images with protected routes

Because `<img src>` cannot carry a token, add a small helper (for example `AuthImage`) that:

1. Calls the logo endpoint through `apiRequest` with the token, asking for a blob.
2. Turns it into an object URL: `URL.createObjectURL(blob)`.
3. Puts that URL in the `<img>`. Revoke the URL when the component unmounts.

Use it wherever logos come from `/api/malls/:id/logo` or `/api/brands/:id/logo` (for example `getLogoUrl` in `AddStoreModal.jsx`).

---

## Part 8: Test plan

Do all of these before calling Account Management done. Tokens expire (about an hour) and are as sensitive as passwords: never paste them into a chat, ticket, or screenshot.

### 8.1 Attack tests

**Test A: API without a login**

1. **[TERMINAL]** `curl.exe -i http://localhost:3000/api/malls`
2. Expected: **401**.

**Test B: database directly with the publishable key** (this proves `05` worked)

1. **[TERMINAL]**
   `curl.exe -i "https://YOUR-PROJECT-REF.supabase.co/rest/v1/admin?select=*" -H "apikey: YOUR_PUBLISHABLE_KEY"`
2. Expected: a **permission denied** error (often code `42501`), or an empty result. It must **never** list admin rows.
3. Repeat with `.../rest/v1/app_user?select=*`.

**Test C: a normal (non-admin) login must not get admin access** (this proves the shared login pool is safe)

1. **[SUPABASE]** **Authentication, Users, Add user, Create new user**. Email `test-user@example.com`, a throwaway password, tick **Auto Confirm User**. Do **not** create an `ADMIN` row for it.
2. **[TERMINAL]** Get its token:
   `curl.exe -s -X POST "https://YOUR-PROJECT-REF.supabase.co/auth/v1/token?grant_type=password" -H "apikey: YOUR_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d "{\"email\":\"test-user@example.com\",\"password\":\"THE_THROWAWAY_PASSWORD\"}"`
3. Copy the `access_token` value from the response.
4. `curl.exe -i http://localhost:3000/api/malls -H "Authorization: Bearer PASTE_TOKEN"`
5. Expected: **403**.
6. **Clean up:** **[SUPABASE]** Authentication, Users, delete `test-user@example.com`.

**Test D: role cannot be chosen by the client**

In the browser DevTools (F12), Network tab, resend a create request with `"role":"mall_admin"` or `"admin_account_status":"official"` in the body. Expected: 400, and no such row in the database.

**Test E: rate limiting**

Click **Resend invite** more than the allowed number of times. Expected: **429**.

**Test F: errors are generic**

Send malformed JSON or an oversized body. Expected: a short generic message. No stack trace, no database error text.

### 8.2 Happy-path tests (needs a second email you control)

1. **[BROWSER]** Log in with your bootstrap Super Admin. Expected: dashboard loads, logos still display.
2. Open **Account Management**, click create, keep **Super Admin**, enter your second email (lowercase), a name, and save.
3. Expected: the new account appears as **Pending**.
4. **[SUPABASE]** Run:
   ```sql
   SELECT admin_email, admin_role, admin_account_status, admin_last_login
   FROM public.admin ORDER BY admin_id;
   ```
   Expected: the new row has status `partial`, `admin_last_login` NULL.
5. Check the second inbox (and spam). Click the button in the invitation.
6. Expected: your app opens at `/auth/set-password`, shows the password form, and the address bar has no token in it.
7. Set a 12+ character password. Expected: redirected to login with "Password saved."
8. Log in as the new Super Admin. Expected: dashboard loads.
9. Back in the first account's **Account Management**: the new account shows **Active**. The SQL query above should now show `official` and a last-login time.
10. Tamper test: while logged out, open `/auth/set-password` directly. Expected: "invalid or expired" message.

### 8.3 Resend, reset, and deactivate

1. **Resend:** create a third account, do **not** click its link, click **Resend invite**. Expected: a new email arrives, and the new link works.
2. **Reset:** from Super Admin A, click **Reset password** on Super Admin B. Expected: B receives a reset email; the link opens `/auth/reset-password`; after B sets a password, B is signed out everywhere and must log in again. Then confirm A's own row has **no** Reset button, and the endpoint returns an error if you call it on yourself.
3. **Deactivate:** deactivate B. Expected: B cannot log in, and an existing B session gets 403. Then try to deactivate the last active Super Admin. Expected: refused.

### 8.4 Inspect a token once (one-time check for the first-login rule)

`login-complete` relies on the login token recording that a **password** was used. Verify this once:

1. **[BROWSER]** Log in, open DevTools Console (F12), and run:
   `JSON.parse(atob((await (await import('/src/config/supabase.js')).supabase.auth.getSession()).data.session.access_token.split('.')[1]))`
2. Look for `amr`: it should contain an entry with `method: 'password'`.
3. If it does not, tell me the exact `amr` value you see. The first-login promotion needs a different check. Do not delete the check; it is what prevents someone promoting an account by using only the invite link.

### 8.5 Final checklist

- [ ] `curl.exe` to `/api/malls` with no token returns 401
- [ ] Direct REST calls to `admin` and `app_user` with the publishable key return no rows
- [ ] A test login with no `ADMIN` row gets 403 on admin routes
- [ ] Client-supplied role, status, or ids are rejected
- [ ] Created accounts start as `partial` and become `official` only after their first password login
- [ ] Resend, reset, and deactivate all work, and self-reset and last-Super-Admin deactivation are refused
- [ ] No link, token, or password appears in any API response, browser console, or backend log
- [ ] `.env` files are not tracked by git
- [ ] The frontend contains only the publishable key

---

## Part 9: Audit logging (a decision is needed first)

The database already has `AUDIT_LOG` (module, action, details, performed-at, performed-by, `MALL_ID`). Problem: **`MALL_ID` is NOT NULL** and has a foreign key to `MALL`. Super Admin account actions belong to no mall, so they cannot be recorded as-is.

Options:

- **A (recommended):** make `AUDIT_LOG.MALL_ID` nullable in a new `06_audit_log_allow_system_events.sql` (I have not created this file; ask me and I will write it, and update your data dictionary notes with it). Store `ADMIN_ID` of the actor in `AUDIT_LOG_PERFORMED_BY`.
- **B (temporary):** log Account Management events only in the backend server log until you decide.

Events worth recording: account created, invite resent, password reset requested, first login completed, account deactivated, failed privileged attempt.

Never record: passwords, tokens, invite or recovery links, or raw request bodies.

---

## Part 10: Common problems

| What you see | Likely cause | Fix |
|---|---|---|
| Invite email never arrives | Built-in email limit or restriction to team members' addresses | Check spam and **Authentication, Logs**; use your own address; set up custom SMTP (3.5) |
| Link says "expired" or invalid the moment you click | An email security scanner opened the one-time link before you | Resend and click quickly, or use a personal mailbox. A more robust template is listed in Part 11 |
| After clicking the link you land on the Site URL, or get a "redirect not allowed" message | The redirect URL is not in **Authentication, URL Configuration** exactly | Add the exact URL (3.3), including the path, no wildcard |
| `User already registered` / `email_exists` | That email already has a login | **Users**: if it is a test login, delete the `ADMIN` row first, then the Auth user (FK restrict blocks the reverse order) |
| `violates foreign key constraint "fk_admin_auth_user_id"` | The UID does not match an Auth user | Recopy the User UID from **Authentication, Users** |
| `violates check constraint "ck_admin_email_lowercase"` | Uppercase in the email | Lowercase it before saving |
| `violates check constraint "ck_admin_deactivation_consistent"` | Status and `admin_is_deactivated` disagree | Update both together |
| Backend says `permission denied for table ...` | It is using the publishable/anon key, or `02` was not run | Use the secret key; re-check `02` |
| Every API call returns 401 in the browser | Token not attached, or session expired | Check `apiRequest` (7.3); sign in again |
| CORS error in the browser | `FRONTEND_ORIGIN` does not match the page origin | Set it to `http://localhost:5173` (no trailing slash) and restart the backend |
| Logos disappear after protecting routes | `<img>` cannot send the token | Use the blob loader (7.9) |
| Cannot delete an Auth user | An `ADMIN` or `APP_USER` row still references it | Delete or deactivate the profile row first |

---

## Part 11: Emergency recovery and later hardening

### If the only Super Admin loses access

Super Admins have no self-service "forgot password". Recovery paths, in order:

1. Another active Super Admin uses **Reset password** on their account (Part 6.6). **Create at least two Super Admins early** so this is always possible.
2. If none is available: **[SUPABASE]** **Authentication, Users**, open the user, and use the user's menu action **Send password recovery** (wording may vary). Do this yourself, as the project owner, and record it in your notes.

### Later hardening (not needed to finish this guide)

- **Multi-factor authentication for Super Admins** (Authentication, Multi-Factor).
- **CAPTCHA and leaked-password protection** (Authentication, Attack Protection) before mobile signup is public.
- **More robust invite/reset email links:** point the templates at your own page with the token hash and a confirm button, so email scanners cannot consume the one-time link.
- **Custom SMTP on your own domain** with SPF/DKIM.
- **HttpOnly cookie sessions** instead of browser storage.
- **Mall Admin:** assign malls, enforce mall ownership on every `/api/malls/:id/...` route, and add a trigger so a Store Admin's `MALL_ID` matches their store's mall.
- **Mobile app:** if it ever queries tables directly, write explicit per-table RLS policies and matching grants. Keep everything else denied.
- **Key rotation** after any suspicion that a key was exposed (Project Settings, API Keys).
