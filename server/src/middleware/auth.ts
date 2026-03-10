import type { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db/pool.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Invalid or missing token');
  }

  const payload = request.user as { id: number; username: string; role: string };

  const { rows } = await pool.query<AuthUser>(
    'SELECT id, username, display_name, role, is_active FROM users WHERE id = $1',
    [payload.id]
  );

  if (rows.length === 0 || !rows[0].is_active) {
    throw new UnauthorizedError('User not found or inactive');
  }

  request.user = rows[0];
}

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user as AuthUser;

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}
