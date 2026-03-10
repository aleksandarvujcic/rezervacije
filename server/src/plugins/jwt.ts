import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  // Primary JWT plugin for access tokens
  await fastify.register(jwt, {
    secret: config.jwt.secret,
  });

  // Secondary JWT plugin for refresh tokens (separate secret)
  await fastify.register(jwt, {
    secret: config.jwt.refreshSecret,
    namespace: 'refresh',
  });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized', statusCode: 401 });
      }
    }
  );
});
