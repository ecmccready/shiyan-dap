// Neon append-only writer for shiyan_anchor.recovery_records.
// Uses the independent anchors database via SHIYAN_ANCHOR_URL (SHIYAN_ANCHOR_DATABASE_URL
// is only a fallback). Never falls back to the storage database. Parameterized queries only.
// Reasons never include a URL or password. This module is not wired into any route.
import type { Pool } from "pg";
import { checkDatabaseUrl, independentDatabases, poolFor } from "./neon-db";
import {
  ANCHORS_NOT_CONFIGURED,
  disabledRecoveryRecorder,
  type RecoveryRecorder,
  type RecoveryRecordWrite,
  type RecorderResult,
} from "./reconcile";
import { resolvedAnchorUrl, resolvedStorageUrl } from "./storage-provider";

type Env = Record<string, string | undefined>;

const REFERENCE_ID = /^ref-[0-9a-f]{32}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function checkWrite(row: RecoveryRecordWrite): string | null {
  if (!row || typeof row.tenantId !== "string") return "Invalid recovery record";
  if (row.referenceId !== null && !REFERENCE_ID.test(row.referenceId)) return "Invalid reference id";
  if (row.runId !== null && (typeof row.runId !== "string" || row.runId.length < 1 || row.runId.length > 200)) {
    return "Invalid run id";
  }
  if (row.status !== "PROMOTED" && row.status !== "DRIFT_EXCEEDED" && row.status !== "REJECTED") {
    return "Invalid recovery status";
  }
  if (!SHA256_HEX.test(row.recordSha256)) return "Invalid record hash";
  if (row.prevRecordSha256 !== null && !SHA256_HEX.test(row.prevRecordSha256)) return "Invalid previous record hash";
  return null;
}

export class NeonRecoveryRecorder implements RecoveryRecorder {
  constructor(private readonly pool: Pool) {}

  async latestRecordSha256(tenantId: string): Promise<string | null> {
    const result = await this.pool.query<{ record_sha256: unknown }>(
      `SELECT record_sha256 FROM shiyan_anchor.recovery_records
       WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) return null;
    const hash = result.rows[0]?.record_sha256;
    if (typeof hash !== "string" || !SHA256_HEX.test(hash)) throw new Error("Malformed recovery hash chain");
    return hash;
  }

  async record(row: RecoveryRecordWrite): Promise<RecorderResult> {
    const invalid = checkWrite(row);
    if (invalid) return { ok: false, error: invalid };
    try {
      const createdAt = Number.isNaN(Date.parse(row.createdAt)) ? new Date() : new Date(row.createdAt);
      await this.pool.query(
        `INSERT INTO shiyan_anchor.recovery_records (
           tenant_id, reference_id, run_id, status,
           prior_predicted, synthesized_predicted, anchor_delta, phi_lift,
           max_anchor_shift_ratio, proof_verdict, record_sha256, prev_record_sha256, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          row.tenantId,
          row.referenceId,
          row.runId,
          row.status,
          row.priorPredicted,
          row.synthesizedPredicted,
          row.anchorDelta,
          row.phiLift,
          row.maxAnchorShiftRatio,
          row.proofVerdict,
          row.recordSha256,
          row.prevRecordSha256,
          createdAt,
        ],
      );
      return { ok: true };
    } catch {
      // Never surface driver messages: they can include connection strings.
      return { ok: false, error: "Anchors storage backend unavailable" };
    }
  }
}

/**
 * Returns a Neon recorder when SHIYAN_ANCHOR_URL (or its fallback) is a valid
 * independent anchors URL. Returns a disabled recorder — never a storage-DB
 * connection — when anchors storage is missing, invalid, or would point at the
 * same database as SHIYAN_STORAGE_URL.
 */
export function configuredRecoveryRecorder(env: Env = process.env): RecoveryRecorder {
  const anchor = checkDatabaseUrl(resolvedAnchorUrl(env), env);
  if (!anchor.ok) return disabledRecoveryRecorder(ANCHORS_NOT_CONFIGURED);
  const storageUrl = resolvedStorageUrl(env);
  if (storageUrl) {
    const storage = checkDatabaseUrl(storageUrl, env);
    if (storage.ok && !independentDatabases(storage.value, anchor.value)) {
      return disabledRecoveryRecorder("Anchors storage must be an independent database");
    }
  }
  return new NeonRecoveryRecorder(poolFor("anchors", anchor.value));
}
