import type { IndependentReferenceAnchors, ReferenceEnvelopeStore } from "./github-reference";
import { checkDatabaseUrl, independentDatabases, poolFor } from "./neon-db";
import { NeonReferenceAnchors, NeonReferenceEnvelopes } from "./neon-reference-store";
import { resolveStorageBackend, resolvedAnchorUrl } from "./storage-provider";

type Env = Record<string, string | undefined>;

export interface ReferenceStorage {
  anchors: IndependentReferenceAnchors;
  envelopes: ReferenceEnvelopeStore;
}

/**
 * Neon-backed reference storage, returned ONLY when all of these hold:
 *  - SHIYAN_STORAGE_BACKEND=neon with a valid SHIYAN_STORAGE_URL (envelopes; SHIYAN_DATABASE_URL is a fallback), and
 *  - a valid SHIYAN_ANCHOR_URL (SHIYAN_ANCHOR_DATABASE_URL is a fallback) that reaches a different database with a different role.
 * Documented names win when both the documented name and the fallback are set.
 * Otherwise undefined, so the reference routes fail closed with 503. There is no local or
 * in-memory anchor fallback, and filesystem envelopes are never paired with Neon anchors here.
 */
export function configuredReferenceStorage(env: Env = process.env): ReferenceStorage | undefined {
  const backend = resolveStorageBackend(env);
  if (backend.kind !== "neon") return undefined;
  const anchor = checkDatabaseUrl(resolvedAnchorUrl(env), env);
  if (!anchor.ok || !independentDatabases(backend.database, anchor.value)) return undefined;
  return {
    anchors: new NeonReferenceAnchors(poolFor("anchors", anchor.value)),
    envelopes: new NeonReferenceEnvelopes(poolFor("storage", backend.database)),
  };
}

export function configuredReferenceAnchors(env: Env = process.env): IndependentReferenceAnchors | undefined {
  return configuredReferenceStorage(env)?.anchors;
}
