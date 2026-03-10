import { pool } from '../db/pool.js';
import type { DbClient } from '../db/pool.js';

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'transfer_table';

/**
 * Write an entry to the audit_log table.
 * Accepts either a transaction client or uses the pool directly.
 */
export async function writeAuditLog(
  params: {
    userId: number;
    action: AuditAction;
    entityType: string;
    entityId: number;
    details?: Record<string, unknown>;
  },
  client?: DbClient
): Promise<void> {
  const queryFn = client ?? pool;
  await queryFn.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.userId,
      params.action,
      params.entityType,
      params.entityId,
      params.details ? JSON.stringify(params.details) : null,
    ]
  );
}
