-- P1: Composite index for availability/overlap time range queries
CREATE INDEX IF NOT EXISTS idx_reservations_date_time_range
  ON reservations(date, start_time, end_time)
  WHERE status NOT IN ('otkazana', 'no_show', 'zavrsena');
