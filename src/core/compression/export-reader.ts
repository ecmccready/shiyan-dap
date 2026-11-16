// 4D state compression (M5): READ-ONLY reader for the customer proof export. The ONLY compression module a
// route may import, and only src/app/api/v1/customer-proof/[id]/route.ts may (scripts/check-compression-boundary.ts).
// Sends exactly two tenant-scoped SELECTs: shiyan.state_segments on the storage DB and
// shiyan_anchor.state_chain_anchors on the independent anchors DB. Never writes, never logs, never throws:
// any missing table, permission error, timeout or inconsistency becomes a status with no internals.
// Never imports the writers (store.ts, anchor-store.ts) or the I/O module source.ts.
import { checkDatabaseUrl, independentDatabases, poolFor } from "../neon-db";
import { resolveStorageBackend, resolvedAnchorUrl } from "../storage-provider";
import { TENANT_ID_PATTERN } from "../tenant-auth";
import { CHAIN_HEADS_SQL, STATE_ANCHORS_SQL, compareAnchors, parseChainHeads, parseStateAnchors } from "./chain-head";

type Env = Record<string, string | undefined>;

export const STATE_COMPRESSION_FLAG = "SHIYAN_STATE_COMPRESSION";
export const STATE_CHAIN_EXPORT_FORMAT = "aethel.state-chain/1";
const ALLOWED_EXPORT_SQL: readonly string[] = [CHAIN_HEADS_SQL, STATE_ANCHORS_SQL];
const DEFAULT_TIMEOUT_MS = 2_500;

export function isAllowedExportSql(sql: string): boolean {
  return ALLOWED_EXPORT_SQL.includes(sql);
}

/** Off unless exactly "1". When off, the export omits the field entirely (byte-identical to before M5). */
export function stateCompressionExportEnabled(env: Env): boolean {
  return env[STATE_COMPRESSION_FLAG] === "1";
}

export interface QueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface StateChainAnchorExport {
  status: "anchored" | "unanchored" | "mismatch" | "unavailable";
  anchored_seq: number | null;
  anchored_head: string | null;
  anchored_at: string | null;
  anchor_count: number;
  covers_head: boolean;
}

export interface StateCompressionExport {
  format: typeof STATE_CHAIN_EXPORT_FORMAT;
  status: "present" | "absent" | "unavailable" | "inconsistent";
  chain_head: string | null;
  segment_count: number;
  last_seq: number | null;
  sealed_through: string | null;
  points: number;
  loss_mode: "lossless" | "bounded" | null;
  context: boolean;
  anchor: StateChainAnchorExport;
}

const anchorOf = (status: StateChainAnchorExport["status"]): StateChainAnchorExport =>
  ({ status, anchored_seq: null, anchored_head: null, anchored_at: null, anchor_count: 0, covers_head: false });

const empty = (status: StateCompressionExport["status"], anchor: StateChainAnchorExport = anchorOf("unavailable")): StateCompressionExport => ({
  format: STATE_CHAIN_EXPORT_FORMAT, status, chain_head: null, segment_count: 0, last_seq: null,
  sealed_through: null, points: 0, loss_mode: null, context: false, anchor,
});

async function select(client: QueryClient, sql: string, tenant: string, timeoutMs: number): Promise<unknown[]> {
  if (!isAllowedExportSql(sql)) throw new Error("statement is not on the export allowlist");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    const r = await Promise.race([client.query(sql, [tenant]), timeout]);
    return Array.isArray(r?.rows) ? r.rows : [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Pure-with-injected-clients core: reads the tenant's stored chain head and its anchors and summarizes them.
 * `anchors` undefined means the anchors DB is not configured (or not independent): anchor.status "unavailable".
 */
export async function readStateCompressionExport(
  tenant: string,
  clients: { storage?: QueryClient; anchors?: QueryClient },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<StateCompressionExport> {
  try {
    if (typeof tenant !== "string" || !TENANT_ID_PATTERN.test(tenant) || !clients.storage) return empty("unavailable");
    let raw: unknown[];
    try { raw = await select(clients.storage, CHAIN_HEADS_SQL, tenant, timeoutMs); } catch { return empty("unavailable"); }
    const heads = parseChainHeads(raw, tenant);
    if (!heads.ok) return heads.reason === "foreign_row" ? empty("unavailable") : empty("inconsistent");

    let anchor = anchorOf("unavailable");
    if (clients.anchors) {
      try {
        const parsed = parseStateAnchors(await select(clients.anchors, STATE_ANCHORS_SQL, tenant, timeoutMs), tenant);
        if (parsed.ok) {
          const c = compareAnchors(heads.rows.map((h) => h.segment_sha256), parsed.rows);
          anchor = {
            status: c.status,
            anchored_seq: c.status === "anchored" ? c.latest!.seq : null,
            anchored_head: c.status === "anchored" ? c.latest!.chain_head : null,
            anchored_at: c.status === "anchored" ? c.latest!.anchored_at : null,
            anchor_count: parsed.rows.length,
            covers_head: c.covers_head,
          };
        }
      } catch { /* anchors unavailable; the export still answers */ }
    }

    if (heads.rows.length === 0) return empty("absent", anchor);
    const head = heads.rows[heads.rows.length - 1];
    return {
      format: STATE_CHAIN_EXPORT_FORMAT,
      status: "present",
      chain_head: head.segment_sha256,
      segment_count: heads.rows.length,
      last_seq: head.seq,
      sealed_through: head.window_closed_at,
      points: heads.rows.reduce((n, h) => n + h.point_count, 0),
      loss_mode: head.loss_mode,
      context: head.context,
      anchor,
    };
  } catch {
    return empty("unavailable");
  }
}

/**
 * Resolves the storage and anchors pools from env (same rules as the app: SHIYAN_STORAGE_BACKEND=neon, and an
 * anchors URL that reaches a different database with a different role) and reads the export field. Never throws.
 */
export async function stateCompressionForExport(tenant: string, env: Env, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<StateCompressionExport> {
  try {
    const backend = resolveStorageBackend(env);
    if (backend.kind !== "neon") return empty("unavailable");
    const storagePool = poolFor("storage", backend.database);
    const storage: QueryClient = { query: (sql, params) => storagePool.query(sql, params) };
    let anchors: QueryClient | undefined;
    const a = checkDatabaseUrl(resolvedAnchorUrl(env), env);
    if (a.ok && independentDatabases(backend.database, a.value)) {
      const anchorPool = poolFor("anchors", a.value);
      anchors = { query: (sql, params) => anchorPool.query(sql, params) };
    }
    return await readStateCompressionExport(tenant, { storage, anchors }, timeoutMs);
  } catch {
    return empty("unavailable");
  }
}
