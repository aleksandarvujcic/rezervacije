import type { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db/pool.js';
import { ForbiddenError } from '../utils/errors.js';
import type { AuthUser } from './auth.js';

type Permission =
  | 'create_reservation'
  | 'create_walkin'
  | 'delete_reservation'
  | 'transfer_table'
  | 'status_no_show'
  | 'status_otkazana'
  | 'status_odlozena';

/**
 * S1: Server-side permission enforcement middleware.
 * Checks role_permissions table for the given permission.
 * Owner always passes (failsafe if table has missing rows).
 */
export function requirePermission(permission: Permission) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user as AuthUser;
    if (!user) {
      throw new ForbiddenError('Insufficient permissions');
    }

    // Owner always has all permissions (failsafe)
    if (user.role === 'owner') return;

    const { rows } = await pool.query<{ allowed: boolean }>(
      'SELECT allowed FROM role_permissions WHERE role = $1 AND permission = $2',
      [user.role, permission]
    );

    // If no row found or not allowed, deny
    if (rows.length === 0 || !rows[0].allowed) {
      throw new ForbiddenError(`Nemate dozvolu za ovu akciju (${permission})`);
    }
  };
}

/**
 * Check if a role has a specific permission (non-middleware version).
 * Used for inline permission checks (e.g., status changes within PATCH).
 */
export async function hasPermission(role: string, permission: Permission): Promise<boolean> {
  if (role === 'owner') return true;

  const { rows } = await pool.query<{ allowed: boolean }>(
    'SELECT allowed FROM role_permissions WHERE role = $1 AND permission = $2',
    [role, permission]
  );

  return rows.length > 0 && rows[0].allowed;
}
