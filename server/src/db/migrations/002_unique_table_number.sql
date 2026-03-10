-- Migration 002: Make table_number globally unique (not per-zone)

-- Drop the existing per-zone unique constraint
ALTER TABLE tables DROP CONSTRAINT tables_zone_id_table_number_key;

-- Add a globally unique constraint on table_number
ALTER TABLE tables ADD CONSTRAINT tables_table_number_key UNIQUE (table_number);
