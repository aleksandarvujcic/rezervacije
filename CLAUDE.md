# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Rezervacije" — internal restaurant reservation management system. Canvas-based floor plan as primary UI, Serbian (latinica) language. For staff use only (3-5 concurrent users).

## Build & Run Commands

### Prerequisites
- Node.js 18+, PostgreSQL 16 (or Docker)
- `docker-compose up db` to start PostgreSQL

### Server (from /server)
- `npm run dev` — start dev server (tsx watch, port 3001)
- `npm run build` — compile TypeScript
- `npm run migrate` — run database migrations
- `npm run migrate:down` — rollback last migration
- `npm run seed` — seed database with sample data

### Client (from /client)
- `npm run dev` — start Vite dev server (port 5173, proxies /api to :3001)
- `npm run build` — production build

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

## Architecture

Monorepo: `server/` (Fastify + PostgreSQL) and `client/` (React + Vite + Mantine + react-konva).

### Server
- **Framework**: Fastify 5 with TypeScript, ESM modules
- **DB**: PostgreSQL via raw SQL (node-postgres), parameterized queries
- **Auth**: JWT (access 15m + refresh 7d), bcrypt passwords
- **Real-time**: SSE via EventBus (EventEmitter on fastify instance)
- **Modules**: auth, users, zones, tables, floor-plans, reservations, working-hours, events
- **Route pattern**: Each module exports `async function(fastify, opts)`, registered under /api prefix

### Client
- **UI**: Mantine 7 components, all text in Serbian (latinica)
- **Canvas**: react-konva for floor plan viewer/editor
- **State**: Zustand (UI state) + TanStack Query (server state)
- **Routing**: react-router-dom v7

### Key conventions
- Status values: nova, potvrdjena, seated, zavrsena, otkazana, no_show, waitlist, odlozena
- Reservation types: standard, celebration, walkin
- User roles: owner, manager, waiter
- Imports use .js extensions in server (ESM)
- Floor plan + Timeline Grid are the PRIMARY interfaces (FloorPlanPage with view toggle)
- `client/src/config/statusConfig.ts` — single source of truth for status colors, labels, transitions
- Timeline Grid: CSS Grid approach (not canvas), rows=tables grouped by zone, columns=30-min time slots
- QuickAvailabilityPanel: right panel on FloorPlan view when no table is selected
- SSE invalidates timeline queries alongside reservations and availability
