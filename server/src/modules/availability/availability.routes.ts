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
      const { date, time, duration = '120', guests } = request.query;

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
      const { rows: occupied } = await pool.query(
        `SELECT DISTINCT rt.table_id
         FROM reservation_tables rt
         JOIN reservations r ON r.id = rt.reservation_id
         WHERE r.date = $1
           AND r.status NOT IN ('otkazana', 'no_show', 'zavrsena')
           AND r.start_time < $2
           AND r.end_time > $3`,
        [date, end_time, time]
      );

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

      let tableQuery =
        'SELECT t.* FROM tables t WHERE t.is_active = true';
      const tableValues: unknown[] = [];

      if (zoneId) {
        tableQuery += ' AND t.zone_id = $1';
        tableValues.push(zoneId);
      }
      tableQuery += ' ORDER BY t.table_number::int';

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
