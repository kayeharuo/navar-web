# Web and mobile account separation

Migration: `navar/navar-backend/database_schema/51_separate_web_and_mobile_profiles.sql`.
Applied to NavAR on 23 November 2026.

Supabase Auth remains the shared sign-in identity store. Creating an Auth user
does not create an `app_user` profile. Super Admin, Mall Admin and Store Admin
profiles belong in `admin`; the separate tenant portal keeps its existing
`tenant_account` records. Both types of web accounts are excluded from `app_user`.

The database checks inserts and identity/email changes in both directions,
including service-role writes. An existing mobile identity cannot also become a
web admin or tenant; use a separate email/account. Concurrent profile creation
locks the Auth identity while checking for a conflicting profile. Client-supplied
platform or role metadata does not decide account ownership.

## Mobile integration

After signup and sign-in, the mobile app must explicitly register:

```js
const { data: userId, error } = await supabase.rpc('register_app_user', {
  p_name: name,
  p_gender: gender || null,
  p_dob: dateOfBirth || null,
})
```

The existing authenticated direct-insert flow also remains available for a user's
own identity with `user_role = 'user'`. Auth signup alone no longer
creates a mobile profile. A mobile client relying on automatic creation must add
the registration call. Email confirmation is not required (migration 52). The mobile source is maintained outside this repository.

Client updates are limited to name, gender, date of birth and last login, for
the caller's own profile. Clients cannot change profile ownership, email or role.

## Cleanup and verification

Archived and removed 13 unique accidental mobile profiles linked to 11 admin
accounts and 3 tenant accounts (one identity overlaps). All had no dependent
mobile history/preferences/notifications. Original profiles are retained in
`app_private.web_profile_cleanup_archive`, accessible only to database owners.
Auth identities and web profiles were preserved; 8 other mobile profiles remain.
The migration aborts if any cleanup candidate has dependent records, even if its
foreign key would normally cascade or clear the reference.

Tests: `test/account-profile-separation.test.cjs` and
`test/live-account-profile-separation.sql`. Live verification runs inside a
rolled-back transaction and creates no permanent test accounts.
