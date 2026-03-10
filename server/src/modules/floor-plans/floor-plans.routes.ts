import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

interface ZoneIdParams {
  zoneId: string;
}

interface UpdateFloorPlanBody {
  canvas_width?: number;
  canvas_height?: number;
  background_image_url?: string | null;
}

export default async function floorPlansRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /zones/:zoneId/floor-plan
  fastify.get<{ Params: ZoneIdParams }>(
    '/zones/:zoneId/floor-plan',
    async (request, reply) => {
      const { zoneId } = request.params;

      const { rows } = await pool.query(
        'SELECT * FROM floor_plans WHERE zone_id = $1',
        [zoneId]
      );

      if (rows.length === 0) {
        // Return defaults if no floor plan exists yet
        return reply.send({
          zone_id: parseInt(zoneId),
          canvas_width: 1200,
          canvas_height: 800,
          background_image_url: null,
        });
      }

      return reply.send(rows[0]);
    }
  );

  // PUT /zones/:zoneId/floor-plan
  fastify.put<{ Params: ZoneIdParams; Body: UpdateFloorPlanBody }>(
    '/zones/:zoneId/floor-plan',
    { preHandler: [requireRole('manager', 'owner')] },
    async (request, reply) => {
      const { zoneId } = request.params;
      const { canvas_width, canvas_height, background_image_url } = request.body;

      // Verify zone exists
      const zoneCheck = await pool.query('SELECT id FROM zones WHERE id = $1', [zoneId]);
      if (zoneCheck.rows.length === 0) {
        throw new NotFoundError('Zone not found');
      }

      if (canvas_width !== undefined && canvas_width <= 0) {
        throw new ValidationError('canvas_width must be positive');
      }
      if (canvas_height !== undefined && canvas_height <= 0) {
        throw new ValidationError('canvas_height must be positive');
      }

      // Upsert
      const { rows } = await pool.query(
        `INSERT INTO floor_plans (zone_id, canvas_width, canvas_height, background_image_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (zone_id)
         DO UPDATE SET
           canvas_width = COALESCE($2, floor_plans.canvas_width),
           canvas_height = COALESCE($3, floor_plans.canvas_height),
           background_image_url = $4,
           updated_at = NOW()
         RETURNING *`,
        [
          zoneId,
          canvas_width ?? 1200,
          canvas_height ?? 800,
          background_image_url ?? null,
        ]
      );

      return reply.send(rows[0]);
    }
  );
}
