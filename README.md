# Rezervacije

Interni sistem za upravljanje rezervacijama u restoranu. Timeline grid i floor plan kao primarni interfejsi, srpski jezik (latinica). Namenjen za osoblje (3-5 korisnika).

## Screenshot

| Timeline | Mobile Agenda | Admin |
|----------|---------------|-------|
| CSS Grid sa zonama, stolovima i 30-min slotovima | Lista rezervacija grupisana po sekcijama | Upravljanje zonama, stolovima, korisnicima |

## Tech Stack

**Server:** Fastify 5, TypeScript, PostgreSQL (raw SQL via node-postgres), JWT auth, SSE real-time

**Client:** React 18, Vite, Mantine 7, react-konva, Zustand, TanStack Query, react-router-dom v7

## Pokretanje

### Preduslovi

- Node.js 18+
- PostgreSQL 16 (ili Docker)

### Brzo pokretanje

```bash
# 1. Pokreni PostgreSQL
docker-compose up db -d

# 2. Server
cd server
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev

# 3. Client (u novom terminalu)
cd client
npm install
npm run dev
```

Aplikacija je dostupna na http://localhost:5173

### Test nalozi

| Korisnik | Lozinka | Uloga |
|----------|---------|-------|
| admin | admin123 | owner |
| menadzer | admin123 | manager |
| konobar1 | admin123 | waiter |

## Struktura projekta

```
rezervacije/
├── client/                  # React frontend
│   └── src/
│       ├── api/             # API klijent i tipovi
│       ├── components/
│       │   ├── admin/       # Zone, stolovi, korisnici, radno vreme
│       │   ├── common/      # StatusBadge
│       │   ├── layout/      # AppLayout, MobileFAB
│       │   ├── reservations/# Forme, lista, drawer, status meni
│       │   └── timeline/    # TimelineGrid, blokovi, filteri, agenda
│       ├── config/          # statusConfig (boje, labeli, tranzicije)
│       ├── hooks/           # React hookovi (reservations, timeline, SSE)
│       ├── pages/           # FloorPlan, Reservations, Admin, Login
│       ├── stores/          # Zustand (auth, UI)
│       └── theme/           # Mantine tema (teal, Inter font)
├── server/                  # Fastify backend
│   └── src/
│       ├── db/              # Migracije, connection pool
│       ├── middleware/      # JWT auth
│       ├── modules/         # auth, users, zones, tables, reservations...
│       ├── plugins/         # CORS, JWT, SSE
│       └── utils/           # Validacija, status tranzicije
├── scripts/                 # migrate, seed, e2e test
└── docker-compose.yml
```

## Funkcionalnosti

- **Timeline Grid** — CSS Grid sa stolovima po zonama, 30-min slotovi, klik za kreiranje rezervacije
- **Mobile Agenda** — Lista grupisana po sekcijama (za stolom, sledece, kasnije) sa quick actions
- **Rezervacije** — CRUD, status tranzicije sa potvrdom, odlaganje, walk-in
- **Admin panel** — Upravljanje zonama, stolovima, korisnicima, radnim vremenom
- **Real-time** — SSE za azuriranje svih klijenata u realnom vremenu
- **Auth** — JWT sa access/refresh tokenima, role-based pristup (owner, manager, waiter)
- **Responsivan** — Mobile-first sa bottom tab navigacijom i FAB

## Environment varijable

```env
DATABASE_URL=postgres://rezervacije:rezervacije_dev@localhost:5432/rezervacije
JWT_SECRET=change-me-to-a-random-secret
JWT_REFRESH_SECRET=change-me-to-a-different-random-secret
PORT=3001
NODE_ENV=development
```

## Komande

### Server (`/server`)

| Komanda | Opis |
|---------|------|
| `npm run dev` | Dev server (port 3001) |
| `npm run build` | Kompajliranje TypeScript-a |
| `npm run migrate` | Pokretanje migracija |
| `npm run migrate:down` | Rollback poslednje migracije |
| `npm run seed` | Seed baze sa test podacima |

### Client (`/client`)

| Komanda | Opis |
|---------|------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Production build |

## Statusi rezervacija

| Status | Opis | Boja |
|--------|------|------|
| nova | Nova rezervacija | plava |
| potvrdjena | Potvrdjena | tamno plava |
| seated | Gost za stolom | zuta |
| zavrsena | Zavrsena | siva |
| otkazana | Otkazana | svetlo siva |
| no_show | Gost se nije pojavio | crvena |
| waitlist | Lista cekanja | ljubicasta |
| odlozena | Odlozena za kasnije | indigo |

## Licence

Private project.
