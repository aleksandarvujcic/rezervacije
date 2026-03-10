import fp from 'fastify-plugin';
import { EventEmitter } from 'events';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export class EventBus extends EventEmitter {}

export default fp(async function ssePlugin(fastify: FastifyInstance) {
  const eventBus = new EventBus();
  eventBus.setMaxListeners(100);

  fastify.decorate('eventBus', eventBus);

  fastify.get('/api/events', async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
    // K3: Authenticate SSE connections via query token
    const token = request.query.token;
    if (!token) {
      return reply.status(401).send({ error: 'Token required', statusCode: 401 });
    }

    try {
      fastify.jwt.verify(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid token', statusCode: 401 });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write('data: {"type":"connected"}\n\n');

    const keepalive = setInterval(() => {
      reply.raw.write(': keepalive\n\n');
    }, 30000);

    const eventTypes = ['reservation:change', 'table:change', 'zone:change'];

    const listeners: Array<{ event: string; handler: (payload: unknown) => void }> = [];

    for (const eventType of eventTypes) {
      const handler = (payload: unknown) => {
        reply.raw.write(`data: ${JSON.stringify({ type: eventType, payload })}\n\n`);
      };
      eventBus.on(eventType, handler);
      listeners.push({ event: eventType, handler });
    }

    const cleanup = () => {
      clearInterval(keepalive);
      for (const { event, handler } of listeners) {
        eventBus.off(event, handler);
      }
    };

    request.raw.on('close', cleanup);

    // Keep the connection open by not resolving
    await new Promise<void>(() => {});
  });
});
