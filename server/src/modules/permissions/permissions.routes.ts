import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

interface RolePermission {
  role: string;
  permission: string;
  allowed: boolean;
}

const VALID_PERMISSIONS = [
  'create_reservation',
  'create_walkin',
  'delete_reservation',
  'transfer_table',
  'status_no_show',
  'status_otkazana',
  'status_odlozena',
];

const VALID_ROLES = ['owner', 'manager', 'waiter'];

export default async function permissionsRoutes(fastify: FastifyInstance) {
  // GET /permissions — returns all role permissions
  fastify.get('/', {
    preHandler: [authenticate],
  }, async () => {
    const { rows } = await pool.query<RolePermission>(
      'SELECT role, permission, allowed FROM role_permissions ORDER BY role, permission'
    );
    return rows;
  });

  // PUT /permissions — bulk update (owner only)
  fastify.put('/', {
    preHandler: [authenticate, requireRole('owner')],
  }, async (request) => {
    const { permissions } = request.body as { permissions: RolePermission[] };

    if (!Array.isArray(permissions)) {
      throw new ValidationError('permissions must be an array');
    }

    for (const p of permissions) {
      if (!VALID_ROLES.includes(p.role)) {
        throw new ValidationError(`Invalid role: ${p.role}`);
      }
      if (!VALID_PERMISSIONS.includes(p.permission)) {
        throw new ValidationError(`Invalid permission: ${p.permission}`);
      }
      if (typeof p.allowed !== 'boolean') {
        throw new ValidationError('allowed must be a boolean');
      }
    }

    // Prevent owner from removing their own permissions
    const ownerRemovals = permissions.filter(p => p.role === 'owner' && !p.allowed);
    if (ownerRemovals.length > 0) {
      throw new ValidationError('Ne možete ukloniti dozvole owner roli');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of permissions) {
        await client.query(
          `INSERT INTO role_permissions (role, permission, allowed)
           VALUES ($1, $2, $3)
           ON CONFLICT (role, permission) DO UPDATE SET allowed = $3, updated_at = NOW()`,
          [p.role, p.permission, p.allowed]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await pool.query<RolePermission>(
      'SELECT role, permission, allowed FROM role_permissions ORDER BY role, permission'
    );
    return rows;
  });
}
