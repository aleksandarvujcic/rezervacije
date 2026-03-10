# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Rezervacije" — internal restaurant reservation management system. Canvas-based floor plan as primary UI, Serbian (latinica) language. For staff use only (3-5 concurrent users). Deployed on Railway.

## Build & Run Commands

### Prerequisites
- Node.js 18+, PostgreSQL 16 (or Docker)
- `docker-compose up db` to start PostgreSQL

### Server (from /server)
- `npm run dev` — start dev server (tsx watch, port 3001)
- `npm run build` — compile TypeScript
- `npm run migrate` — run database migrations (001-005)
- `npm run migrate:down` — rollback last migration
- `npm run seed` — seed database with sample data

### Client (from /client)
- `npm run dev` — start Vite dev server (port 5173, proxies /api to :3001)
- `npm run build` — production build

### Full Build (from root)
- `npm run build` — builds client (Vite) then server (tsc)
- `npm start` — runs production server (serves client static files + API)

### Testing
- `cd server && npx tsc --noEmit` — server type check
- `cd client && npx tsc --noEmit` — client type check
- `npm run build` — full production build (root)
- `npx playwright test` — E2E browser tests (requires running server on :5174)

### Full Setup
```bash
docker-compose up db -d
cd server && npm install && npm run migrate && npm run seed
cd ../client && npm install
# Terminal 1: cd server && npm run dev
# Terminal 2: cd client && npm run dev
```

### Seed Credentials
- admin / admin123 (owner)
- menadzer / admin123 (manager)
- konobar1 / admin123 (waiter)

### Railway Deployment
- Build: `npm run build` (root)
- Start: `npm start`
- Required env vars: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV=production, PORT, CORS_ORIGIN

## Architecture

Monorepo: `server/` (Fastify + PostgreSQL) and `client/` (React + Vite + Mantine + react-konva).

### Server
- **Framework**: Fastify 5 with TypeScript, ESM modules
- **DB**: PostgreSQL via raw SQL (node-postgres), parameterized queries, SERIALIZABLE isolation
- **Auth**: JWT (access 15m + refresh 7d), bcrypt passwords (min 8 chars)
- **Permissions**: role_permissions table enforced server-side via middleware/permissions.ts
- **Real-time**: SSE via EventBus (EventEmitter on fastify instance)
- **Audit**: Every reservation mutation logged to audit_log table (utils/auditLog.ts)
- **Rate limiting**: Global 100 req/min + login 5 req/min
- **Static files**: @fastify/static serves client dist in production (wildcard: true)
- **Modules**: auth, users, zones, tables, floor-plans, reservations, working-hours, events, availability, permissions
- **Route pattern**: Each module exports `async function(fastify, opts)`, registered under /api prefix

### Client
- **UI**: Mantine 7 components, all text in Serbian (latinica)
- **Canvas**: react-konva for floor plan viewer/editor
- **State**: Zustand (UI state) + TanStack Query (server state)
- **Routing**: react-router-dom v7
- **Error handling**: Error Boundary in App.tsx prevents total crash

### Key conventions
- Status values: nova, potvrdjena, seated, zavrsena, otkazana, no_show, waitlist, odlozena
- Reservation types: standard, celebration, walkin
- User roles: owner, manager, waiter
- Imports use .js extensions in server (ESM)
- Floor plan + Timeline Grid are the PRIMARY interfaces (FloorPlanPage with view toggle)
- `client/src/config/statusConfig.ts` — single source of truth for status colors, labels, transitions
- Timeline Grid: CSS Grid approach (not canvas), rows=tables grouped by zone, columns=30-min time slots
- Mobile timeline: fixed header/column layout (table col + time header outside scroll area, only grid body scrolls horizontally)
- AppLayout accepts `mobileHeaderCenter` prop for page-specific header content on mobile
- `server/src/utils/overlapCheck.ts` — single source of truth for table availability checks
- `server/src/middleware/permissions.ts` — server-side permission enforcement (requirePermission, hasPermission)
- SSE invalidates timeline queries alongside reservations and availability

### Migrations
- 001_initial.sql — core schema (users, zones, tables, reservations, audit_log, working_hours)
- 002_unique_table_number.sql — (zone_id, table_number) unique constraint
- 003_table_cascade_delete.sql — reservation_tables.table_id ON DELETE CASCADE
- 004_role_permissions.sql — role_permissions table + seed data
- 005_availability_index.sql — partial composite index for overlap queries
