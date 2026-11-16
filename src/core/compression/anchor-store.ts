// 4D state compression (M5): the ONLY module that writes to the anchors DB for compression, and only
// INSERT INTO shiyan_anchor.state_chain_anchors (migration 005). Imported only by scripts/anchor-state-chain.ts
// (enforced by scripts/check-compression-boundary.ts); never by a route, the pure core, Level 4 or the engine.
//
// One transaction per run on the anchors DB. Exact statement allowlist:
//   write:            BEGIN, a per-tenant advisory lock, the tenant-scoped anchors SELECT, one insert, COMMIT/ROLLBACK
//   dry-run / verify: BEGIN READ ONLY, the tenant-scoped anchors SELECT, COMMIT/ROLLBACK
// The caller passes the stored chain's segment hashes (seq order) AFTER verifying that chain read-only.
// Any existing anchor that disagrees with the stored chain is a mismatch: refuse, write nothing, report it.
// Idempotent: if the stored head is already anchored at its seq, nothing is inserted.
import { TENANT_ID_PATTERN } from "../tenant-auth";
import { READ_ONLY_BEGIN, type ReadOnlyClient } from "./source";
import { STATE_ANCHORS_SQL, compareAnchors, parseStateAnchors, type AnchorComparison, type StateAnchorRow } from "./chain-head";

export const ANCHOR_WRITE_BEGIN = "BEGIN";
export const ANCHOR_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('shiyan_anchor.state_chain_anchors'), hashtext($1))";
export const INSERT_STATE_ANCHOR_SQL = "INSERT INTO shiyan_anchor.state_chain_anchors (tenant_id, seq, chain_head, segment_count) VALUES ($1, $2, $3, $4)";

const WRITE_SQL: readonly string[] = [ANCHOR_WRITE_BEGIN, ANCHOR_LOCK_SQL, STATE_ANCHORS_SQL, INSERT_STATE_ANCHOR_SQL, "COMMIT", "ROLLBACK"];
const READ_SQL: readonly string[] = [READ_ONLY_BEGIN, STATE_ANCHORS_SQL, "COMMIT", "ROLLBACK"];

export type AnchorMode = "dry-run" | "write" | "verify";

export function isAllowedAnchorSql(sql: string, mode: AnchorMode): boolean {
  return (mode === "write" ? WRITE_SQL : READ_SQL).includes(sql);
}

export class AnchorSqlRefused extends Error {
  constructor() { super("statement is not on the state-chain-anchors allowlist"); this.name = "AnchorSqlRefused"; }
}

const SHA256 = /^[0-9a-f]{64}$/;

export interface AnchorResult {
  mode: AnchorMode;
  anchors_before: number;
  /** Non-empty: refused (foreign/malformed anchor rows); nothing written. */
  invalid: string[];
  comparison: AnchorComparison;
  /** The head that would be / was anchored (null when the stored chain is empty). */
  head: { seq: number; chain_head: string; segment_count: number } | null;
  /** 1 when the head is not yet anchored and nothing is refused (dry-run/write); 0 otherwise. */
  would_insert: number;
  inserted: number;
  latest_after: StateAnchorRow | null;
}

/** Runs one dry-run, write or verify pass. Mismatches roll back and insert nothing. Errors roll back and rethrow. */
export async function anchorStateChainHead(
  client: ReadOnlyClient, tenant: string, mode: AnchorMode, storedHashes: readonly string[],
): Promise<AnchorResult> {
  if (typeof tenant !== "string" || !TENANT_ID_PATTERN.test(tenant)) throw new TypeError("tenant must match TENANT_ID_PATTERN");
  if (!storedHashes.every((h) => typeof h === "string" && SHA256.test(h))) throw new TypeError("stored hashes must be sha256 hex");
  const send = (sql: string, params?: unknown[]) => {
    if (!isAllowedAnchorSql(sql, mode)) throw new AnchorSqlRefused();
    return params === undefined ? client.query(sql) : client.query(sql, params);
  };
  await send(mode === "write" ? ANCHOR_WRITE_BEGIN : READ_ONLY_BEGIN);
  try {
    if (mode === "write") await send(ANCHOR_LOCK_SQL, [tenant]);
    const raw = await send(STATE_ANCHORS_SQL, [tenant]);
    const rows = Array.isArray(raw?.rows) ? raw.rows : [];
    const parsed = parseStateAnchors(rows, tenant);
    const anchors = parsed.ok ? parsed.rows : [];
    const invalid = parsed.ok ? [] : [`anchors: ${parsed.reason === "foreign_row" ? "a row belongs to another tenant" : "malformed anchor row"}`];
    const comparison = compareAnchors(storedHashes, anchors);
    const n = storedHashes.length;
    const head = n ? { seq: n - 1, chain_head: storedHashes[n - 1], segment_count: n } : null;
    const refused = invalid.length > 0 || comparison.status === "mismatch";
    const already = head !== null && anchors.some((a) => a.seq === head.seq && a.chain_head === head.chain_head);
    const result: AnchorResult = {
      mode, anchors_before: rows.length, invalid, comparison, head,
      would_insert: mode !== "verify" && !refused && head !== null && !already ? 1 : 0,
      inserted: 0, latest_after: comparison.latest,
    };
    if (mode !== "write" || result.would_insert === 0) {
      await send(refused && mode === "write" ? "ROLLBACK" : "COMMIT");
      return result;
    }
    await send(INSERT_STATE_ANCHOR_SQL, [tenant, head!.seq, head!.chain_head, head!.segment_count]);
    const back = parseStateAnchors(((await send(STATE_ANCHORS_SQL, [tenant]))?.rows ?? []) as unknown[], tenant);
    if (!back.ok || compareAnchors(storedHashes, back.rows).status !== "anchored" || !back.rows.some((a) => a.seq === head!.seq && a.chain_head === head!.chain_head)) {
      throw Object.assign(new Error("read-back mismatch"), { code: "READBACK" });
    }
    await send("COMMIT");
    result.inserted = 1;
    result.latest_after = back.rows[back.rows.length - 1];
    return result;
  } catch (error) {
    try { await send("ROLLBACK"); } catch { /* the original error matters */ }
    throw error;
  }
}
