-- Migration 003: Change reservation_tables.table_id from RESTRICT to CASCADE
-- This allows hard-deleting tables; past reservations keep their data but lose the table link.

ALTER TABLE reservation_tables
  DROP CONSTRAINT reservation_tables_table_id_fkey;

ALTER TABLE reservation_tables
  ADD CONSTRAINT reservation_tables_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE;
