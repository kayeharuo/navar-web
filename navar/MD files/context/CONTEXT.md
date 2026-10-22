# NavAR — Project Context

## What This System Is

NavAR is an **AR-based indoor mall navigation SaaS platform**, built as a capstone project by a 4-person team. It helps mall visitors navigate indoor spaces using augmented reality, while giving mall operators and tenants tools to manage their presence on the platform.

The platform serves multiple user types:
- **Super Admin** — platform-wide management
- **Mall Admin** — manages a specific mall's data, beacons, tenants, tickets
- **Tenant** — manages their own store presence
- **Marketing** — public-facing marketing interface

## System Architecture

### High-Level Components
1. **Web platform** — admin dashboards for Super Admin, Mall Admin, Tenant, and a public marketing site
2. **Mobile AR app** — Unity/ARCore app used by mall visitors for in-app navigation
3. **BLE beacon network** — physical beacons installed in malls for indoor positioning

### Positioning Pipeline
The indoor positioning system processes beacon signals through this pipeline:

```
RSSI → SMA (Simple Moving Average) → LDPLM → WCL (Weighted Centroid Localization) → Node Snapping → A* Pathfinding
```

Algorithm choices and their justification (for panel defense):
- **SMA over Kalman Filter** — chosen for simplicity and defensibility at capstone scope
- **WCL over trilateration/fingerprinting** — chosen over alternatives for the same reason

### Beacon/Node Model
- Beacons use iBeacon UUID/Major/Minor schema
- A beacon holds a **nullable `node_id` FK with a unique constraint** (resolves beacon-node relationship without circular FKs)
- **Nodes are versioned through `node.ar_development_id`, alongside edges, beacon assignments and floor calibration**
- `FLOOR_CALIBRATION` is a separate version-specific table
- Stall nodes use predefined slots with add-on fees for extras

## Tech Stack

### Backend
- **Node.js + Fastify** — chosen over Express for speed, built-in validation, and easier WebSocket/real-time support
- **JavaScript** (not TypeScript) — team is more comfortable in plain JS
- **Raw SQL via Supabase client** — team has strong SQL background; parameterized queries via Supabase's JS client provide injection protection without needing an ORM layer. (Prisma was evaluated as an alternative — easy to learn on top of existing SQL knowledge, good for schema versioning/migrations — but the team is going with raw SQL for full query control.)

> **Architecture note:** The project previously used a **decoupled Laravel (backend) + React (frontend)** setup, reflected in the existing `frontend/` and `backend/` folder split. This has been replaced — the backend is being rebuilt in **JavaScript/Node.js** instead of Laravel. The folder structure (separate frontend/backend) stays the same; only the backend's language/framework changes.

### Frontend
- **React** with **Tailwind CSS**
- Plain CSS files (not Tailwind utility classes) due to Vite plugin compatibility issues
- **Poppins** for UI text, **Fira Mono** for numeric values
- Responsive design: fixed-column tables on desktop, card views with prev/next navigation on mobile, sidebar becomes a drawer on smaller screens
- Action errors must appear in a modal matching existing dialogs, with proper padding and readable font sizes. Do not render error messages inline in the page. Use button loading indicators while approval and revision requests are pending.

### Database & Backend Services
- **Supabase / PostgreSQL** — primary database, auth, and real-time features
- **Supabase Realtime** — used for live dashboard updates (ticket status changes, analytics) without polling
- **Supabase Auth** — JWT-based auth with Row-Level Security (RLS) policies enforcing role boundaries (Super Admin sees all, Mall Admin sees only their mall, Tenant sees only their store)

### Third-Party Services
- **PayMongo** — billing, using a wallet-based B2B model (replacing manual offline payments)
- **Postmark** — transactional email
- **Unity/ARCore** — mobile AR app

### Auth
- Magic link authentication
- Wallet-based onboarding flow

## Mandatory Security Rules

These rules apply to every implementation, bug fix, refactor, database change, and feature request. Security decisions must be made before adding functionality.

### Current Account Status

- Account Management and real authentication are not implemented yet.
- The current login screen must be treated as a UI prototype, not as security. It must not be described or treated as authenticated access.
- Until authentication and authorization are implemented, the backend is suitable only for local or tightly controlled development. Do not present it as production-ready.
- Do not add temporary authentication bypasses, hardcoded users, shared passwords, client-only route guards, or hidden demo credentials.

### Authentication and Authorization

- Use Supabase Auth for identity and JWTs when Account Management is implemented. Do not create a parallel password system unless explicitly approved.
- Every protected backend route must verify the bearer token on the server. Frontend route protection is only a usability feature and never a security boundary.
- Enforce authorization server-side for every operation: role permissions and resource ownership must be checked before reading or changing data.
- Enforce mall and store scope from the authenticated user, not from IDs supplied by the client. Prevent IDOR by checking access to every `:id` resource.
- Use Supabase Row-Level Security policies as defense in depth. Never rely on RLS alone when the backend uses a service-role key, because service-role access bypasses RLS.
- Never expose the Supabase service-role key, database credentials, or any secret in frontend code, source control, logs, screenshots, or API responses.
- Store secrets only in environment variables or the approved secret manager. Keep `.env` files out of version control.

### Input, Output, and Data Protection

- Validate and constrain every request body, query parameter, path parameter, file, date, number, enum, and array at the backend boundary.
- Use parameterized Supabase queries or structured query APIs. Never construct SQL, filters, file paths, or shell commands by concatenating untrusted input.
- Enforce request-size, upload-size, pagination, and timeout limits. Treat uploaded logos, images, CSV files, and similar content as untrusted.
- Return generic client-facing errors. Log detailed database and internal errors only on the server, without tokens, passwords, personal data, or raw request bodies.
- Minimize returned data. Do not expose password hashes, service data, internal IDs, secrets, or fields the requesting role does not need.
- Protect state-changing browser requests against CSRF when cookie-based sessions are introduced. Use secure, HttpOnly, appropriately scoped cookies and avoid storing sensitive tokens in unsafe browser storage.

### API and Deployment Hardening

- Keep health checks minimal and do not expose database details, environment values, stack traces, or dependency information publicly.
- Allow only explicitly configured frontend origins. CORS is not authentication and must never be used as an authorization mechanism.
- Require HTTPS outside local development. Add security headers, rate limiting, request timeouts, and abuse monitoring before public deployment.
- Keep dependencies current, review new packages, and run audits when dependencies change. Do not add an ORM or security package without understanding its configuration and trust boundaries.
- Use least-privilege database credentials. Prefer an authenticated user-scoped client where possible; isolate service-role operations and protect them with explicit backend authorization checks.
- Do not make destructive database changes, permission changes, or RLS changes without reviewing their effect on existing roles and data access.

### Required Workflow for Every Change

1. Identify the data, endpoint, user role, and trust boundary affected by the request.
2. State the security assumption and the cheapest test that could disprove it before editing.
3. Implement validation and authorization at the owning backend or database boundary, not only in the UI.
4. Test unauthenticated access, unauthorized roles, cross-mall or cross-store access, malformed input, oversized input, and error responses where relevant.
5. Check that no secret, sensitive data, or raw internal error was added to the client, repository, or logs.
6. Run focused tests, linting, type or syntax checks, and dependency checks when applicable. Report any remaining security gap instead of silently accepting it.

When a request conflicts with these rules, pause and explain the risk before making the change. Security requirements may be relaxed only with explicit user approval and a documented reason.

## Business Model

### Subscription Tiers
- **Basic / Standard / Premium** tiers
- One-time **Onboarding & AR Dev Fee**, separate from annual subscription fees
- **GFA-based sizing** (Gross Floor Area) determines tier fit
- Beacon ownership model with per-node infrastructure costs **decoupled** from software subscription tiers
- Yearly billing cycles
- Ticket-driven maintenance system for beacon/node issues

## Database

- Data dictionary covers **40+ tables**
- Design resolved circular foreign keys, beacon-node relationship modeling, and edge-based AR versioning
- Preference for **clean, normalized designs** with explicit justification required for any denormalization

## Competitive Landscape (for capstone defense)

Comparative analysis conducted against:
- Gotu AR
- aryve Guide
- NAVIAR.IO
- Vera by Resonai
- ARway

## Documentation on Hand

- Capstone defense scripts
- Business Model Canvas
- Use case diagrams (Super Admin, Mall Admin actors)
- Software specification tables
- Data dictionary (40+ tables)
- ERD

## Development Environment

- Windows-based dev setup
- Resolved: PowerShell execution policy issues, pcntl extension, shadcn path alias config

## Recent Feature Work

- Ticket management page
- Analytics dashboard — CSV export, date filtering, multiple chart tabs
- Dashboard page and Mall Management page — fixed-column tables, responsive card views, collapsible sidebar/drawer
