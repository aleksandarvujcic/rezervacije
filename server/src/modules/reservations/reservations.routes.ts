import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthUser } from '../../middleware/auth.js';
import { requirePermission, hasPermission } from '../../middleware/permissions.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../utils/errors.js';
import { emitEvent } from '../events/events.routes.js';
import { normalizeTime, addMinutesToTime, validateDateFormat, validateTimeFormat, formatPgDate } from '../../utils/time.js';
import { isValidStatus, isValidTransition } from '../../utils/statusTransitions.js';
import { checkTableOverlap } from '../../utils/overlapCheck.js';
import { writeAuditLog } from '../../utils/auditLog.js';

// ---------- Types ----------

interface ListQuery {
  date?: string;
  status?: string;
  zone?: string;
}

interface IdParams {
  id: string;
}

interface CreateBody {
  guest_name: string;
  guest_phone?: string;
  guest_count: number;
  date: string;
  start_time: string;
  duration_minutes?: number;
  table_ids: number[];
  reservation_type?: string;
  notes?: string;
  celebration_details?: string;
}

interface UpdateBody {
  guest_name?: string;
  guest_phone?: string;
  guest_count?: number;
  date?: string;
  start_time?: string;
  duration_minutes?: number;
  table_ids?: number[];
  status?: string;
  reservation_type?: string;
  notes?: string;
  celebration_details?: string;
}

interface WalkinBody {
  guest_name: string;
  guest_count: number;
  table_ids: number[];
  date?: string;
  start_time?: string;
  duration_minutes?: number;
}

// ---------- Helpers ----------

const FULL_RESERVATION_QUERY = `
  SELECT r.*,
         u.display_name AS created_by_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', t.id,
               'table_id', t.id,
               'table_number', t.table_number,
               'zone_id', t.zone_id,
               'capacity', t.capacity
             )
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'
         ) AS tables
  FROM reservations r
  LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
  LEFT JOIN tables t ON t.id = rt.table_id
  LEFT JOIN users u ON u.id = r.created_by
`;

/**
 * K7: Validate date format (YYYY-MM-DD)
 */
function requireValidDate(date: string): void {
  if (!validateDateFormat(date)) {
    throw new ValidationError('Datum mora biti u formatu YYYY-MM-DD');
  }
}

/**
 * K7: Validate time format (HH:mm)
 */
function requireValidTime(time: string): void {
  if (!validateTimeFormat(time)) {
    throw new ValidationError('Vreme mora biti u formatu HH:mm');
  }
}

/**
 * K8: Validate duration
 */
function requireValidDuration(minutes: number): void {
  if (minutes < 15) {
    throw new ValidationError('Trajanje mora biti najmanje 15 minuta');
  }
  if (minutes > 480) {
    throw new ValidationError('Trajanje ne može biti duže od 8 sati');
  }
}

/**
 * K9: Check if reservation crosses midnight — not allowed
 */
function checkMidnightCrossing(startTime: string, endTime: string): void {
  if (endTime <= startTime && endTime !== '00:00') {
    throw new ValidationError(
      'Rezervacija ne može prelaziti ponoć. Podelite na dva dela ili skratite trajanje.'
    );
  }
}

/**
 * S5: Validate guest count against table capacity
 */
async function checkCapacity(
  client: import('pg').PoolClient,
  tableIds: number[],
  guestCount: number
): Promise<void> {
  const placeholders = tableIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(capacity), 0) AS total_capacity FROM tables WHERE id IN (${placeholders})`,
    tableIds
  );
  const totalCapacity = parseInt(rows[0].total_capacity, 10);
  if (guestCount > totalCapacity) {
    throw new ValidationError(
      `Broj gostiju (${guestCount}) prelazi kapacitet izabranih stolova (${totalCapacity} mesta)`
    );
  }
}

/** Map status to the permission required for that status transition */
const STATUS_PERMISSION_MAP: Record<string, string> = {
  otkazana: 'status_otkazana',
  no_show: 'status_no_show',
  odlozena: 'status_odlozena',
};

// ---------- Routes ----------

export default async function reservationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / - list with filters
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    async (request, reply) => {
      const { date, status, zone } = request.query;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (date) {
        conditions.push(`r.date = $${paramIndex++}`);
        values.push(date);
      }
      if (status) {
        conditions.push(`r.status = $${paramIndex++}`);
        values.push(status);
      }
      if (zone) {
        conditions.push(`t.zone_id = $${paramIndex++}`);
        values.push(zone);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const { rows } = await pool.query(
        `${FULL_RESERVATION_QUERY}
         ${whereClause}
         GROUP BY r.id, u.display_name
         ORDER BY r.date, r.start_time`,
        values
      );

      return reply.send(rows);
    }
  );

  // GET /:id - get single reservation
  fastify.get<{ Params: IdParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      const { rows } = await pool.query(
        `${FULL_RESERVATION_QUERY}
         WHERE r.id = $1
         GROUP BY r.id, u.display_name`,
        [id]
      );

      if (rows.length === 0) {
        throw new NotFoundError('Reservation not found');
      }

      return reply.send(rows[0]);
    }
  );

  // POST / - create reservation (S1: permission enforced)
  fastify.post<{ Body: CreateBody }>(
    '/',
    { preHandler: [requirePermission('create_reservation')] },
    async (request, reply) => {
      const {
        guest_name,
        guest_phone,
        guest_count,
        date,
        start_time,
        duration_minutes = 120,
        table_ids,
        reservation_type = 'standard',
        notes,
        celebration_details,
      } = request.body;

      const user = request.user as AuthUser;

      if (!guest_name || !date || !start_time) {
        throw new ValidationError('guest_name, date, and start_time are required');
      }
      if (!table_ids || table_ids.length === 0) {
        throw new ValidationError('At least one table must be selected');
      }

      // K7: Validate formats
      requireValidDate(date);
      requireValidTime(start_time);
      // K8: Validate duration
      requireValidDuration(duration_minutes);
      // Validate guest count
      if (guest_count < 1) {
        throw new ValidationError('Broj gostiju mora biti najmanje 1');
      }

      const end_time = addMinutesToTime(start_time, duration_minutes);
      const status = reservation_type === 'walkin' ? 'seated' : 'nova';

      // K9: Check midnight crossing
      checkMidnightCrossing(start_time, end_time);

      const reservation = await withTransaction(async (client) => {
        // S5: Check capacity
        await checkCapacity(client, table_ids, guest_count);

        // Check working hours
        const dayOfWeek = new Date(date).getDay();
        const { rows: whRows } = await client.query(
          'SELECT * FROM working_hours WHERE day_of_week = $1',
          [dayOfWeek]
        );

        // S7: If no working hours configured, reject (safety default)
        if (whRows.length === 0) {
          throw new ValidationError(
            'Radno vreme nije podešeno za ovaj dan. Kontaktirajte menadžera.'
          );
        }

        const wh = whRows[0];
        if (wh.is_closed) {
          throw new ValidationError('Restaurant is closed on this day');
        }
        const whOpen = normalizeTime(wh.open_time);
        const whClose = normalizeTime(wh.close_time);
        const normStart = normalizeTime(start_time);
        const normEnd = normalizeTime(end_time);
        if (normStart < whOpen || normEnd > whClose) {
          throw new ValidationError(
            `Reservation must be within working hours (${whOpen} - ${whClose})`
          );
        }

        // Check seasonal zone validity
        for (const tableId of table_ids) {
          const { rows: tableRows } = await client.query(
            `SELECT t.id, z.is_seasonal, z.season_start, z.season_end
             FROM tables t
             JOIN zones z ON z.id = t.zone_id
             WHERE t.id = $1`,
            [tableId]
          );

          if (tableRows.length === 0) {
            throw new NotFoundError(`Table ${tableId} not found`);
          }

          const zone = tableRows[0];
          if (zone.is_seasonal && zone.season_start && zone.season_end) {
            if (date < zone.season_start || date > zone.season_end) {
              throw new ValidationError(
                `Table ${tableId} is in a seasonal zone not active on ${date}`
              );
            }
          }
        }

        // A5: Centralized overlap check
        await checkTableOverlap(client, table_ids, date, start_time, end_time);

        // Create reservation
        const { rows: resRows } = await client.query(
          `INSERT INTO reservations
           (reservation_type, status, guest_name, guest_phone, guest_count,
            date, start_time, end_time, duration_minutes, notes, celebration_details,
            created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
           RETURNING *`,
          [
            reservation_type,
            status,
            guest_name,
            guest_phone || null,
            guest_count || 2,
            date,
            start_time,
            end_time,
            duration_minutes,
            notes || null,
            celebration_details || null,
            user.id,
          ]
        );

        const reservation = resRows[0];

        // Link tables
        for (const tableId of table_ids) {
          await client.query(
            'INSERT INTO reservation_tables (reservation_id, table_id) VALUES ($1, $2)',
            [reservation.id, tableId]
          );
        }

        // Audit log
        await writeAuditLog({
          userId: user.id,
          action: 'create',
          entityType: 'reservation',
          entityId: reservation.id,
          details: {
            guest_name,
            guest_count,
            date,
            start_time,
            duration_minutes,
            table_ids,
            reservation_type,
          },
        }, client);

        return reservation;
      });

      // Fetch full reservation with tables
      const { rows: fullRows } = await pool.query(
        `${FULL_RESERVATION_QUERY}
         WHERE r.id = $1
         GROUP BY r.id, u.display_name`,
        [reservation.id]
      );

      emitEvent(fastify, 'reservation:change', {
        action: 'created',
        reservation: fullRows[0],
      });

      return reply.status(201).send(fullRows[0]);
    }
  );

  // PATCH /:id - update reservation
  fastify.patch<{ Params: IdParams; Body: UpdateBody }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as AuthUser;
      const {
        guest_name,
        guest_phone,
        guest_count,
        date,
        start_time,
        duration_minutes,
        table_ids,
        status,
        reservation_type,
        notes,
        celebration_details,
      } = request.body;

      // K7: Validate formats if provided
      if (date !== undefined) requireValidDate(date);
      if (start_time !== undefined) requireValidTime(start_time);
      // K8: Validate duration if provided
      if (duration_minutes !== undefined) requireValidDuration(duration_minutes);
      // Validate guest count if provided
      if (guest_count !== undefined && guest_count < 1) {
        throw new ValidationError('Broj gostiju mora biti najmanje 1');
      }

      await withTransaction(async (client) => {
        // Fetch existing reservation
        const { rows: existing } = await client.query(
          'SELECT * FROM reservations WHERE id = $1',
          [id]
        );
        if (existing.length === 0) {
          throw new NotFoundError('Reservation not found');
        }

        const res = existing[0];

        // K2: Validate status transition
        if (status !== undefined) {
          if (!isValidStatus(status)) {
            throw new ValidationError(`Nevažeći status: ${status}`);
          }
          if (!isValidTransition(res.status, status)) {
            throw new ValidationError(
              `Nedozvoljena promena statusa: ${res.status} → ${status}`
            );
          }

          // S1: Check permission for restricted status changes
          const requiredPermission = STATUS_PERMISSION_MAP[status];
          if (requiredPermission) {
            const allowed = await hasPermission(user.role, requiredPermission as any);
            if (!allowed) {
              throw new ForbiddenError(`Nemate dozvolu za promenu statusa u "${status}"`);
            }
          }
        }

        // S1: Check permission for table transfer
        if (table_ids && table_ids.length > 0) {
          const currentTableIds = (await client.query(
            'SELECT table_id FROM reservation_tables WHERE reservation_id = $1',
            [id]
          )).rows.map((r: { table_id: number }) => r.table_id);

          const tablesChanged = table_ids.length !== currentTableIds.length ||
            !table_ids.every((tid) => currentTableIds.includes(tid));

          if (tablesChanged) {
            const allowed = await hasPermission(user.role, 'transfer_table');
            if (!allowed) {
              throw new ForbiddenError('Nemate dozvolu za transfer stola');
            }
          }
        }

        // Build updated values
        const newStartTime = start_time ?? res.start_time;
        const newDuration = duration_minutes ?? res.duration_minutes;
        const newEndTime =
          start_time || duration_minutes
            ? addMinutesToTime(
                typeof newStartTime === 'string'
                  ? newStartTime
                  : newStartTime.toString().slice(0, 5),
                newDuration
              )
            : res.end_time;
        const newDate = date ?? res.date;

        // K9: Check midnight crossing if time is changing
        if (start_time || duration_minutes) {
          const effectiveStartStr = typeof newStartTime === 'string'
            ? newStartTime
            : newStartTime.toString().slice(0, 5);
          const effectiveEndStr = typeof newEndTime === 'string'
            ? newEndTime
            : newEndTime.toString().slice(0, 5);
          checkMidnightCrossing(effectiveStartStr, effectiveEndStr);
        }

        // S5: Check capacity if guest count or tables change
        if (guest_count !== undefined || (table_ids && table_ids.length > 0)) {
          const effectiveGuestCount = guest_count ?? res.guest_count;
          const effectiveTableIds = table_ids && table_ids.length > 0
            ? table_ids
            : (await client.query('SELECT table_id FROM reservation_tables WHERE reservation_id = $1', [id]))
                .rows.map((r: { table_id: number }) => r.table_id);
          if (effectiveTableIds.length > 0) {
            await checkCapacity(client, effectiveTableIds, effectiveGuestCount);
          }
        }

        // Build update query
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (guest_name !== undefined) {
          updates.push(`guest_name = $${paramIndex++}`);
          values.push(guest_name);
        }
        if (guest_phone !== undefined) {
          updates.push(`guest_phone = $${paramIndex++}`);
          values.push(guest_phone);
        }
        if (guest_count !== undefined) {
          updates.push(`guest_count = $${paramIndex++}`);
          values.push(guest_count);
        }
        if (date !== undefined) {
          updates.push(`date = $${paramIndex++}`);
          values.push(date);
        }
        if (start_time !== undefined) {
          updates.push(`start_time = $${paramIndex++}`);
          values.push(start_time);
        }
        if (start_time || duration_minutes) {
          updates.push(`end_time = $${paramIndex++}`);
          values.push(newEndTime);
        }
        if (duration_minutes !== undefined) {
          updates.push(`duration_minutes = $${paramIndex++}`);
          values.push(duration_minutes);
        }
        if (status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          values.push(status);
        }
        if (reservation_type !== undefined) {
          updates.push(`reservation_type = $${paramIndex++}`);
          values.push(reservation_type);
        }
        if (notes !== undefined) {
          updates.push(`notes = $${paramIndex++}`);
          values.push(notes);
        }
        if (celebration_details !== undefined) {
          updates.push(`celebration_details = $${paramIndex++}`);
          values.push(celebration_details);
        }

        updates.push(`updated_by = $${paramIndex++}`);
        values.push(user.id);
        updates.push(`updated_at = NOW()`);

        if (updates.length > 2) {
          // More than just updated_by and updated_at
          values.push(id);
          await client.query(
            `UPDATE reservations SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
          );
        }

        // A5: Centralized overlap check when time changes (without new table_ids)
        if ((start_time || duration_minutes) && !(table_ids && table_ids.length > 0)) {
          const { rows: currentTables } = await client.query(
            'SELECT table_id FROM reservation_tables WHERE reservation_id = $1',
            [id]
          );
          const currentTableIds = currentTables.map((t: { table_id: number }) => t.table_id);

          if (currentTableIds.length > 0) {
            const effectiveDate = formatPgDate(newDate);
            const effectiveEndTime =
              typeof newEndTime === 'string' ? newEndTime : newEndTime.toString().slice(0, 5);
            const effectiveStartTime =
              typeof newStartTime === 'string'
                ? newStartTime
                : newStartTime.toString().slice(0, 5);

            await checkTableOverlap(
              client, currentTableIds, effectiveDate, effectiveStartTime, effectiveEndTime, parseInt(id)
            );
          }
        }

        // Reassign tables if provided
        if (table_ids && table_ids.length > 0) {
          const effectiveDate = formatPgDate(newDate);
          const effectiveEndTime =
            typeof newEndTime === 'string' ? newEndTime : newEndTime.toString().slice(0, 5);
          const effectiveStartTime =
            typeof newStartTime === 'string'
              ? newStartTime
              : newStartTime.toString().slice(0, 5);

          // A5: Centralized overlap check for new tables
          await checkTableOverlap(
            client, table_ids, effectiveDate, effectiveStartTime, effectiveEndTime, parseInt(id)
          );

          // Remove old table links and create new ones
          await client.query(
            'DELETE FROM reservation_tables WHERE reservation_id = $1',
            [id]
          );
          for (const tableId of table_ids) {
            await client.query(
              'INSERT INTO reservation_tables (reservation_id, table_id) VALUES ($1, $2)',
              [id, tableId]
            );
          }
        }

        // Audit log for updates
        const auditDetails: Record<string, unknown> = {};
        if (status !== undefined) {
          auditDetails.old_status = res.status;
          auditDetails.new_status = status;
        }
        if (table_ids) auditDetails.new_table_ids = table_ids;
        if (guest_name !== undefined) auditDetails.guest_name = guest_name;
        if (date !== undefined) auditDetails.date = date;
        if (start_time !== undefined) auditDetails.start_time = start_time;
        if (duration_minutes !== undefined) auditDetails.duration_minutes = duration_minutes;

        const auditAction = status !== undefined && status !== res.status
          ? (table_ids ? 'transfer_table' : 'status_change')
          : (table_ids ? 'transfer_table' : 'update');

        await writeAuditLog({
          userId: user.id,
          action: auditAction,
          entityType: 'reservation',
          entityId: parseInt(id),
          details: auditDetails,
        }, client);
      });

      // Fetch updated reservation
      const { rows } = await pool.query(
        `${FULL_RESERVATION_QUERY}
         WHERE r.id = $1
         GROUP BY r.id, u.display_name`,
        [id]
      );

      emitEvent(fastify, 'reservation:change', {
        action: 'updated',
        reservation: rows[0],
      });

      return reply.send(rows[0]);
    }
  );

  // DELETE /:id — K5: restricted to manager/owner + S1: permission enforced
  fastify.delete<{ Params: IdParams }>(
    '/:id',
    { preHandler: [requirePermission('delete_reservation')] },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as AuthUser;

      const { rows } = await pool.query(
        'SELECT * FROM reservations WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        throw new NotFoundError('Reservation not found');
      }

      const reservation = rows[0];

      await pool.query('DELETE FROM reservations WHERE id = $1', [id]);

      // Audit log
      await writeAuditLog({
        userId: user.id,
        action: 'delete',
        entityType: 'reservation',
        entityId: parseInt(id),
        details: {
          guest_name: reservation.guest_name,
          date: formatPgDate(reservation.date),
          start_time: reservation.start_time,
          status: reservation.status,
        },
      });

      emitEvent(fastify, 'reservation:change', {
        action: 'deleted',
        reservationId: parseInt(id),
      });

      return reply.send({ success: true });
    }
  );

  // POST /walkin - quick walk-in (S1: permission enforced)
  fastify.post<{ Body: WalkinBody }>(
    '/walkin',
    { preHandler: [requirePermission('create_walkin')] },
    async (request, reply) => {
      const {
        guest_name,
        guest_count,
        table_ids,
        date: clientDate,
        start_time: customStartTime,
        duration_minutes: customDuration,
      } = request.body;
      const user = request.user as AuthUser;

      if (!guest_name) {
        throw new ValidationError('guest_name is required');
      }
      if (!table_ids || table_ids.length === 0) {
        throw new ValidationError('At least one table must be selected');
      }
      if (guest_count < 1) {
        throw new ValidationError('Broj gostiju mora biti najmanje 1');
      }

      // K6: Accept date from client (avoids UTC timezone issue)
      const now = new Date();
      const date = clientDate ??
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const duration = customDuration ?? 120;
      const start_time = customStartTime ??
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // K7: Validate formats
      requireValidDate(date);
      requireValidTime(start_time);
      // K8: Validate duration
      requireValidDuration(duration);

      const end_time = addMinutesToTime(start_time, duration);

      // K9: Check midnight crossing
      checkMidnightCrossing(start_time, end_time);

      const reservation = await withTransaction(async (client) => {
        // S5: Check capacity
        await checkCapacity(client, table_ids, guest_count);

        // A5: Centralized overlap check
        await checkTableOverlap(client, table_ids, date, start_time, end_time);

        const { rows: resRows } = await client.query(
          `INSERT INTO reservations
           (reservation_type, status, guest_name, guest_count, date, start_time, end_time,
            duration_minutes, created_by, updated_by)
           VALUES ('walkin', 'seated', $1, $2, $3, $4, $5, $6, $7, $7)
           RETURNING *`,
          [guest_name, guest_count || 2, date, start_time, end_time, duration, user.id]
        );

        const reservation = resRows[0];

        for (const tableId of table_ids) {
          await client.query(
            'INSERT INTO reservation_tables (reservation_id, table_id) VALUES ($1, $2)',
            [reservation.id, tableId]
          );
        }

        // Audit log
        await writeAuditLog({
          userId: user.id,
          action: 'create',
          entityType: 'reservation',
          entityId: reservation.id,
          details: {
            guest_name,
            guest_count,
            date,
            start_time,
            duration_minutes: duration,
            table_ids,
            reservation_type: 'walkin',
          },
        }, client);

        return reservation;
      });

      // Fetch full reservation
      const { rows: fullRows } = await pool.query(
        `${FULL_RESERVATION_QUERY}
         WHERE r.id = $1
         GROUP BY r.id, u.display_name`,
        [reservation.id]
      );

      emitEvent(fastify, 'reservation:change', {
        action: 'created',
        reservation: fullRows[0],
      });

      return reply.status(201).send(fullRows[0]);
    }
  );

}
