-- Role-based permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(50) NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Seed default permissions
INSERT INTO role_permissions (role, permission, allowed) VALUES
  -- Owner: everything allowed
  ('owner', 'create_reservation', true),
  ('owner', 'create_walkin', true),
  ('owner', 'delete_reservation', true),
  ('owner', 'transfer_table', true),
  ('owner', 'status_no_show', true),
  ('owner', 'status_otkazana', true),
  ('owner', 'status_odlozena', true),
  -- Manager: everything allowed
  ('manager', 'create_reservation', true),
  ('manager', 'create_walkin', true),
  ('manager', 'delete_reservation', true),
  ('manager', 'transfer_table', true),
  ('manager', 'status_no_show', true),
  ('manager', 'status_otkazana', true),
  ('manager', 'status_odlozena', true),
  -- Waiter: only walk-in
  ('waiter', 'create_reservation', false),
  ('waiter', 'create_walkin', true),
  ('waiter', 'delete_reservation', false),
  ('waiter', 'transfer_table', false),
  ('waiter', 'status_no_show', false),
  ('waiter', 'status_otkazana', false),
  ('waiter', 'status_odlozena', false)
ON CONFLICT (role, permission) DO NOTHING;
