import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { pool } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { UnauthorizedError, ValidationError } from '../../utils/errors.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthUser } from '../../middleware/auth.js';

interface LoginBody {
  username: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /login — rate limited (K10)
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply
    ) => {
      const { username, password } = request.body;

      if (!username || !password) {
        throw new ValidationError('Username and password are required');
      }

      const { rows } = await pool.query(
        'SELECT id, username, password_hash, display_name, role, is_active FROM users WHERE username = $1',
        [username]
      );

      if (rows.length === 0) {
        throw new UnauthorizedError('Invalid username or password');
      }

      const user = rows[0];

      if (!user.is_active) {
        throw new UnauthorizedError('Account is deactivated');
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new UnauthorizedError('Invalid username or password');
      }

      const tokenPayload = { id: user.id, username: user.username, role: user.role };

      const accessToken = fastify.jwt.sign(tokenPayload, {
        expiresIn: config.jwt.accessExpiresIn,
      });

      const refreshToken = (fastify.jwt as any).refresh.sign(tokenPayload, {
        expiresIn: config.jwt.refreshExpiresIn,
      });

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
        },
      });
    }
  );

  // POST /refresh
  fastify.post(
    '/refresh',
    async (
      request: FastifyRequest<{ Body: RefreshBody }>,
      reply: FastifyReply
    ) => {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
      }

      let payload: { id: number; username: string; role: string };
      try {
        payload = (fastify.jwt as any).refresh.verify(refreshToken) as { id: number; username: string; role: string };
      } catch {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Verify user still exists and is active
      const { rows } = await pool.query(
        'SELECT id, username, role, is_active FROM users WHERE id = $1',
        [payload.id]
      );

      if (rows.length === 0 || !rows[0].is_active) {
        throw new UnauthorizedError('User not found or inactive');
      }

      const user = rows[0];
      const tokenPayload = { id: user.id, username: user.username, role: user.role };

      const accessToken = fastify.jwt.sign(tokenPayload, {
        expiresIn: config.jwt.accessExpiresIn,
      });

      return reply.send({ accessToken });
    }
  );

  // GET /me
  fastify.get(
    '/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as AuthUser;
      return reply.send({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      });
    }
  );
}
