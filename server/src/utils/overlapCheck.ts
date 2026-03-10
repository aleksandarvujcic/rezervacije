import type { DbClient } from '../db/pool.js';
import { ConflictError } from './errors.js';

/**
 * A5: Centralized overlap/availability check for table reservations.
 * Replaces 4 duplicate implementations across reservations.routes.ts.
 *
 * @param client - Transaction database client
 * @param tableIds - Table IDs to check
 * @param date - Reservation date (YYYY-MM-DD)
 * @param startTime - Start time (HH:mm)
 * @param endTime - End time (HH:mm)
 * @param excludeReservationId - Optional reservation ID to exclude (for updates)
 */
export async function checkTableOverlap(
  client: DbClient,
  tableIds: number[],
  date: string,
  startTime: string,
  endTime: string,
  excludeReservationId?: number
): Promise<void> {
  if (tableIds.length === 0) return;

  const tablePlaceholders = tableIds.map((_, i) => `$${i + 1}`).join(', ');
  let offset = tableIds.length;

  let excludeClause = '';
  const params: unknown[] = [...tableIds, date, endTime, startTime];

  if (excludeReservationId !== undefined) {
    excludeClause = `AND r.id != $${offset + 4}`;
    params.push(excludeReservationId);
  }

  const { rows: conflicts } = await client.query(
    `SELECT rt.table_id
     FROM reservation_tables rt
     JOIN reservations r ON r.id = rt.reservation_id
     WHERE rt.table_id IN (${tablePlaceholders})
       AND r.date = $${offset + 1}
       AND r.status NOT IN ('otkazana', 'no_show', 'zavrsena')
       AND r.start_time < $${offset + 2}
       AND r.end_time > $${offset + 3}
       ${excludeClause}
     FOR UPDATE`,
    params
  );

  if (conflicts.length > 0) {
    const conflictIds = [...new Set(conflicts.map((r: { table_id: number }) => r.table_id))];
    throw new ConflictError(
      `Stolovi ${conflictIds.join(', ')} nisu dostupni u traženom terminu`
    );
  }
}
