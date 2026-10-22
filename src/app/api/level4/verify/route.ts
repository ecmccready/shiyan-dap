import { NextRequest, NextResponse } from "next/server";
import { verifyRun } from "@/lib/level4/verify-run";
import { readExperienceStore } from "@/lib/level4/experience-store";
import { demoReferenceTensor } from "@/lib/level4/demo-tensor";
import { calculateDynamicThreshold } from "@/lib/level4/tensor";
import { roeForEntry } from "@/lib/level4/roe";
import { roeEligibility } from "@/lib/level4/roe-eligibility";

/**
 * GET /api/level4/verify?run_id=... — public, read-only.
 * Independently recomputes a stored run (e per step, Φ, eligibility, tensor
 * commitments, anchor Merkle root) and returns PASS/FAIL/SKIP per check.
 *
 * Additive: when the run has stored tensor distances, a top-level `holographic`
 * array (one item per tensor iteration) shows the dynamic limit ε_base·√(N/4)
 * for the demo tensor. Informational only: verdict, checks and the replay
 * itself stay on fixed ε 0.16.
 */
export async function GET(req: NextRequest) {
  const run_id = req.nextUrl.searchParams.get("run_id");
  if (!run_id) return NextResponse.json({ error: "run_id required" }, { status: 400 });
  const entries = await readExperienceStore().catch(() => null);
  if (entries == null) return NextResponse.json({ run_id, verdict: "UNAVAILABLE", error: "experience store not configured", checks: [] });
  const result = verifyRun(entries, run_id);
  const ref = demoReferenceTensor();
  const base_epsilon = 0.16;
  const max_allowable = calculateDynamicThreshold(ref, { baseEpsilon: base_epsilon, baseDimensions: 4 });
  const holographic = entries
    .filter((e) => e.run_id === run_id && typeof e.tensor_distance === "number")
    .sort((a, b) => a.iteration - b.iteration)
    .map((e) => ({
      iter: e.iteration,
      n: ref.data.length,
      base_epsilon,
      max_allowable,
      distance: e.tensor_distance as number,
      verified: (e.tensor_distance as number) <= max_allowable,
    }));
  // ROE (additive, informational): gated improvement I_t per stored step. Not a check.
  const roe = entries
    .filter((e) => e.run_id === run_id)
    .sort((a, b) => a.iteration - b.iteration)
    .map((e) => ({ iter: e.iteration, ...roeForEntry(e), eligibility: roeEligibility(e) }));
  const out = holographic.length ? { ...result, holographic } : result;
  return NextResponse.json(roe.length ? { ...out, roe } : out);
}
