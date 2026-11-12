// Explicit storage backend selection. Production never falls back to the local filesystem silently.
//
//   SHIYAN_STORAGE_BACKEND=neon        -> Neon Postgres via SHIYAN_STORAGE_URL (required, validated)
//   SHIYAN_STORAGE_BACKEND=filesystem  -> local HFMemory files (refused when VERCEL_ENV=production)
//   unset, not on Vercel, no storage URL -> local files (local development and offline tests)
//   anything else (unset on Vercel, invalid value, invalid URL) -> unconfigured: routes answer 503
//
// Documented Preview names (README, 65aa7df / 78ed618): SHIYAN_STORAGE_URL and SHIYAN_ANCHOR_URL.
// SHIYAN_DATABASE_URL and SHIYAN_ANCHOR_DATABASE_URL are accepted only as fallbacks when the
// documented name is unset. If both are set, the documented name wins. Reasons never include a URL
// or password.
import { tenantStore, TENANT_ID_PATTERN } from "./tenant-auth";
import type { ExperienceStoreLike } from "./experience-store";
import { checkDatabaseUrl, poolFor, type CheckedDatabaseUrl } from "./neon-db";
import { NeonExperienceStore } from "./neon-experience-store";

type Env = Record<string, string | undefined>;

export type StorageBackend =
  | { kind: "filesystem" }
  | { kind: "neon"; database: CheckedDatabaseUrl }
  | { kind: "unconfigured"; reason: string };

const empty = (value: string | undefined) => !value || !value.trim();

/** Documented SHIYAN_STORAGE_URL wins over the SHIYAN_DATABASE_URL fallback. */
export function resolvedStorageUrl(env: Env = process.env): string | undefined {
  if (!empty(env.SHIYAN_STORAGE_URL)) return env.SHIYAN_STORAGE_URL!.trim();
  if (!empty(env.SHIYAN_DATABASE_URL)) return env.SHIYAN_DATABASE_URL!.trim();
  return undefined;
}

/** Documented SHIYAN_ANCHOR_URL wins over the SHIYAN_ANCHOR_DATABASE_URL fallback. */
export function resolvedAnchorUrl(env: Env = process.env): string | undefined {
  if (!empty(env.SHIYAN_ANCHOR_URL)) return env.SHIYAN_ANCHOR_URL!.trim();
  if (!empty(env.SHIYAN_ANCHOR_DATABASE_URL)) return env.SHIYAN_ANCHOR_DATABASE_URL!.trim();
  return undefined;
}

export function resolveStorageBackend(env: Env = process.env): StorageBackend {
  const choice = (env.SHIYAN_STORAGE_BACKEND ?? "").trim();
  if (choice === "neon") {
    const checked = checkDatabaseUrl(resolvedStorageUrl(env), env);
    return checked.ok
      ? { kind: "neon", database: checked.value }
      : { kind: "unconfigured", reason: `SHIYAN_STORAGE_URL ${checked.reason}` };
  }
  if (choice === "filesystem") {
    return env.VERCEL_ENV === "production"
      ? { kind: "unconfigured", reason: "filesystem storage is not permitted when VERCEL_ENV=production" }
      : { kind: "filesystem" };
  }
  if (choice !== "") return { kind: "unconfigured", reason: "SHIYAN_STORAGE_BACKEND must be neon or filesystem" };
  if (env.VERCEL) return { kind: "unconfigured", reason: "SHIYAN_STORAGE_BACKEND must be set explicitly on Vercel" };
  if (resolvedStorageUrl(env)) return { kind: "unconfigured", reason: "SHIYAN_STORAGE_URL is set; set SHIYAN_STORAGE_BACKEND=neon explicitly" };
  return { kind: "filesystem" };
}

export type ExperienceStoreResolution =
  | { ok: true; backend: "filesystem" | "neon"; store: ExperienceStoreLike }
  | { ok: false; status: 503; code: "STORAGE_NOT_CONFIGURED"; error: string };

/** The tenant must come from authenticateTenant. Never returns a store for an unconfigured backend. */
export function configuredExperienceStore(tenant: string, env: Env = process.env): ExperienceStoreResolution {
  if (!TENANT_ID_PATTERN.test(tenant)) throw new Error("Invalid tenant id");
  const backend = resolveStorageBackend(env);
  if (backend.kind === "neon") return { ok: true, backend: "neon", store: new NeonExperienceStore(tenant, poolFor("storage", backend.database)) };
  if (backend.kind === "filesystem") return { ok: true, backend: "filesystem", store: tenantStore(tenant) };
  // The reason names env vars only; it never contains a URL or credential.
  return { ok: false, status: 503, code: "STORAGE_NOT_CONFIGURED", error: `Durable storage is not configured: ${backend.reason}` };
}
