import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { pool } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';

interface CreateUserBody {
  username: string;
  password: string;
  display_name: string;
  role: string;
}

interface UpdateUserBody {
  username?: string;
  password?: string;
  display_name?: string;
  role?: string;
  is_active?: boolean;
}

interface IdParams {
  id: string;
}

const SALT_ROUNDS = 10;

export default async function usersRoutes(fastify: FastifyInstance) {
  // All routes require authentication and manager/owner role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('manager', 'owner'));

  // GET / - list all users
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { rows } = await pool.query(
      'SELECT id, username, display_name, role, is_active, created_at, updated_at FROM users ORDER BY id'
    );
    return reply.send(rows);
  });

  // POST / - create user
  fastify.post(
    '/',
    async (
      request: FastifyRequest<{ Body: CreateUserBody }>,
      reply: FastifyReply
    ) => {
      const { username, password, display_name, role } = request.body;

      if (!username || !password || !display_name || !role) {
        throw new ValidationError('username, password, display_name, and role are required');
      }

      const validRoles = ['owner', 'manager', 'waiter'];
      if (!validRoles.includes(role)) {
        throw new ValidationError(`role must be one of: ${validRoles.join(', ')}`);
      }

      // Check for duplicate username
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (existing.rows.length > 0) {
        throw new ConflictError('Username already exists');
      }

      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, display_name, role, is_active, created_at, updated_at`,
        [username, password_hash, display_name, role]
      );

      return reply.status(201).send(rows[0]);
    }
  );

  // PATCH /:id - update user
  fastify.patch(
    '/:id',
    async (
      request: FastifyRequest<{ Params: IdParams; Body: UpdateUserBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { username, password, display_name, role, is_active } = request.body;

      // Check user exists
      const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (username !== undefined) {
        // Check uniqueness
        const dup = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, id]
        );
        if (dup.rows.length > 0) {
          throw new ConflictError('Username already exists');
        }
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
      }

      if (password !== undefined) {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(password_hash);
      }

      if (display_name !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        values.push(display_name);
      }

      if (role !== undefined) {
        const validRoles = ['owner', 'manager', 'waiter'];
        if (!validRoles.includes(role)) {
          throw new ValidationError(`role must be one of: ${validRoles.join(', ')}`);
        }
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
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
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, username, display_name, role, is_active, created_at, updated_at`,
        values
      );

      return reply.send(rows[0]);
    }
  );

  // DELETE /:id - soft delete
  fastify.delete(
    '/:id',
    async (
      request: FastifyRequest<{ Params: IdParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const { rows } = await pool.query(
        `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1
         RETURNING id, username, display_name, role, is_active`,
        [id]
      );

      if (rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      return reply.send(rows[0]);
    }
  );
}
