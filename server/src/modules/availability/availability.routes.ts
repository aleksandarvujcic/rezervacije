import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';
import { addMinutesToTime } from '../../utils/time.js';

interface AvailabilityQuery {
  date?: string;
  time?: string;
  duration?: string;
  guests?: string;
  exclude_reservation_id?: string;
}

interface TimelineQuery {
  date?: string;
  zoneId?: string;
}

export default async function availabilityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // GET /availability - return free tables
  fastify.get<{ Querystring: AvailabilityQuery }>(
    '/availability',
    async (request, reply) => {
      const { date, time, duration = '120', guests, exclude_reservation_id } = request.query;

      if (!date || !time) {
        throw new ValidationError('date and time are required');
      }

      const durationMinutes = parseInt(duration);
      const end_time = addMinutesToTime(time, durationMinutes);

      // Get all active tables
      let tableQuery = `
        SELECT t.*, z.name as zone_name
        FROM tables t
        JOIN zones z ON z.id = t.zone_id
        WHERE t.is_active = true AND z.is_active = true
      `;
      const tableValues: unknown[] = [];
      let paramIndex = 1;

      if (guests) {
        tableQuery += ` AND t.capacity >= $${paramIndex++}`;
        tableValues.push(parseInt(guests));
      }

      tableQuery += ' ORDER BY z.sort_order, t.table_number::int';

      const { rows: allTables } = await pool.query(tableQuery, tableValues);

      // Get occupied table IDs for the time window
      let occupiedQuery = `
        SELECT DISTINCT rt.table_id
         FROM reservation_tables rt
         JOIN reservations r ON r.id = rt.reservation_id
         WHERE r.date = $1
           AND r.status NOT IN ('otkazana', 'no_show', 'zavrsena')
           AND r.start_time < $2
           AND r.end_time > $3`;
      const occupiedValues: unknown[] = [date, end_time, time];

      if (exclude_reservation_id) {
        occupiedQuery += ` AND r.id != $4`;
        occupiedValues.push(parseInt(exclude_reservation_id));
      }

      const { rows: occupied } = await pool.query(occupiedQuery, occupiedValues);

      const occupiedIds = new Set(occupied.map((r: { table_id: number }) => r.table_id));

      const freeTables = allTables.filter((t: { id: number }) => !occupiedIds.has(t.id));

      return reply.send({ available_tables: freeTables });
    }
  );

  // GET /availability/timeline - for each table, return reservations for the day
  fastify.get<{ Querystring: TimelineQuery }>(
    '/availability/timeline',
    async (request, reply) => {
      const { date, zoneId } = request.query;

      if (!date) {
        throw new ValidationError('date is required');
      }

      let tableQuery = `
        SELECT t.* FROM tables t
        JOIN zones z ON z.id = t.zone_id
        WHERE t.is_active = true AND z.is_active = true
      `;
      const tableValues: unknown[] = [];
      let paramIdx = 1;

      if (zoneId) {
        tableQuery += ` AND t.zone_id = $${paramIdx++}`;
        tableValues.push(zoneId);
      }

      // Filter out seasonal zones that are not in season for the requested date
      tableQuery += `
        AND (z.is_seasonal = false
             OR (z.season_start IS NOT NULL AND z.season_end IS NOT NULL
                 AND $${paramIdx}::date >= z.season_start AND $${paramIdx}::date <= z.season_end))
      `;
      tableValues.push(date);
      paramIdx++;

      tableQuery += ' ORDER BY z.sort_order, t.table_number::int';

      const { rows: tables } = await pool.query(tableQuery, tableValues);

      // Get all reservations for the day
      const reservationValues: unknown[] = [date];
      let resQuery = `
        SELECT r.id, r.guest_name, r.guest_phone, r.guest_count, r.start_time, r.end_time,
               r.status, r.reservation_type, rt.table_id
        FROM reservations r
        JOIN reservation_tables rt ON rt.reservation_id = r.id
        WHERE r.date = $1
          AND r.status NOT IN ('otkazana', 'no_show')
      `;

      if (zoneId) {
        resQuery += `
          AND rt.table_id IN (
            SELECT id FROM tables WHERE zone_id = $2
          )
        `;
        reservationValues.push(zoneId);
      }

      resQuery += ' ORDER BY r.start_time';

      const { rows: reservations } = await pool.query(resQuery, reservationValues);

      // Group reservations by table
      const reservationsByTable = new Map<number, typeof reservations>();
      for (const res of reservations) {
        const existing = reservationsByTable.get(res.table_id) || [];
        existing.push(res);
        reservationsByTable.set(res.table_id, existing);
      }

      const timeline = tables.map((table: { id: number }) => ({
        table,
        reservations: reservationsByTable.get(table.id) || [],
      }));

      return reply.send(timeline);
    }
  );
}
