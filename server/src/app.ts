import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Fastify, { type FastifyError } from 'fastify';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import ssePlugin from './plugins/sse.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import zonesRoutes from './modules/zones/zones.routes.js';
import tablesRoutes from './modules/tables/tables.routes.js';
import floorPlansRoutes from './modules/floor-plans/floor-plans.routes.js';
import workingHoursRoutes from './modules/working-hours/working-hours.routes.js';
import reservationsRoutes from './modules/reservations/reservations.routes.js';
import availabilityRoutes from './modules/availability/availability.routes.js';
import eventsRoutes from './modules/events/events.routes.js';
import { AppError } from './utils/errors.js';
import { pool } from './db/pool.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 1_048_576, // 1 MB request body limit (B8)
  });

  // Security headers (S9)
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // CSP managed by frontend
  });

  // Rate limiting (K10)
  await fastify.register(rateLimit, {
    global: false, // only apply to specific routes
  });

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(ssePlugin);

  // Health check with DB ping
  fastify.get('/api/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
    } catch {
      return reply.status(503).send({ status: 'error', message: 'Database connection failed' });
    }
  });

  // Register route modules
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(usersRoutes, { prefix: '/api/users' });
  await fastify.register(zonesRoutes, { prefix: '/api/zones' });
  await fastify.register(tablesRoutes, { prefix: '/api' });
  await fastify.register(floorPlansRoutes, { prefix: '/api' });
  await fastify.register(workingHoursRoutes, { prefix: '/api/working-hours' });
  await fastify.register(reservationsRoutes, { prefix: '/api/reservations' });
  await fastify.register(availabilityRoutes, { prefix: '/api' });
  await fastify.register(eventsRoutes, { prefix: '/api/events' });

  // Serve client static files in production
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    await fastify.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: non-API routes serve index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Not found', statusCode: 404 });
      }
      return reply.sendFile('index.html');
    });
  }

  // Global error handler
  fastify.setErrorHandler((error: FastifyError | AppError, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        statusCode: error.statusCode,
      });
    }

    // Fastify validation errors
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: error.message,
        statusCode: 400,
      });
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Previše zahteva. Pokušajte ponovo za minut.',
        statusCode: 429,
      });
    }

    // Default
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      statusCode: 500,
    });
  });

  return fastify;
}
