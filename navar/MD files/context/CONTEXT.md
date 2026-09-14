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
- **AR development versioning is tied to edges, not nodes**
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
