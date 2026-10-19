/**
 * Independent run verification (additive, read-only).
 *
 * Recomputes a stored run from its action sequence instead of trusting the
 * ledger: replays the actions on a fresh plant (measured helpers; core engine
 * read-only), recomputes e, e0, cold e, Φ and eligibility per step, recomputes
 * the demo tensor commitment and distance at tensor steps, and recomputes the
 * anchor Merkle root from the replayed values. Each check is PASS / FAIL, or
 * SKIP when the stored entry has no value to compare (e.g. pre-tensor runs).
 */
import type { YAction } from "../closed-loop";
import type { ExperienceEntry } from "./experience-client";
import { coldBaseline, measureActions } from "./measured";
import { demoTensorCheck } from "./demo-tensor";
import { combineEligibility } from "./tensor";
import { buildAnchorPayload } from "./anchor";

export type CheckResult = "PASS" | "FAIL" | "SKIP";
export type VerifyCheck = { iter: number | null; check: string; result: CheckResult; stored?: unknown; recomputed?: unknown };

/** Demo goal threshold (e < 0.16), as on /workbench/autonomous. */
export const VERIFY_THRESHOLD = 0.16;
const TOL = 0.0015;

const close = (a: unknown, b: number) => typeof a === "number" && Math.abs(a - b) <= TOL;

export function verifyRun(list: ExperienceEntry[], run_id: string) {
  const steps = list.filter((x) => x.run_id === run_id).sort((a, b) => a.iteration - b.iteration);
  const checks: VerifyCheck[] = [];
  const push = (c: VerifyCheck) => checks.push(c);
  if (steps.length === 0) return { run_id, verdict: "FAIL" as const, checks: [{ iter: null, check: "run_found", result: "FAIL" as const }] };

  const contiguous = steps.every((s, i) => s.iteration === i + 1 && typeof s.y === "string");
  push({ iter: null, check: "sequence_contiguous", result: contiguous ? "PASS" : "FAIL" });

  const replayed: ExperienceEntry[] = [];
  const actions: YAction[] = [];
  for (const s of steps) {
    if (typeof s.y !== "string") break;
    actions.push(s.y as YAction);
    let m;
    try {
      m = measureActions(actions);
    } catch {
      push({ iter: s.iteration, check: "replay", result: "FAIL", stored: s.y });
      break;
    }
    const cold = coldBaseline(actions.length);
    const phi = Number((cold - m.e).toFixed(3));
    const t = demoTensorCheck(actions);
    const eligible = combineEligibility(m.e < VERIFY_THRESHOLD, t);
    const cmp = (check: string, stored: unknown, rec: number) =>
      push({ iter: s.iteration, check, result: stored == null ? "SKIP" : close(stored, rec) ? "PASS" : "FAIL", stored, recomputed: rec });
    cmp("e", s.e, m.e);
    cmp("e0", s.e0, m.e0);
    cmp("cold_e", s.cold_e, cold);
    cmp("phi", s.phi, phi);
    push({ iter: s.iteration, check: "eligible", result: s.eligible === eligible ? "PASS" : "FAIL", stored: s.eligible, recomputed: eligible });
    if (t || s.tensor_commitment !== undefined) {
      push({
        iter: s.iteration,
        check: "tensor_commitment",
        result: s.tensor_commitment === undefined ? "SKIP" : s.tensor_commitment === t?.outCommitment ? "PASS" : "FAIL",
        stored: s.tensor_commitment,
        recomputed: t?.outCommitment,
      });
      if (t) cmp("tensor_distance", s.tensor_distance, t.distance);
    }
    replayed.push({
      ...s,
      e: m.e,
      e0: m.e0,
      cold_e: cold,
      phi,
      eligible,
      ...(s.tensor_commitment !== undefined && t ? { tensor_commitment: t.outCommitment, tensor_distance: t.distance } : {}),
    });
  }

  const storedRoot = buildAnchorPayload(steps, run_id).root;
  const replayRoot = buildAnchorPayload(replayed, run_id).root;
  push({
    iter: null,
    check: "anchor_merkle_root",
    result: storedRoot == null && replayRoot == null ? "SKIP" : storedRoot === replayRoot ? "PASS" : "FAIL",
    stored: storedRoot,
    recomputed: replayRoot,
  });

  const verdict = checks.some((c) => c.result === "FAIL") ? ("FAIL" as const) : ("PASS" as const);
  return { run_id, verdict, checks };
}
