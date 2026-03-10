import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';
import { emitEvent } from '../events/events.routes.js';

interface CreateZoneBody {
  name: string;
  description?: string;
  is_seasonal?: boolean;
  season_start?: string;
  season_end?: string;
  sort_order?: number;
}

interface UpdateZoneBody {
  name?: string;
  description?: string;
  is_seasonal?: boolean;
  season_start?: string | null;
  season_end?: string | null;
  sort_order?: number;
}

interface IdParams {
  id: string;
}

export default async function zonesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET / - list all active zones, sorted
  fastify.get('/', async (_request, reply) => {
    const { rows } = await pool.query(
      `SELECT id, name, description, is_active, is_seasonal, season_start, season_end,
              sort_order, created_at, updated_at
       FROM zones
       WHERE is_active = true
       ORDER BY sort_order, name`
    );
    return reply.send(rows);
  });

  // POST / - create zone (manager/owner)
  fastify.post<{ Body: CreateZoneBody }>(
    '/',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { name, description, is_seasonal, season_start, season_end, sort_order } =
        request.body;

      if (!name) {
        throw new ValidationError('name is required');
      }

      const { rows } = await pool.query(
        `INSERT INTO zones (name, description, is_seasonal, season_start, season_end, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name,
          description || null,
          is_seasonal ?? false,
          season_start || null,
          season_end || null,
          sort_order ?? 0,
        ]
      );

      emitEvent(fastify, 'zone:change', { action: 'created', zone: rows[0] });

      return reply.status(201).send(rows[0]);
    }
  );

  // PATCH /:id - update zone
  fastify.patch<{ Params: IdParams; Body: UpdateZoneBody }>(
    '/:id',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, is_seasonal, season_start, season_end, sort_order } =
        request.body;

      const existing = await pool.query('SELECT id FROM zones WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('Zone not found');
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (is_seasonal !== undefined) {
        updates.push(`is_seasonal = $${paramIndex++}`);
        values.push(is_seasonal);
      }
      if (season_start !== undefined) {
        updates.push(`season_start = $${paramIndex++}`);
        values.push(season_start);
      }
      if (season_end !== undefined) {
        updates.push(`season_end = $${paramIndex++}`);
        values.push(season_end);
      }
      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sort_order);
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE zones SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      emitEvent(fastify, 'zone:change', { action: 'updated', zone: rows[0] });

      return reply.send(rows[0]);
    }
  );

  // DELETE /:id - soft delete zone and its tables
  fastify.delete<{ Params: IdParams }>(
    '/:id',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await pool.query('SELECT id, name FROM zones WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('Zone not found');
      }

      // Check for future active reservations on tables in this zone
      const { rows: futureRes } = await pool.query(
        `SELECT COUNT(DISTINCT r.id) AS count
         FROM reservations r
         JOIN reservation_tables rt ON rt.reservation_id = r.id
         JOIN tables t ON t.id = rt.table_id
         WHERE t.zone_id = $1
           AND r.date >= CURRENT_DATE
           AND r.status NOT IN ('otkazana', 'no_show', 'zavrsena')`,
        [id]
      );

      const activeCount = parseInt(futureRes[0].count, 10);
      if (activeCount > 0) {
        throw new ConflictError(
          `Zona "${existing.rows[0].name}" ima ${activeCount} aktivnih budućih rezervacija. Otkažite ili premestite ih pre brisanja.`
        );
      }

      // Hard delete tables in this zone (cascade removes reservation_tables links)
      await pool.query('DELETE FROM tables WHERE zone_id = $1', [id]);

      // Soft-delete zone (keeps zone record for historical context)
      const { rows } = await pool.query(
        `UPDATE zones SET is_active = false, updated_at = NOW() WHERE id = $1
         RETURNING *`,
        [id]
      );

      emitEvent(fastify, 'zone:change', { action: 'deleted', zone: rows[0] });

      return reply.send(rows[0]);
    }
  );
}
