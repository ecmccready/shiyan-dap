// 4D state compression (M1): stored experience row -> StatePoint, or a counted exclusion. Pure.
import { createHash } from "node:crypto";
import { validateExperienceRecord } from "../experience-schema";
import { TENANT_ID_PATTERN } from "../tenant-auth";
import {
  STATE_SOURCE,
  type Excluded,
  type ExclusionReason,
  type ExclusionSummary,
  type SourceRow,
  type StatePoint,
  type StateVerdict,
} from "./types";

export type Extracted = { ok: true; point: StatePoint } | { ok: false; excluded: Excluded };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const VERDICTS: readonly string[] = ["PASS", "FAIL", "INCONCLUSIVE"];

function exclude(experience_id: unknown, reason: ExclusionReason): Extracted {
  return { ok: false, excluded: { experience_id: typeof experience_id === "string" ? experience_id : null, reason } };
}

/** Extracts one row for `tenant`. Never guesses: anything not provably a valid third-party-workbench run is excluded. */
export function extractPoint(tenant: string, row: SourceRow): Extracted {
  if (typeof row !== "object" || row === null) return exclude(null, "invalid_row");
  const id = row.experience_id;
  if (typeof row.tenant_id !== "string" || typeof id !== "string" || typeof row.record_json !== "string"
    || typeof row.content_sha256 !== "string" || typeof row.proof_timestamp !== "string") return exclude(id, "invalid_row");
  if (row.tenant_id !== tenant) return exclude(id, "tenant_mismatch");
  if (createHash("sha256").update(row.record_json, "utf8").digest("hex") !== row.content_sha256) return exclude(id, "hash_mismatch");
  let record: unknown;
  try { record = JSON.parse(row.record_json); } catch { return exclude(id, "invalid_json"); }
  if (!validateExperienceRecord(record) || record.experience_id !== id) return exclude(id, "invalid_record");
  if (record.tenant_id !== tenant) return exclude(id, "tenant_mismatch");
  if (record.provenance.source !== STATE_SOURCE) return exclude(id, "not_third_party_workbench");
  let detail: unknown;
  try { detail = JSON.parse(record.metamorphic.transformation); } catch { return exclude(id, "unparseable_inputs"); }
  const inputs = (typeof detail === "object" && detail !== null ? (detail as Record<string, unknown>).inputs : undefined) as
    Record<string, unknown> | undefined | null;
  if (typeof inputs !== "object" || inputs === null
    || !finite(inputs.predicted) || !finite(inputs.observed) || !finite(inputs.phi) || !finite(inputs.step)) {
    return exclude(id, "unparseable_inputs");
  }
  if (!VERDICTS.includes(record.metamorphic.result)) return exclude(id, "invalid_verdict");
  const t = Date.parse(row.proof_timestamp);
  if (!Number.isSafeInteger(t)) return exclude(id, "invalid_timestamp");
  return {
    ok: true,
    point: {
      experience_id: id, content_sha256: row.content_sha256, t,
      predicted: inputs.predicted, observed: inputs.observed, phi: inputs.phi, step: inputs.step,
      verdict: record.metamorphic.result as StateVerdict,
    },
  };
}

/** Total order on points: time, then experience_id by UTF-16 code units (never locale-dependent). */
export function comparePoints(a: StatePoint, b: StatePoint): number {
  if (a.t !== b.t) return a.t < b.t ? -1 : 1;
  return a.experience_id < b.experience_id ? -1 : a.experience_id > b.experience_id ? 1 : 0;
}

/** Extracts all rows, removes duplicate ids order-independently, and returns points in canonical order. */
export function extractPoints(tenant: string, rows: readonly SourceRow[]): { points: StatePoint[]; excluded: Excluded[] } {
  if (!TENANT_ID_PATTERN.test(tenant)) throw new TypeError("tenant must match TENANT_ID_PATTERN");
  const excluded: Excluded[] = [];
  const valid: StatePoint[] = [];
  for (const row of rows) {
    const r = extractPoint(tenant, row);
    if (r.ok) valid.push(r.point); else excluded.push(r.excluded);
  }
  // Deterministic duplicate handling regardless of input order: keep the lowest (id, content_sha256).
  valid.sort((a, b) => a.experience_id < b.experience_id ? -1 : a.experience_id > b.experience_id ? 1
    : a.content_sha256 < b.content_sha256 ? -1 : a.content_sha256 > b.content_sha256 ? 1 : 0);
  const points: StatePoint[] = [];
  for (const p of valid) {
    if (points.length && points[points.length - 1].experience_id === p.experience_id) excluded.push({ experience_id: p.experience_id, reason: "duplicate_id" });
    else points.push(p);
  }
  points.sort(comparePoints);
  return { points, excluded };
}

export function summarizeExclusions(excluded: readonly Excluded[]): ExclusionSummary {
  const reasons: Partial<Record<ExclusionReason, number>> = {};
  for (const e of excluded) reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
  return { count: excluded.length, reasons };
}
