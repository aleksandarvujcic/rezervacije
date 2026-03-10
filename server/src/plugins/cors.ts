import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config/index.js';
import type { FastifyInstance } from 'fastify';

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });
});
