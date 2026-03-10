import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';
import { emitEvent } from '../events/events.routes.js';

interface ZoneIdParams {
  zoneId: string;
}

interface IdParams {
  id: string;
}

interface CreateTableBody {
  table_number: string;
  capacity?: number;
  shape?: string;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

interface UpdateTableBody {
  table_number?: string;
  capacity?: number;
  shape?: string;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  is_active?: boolean;
  zone_id?: number;
}

interface LayoutItem {
  id: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  rotation: number;
}

export default async function tablesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /zones/:zoneId/tables - list all tables in zone
  fastify.get<{ Params: ZoneIdParams }>(
    '/zones/:zoneId/tables',
    async (request, reply) => {
      const { zoneId } = request.params;

      const { rows } = await pool.query(
        `SELECT id, zone_id, table_number, capacity, shape,
                pos_x, pos_y, width, height, rotation,
                is_active, created_at, updated_at
         FROM tables
         WHERE zone_id = $1 AND is_active = true
         ORDER BY table_number::int`,
        [zoneId]
      );

      return reply.send(rows);
    }
  );

  // POST /zones/:zoneId/tables - create table
  fastify.post<{ Params: ZoneIdParams; Body: CreateTableBody }>(
    '/zones/:zoneId/tables',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { zoneId } = request.params;
      const { table_number, capacity, shape, pos_x, pos_y, width, height, rotation } =
        request.body;

      if (!table_number) {
        throw new ValidationError('table_number is required');
      }

      // Verify zone exists
      const zoneCheck = await pool.query('SELECT id FROM zones WHERE id = $1', [zoneId]);
      if (zoneCheck.rows.length === 0) {
        throw new NotFoundError('Zone not found');
      }

      // Check uniqueness within zone
      const dup = await pool.query(
        'SELECT id FROM tables WHERE zone_id = $1 AND table_number = $2',
        [zoneId, table_number]
      );
      if (dup.rows.length > 0) {
        throw new ConflictError('Table number already exists in this zone');
      }

      const { rows } = await pool.query(
        `INSERT INTO tables (zone_id, table_number, capacity, shape, pos_x, pos_y, width, height, rotation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          zoneId,
          table_number,
          capacity ?? 4,
          shape ?? 'rectangle',
          pos_x ?? 0,
          pos_y ?? 0,
          width ?? 80,
          height ?? 60,
          rotation ?? 0,
        ]
      );

      emitEvent(fastify, 'table:change', { action: 'created', table: rows[0] });

      return reply.status(201).send(rows[0]);
    }
  );

  // PATCH /tables/:id - update single table
  fastify.patch<{ Params: IdParams; Body: UpdateTableBody }>(
    '/tables/:id',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { id } = request.params;
      const { table_number, capacity, shape, pos_x, pos_y, width, height, rotation, is_active, zone_id } =
        request.body;

      const existing = await pool.query('SELECT id, zone_id FROM tables WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('Table not found');
      }

      const targetZoneId = zone_id ?? existing.rows[0].zone_id;

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (zone_id !== undefined) {
        // Verify target zone exists
        const zoneCheck = await pool.query('SELECT id FROM zones WHERE id = $1 AND is_active = true', [zone_id]);
        if (zoneCheck.rows.length === 0) {
          throw new NotFoundError('Target zone not found');
        }
        updates.push(`zone_id = $${paramIndex++}`);
        values.push(zone_id);
      }

      if (table_number !== undefined) {
        // Check uniqueness within target zone
        const dup = await pool.query(
          'SELECT id FROM tables WHERE zone_id = $1 AND table_number = $2 AND id != $3',
          [targetZoneId, table_number, id]
        );
        if (dup.rows.length > 0) {
          throw new ConflictError('Table number already exists in this zone');
        }
        updates.push(`table_number = $${paramIndex++}`);
        values.push(table_number);
      } else if (zone_id !== undefined) {
        // Moving to new zone — check current table_number uniqueness in target zone
        const currentNumber = (await pool.query('SELECT table_number FROM tables WHERE id = $1', [id])).rows[0].table_number;
        const dup = await pool.query(
          'SELECT id FROM tables WHERE zone_id = $1 AND table_number = $2 AND id != $3',
          [zone_id, currentNumber, id]
        );
        if (dup.rows.length > 0) {
          throw new ConflictError(`Sto broj ${currentNumber} već postoji u ciljnoj zoni`);
        }
      }

      if (capacity !== undefined) {
        updates.push(`capacity = $${paramIndex++}`);
        values.push(capacity);
      }
      if (shape !== undefined) {
        updates.push(`shape = $${paramIndex++}`);
        values.push(shape);
      }
      if (pos_x !== undefined) {
        updates.push(`pos_x = $${paramIndex++}`);
        values.push(pos_x);
      }
      if (pos_y !== undefined) {
        updates.push(`pos_y = $${paramIndex++}`);
        values.push(pos_y);
      }
      if (width !== undefined) {
        updates.push(`width = $${paramIndex++}`);
        values.push(width);
      }
      if (height !== undefined) {
        updates.push(`height = $${paramIndex++}`);
        values.push(height);
      }
      if (rotation !== undefined) {
        updates.push(`rotation = $${paramIndex++}`);
        values.push(rotation);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE tables SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      emitEvent(fastify, 'table:change', { action: 'updated', table: rows[0] });

      return reply.send(rows[0]);
    }
  );

  // DELETE /tables/:id - hard delete (blocked if future reservations)
  fastify.delete<{ Params: IdParams }>(
    '/tables/:id',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await pool.query('SELECT id, table_number FROM tables WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('Table not found');
      }

      // Block if future active reservations exist
      const { rows: futureRes } = await pool.query(
        `SELECT COUNT(*) AS count FROM reservations r
         JOIN reservation_tables rt ON rt.reservation_id = r.id
         WHERE rt.table_id = $1
           AND r.date >= CURRENT_DATE
           AND r.status NOT IN ('otkazana', 'no_show', 'zavrsena')`,
        [id]
      );

      const activeCount = parseInt(futureRes[0].count, 10);
      if (activeCount > 0) {
        throw new ConflictError(
          `Sto "${existing.rows[0].table_number}" ima ${activeCount} aktivnih budućih rezervacija. Otkažite ili premestite ih pre brisanja.`
        );
      }

      // Hard delete — past reservation_tables rows cascade-removed, reservations stay
      await pool.query('DELETE FROM tables WHERE id = $1', [id]);

      emitEvent(fastify, 'table:change', { action: 'deleted', tableId: parseInt(id) });

      return reply.send({ success: true });
    }
  );

  // PUT /zones/:zoneId/tables/layout - bulk update positions
  fastify.put<{ Params: ZoneIdParams; Body: LayoutItem[] }>(
    '/zones/:zoneId/tables/layout',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { zoneId } = request.params;
      const items = request.body;

      if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('Body must be a non-empty array of layout items');
      }

      await withTransaction(async (client) => {
        for (const item of items) {
          await client.query(
            `UPDATE tables
             SET pos_x = $1, pos_y = $2, width = $3, height = $4, rotation = $5, updated_at = NOW()
             WHERE id = $6 AND zone_id = $7`,
            [item.pos_x, item.pos_y, item.width, item.height, item.rotation, item.id, zoneId]
          );
        }
      });

      emitEvent(fastify, 'table:change', { action: 'layout_updated', zoneId: parseInt(zoneId) });

      const { rows } = await pool.query(
        'SELECT * FROM tables WHERE zone_id = $1 AND is_active = true ORDER BY table_number::int',
        [zoneId]
      );

      return reply.send(rows);
    }
  );
}
