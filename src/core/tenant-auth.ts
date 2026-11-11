// Server-derived tenant identity. Callers present an API key (Authorization: Bearer <key>);
// the server maps sha256(key) to a tenant via AETHEL_TENANT_KEYS. Unconfigured => fail closed.
// Client-supplied tenant ids, workbench names or headers never establish identity.
import { createHash, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { HFMemory } from "./hf-memory";
import { ExperienceStore, resolveExperienceStoreRoot } from "./experience-store";

export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export type TenantAuth =
  | { ok: true; tenant: string }
  | { ok: false; status: 401 | 503; code: "UNAUTHENTICATED" | "AUTH_NOT_CONFIGURED"; error: string };

type Env = Record<string, string | undefined>;

/** AETHEL_TENANT_KEYS = {"<tenant-id>": "<sha256 hex of that tenant's API key>", ...}. Raw keys are never stored. */
export function loadTenantKeys(env: Env = process.env): Map<string, Buffer> | null {
  const raw = env.AETHEL_TENANT_KEYS;
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const keys = new Map<string, Buffer>();
  const seenHashes = new Set<string>();
  for (const [tenant, hash] of Object.entries(parsed)) {
    if (!TENANT_ID_PATTERN.test(tenant) || typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) return null;
    if (seenHashes.has(hash)) return null;
    seenHashes.add(hash);
    keys.set(tenant, Buffer.from(hash, "hex"));
  }
  return keys.size ? keys : null;
}

export const isTenantAuthConfigured = (env: Env = process.env) => loadTenantKeys(env) !== null;

export function authenticateTenant(request: Request, env: Env = process.env): TenantAuth {
  const keys = loadTenantKeys(env);
  if (!keys) return { ok: false, status: 503, code: "AUTH_NOT_CONFIGURED", error: "Tenant authentication is not configured on this server" };
  const match = /^Bearer ([A-Za-z0-9._~-]{16,256})$/.exec(request.headers.get("authorization") ?? "");
  const fail = { ok: false as const, status: 401 as const, code: "UNAUTHENTICATED" as const, error: "Missing or invalid API key" };
  if (!match) return fail;
  const presented = createHash("sha256").update(match[1]).digest();
  let tenant: string | null = null;
  for (const [id, hash] of keys) if (timingSafeEqual(presented, hash) && tenant === null) tenant = id;
  return tenant ? { ok: true, tenant } : fail;
}

/** Each tenant gets its own directory; the legacy founder-z store at the root is never a tenant store. */
export function tenantRoot(tenant: string, env: Env = process.env): string {
  if (!TENANT_ID_PATTERN.test(tenant)) throw new Error("Invalid tenant id");
  return join(resolveExperienceStoreRoot(env), "tenants", tenant);
}
export const tenantStore = (tenant: string) => new ExperienceStore(new HFMemory(tenantRoot(tenant)))