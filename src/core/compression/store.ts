// 4D state compression (M4): the ONLY module that writes, and only to shiyan.state_segments (migration 004).
// Imported only by scripts/persist-tenant-segments.ts (enforced by scripts/check-compression-boundary.ts); never by
// the pure core, any route, Level 4, MetamorphicEngine or metamorphic-runtime.
//
// One transaction per run on the storage DB. Exact statement allowlist:
//   write:   BEGIN, a per-tenant advisory lock, tenant-scoped SELECTs, INSERT INTO shiyan.state_segments, COMMIT/ROLLBACK
//   dry-run and verify: BEGIN READ ONLY, tenant-scoped SELECTs, COMMIT/ROLLBACK
// The stored chain must verify and match the requested options, or nothing is written ("refuse, never overwrite").
// Only sealed windows are inserted; pending windows never are. A rerun with nothing new inserts 0 rows.
import { createHash } from "node:crypto";
import { canonical } from "../reconcile";
import { TENANT_ID_PATTERN } from "../tenant-auth";
import { READ_ONLY_BEGIN, TENANT_ROWS_SQL, toSourceRow, type ReadOnlyClient } from "./source";
import { buildTenantChain, type ChainOptions } from "./chain";
import { extendTenantChain, verifyStoredChain, type ChainParams, type Extension, type StoredChecks, type StoredSegment } from "./extend";
import type { AnchorSource } from "./context";
import type { SealedSegment, SourceRow, StateSegment } from "./types";
import type { CloseReason } from "./window";

export const WRITE_BEGIN = "BEGIN";
export const TENANT_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('shiyan.state_segments'), hashtext($1))";
const COLUMNS = ["tenant_id", "seq", "segment_sha256", "prev_segment_sha256", "segment_json", "point_count", "source_ids",
  "window_opened_at", "window_closed_at", "closed_by", "segment_size", "cutoff_ms", "grace_ms", "loss_mode",
  "eps_predicted", "eps_observed", "eps_phi", "context_sha256"] as const;
export const STORED_SEGMENTS_SQL = `SELECT ${COLUMNS.join(", ")} FROM shiyan.state_segments WHERE tenant_id = $1 ORDER BY seq`;
export const INSERT_SEGMENT_SQL = `INSERT INTO shiyan.state_segments (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})`;

const WRITE_SQL: readonly string[] = [WRITE_BEGIN, TENANT_LOCK_SQL, TENANT_ROWS_SQL, STORED_SEGMENTS_SQL, INSERT_SEGMENT_SQL, "COMMIT", "ROLLBACK"];
const READ_SQL: readonly string[] = [READ_ONLY_BEGIN, TENANT_ROWS_SQL, STORED_SEGMENTS_SQL, "COMMIT", "ROLLBACK"];

export type PersistMode = "dry-run" | "write" | "verify";

export function isAllowedStoreSql(sql: string, mode: PersistMode): boolean {
  return (mode === "write" ? WRITE_SQL : READ_SQL).includes(sql);
}

export class StoreSqlRefused extends Error {
  constructor() { super("statement is not on the state-segments allowlist"); this.name = "StoreSqlRefused"; }
}

const SHA256 = /^[0-9a-f]{64}$/;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const ms = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : Number.NaN);
const int = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : Number.NaN);

/** Parses one stored row; any inconsistency is a reason to refuse, never something to repair. */
export function parseStoredRow(raw: unknown, tenant: string): { ok: true; value: StoredSegment } | { ok: false; reason: string } {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const bad = (reason: string) => ({ ok: false as const, reason });
  if (r.tenant_id !== tenant) return bad("row belongs to another tenant");
  if (typeof r.segment_json !== "string" || typeof r.segment_sha256 !== "string" || !SHA256.test(r.segment_sha256)) return bad("malformed segment columns");
  if (sha256(r.segment_json) !== r.segment_sha256) return bad("segment_sha256 does not match segment_json");
  let segment: StateSegment;
  try { segment = JSON.parse(r.segment_json) as StateSegment; } catch { return bad("segment_json is not JSON"); }
  if (canonical(segment) !== r.segment_json) return bad("segment_json is not canonical");
  const seq = int(r.seq);
  if (segment?.seq !== seq || segment.tenant_id !== tenant) return bad("seq or tenant differs from segment_json");
  if ((r.prev_segment_sha256 ?? null) !== segment.prev_segment_sha256) return bad("prev_segment_sha256 differs from segment_json");
  if (int(r.point_count) !== segment.count) return bad("point_count differs from segment_json");
  if (!Array.isArray(r.source_ids) || !r.source_ids.every((x) => typeof x === "string")) return bad("malformed source_ids");
  const opened_at = ms(r.window_opened_at), closed_at = ms(r.window_closed_at);
  if (!Number.isSafeInteger(opened_at) || !Number.isSafeInteger(closed_at)) return bad("malformed window bounds");
  if (r.closed_by !== "full" && r.closed_by !== "cutoff") return bad("malformed closed_by");
  const params: ChainParams = {
    segmentSize: int(r.segment_size),
    cutoffMs: r.cutoff_ms === null || r.cutoff_ms === undefined ? Infinity : int(r.cutoff_ms),
    graceMs: int(r.grace_ms),
  };
  if (!Number.isSafeInteger(params.segmentSize) || !(params.cutoffMs === Infinity || Number.isSafeInteger(params.cutoffMs)) || !Number.isSafeInteger(params.graceMs)) {
    return bad("malformed sealing parameters");
  }
  const loss = segment.loss;
  if (r.loss_mode !== loss?.mode) return bad("loss_mode differs from segment_json");
  if (loss.mode === "bounded") {
    if (r.eps_predicted !== loss.eps.predicted || r.eps_observed !== loss.eps.observed || r.eps_phi !== loss.eps.phi) return bad("eps columns differ from segment_json");
  } else if (r.eps_predicted !== null || r.eps_observed !== null || r.eps_phi !== null) return bad("eps set on a lossless segment");
  const context_sha256 = r.context_sha256 ?? null;
  if (context_sha256 !== null && (typeof context_sha256 !== "string" || !SHA256.test(context_sha256))) return bad("malformed context_sha256");
  return {
    ok: true,
    value: {
      sealed: { segment, segment_sha256: r.segment_sha256 }, source_ids: r.source_ids as string[],
      opened_at, closed_at, closed_by: r.closed_by as CloseReason, params, context_sha256: context_sha256 as string | null,
    },
  };
}

/** Insert parameters for one new segment, in COLUMNS order. */
export function insertParams(tenant: string, sealed: SealedSegment, window: Extension["windows"][number], params: ChainParams): unknown[] {
  const s = sealed.segment;
  const bounded = s.loss.mode === "bounded" ? s.loss.eps : null;
  return [
    tenant, s.seq, sealed.segment_sha256, s.prev_segment_sha256, canonical(s), s.count, window.points.map((p) => p.experience_id),
    new Date(window.opened_at), new Date(window.closed_at), window.closed_by, params.segmentSize,
    params.cutoffMs === Infinity ? null : params.cutoffMs, params.graceMs, s.loss.mode,
    bounded?.predicted ?? null, bounded?.observed ?? null, bounded?.phi ?? null,
    s.context === undefined ? null : sha256(canonical(s.context)),
  ];
}

export interface PersistResult {
  mode: PersistMode;
  rows_read: number;
  foreign_rows_dropped: number;
  stored_before: number;
  /** Invalid stored rows (refusal reasons, no payloads). */
  invalid_stored: string[];
  extension: Extension;
  /** Segments actually inserted (write) or that would be (dry-run). Always 0 for verify. */
  appended: number;
  inserted: number;
  stored_head_after: string | null;
  /** M5: the valid stored segment hashes in seq order (index = seq), as read in this transaction. */
  stored_hashes: string[];
  /** Sync: the stored chain's own sealing parameters, loss option and context presence (null when nothing is stored). */
  stored_options: { params: ChainParams; loss: ChainOptions["loss"]; context: boolean } | null;
  /** verify only: whether the stored chain is a prefix of a from-scratch recomputation (informational). */
  from_scratch_prefix?: boolean;
  /** verify only: the stored chain's own checks (context re-derived only when anchors were given). */
  stored_checks?: StoredChecks;
}

/**
 * Runs one dry-run, write or verify pass for a tenant in a single transaction on the storage DB.
 * Refused extensions are rolled back and nothing is written. Errors roll back and are rethrown.
 */
export async function persistTenantSegments(
  client: ReadOnlyClient, tenant: string, mode: PersistMode, options: ChainOptions & { anchors?: AnchorSource },
): Promise<PersistResult> {
  if (typeof tenant !== "string" || !TENANT_ID_PATTERN.test(tenant)) throw new TypeError("tenant must match TENANT_ID_PATTERN");
  const send = (sql: string, params?: unknown[]) => {
    if (!isAllowedStoreSql(sql, mode)) throw new StoreSqlRefused();
    return params === undefined ? client.query(sql) : client.query(sql, params);
  };
  await send(mode === "write" ? WRITE_BEGIN : READ_ONLY_BEGIN);
  try {
    if (mode === "write") await send(TENANT_LOCK_SQL, [tenant]);
    const read = await send(TENANT_ROWS_SQL, [tenant]);
    const rows: SourceRow[] = [];
    let foreign = 0;
    for (const raw of Array.isArray(read?.rows) ? read.rows : []) {
      const row = toSourceRow(raw);
      if (row.tenant_id === tenant) rows.push(row); else foreign += 1;
    }
    const storedRaw = await send(STORED_SEGMENTS_SQL, [tenant]);
    const stored: StoredSegment[] = [];
    const invalid_stored: string[] = [];
    (Array.isArray(storedRaw?.rows) ? storedRaw.rows : []).forEach((raw, i) => {
      const p = parseStoredRow(raw, tenant);
      if (p.ok) stored.push(p.value); else invalid_stored.push(`row ${i}: ${p.reason}`);
    });
    // verify: use the stored chain's own parameters, loss mode and context presence, so it checks what was written.
    const storedHasContext = stored.length > 0 && stored[0].sealed.segment.context !== undefined;
    const effective: ChainOptions = mode === "verify" && stored.length ? {
      ...options,
      segmentSize: stored[0].params.segmentSize, cutoffMs: stored[0].params.cutoffMs, graceMs: stored[0].params.graceMs,
      loss: stored[0].sealed.segment.loss.mode === "bounded" ? { mode: "bounded", eps: stored[0].sealed.segment.loss.eps } : { mode: "lossless" },
      anchors: storedHasContext ? options.anchors : undefined,
    } : options;
    let extension = extendTenantChain(tenant, rows, stored, effective);
    if (invalid_stored.length) extension = { ...extension, refused: [...invalid_stored, ...extension.refused], appended: [], windows: [] };
    const result: PersistResult = {
      mode, rows_read: rows.length, foreign_rows_dropped: foreign, stored_before: stored.length + invalid_stored.length,
      invalid_stored, extension, appended: mode === "verify" ? 0 : extension.appended.length, inserted: 0,
      stored_head_after: stored.length ? stored[stored.length - 1].sealed.segment_sha256 : null,
      stored_hashes: stored.map((s) => s.sealed.segment_sha256),
      stored_options: stored.length ? {
        params: { ...stored[0].params },
        loss: stored[0].sealed.segment.loss.mode === "bounded" ? { mode: "bounded", eps: { ...stored[0].sealed.segment.loss.eps } } : { mode: "lossless" },
        context: storedHasContext,
      } : null,
    };
    if (mode === "verify") {
      const { covered: _covered, ...storedChecks } = verifyStoredChain(tenant, stored, rows, effective.anchors);
      result.stored_checks = storedChecks;
      if (!storedHasContext || effective.anchors) {
        const scratch = buildTenantChain(tenant, rows, effective);
        result.from_scratch_prefix = stored.every((s, i) => scratch.segments[i]?.segment_sha256 === s.sealed.segment_sha256);
      }
    }
    if (mode !== "write" || extension.refused.length || extension.appended.length === 0) {
      await send(extension.refused.length && mode === "write" ? "ROLLBACK" : "COMMIT");
      return result;
    }
    for (let i = 0; i < extension.appended.length; i++) {
      await send(INSERT_SEGMENT_SQL, insertParams(tenant, extension.appended[i], extension.windows[i], extension.params));
    }
    const back = await send(STORED_SEGMENTS_SQL, [tenant]);
    const want = [...stored.map((s) => s.sealed.segment_sha256), ...extension.appended.map((s) => s.segment_sha256)];
    const got = (Array.isArray(back?.rows) ? back.rows : []).map((r) => (r as { segment_sha256?: unknown }).segment_sha256);
    if (JSON.stringify(got) !== JSON.stringify(want)) throw Object.assign(new Error("read-back mismatch"), { code: "READBACK" });
    await send("COMMIT");
    result.inserted = extension.appended.length;
    result.stored_head_after = want[want.length - 1];
    return result;
  } catch (error) {
    try { await send("ROLLBACK"); } catch { /* original error matters */ }
    throw error;
  }
}
