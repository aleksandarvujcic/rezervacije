# Rezervacije — Detaljna Dokumentacija

Interni sistem za upravljanje rezervacijama restorana. Canvas floor plan, timeline grid, CRUD rezervacija, status workflow, role-based pristup. Srpski jezik (latinica). Deploy na Railway.

---

## Sadržaj

1. [Pregled arhitekture](#1-pregled-arhitekture)
2. [Baza podataka](#2-baza-podataka)
3. [Server — API referenca](#3-server--api-referenca)
4. [Autentifikacija i autorizacija](#4-autentifikacija-i-autorizacija)
5. [Status workflow](#5-status-workflow)
6. [Klijent — stranice i komponente](#6-klijent--stranice-i-komponente)
7. [Real-time (SSE)](#7-real-time-sse)
8. [Pokretanje i razvoj](#8-pokretanje-i-razvoj)
9. [Deploy (Railway)](#9-deploy-railway)
10. [Konvencije i pravila](#10-konvencije-i-pravila)

---

## 1. Pregled arhitekture

```
rezervacije/
├── client/             React 18 + Vite 6 + Mantine 7 + react-konva
│   └── src/
│       ├── api/        HTTP klijent, endpointi, tipovi
│       ├── components/ UI komponente (admin, floor-plan, layout, reservations, timeline)
│       ├── config/     statusConfig.ts (boje, labele, tranzicije)
│       ├── hooks/      React Query hookovi + useSSE
│       ├── pages/      LoginPage, FloorPlanPage, ReservationsPage, AdminPage
│       └── stores/     Zustand (authStore, uiStore)
├── server/             Fastify 5 + TypeScript + PostgreSQL (raw SQL)
│   └── src/
│       ├── config/     Env varijable, validacija
│       ├── db/         Pool, migracije (001-005)
│       ├── middleware/  auth.ts, permissions.ts
│       ├── modules/    Rute po domenu (10 modula)
│       └── utils/      time, statusTransitions, overlapCheck, auditLog, errors
├── scripts/            seed.ts
├── tests/              Playwright E2E
├── docker-compose.yml  PostgreSQL 16, server, client
└── package.json        Root build/start skripte
```

### Tehnologije

| Sloj | Tehnologija |
|------|------------|
| Server | Fastify 5, TypeScript, ESM, node-postgres (raw SQL) |
| Baza | PostgreSQL 16 |
| Klijent | React 18, Vite 6, Mantine 7, react-konva, Zustand, TanStack Query v5 |
| Auth | JWT (access 15min + refresh 7 dana), bcrypt |
| Real-time | Server-Sent Events (SSE) |
| Deploy | Railway (single service) |

---

## 2. Baza podataka

### Šema

#### `users`
| Kolona | Tip | Opis |
|--------|-----|------|
| id | SERIAL PK | |
| username | VARCHAR(50) UNIQUE | Login korisničko ime |
| password_hash | VARCHAR(255) | bcrypt hash |
| display_name | VARCHAR(100) | Prikazano ime |
| role | VARCHAR(20) | `owner`, `manager`, `waiter` |
| is_active | BOOLEAN | Deaktivirani korisnici ne mogu da se loguju |

#### `zones`
| Kolona | Tip | Opis |
|--------|-----|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | Npr. "Glavna sala", "Bašta" |
| is_active | BOOLEAN | Neaktivne zone se ne prikazuju |
| is_seasonal | BOOLEAN | Da li je sezonska zona |
| season_start / season_end | DATE | Period sezone (ako is_seasonal=true) |
| sort_order | INTEGER | Redosled prikaza |

#### `tables`
| Kolona | Tip | Opis |
|--------|-----|------|
| id | SERIAL PK | |
| zone_id | FK → zones | |
| table_number | VARCHAR(20) | Broj stola (UNIQUE per zone) |
| capacity | INTEGER | Broj mesta |
| shape | VARCHAR(20) | `rectangle`, `circle`, `square` |
| pos_x, pos_y, width, height, rotation | REAL | Pozicija na canvas-u |
| is_active | BOOLEAN | |

#### `reservations`
| Kolona | Tip | Opis |
|--------|-----|------|
| id | SERIAL PK | |
| reservation_type | VARCHAR(20) | `standard`, `celebration`, `walkin` |
| status | VARCHAR(20) | Jedan od 8 statusa (videti sekciju 5) |
| guest_name | VARCHAR(200) | Ime gosta |
| guest_phone | VARCHAR(50) | Telefon (opcionalno) |
| guest_count | INTEGER | Broj gostiju |
| date | DATE | Datum rezervacije |
| start_time / end_time | TIME | Vreme početka i kraja |
| duration_minutes | INTEGER | Trajanje (15-480 min) |
| notes | TEXT | Beleške |
| celebration_details | TEXT | Detalji proslave (za celebration tip) |
| created_by / updated_by | FK → users | Ko je kreirao/izmenio |

#### `reservation_tables` (M:N)
| Kolona | Tip | Opis |
|--------|-----|------|
| reservation_id | FK → reservations | ON DELETE CASCADE |
| table_id | FK → tables | ON DELETE CASCADE |

#### `floor_plans` (1:1 sa zones)
| Kolona | Tip | Opis |
|--------|-----|------|
| zone_id | FK → zones UNIQUE | |
| canvas_width / canvas_height | INTEGER | Dimenzije canvasa |

#### `working_hours`
| Kolona | Tip | Opis |
|--------|-----|------|
| day_of_week | INTEGER (0-6) UNIQUE | 0=nedelja, 6=subota |
| open_time / close_time | TIME | Radno vreme |
| is_closed | BOOLEAN | Zatvoreno tog dana |

#### `role_permissions`
| Kolona | Tip | Opis |
|--------|-----|------|
| role | VARCHAR(20) | `owner`, `manager`, `waiter` |
| permission | VARCHAR(50) | Ime dozvole |
| allowed | BOOLEAN | Da li je dozvoljena |

#### `audit_log`
| Kolona | Tip | Opis |
|--------|-----|------|
| user_id | FK → users | Ko je izvršio akciju |
| action | VARCHAR(50) | `create`, `update`, `delete`, `status_change`, `transfer_table` |
| entity_type | VARCHAR(50) | `reservation` |
| entity_id | INTEGER | ID entiteta |
| details | JSONB | Detalji promene |

### Migracije

| # | Fajl | Opis |
|---|------|------|
| 001 | `001_initial.sql` | Kompletna šema + indexi |
| 002 | `002_unique_table_number.sql` | UNIQUE(zone_id, table_number) |
| 003 | `003_table_cascade_delete.sql` | reservation_tables ON DELETE CASCADE |
| 004 | `004_role_permissions.sql` | role_permissions tabela + seed |
| 005 | `005_availability_index.sql` | Parcijalni indeks za overlap upite |

### Indexi
- `idx_reservations_date_status` — (date, status)
- `idx_reservation_tables_table_id` — (table_id)
- `idx_reservations_status` — (status)
- `idx_tables_zone_id` — (zone_id)
- `idx_audit_log_entity` — (entity_type, entity_id)
- `idx_reservations_date_time_range` — parcijalni: (date, start_time, end_time) WHERE status NOT IN ('otkazana', 'no_show', 'zavrsena')

---

## 3. Server — API referenca

Svi endpointi su pod `/api` prefiksom. Svi zahtevaju JWT autentifikaciju osim login i refresh.

### Auth (`/api/auth`)

| Metod | Putanja | Opis | Auth |
|-------|---------|------|------|
| POST | `/auth/login` | Prijava (username + password) | Ne |
| POST | `/auth/refresh` | Refresh tokena | Ne |
| GET | `/auth/me` | Trenutni korisnik | Da |

**POST /auth/login**
```json
// Request
{ "username": "admin", "password": "admin123" }
// Response 200
{ "accessToken": "...", "refreshToken": "...", "user": { "id": 1, "username": "admin", "display_name": "Admin", "role": "owner" } }
```

**POST /auth/refresh**
```json
// Request
{ "refreshToken": "..." }
// Response 200
{ "accessToken": "..." }
```

### Reservations (`/api/reservations`)

| Metod | Putanja | Opis | Dozvola |
|-------|---------|------|---------|
| GET | `/reservations` | Lista (filter: date, status, zone_id) | auth |
| GET | `/reservations/:id` | Detalj jedne | auth |
| POST | `/reservations` | Kreiraj novu | `create_reservation` |
| POST | `/reservations/walkin` | Kreiraj walk-in | `create_walkin` |
| PATCH | `/reservations/:id` | Izmeni (status, vreme, stolove...) | Zavisno od polja |
| DELETE | `/reservations/:id` | Obriši | `delete_reservation` |

**POST /reservations**
```json
{
  "reservation_type": "standard",
  "guest_name": "Marko Petrović",
  "guest_phone": "0641234567",
  "guest_count": 4,
  "date": "2026-03-15",
  "start_time": "19:00",
  "duration_minutes": 120,
  "table_ids": [5, 6],
  "notes": "Bez glutena",
  "celebration_details": null
}
```

**POST /reservations/walkin**
```json
{
  "guest_name": "Walk-in gost",
  "guest_count": 2,
  "table_ids": [3],
  "date": "2026-03-11",
  "start_time": "20:30",
  "duration_minutes": 90
}
```

**PATCH /reservations/:id — promena statusa**
```json
{ "status": "seated" }
```

**PATCH /reservations/:id — transfer stola**
```json
{ "table_ids": [8] }
```

**PATCH /reservations/:id — promena vremena**
```json
{ "start_time": "20:00", "duration_minutes": 90 }
```

#### Validacije na serveru
- Status tranzicija: proverava VALID_TRANSITIONS mapu
- Overlap check: SERIALIZABLE transakcija + SELECT FOR UPDATE
- Guest count ≤ ukupni kapacitet dodeljenih stolova
- Duration: 15-480 minuta
- Midnight crossing: odbija ako end_time prelazi ponoć
- Radno vreme: odbija ako datum pada na zatvoren dan ili pre/posle radnog vremena
- Date/time format validacija (YYYY-MM-DD, HH:MM)

### Availability (`/api/availability`)

| Metod | Putanja | Opis |
|-------|---------|------|
| GET | `/availability` | Slobodni stolovi za dato vreme |
| GET | `/availability/timeline` | Timeline za sve stolove po danu |

**GET /availability?date=2026-03-15&time=19:00&duration=120&guests=4**
```json
{
  "available_tables": [
    { "id": 5, "table_number": "5", "capacity": 4, "zone_name": "Glavna sala", ... }
  ]
}
```

**GET /availability/timeline?date=2026-03-15&zoneId=1**
```json
[
  {
    "table": { "id": 1, "table_number": "1", ... },
    "reservations": [
      {
        "id": 10,
        "guest_name": "Petar",
        "start_time": "19:00:00",
        "end_time": "21:00:00",
        "status": "nova",
        ...
      }
    ]
  }
]
```

Timeline filtrira:
- Samo aktivne zone (`z.is_active = true`)
- Sezonske zone prikazane samo ako je datum u sezoni
- Rezervacije sa statusom `otkazana` i `no_show` isključene

### Zones (`/api/zones`)

| Metod | Putanja | Opis | Rola |
|-------|---------|------|------|
| GET | `/zones` | Lista svih zona | auth |
| POST | `/zones` | Kreiraj | owner/manager |
| PATCH | `/zones/:id` | Izmeni | owner/manager |
| DELETE | `/zones/:id` | Obriši | owner/manager |

### Tables (`/api/zones/:zoneId/tables`, `/api/tables/:id`)

| Metod | Putanja | Opis |
|-------|---------|------|
| GET | `/zones/:zoneId/tables` | Stolovi u zoni |
| POST | `/zones/:zoneId/tables` | Kreiraj sto |
| PATCH | `/tables/:id` | Izmeni sto |
| DELETE | `/tables/:id` | Obriši sto |
| PUT | `/zones/:zoneId/tables/layout` | Sačuvaj raspored stolova (canvas pozicije) |

### Floor Plans (`/api/zones/:zoneId/floor-plan`)

| Metod | Putanja | Opis |
|-------|---------|------|
| GET | `/zones/:zoneId/floor-plan` | Floor plan za zonu |
| PATCH | `/zones/:zoneId/floor-plan` | Izmeni dimenzije |

### Users (`/api/users`)

| Metod | Putanja | Opis | Rola |
|-------|---------|------|------|
| GET | `/users` | Lista svih | owner/manager |
| POST | `/users` | Kreiraj | owner |
| PATCH | `/users/:id` | Izmeni | owner |
| DELETE | `/users/:id` | Obriši | owner |

Password mora imati minimum 8 karaktera.

### Working Hours (`/api/working-hours`)

| Metod | Putanja | Opis |
|-------|---------|------|
| GET | `/working-hours` | Radno vreme za svih 7 dana |
| PUT | `/working-hours` | Postavi radno vreme |

### Permissions (`/api/permissions`)

| Metod | Putanja | Opis | Rola |
|-------|---------|------|------|
| GET | `/permissions` | Lista svih dozvola po roli | owner/manager |
| PUT | `/permissions` | Postavi dozvole | owner |

### Events — SSE (`/api/events`)

| Metod | Putanja | Opis |
|-------|---------|------|
| GET | `/events?token=<JWT>` | SSE stream |

Emituje `reservation:change` eventi koji invalidiraju klijentske queryje.

---

## 4. Autentifikacija i autorizacija

### JWT tokeni

- **Access token**: 15 minuta, šalje se kao `Authorization: Bearer <token>`
- **Refresh token**: 7 dana, koristi se za obnovu access tokena
- Odvojeni JWT secreti za access i refresh (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- Refresh namespace: `'refresh'`

### Klijentski flow

1. Login → čuva oba tokena u localStorage (authStore)
2. Svaki API poziv dodaje `Authorization` header
3. Na 401 → automatski refresh (client/src/api/client.ts)
4. Na neuspeli refresh → logout + redirect na /login
5. SSE konekcija šalje token kao query param, prati promene tokena

### Server-side dozvole

Middleware `requirePermission(permission)` u `server/src/middleware/permissions.ts`:
1. Čita ulogu korisnika iz JWT tokena
2. Owner uvek ima sve dozvole (failsafe)
3. Za ostale role: query na `role_permissions` tabelu
4. Ako dozvola nije pronađena ili `allowed=false` → 403

**Dozvole:**

| Permission | Opis | Default: owner | manager | waiter |
|-----------|------|:-:|:-:|:-:|
| `create_reservation` | Kreiranje rezervacije | ✅ | ✅ | ✅ |
| `create_walkin` | Kreiranje walk-in | ✅ | ✅ | ✅ |
| `delete_reservation` | Brisanje rezervacije | ✅ | ✅ | ❌ |
| `transfer_table` | Transfer stola | ✅ | ✅ | ❌ |
| `status_otkazana` | Otkazivanje | ✅ | ✅ | ❌ |
| `status_no_show` | Označavanje no-show | ✅ | ✅ | ❌ |
| `status_odlozena` | Odlaganje | ✅ | ✅ | ✅ |

Dozvole su konfigurisane u Admin panelu (owner može menjati).

### Rate limiting

- Global: 100 req/min po IP
- Login: 5 req/min po IP
- `@fastify/helmet` za security headere

---

## 5. Status workflow

### Statusi

| Status | Srpski | Boja | Opis |
|--------|--------|------|------|
| `nova` | Nova | #1971C2 (plava) | Novokreirana rezervacija |
| `potvrdjena` | Potvrđena | #1864AB (tamno plava) | Potvrđena rezervacija |
| `seated` | Za stolom | #C2255C (roze) | Gost je seo |
| `zavrsena` | Završena | #868E96 (siva) | Rezervacija je gotova |
| `otkazana` | Otkazana | #C92A2A (crvena) | Otkazano |
| `no_show` | No-show | #C92A2A (crvena) | Gost se nije pojavio |
| `waitlist` | Lista čekanja | #862E9C (ljubičasta) | Na listi čekanja |
| `odlozena` | Odložena | #E67700 (žuta) | Odložena za kasnije |

### Dozvoljene tranzicije

```
nova       → seated, no_show, otkazana, odlozena
potvrdjena → seated, no_show, otkazana, odlozena
seated     → zavrsena, nova
waitlist   → nova, otkazana
odlozena   → nova, otkazana
zavrsena   → seated (revert)
otkazana   → nova (revert)
no_show    → nova (revert)
```

Tranzicije se proveravaju na obe strane:
- Klijent: `client/src/config/statusConfig.ts` → VALID_TRANSITIONS
- Server: `server/src/utils/statusTransitions.ts` → isValidTransition()

### Tipovi rezervacija

| Tip | Opis |
|-----|------|
| `standard` | Regularna rezervacija |
| `celebration` | Proslava (ima celebration_details polje) |
| `walkin` | Walk-in gost (kreiran sa trenutnim vremenom) |

---

## 6. Klijent — stranice i komponente

### Stranice

| Stranica | Putanja | Opis |
|----------|---------|------|
| `LoginPage` | `/login` | Prijava korisnika |
| `FloorPlanPage` | `/` | Glavna stranica: timeline grid + agenda + floor plan |
| `ReservationsPage` | `/reservations` | Lista svih rezervacija sa filterima |
| `AdminPage` | `/admin` | Upravljanje zonama, stolovima, korisnicima, radnim vremenom, dozvolama |

### FloorPlanPage — glavna stranica

Prikazuje se u dva režima:
- **Desktop**: toolbar sa datumom + navigacijom + dugmadima | search bar | TimelineGrid
- **Mobile**: header sa datumom + Lista/Timeline toggle | search bar | MobileAgendaView ili TimelineGrid

Korisnik može:
- Navigirati po datumima (strelice, klik na datum za danas)
- Pretraživati goste po imenu, telefonu, stolu
- Kreirati novu rezervaciju (+ dugme ili klik na prazan slot u timeline)
- Kreirati walk-in
- Kliknuti na rezervaciju → otvara ReservationDrawer

### Komponente po kategoriji

#### Timeline (`components/timeline/`)

| Komponenta | Opis |
|-----------|------|
| `TimelineGrid` | CSS Grid: redovi=stolovi grupisani po zonama, kolone=30-min slotovi. Desktop koristi sticky headers u ScrollArea, mobile koristi fiksni layout (table kolona + time header van scroll oblasti). |
| `TimelineReservationBlock` | Blok rezervacije u grid-u. Desktop: tooltip + hover efekti. Mobile: kompaktan bar sa imenom. Boja po statusu, pulsira ako ističe. |
| `MobileAgendaView` | Kartica-bazirani prikaz za mobile. Sekcije: "Sada" (seated), "Sledeće" (naredna 2h), "Kasnije". Prikazuje slobodne stolove po zonama. Brze status akcije. |
| `TimelineFilters` | (opcionalno) Filteri za timeline |
| `timelineUtils` | `isEndingSoon()`, `minutesUntil()`, `computeTimeSlots()` |

#### Reservations (`components/reservations/`)

| Komponenta | Opis |
|-----------|------|
| `ReservationForm` | Modal forma za kreiranje/editovanje. Bira datum, vreme, trajanje, goste, stolove. Validira midnight crossing, upozorava na dugačke rezervacije i prekoračenje kapaciteta. |
| `ReservationDrawer` | Drawer sa detaljima rezervacije + StatusChangeMenu + Edit/Delete dugmad |
| `ReservationDetail` | Prikaz svih detalja rezervacije |
| `ReservationList` | Lista kartica rezervacija sa filterima (za ReservationsPage) |
| `StatusChangeMenu` | Menu sa dozvoljenim tranzicijama statusa. Potvrda za opasne akcije (otkazana, no_show). |
| `WalkinForm` | Brza forma za walk-in (ime, broj gostiju, sto, opcionalno vreme) |
| `WaitlistPanel` | Panel sa waitlist rezervacijama |

#### Floor Plan (`components/floor-plan/`)

| Komponenta | Opis |
|-----------|------|
| `FloorPlanEditor` | react-konva canvas za raspoređivanje stolova (drag, resize, rotate). Koristi se u Admin panelu. |
| `TableShape` | Vizuelni prikaz stola na canvasu (rectangle, circle, square). Boja po statusu. |
| `tableUtils` | Pomoćne funkcije za geometriju stolova |

#### Admin (`components/admin/`)

| Komponenta | Opis |
|-----------|------|
| `ZoneManager` | CRUD zona (naziv, opis, sezonska, sort_order) |
| `TableManager` | CRUD stolova + FloorPlanEditor za raspored |
| `UserManager` | CRUD korisnika (username, role, active) |
| `WorkingHoursEditor` | Radno vreme za svaki dan (7 dana) |
| `PermissionsManager` | Matrica dozvola po rolama (toggle on/off) |

#### Layout (`components/layout/`)

| Komponenta | Opis |
|-----------|------|
| `AppLayout` | Shell: desktop sidebar/header, mobile bottom tabs. Prihvata `mobileHeaderCenter` prop za custom header sadržaj. |
| `MobileFAB` | Floating action button na mobile (+ nova rezervacija, walk-in) |

### Hooks

| Hook | Fajl | Opis |
|------|------|------|
| `useTimeline` | `useTimeline.ts` | TanStack Query za `/availability/timeline`, auto-refetch 30s |
| `useReservations` | `useReservations.ts` | CRUD hookovi za rezervacije, walk-in, update |
| `useZones`, `useTables`, `useFloorPlan` | `useFloorPlan.ts` | Query hookovi za zone, stolove, floor plan |
| `useSSE` | `useSSE.ts` | SSE konekcija, invalidira TanStack Query cache na `reservation:change` |
| `useHasPermission` | `usePermissions.ts` | Vraća `hasPermission(name)` funkciju baziranu na klijentskom `role_permissions` |

### Stores (Zustand)

| Store | Fajl | Stanje |
|-------|------|--------|
| `authStore` | `authStore.ts` | user, accessToken, refreshToken, login/logout/setTokens |
| `uiStore` | `uiStore.ts` | selectedDate, selectedZoneId, selectedTableId, setters |

---

## 7. Real-time (SSE)

### Server

- `server/src/modules/events/events.routes.ts`
- Koristi Fastify EventEmitter (`fastify.eventBus`)
- Endpoint: `GET /api/events?token=<JWT>`
- Emituje `reservation:change` na svaki create/update/delete rezervacije
- Heartbeat svakih 15s (`:\n\n`)

### Klijent

- `client/src/hooks/useSSE.ts`
- Konektuje se sa access tokenom
- Na `reservation:change` → `queryClient.invalidateQueries(['reservations', 'availability', 'timeline'])`
- Automatski reconnect na grešku (3s delay)
- Prati promenu tokena (posle refresh-a)

---

## 8. Pokretanje i razvoj

### Preduslovi

- Node.js 18+
- PostgreSQL 16 (ili Docker)

### Lokalno pokretanje

```bash
# 1. Pokreni PostgreSQL
docker-compose up db -d

# 2. Server
cd server
npm install
npm run migrate     # pokreni migracije 001-005
npm run seed        # seed: 3 zone, 30 stolova, 4 korisnika
npm run dev         # port 3001

# 3. Klijent (novi terminal)
cd client
npm install
npm run dev         # port 5173, proxy /api → :3001
```

### Test kredencijali

| Username | Password | Rola |
|----------|----------|------|
| admin | admin123 | owner |
| menadzer | admin123 | manager |
| konobar1 | admin123 | waiter |

### Komande

| Komanda | Direktorijum | Opis |
|---------|-------------|------|
| `npm run dev` | server/ | Dev server (tsx watch, port 3001) |
| `npm run build` | server/ | Kompajlira TypeScript |
| `npm run migrate` | server/ | Pokreni migracije |
| `npm run migrate:down` | server/ | Rollback poslednje migracije |
| `npm run seed` | server/ | Seed baze |
| `npm run dev` | client/ | Vite dev server (port 5173) |
| `npm run build` | client/ | Production build |
| `npm run build` | root | Build client + server |
| `npm start` | root | Production server |
| `npx tsc --noEmit` | server/ ili client/ | Type check |
| `npx playwright test` | root | E2E testovi |

### Docker Compose

```bash
docker-compose up          # sve tri usluge (db, server, client)
docker-compose up db -d    # samo baza
```

---

## 9. Deploy (Railway)

### Konfiguracija

Railway koristi single service koji servira i API i statičke fajlove.

| Env varijabla | Opis |
|--------------|------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret za access token |
| `JWT_REFRESH_SECRET` | Secret za refresh token |
| `NODE_ENV` | `production` |
| `PORT` | Port (Railway automatski dodeljuje) |
| `CORS_ORIGIN` | Frontend URL (npr. `https://app.railway.app`) |

### Build & Start

```bash
# Build (root package.json)
npm run build
# → client: vite build → client/dist/
# → server: tsc → server/dist/

# Start
npm start
# → node server/dist/index.js
# Fastify servira client/dist/ statičke fajlove + API na /api
```

### Kako radi u produkciji

1. `@fastify/static` servira `client/dist/` sa `wildcard: true`
2. SPA fallback: sve rute koje nisu `/api/*` ni `/assets/*` vraćaju `index.html`
3. API rute registrovane pod `/api` prefiksom

---

## 10. Konvencije i pravila

### Jezik
- UI tekst: srpski (latinica)
- Kod: engleski (varijable, funkcije, komentari)
- Status nazivi: srpski (`nova`, `potvrdjena`, `zavrsena`, `otkazana`, `odlozena`) + engleski (`seated`, `no_show`, `waitlist`)

### Server konvencije
- ESM moduli — importi koriste `.js` ekstenzije
- Svaki modul eksportuje `async function(fastify, opts)` → registruje se pod `/api`
- Raw SQL sa parameterized queries (bez ORM-a)
- SERIALIZABLE izolacija za transakcije sa overlap proverom
- `server/src/utils/overlapCheck.ts` — jedini izvor istine za proveru zauzetosti stola
- `server/src/utils/statusTransitions.ts` — validacija tranzicija (mirror klijentskog config-a)
- `server/src/utils/auditLog.ts` — svaka mutacija rezervacije se loguje
- `server/src/middleware/permissions.ts` — server-side provera dozvola

### Klijent konvencije
- `client/src/config/statusConfig.ts` — jedini izvor istine za boje, labele, tranzicije statusa
- TanStack Query za server state, Zustand za UI state
- Mantine 7 komponente za UI
- AppLayout prima `mobileHeaderCenter` prop za page-specific header na mobile

### Overlap Check logika

Centralizovana u `server/src/utils/overlapCheck.ts`. Koristi se za:
- Kreiranje rezervacije
- Izmenu vremena
- Izmenu stolova (transfer)
- Walk-in

Logika:
1. Otvori SERIALIZABLE transakciju
2. `SELECT ... FOR UPDATE` na rezervacije tog stola za taj dan
3. Proveri da li postoji preklapanje: `start_time < end_time AND end_time > start_time`
4. Opciono: isključi trenutnu rezervaciju iz provere (za edit)

### Audit Log

Svaka mutacija na rezervacijama piše u `audit_log`:
- **create**: novi zapis sa svim podacima
- **update**: promena polja (start_time, duration, table_ids...)
- **status_change**: stari → novi status
- **transfer_table**: stari → novi stolovi
- **delete**: obrisana rezervacija

### Bezbednost
- JWT tokeni sa odvojenim secretima za access i refresh
- bcrypt za lozinke (minimum 8 karaktera)
- Rate limiting: 100 req/min globalno, 5 req/min za login
- `@fastify/helmet` za HTTP security headere
- Parameterized SQL upiti (zaštita od SQL injection)
- Request body limit: 1MB
- Server-side validacija: format datuma/vremena, trajanje, status tranzicije, kapacitet, radno vreme
- CORS: konfigurisani origin
