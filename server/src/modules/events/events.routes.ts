import type { FastifyInstance } from 'fastify';

export function emitEvent(
  fastify: FastifyInstance,
  type: string,
  payload: unknown
): void {
  fastify.eventBus.emit(type, payload);
}

export default async function eventsRoutes(_fastify: FastifyInstance) {
  // No additional routes — the SSE endpoint is registered in the sse plugin.
  // This module only exports the emitEvent helper.
}
