// 4D state compression (M2): read-only tenant source over shiyan.experiences.
// Sends only BEGIN READ ONLY, one tenant-scoped SELECT, and COMMIT/ROLLBACK. Never writes, never logs.
// The URL is checked by the caller (checkDatabaseUrl); connection strings never reach this module's output.
// Not imported by index.ts, any route, Level 4, MetamorphicEngine or metamorphic-runtime.
import { poolFor, type CheckedDatabaseUrl } from "../neon-db";
import { TENANT_ID_PATTERN } from "../tenant-auth";
import type { SourceRow } from "./types";

/** Exactly the statements this module may send. Anything else is refused before it reaches the client. */
export const READ_ONLY_BEGIN = "BEGIN READ ONLY";
export const TENANT_ROWS_SQL = "SELECT tenant_id, experience_id, record_json, content_sha256, proof_timestamp "
  + "FROM shiyan.experiences WHERE tenant_id = $1 ORDER BY proof_timestamp, experience_id";
const ALLOWED_SQL: readonly string[] = [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "COMMIT", "ROLLBACK"];

export function isAllowedReadOnlySql(sql: string): boolean {
  return ALLOWED_SQL.includes(sql);
}

/** Minimal client surface (a pg PoolClient satisfies it); lets tests pass a recording mock. */
export interface ReadOnlyClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export class ReadOnlySqlRefused extends Error {
  constructor() {
    super("statement is not on the read-only allowlist");
    this.name = "ReadOnlySqlRefused";
  }
}

async function send(client: ReadOnlyClient, sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
  if (!isAllowedReadOnlySql(sql)) throw new ReadOnlySqlRefused();
  return params === undefined ? client.query(sql) : client.query(sql, params);
}

/**
 * Converts one raw pg row to the M1 SourceRow shape. proof_timestamp: a valid Date becomes toISOString();
 * a string passes through; anything else (or an invalid Date) becomes a non-string so M1 excludes it
 * (invalid_row) rather than guessing.
 */
export function toSourceRow(raw: unknown): SourceRow {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const ts = r.proof_timestamp;
  let proof_timestamp: unknown = null;
  if (ts instanceof Date) proof_timestamp = Number.isFinite(ts.getTime()) ? ts.toISOString() : null;
  else if (typeof ts === "string") proof_timestamp = ts;
  return {
    tenant_id: r.tenant_id, experience_id: r.experience_id, record_json: r.record_json,
    content_sha256: r.content_sha256, proof_timestamp,
  } as SourceRow;
}

export interface TenantRows {
  tenant_id: string;
  rows: SourceRow[];
  /** Rows the database returned for any other tenant. Dropped here (defence in depth); never passed on. */
  foreign_dropped: number;
}

/** Reads one tenant's rows inside a READ ONLY transaction. Rolls back on any error and rethrows it. */
export async function readTenantRows(client: ReadOnlyClient, tenant: string): Promise<TenantRows> {
  if (typeof tenant !== "string" || !TENANT_ID_PATTERN.test(tenant)) throw new TypeError("tenant must match TENANT_ID_PATTERN");
  await send(client, READ_ONLY_BEGIN);
  try {
    const result = await send(client, TENANT_ROWS_SQL, [tenant]);
    await send(client, "COMMIT");
    const rows: SourceRow[] = [];
    let foreign_dropped = 0;
    for (const raw of Array.isArray(result?.rows) ? result.rows : []) {
      const row = toSourceRow(raw);
      if (row.tenant_id === tenant) rows.push(row); else foreign_dropped += 1;
    }
    return { tenant_id: tenant, rows, foreign_dropped };
  } catch (error) {
    try { await send(client, "ROLLBACK"); } catch { /* the original error is what matters */ }
    throw error;
  }
}

/** Opens one storage connection for a checked URL. close() releases the client and ends the pool. */
export async function openStorageClient(checked: CheckedDatabaseUrl): Promise<{ client: ReadOnlyClient; close: () => Promise<void> }> {
  const pool = poolFor("storage", checked);
  const pc = await pool.connect().catch(async (error: unknown) => {
    await pool.end().catch(() => undefined);
    throw error;
  });
  const client: ReadOnlyClient = { query: (sql, params) => pc.query(sql, params) };
  return {
    client,
    close: async () => {
      pc.release();
      await pool.end().catch(() => undefined);
    },
  };
}
