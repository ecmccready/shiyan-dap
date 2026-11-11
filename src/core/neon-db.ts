// Neon Postgres connection handling for production storage and independent anchors.
// Node runtime only. Connection strings come from server env vars and are never logged or returned.
import { Pool, type PoolClient, type PoolConfig } from "pg";

type Env = Record<string, string | undefined>;

export interface CheckedDatabaseUrl {
  /** Stable identity used to prove two URLs point at different databases. Contains no password. */
  identity: { host: string; port: number; database: string; user: string };
  config: PoolConfig;
}
export type DatabaseUrlCheck = { ok: true; value: CheckedDatabaseUrl } | { ok: false; reason: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const IDENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}$/;

/**
 * Accepts postgres:// or postgresql:// URLs with user, password, host and database.
 * TLS with certificate verification is mandatory (sslmode=require or verify-full; both verify the
 * certificate here). sslmode=disable is accepted only for a loopback host outside Vercel, so an
 * adapter can be exercised against a local PostgreSQL; it is never accepted on Vercel.
 * Reasons never include the URL or any part of the password.
 */
export function checkDatabaseUrl(raw: string | undefined, env: Env = process.env): DatabaseUrlCheck {
  if (!raw || !raw.trim()) return { ok: false, reason: "is not set" };
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { ok: false, reason: "is not a valid URL" }; }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return { ok: false, reason: "must use postgres:// or postgresql://" };
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "must include a host" };
  if (!IDENT.test(user)) return { ok: false, reason: "must include a valid role name" };
  if (!password) return { ok: false, reason: "must include a password" };
  if (!IDENT.test(database)) return { ok: false, reason: "must include a valid database name" };
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, reason: "has an invalid port" };
  const sslmode = url.searchParams.get("sslmode");
  let ssl: PoolConfig["ssl"];
  if (sslmode === "require" || sslmode === "verify-full") {
    ssl = { rejectUnauthorized: true, servername: host };
  } else if (sslmode === "disable" && LOOPBACK.has(host) && !env.VERCEL) {
    ssl = false;
  } else {
    return { ok: false, reason: "must set sslmode=require or sslmode=verify-full" };
  }
  return {
    ok: true,
    value: {
      identity: { host, port, database, user },
      config: {
        host, port, user, password, database, ssl,
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
        // Server-side statement_timeout is set per role in the migrations (ALTER ROLE ... SET), not as a
        // startup parameter, because Neon's PgBouncer pooler may reject unknown startup parameters.
        query_timeout: 15_000,
        application_name: "shiyan-dap",
      },
    },
  };
}

/** True when the two URLs reach different databases with different roles. */
export function independentDatabases(a: CheckedDatabaseUrl, b: CheckedDatabaseUrl): boolean {
  const sameDatabase = a.identity.host === b.identity.host && a.identity.port === b.identity.port
    && a.identity.database === b.identity.database;
  return !sameDatabase && a.identity.user !== b.identity.user;
}

// One pool per (purpose, target) per server instance, reused across requests.
const POOLS_KEY = Symbol.for("shiyan-dap.neon-pools");
type PoolCache = Map<string, Pool>;
function poolCache(): PoolCache {
  const holder = globalThis as unknown as Record<symbol, PoolCache | undefined>;
  if (!holder[POOLS_KEY]) holder[POOLS_KEY] = new Map();
  return holder[POOLS_KEY] as PoolCache;
}

export function poolFor(purpose: "storage" | "anchors", checked: CheckedDatabaseUrl): Pool {
  const { host, port, database, user } = checked.identity;
  const key = JSON.stringify([purpose, host, port, database, user]);
  const cache = poolCache();
  let pool = cache.get(key);
  if (!pool) {
    pool = new Pool({ ...checked.config, application_name: `shiyan-dap-${purpose}` });
    // Idle-client errors (e.g. Neon scale-to-zero) must not crash the process; the next query reconnects.
    pool.on("error", () => undefined);
    cache.set(key, pool);
  }
  return pool;
}

/** Runs fn inside a single transaction; rolls back on any error. */
export async function inTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}

export const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";

// TEMPORARY (staging diagnosis only, remove before merge): logs the underlying Postgres/Neon error behind a
// 503 STORE_UNAVAILABLE. Logs only code/severity/routine/errno/syscall and a scrubbed message: never the
// connection string, host credentials or password.
export function logNeonStoreError(context: string, error: unknown, pool?: { options?: { password?: unknown } }): void {
  const e = (typeof error === "object" && error !== null ? error : {}) as Record<string, unknown>;
  const password = typeof pool?.options?.password === "string" ? pool.options.password : "";
  let message = String(e.message ?? error);
  message = message.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[redacted-url]");
  if (password) message = message.split(password).join("[redacted]");
  console.error("[TEMPORARY neon-store-error]", JSON.stringify({
    context,
    code: e.code ?? null,
    severity: e.severity ?? null,
    routine: e.routine ?? null,
    errno: e.errno ?? null,
    syscall: e.syscall ?? null,
    name: e.name ?? null,
    message,
  }));
}
