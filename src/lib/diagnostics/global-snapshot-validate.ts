/**
 * Shape validator and report for an `aethel.global.snapshot.v1` record (pure: no network, no I/O, no writes).
 * It takes an already-parsed value and never throws. A valid result means well-formed only: not verified, not
 * attested and not a clinical diagnosis. The sanitized copy is built field by field; unknown fields are dropped.
 * A run's verified_at may be null (buildGlobalSnapshot emits null when the record had none); that is a warning.
 */
import { RUN_ID_RE } from "@/lib/marketplace/peer";
import { GLOBAL_SNAPSHOT_SCHEMA, type GlobalSnapshot, type GlobalSnapshotRun, type GlobalStatus } from "@/lib/diagnostics/global-snapshot";

export const SNAPSHOT_VALIDATE_NOTE =
  "Shape check only: a well-formed snapshot is not verified, attested or a clinical diagnosis. Misdiagnosis means a wrong next action.";
export const SNAPSHOT_MAX_ERRORS = 20;
export const SNAPSHOT_MAX_RUNS = 5000;
const STATUSES: readonly GlobalStatus[] = ["ELIGIBLE_EXPERIENCE", "MISDIAGNOSIS_REJECTED", "IN_PROGRESS"];

export type SnapshotResult = { ok: true; snapshot: GlobalSnapshot; warnings: string[] } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v));
const isDate = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function validateGlobalSnapshot(input: unknown): SnapshotResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const push = (m: string) => { if (errors.length < SNAPSHOT_MAX_ERRORS) errors.push(m); };
  try {
    if (!isObj(input)) return { ok: false, errors: ["snapshot: must be an object"] };
    if (input.schema_version !== GLOBAL_SNAPSHOT_SCHEMA) push(`schema_version: must be ${GLOBAL_SNAPSHOT_SCHEMA}`);
    if (!isDate(input.generated_at)) push("generated_at: must be a parseable date string");
    if (!isStr(input.note)) push("note: must be a string");
    const c = input.counts;
    if (!isObj(c)) push("counts: must be an object");
    if (!Array.isArray(input.runs)) { push("runs: must be an array"); return { ok: false, errors }; }
    const raw = input.runs;
    if (raw.length > SNAPSHOT_MAX_RUNS) { push(`runs: more than ${SNAPSHOT_MAX_RUNS} entries`); return { ok: false, errors }; }
    const runs: GlobalSnapshotRun[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < raw.length && errors.length < SNAPSHOT_MAX_ERRORS; i++) {
      const r = raw[i];
      const at = `runs[${i}]`;
      if (!isObj(r)) { push(`${at}: must be an object`); continue; }
      const before = errors.length;
      if (typeof r.run_id !== "string" || !RUN_ID_RE.test(r.run_id)) push(`${at}.run_id: must match ${RUN_ID_RE}`);
      else if (seen.has(r.run_id)) push(`${at}.run_id: duplicate run_id ${r.run_id}`);
      if (!STATUSES.includes(r.status as GlobalStatus)) push(`${at}.status: must be one of ${STATUSES.join(", ")}`);
      for (const k of ["final_e", "delta_e", "phi"] as const) if (!isNumOrNull(r[k])) push(`${at}.${k}: must be a finite number or null`);
      if (r.verified_at === null) warnings.push(`${at}.verified_at: null (the record had no verified_at)`);
      else if (!isDate(r.verified_at)) push(`${at}.verified_at: must be a parseable date string or null`);
      if (errors.length > before) continue;
      seen.add(r.run_id as string);
      runs.push({
        run_id: r.run_id as string, status: r.status as GlobalStatus,
        final_e: r.final_e as number | null, delta_e: r.delta_e as number | null, phi: r.phi as number | null,
        verified_at: r.verified_at as string | null,
      });
    }
    if (isObj(c)) {
      const tally = (s: GlobalStatus) => raw.filter((r) => isObj(r) && r.status === s).length;
      const want: Record<string, number> = { total: raw.length, eligible: tally("ELIGIBLE_EXPERIENCE"), misdiagnosis_rejected: tally("MISDIAGNOSIS_REJECTED"), in_progress: tally("IN_PROGRESS") };
      for (const k of Object.keys(want)) {
        if (!isCount(c[k])) push(`counts.${k}: must be an integer >= 0`);
        else if (c[k] !== want[k]) push(`counts.${k}: ${String(c[k])} does not match ${want[k]} in runs`);
      }
    }
    if (errors.length > 0) return { ok: false, errors };
    return {
      ok: true,
      snapshot: {
        schema_version: GLOBAL_SNAPSHOT_SCHEMA,
        generated_at: input.generated_at as string,
        note: input.note as string,
        counts: { total: runs.length, eligible: (c as Obj).eligible as number, misdiagnosis_rejected: (c as Obj).misdiagnosis_rejected as number, in_progress: (c as Obj).in_progress as number },
        runs,
      },
      warnings,
    };
  } catch {
    return { ok: false, errors: [...errors, "snapshot: could not be read safely"].slice(0, SNAPSHOT_MAX_ERRORS) };
  }
}

function isStr(v: unknown): v is string { return typeof v === "string"; }

/** Plain-text report (pure). Exit 0 when well-formed (warnings allowed), 1 when not. */
export function formatSnapshotReport(result: SnapshotResult): { lines: string[]; exitCode: 0 | 1 } {
  const lines = [SNAPSHOT_VALIDATE_NOTE];
  if (result.ok) {
    const k = result.snapshot.counts;
    lines.push(`OK: ${k.total} runs, ${k.eligible} eligible, ${k.misdiagnosis_rejected} misdiagnosis rejected, ${k.in_progress} in progress`);
    for (const w of result.warnings) lines.push(`warning: ${w}`);
    return { lines, exitCode: 0 };
  }
  for (const e of result.errors) lines.push(`error: ${e}`);
  return { lines, exitCode: 1 };
}
