/** TEST ONLY. v0.1.25 wall time. The rule is fixtures/scp/v0125-prereg.json.
 * Counted checks read the committed simulation and manifest. They do not
 * re-simulate or place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0125.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const prereg = JSON.parse(read("fixtures/scp/v0125-prereg.json")) as {
  candidate: { kind: string; not_a_hybrid: boolean; full_scan_frames_required: number };
  metric: { formula: string };
  widths_required: string;
  wall_PASS: string;
};
check("prereg locks wall time for a pure pipelined-K1 loop at all three widths",
  prereg.candidate.not_a_hybrid === true && prereg.candidate.kind === "pure pipelined K1"
  && prereg.candidate.full_scan_frames_required === 0
  && prereg.metric.formula === "wall_us = cycles / fmax_mhz"
  && prereg.widths_required.includes("8") && prereg.widths_required.includes("10") && prereg.widths_required.includes("12")
  && prereg.wall_PASS.includes("strictly less"));

const base = JSON.parse(read("fixtures/scp/v0125-baselines.json")) as {
  rows: { engine: string; addr_w: number; cycles: number; bit_exact: boolean }[];
};
const bareC: Record<number, number> = { 8: 16206, 10: 64482, 12: 129676 };
const fsdC: Record<number, number> = { 8: 40767, 10: 163151, 12: 326734 };
const baseOk = [8, 10, 12].every((w) => {
  const b = base.rows.find((r) => r.engine === "k1bare" && r.addr_w === w);
  const f = base.rows.find((r) => r.engine === "fsdonly" && r.addr_w === w);
  return !!b && !!f && b.bit_exact && f.bit_exact && b.cycles === bareC[w] && f.cycles === fsdC[w];
});
check("bare pipe and full-scan baselines are bit-exact at the measured cycle counts", baseOk);

const cand = JSON.parse(read("fixtures/scp/v0125-candidate.json")) as {
  rows: { addr_w: number; cycles: number; evals: number; bit_exact: boolean; fsd_frames: number }[];
};
const fastC: Record<number, number> = { 8: 16416, 10: 65255, 12: 131378 };
const candOk = [8, 10, 12].every((w) => {
  const r = cand.rows.find((x) => x.addr_w === w);
  return !!r && r.bit_exact && r.fsd_frames === 0 && r.cycles === fastC[w] && (w !== 12 || r.evals === 20182);
});
check("candidate is bit-exact pure pipelined K1 with zero full-scan frames", candOk);

const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as {
  source_files: { path: string; sha256: string }[];
  designs: Record<string, {
    smallest_part?: string;
    decisions_per_s_per_lut?: number;
    fmax_mhz?: { median?: number; n?: number };
    seeds_45f?: { status: string; utilization?: { TRELLIS_COMB?: { used: number }; DP16KD?: { used: number } } }[];
  }>;
};
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("v0.1.22 and v0.1.24 sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v") === sha(read("hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v"))
  && pinned("hw/scp4d/rtl/scp4d_fe_r_share.v") === sha(read("hw/scp4d/rtl/scp4d_fe_r_share.v"))
  && pinned("hw/scp4d/rtl/scp4d_ede_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_ede_pipe.v"))
  && pinned("hw/scp4d/rtl/scp4d_hybrid_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_pipe.v")));
const fastDec = read("hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v");
const oldDec = read("hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v");
check("the one cut is in the new decoder and front end",
  fastDec.includes("scp4d_fe_r_fast") && fastDec.includes("q_hold")
  && !oldDec.includes("scp4d_fe_r_fast") && !oldDec.includes("q_hold"));

const placed = manifest.designs["loop-k1fast-w4l8"];
const seeds = placed?.seeds_45f ?? [];
check("loop-k1fast-w4l8 routes five of five at median 38.318580627441406 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && seeds[0]?.utilization?.TRELLIS_COMB?.used === 32497
  && seeds[0]?.utilization?.DP16KD?.used === 39
  && placed?.fmax_mhz?.median === 38.318580627441406 && placed?.fmax_mhz?.n === 5
  && placed?.smallest_part === "45F");

const bareF = manifest.designs["loop-k1bare-w4l8"]?.fmax_mhz?.median;
const fsdF = manifest.designs["loop-fsdonly-w4l8"]?.fmax_mhz?.median;
const oldF = 35.09634017944336;
const oldC: Record<number, number> = { 8: 18643, 10: 74342, 12: 149496 };
const wins = bareF === 31.84916114807129 && fsdF === 33.58522415161133 && [8, 10, 12].every((w) => {
  const fast = fastC[w]! / 38.318580627441406;
  const bare = bareC[w]! / bareF!;
  const old = oldC[w]! / oldF;
  const scan = fsdC[w]! / fsdF!;
  return fast < Math.min(bare, old, scan);
});
check("candidate wall time is strictly under the bare pipe, the old K1 loop and full scan", wins);
check("decisions/s per LUT is 181.13722038937402 and loses to standalone full scan",
  placed?.decisions_per_s_per_lut === 181.13722038937402
  && (placed?.decisions_per_s_per_lut ?? 0) < 71397.91807427029);

if (failures.length) {
  console.error(`FAIL check-scp-v0125 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0125 (${passed} checks)`);
