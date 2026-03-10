import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

interface WorkingHourItem {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export default async function workingHoursRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / - get all 7 days
  fastify.get('/', async (_request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, day_of_week, open_time, close_time, is_closed FROM working_hours ORDER BY day_of_week'
    );
    return reply.send(rows);
  });

  // PUT / - update all 7 days at once
  fastify.put<{ Body: WorkingHourItem[] }>(
    '/',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const items = request.body;

      if (!Array.isArray(items) || items.length !== 7) {
        throw new ValidationError('Body must be an array of exactly 7 working hour entries');
      }

      // Validate each entry
      for (const item of items) {
        if (
          item.day_of_week === undefined ||
          item.day_of_week < 0 ||
          item.day_of_week > 6
        ) {
          throw new ValidationError('day_of_week must be between 0 and 6');
        }
        if (!item.open_time || !item.close_time) {
          throw new ValidationError('open_time and close_time are required');
        }
      }

      // Check all 7 days are represented
      const days = new Set(items.map((i) => i.day_of_week));
      if (days.size !== 7) {
        throw new ValidationError('All 7 days of the week must be provided (0-6)');
      }

      const results = await withTransaction(async (client) => {
        const updated: unknown[] = [];
        for (const item of items) {
          const { rows } = await client.query(
            `INSERT INTO working_hours (day_of_week, open_time, close_time, is_closed)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (day_of_week)
             DO UPDATE SET open_time = $2, close_time = $3, is_closed = $4
             RETURNING *`,
            [item.day_of_week, item.open_time, item.close_time, item.is_closed ?? false]
          );
          updated.push(rows[0]);
        }
        return updated;
      });

      return reply.send(results);
    }
  );
}
