import type { EventBus } from '../plugins/sse.js';
import type { AuthUser } from '../middleware/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => Promise<void>;
    eventBus: EventBus;
  }

  interface FastifyRequest {
    user: AuthUser | { id: number; username: string; role: string } | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; username: string; role: string };
    user: { id: number; username: string; role: string };
  }
}
