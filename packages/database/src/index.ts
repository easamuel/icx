import pg, { PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://icx_admin:icx_secret_password@localhost:5432/icx_studios',
  max: Number(process.env.PG_POOL_MAX || 25),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[ICX-DB] Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a parameterized SQL query against the connection pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Execute a callback inside an ACID PostgreSQL transaction (BEGIN ... COMMIT / ROLLBACK).
 * Supports row-level locking (`SELECT ... FOR UPDATE`) and serializable/read-committed isolation.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Record an immutable audit event inside or outside an active transaction.
 */
export async function recordAuditEvent(
  params: {
    actorId: string | null;
    action: string;
    targetEntity: string;
    targetId?: string | null;
    details?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<void> {
  const sql = `
    INSERT INTO audit_events (actor_id, action, target_entity, target_id, details)
    VALUES ($1, $2, $3, $4, $5::jsonb)
  `;
  const values = [
    params.actorId,
    params.action,
    params.targetEntity,
    params.targetId ?? null,
    JSON.stringify(params.details ?? {}),
  ];
  if (client) {
    await client.query(sql, values);
  } else {
    await pool.query(sql, values);
  }
}

export type { PoolClient, QueryResult, QueryResultRow };

