-- Migration 001: Initial schema

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'waiter')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zones
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_seasonal BOOLEAN NOT NULL DEFAULT false,
  season_start DATE,
  season_end DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Floor plans (one per zone)
CREATE TABLE floor_plans (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL UNIQUE REFERENCES zones(id) ON DELETE CASCADE,
  canvas_width INTEGER NOT NULL DEFAULT 1200,
  canvas_height INTEGER NOT NULL DEFAULT 800,
  background_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables
CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  shape VARCHAR(20) NOT NULL DEFAULT 'rectangle' CHECK (shape IN ('rectangle', 'circle', 'square')),
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 80,
  height REAL NOT NULL DEFAULT 60,
  rotation REAL NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(zone_id, table_number)
);

-- Working hours
CREATE TABLE working_hours (
  id SERIAL PRIMARY KEY,
  day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL DEFAULT '10:00',
  close_time TIME NOT NULL DEFAULT '23:00',
  is_closed BOOLEAN NOT NULL DEFAULT false
);

-- Reservations
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  reservation_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (reservation_type IN ('standard', 'celebration', 'walkin')),
  status VARCHAR(20) NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'potvrdjena', 'seated', 'zavrsena', 'otkazana', 'no_show', 'waitlist', 'odlozena')),
  guest_name VARCHAR(200) NOT NULL,
  guest_phone VARCHAR(50),
  guest_count INTEGER NOT NULL DEFAULT 2,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  notes TEXT,
  celebration_details TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservation-Tables (many-to-many)
CREATE TABLE reservation_tables (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  UNIQUE(reservation_id, table_id)
);

-- Audit log
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reservations_date_status ON reservations(date, status);
CREATE INDEX idx_reservation_tables_table_id ON reservation_tables(table_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_tables_zone_id ON tables(zone_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
