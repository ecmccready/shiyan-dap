/** TEST ONLY. v0.1.27 fast full scan and hybrid. The rule is fixtures/scp/v0127-prereg.json.
 * Counted checks do not re-simulate or place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0127.ts
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

const prereg = JSON.parse(read("fixtures/scp/v0127-prereg.json")) as {
  selector_procedure: { sha256: string; n_candidates: number[]; percent_grid: number[] };
  path2: { training_high: { seed: number }; held_out_high: { seed: number }; held_out_original: { seed: number; regenerated: boolean } };
};
const proc = {
  feature: "event count of the completed frame",
  integer_test: "events * 100 >= D * percent",
  n_candidates: [2, 4],
  n_rule: "Place both N. Choose the N with the smaller sum of training wall times at fraction 0.95 across ADDR_W 8, 10 and 12. A tie takes the smaller N.",
  not_used_to_fit: "held-out seed 9 and held-out seed 13",
  percent_grid: [55, 60, 65, 70, 75, 80, 85, 90, 95],
  percent_rule: "Smallest grid percent such that every training band with nominal fraction >= percent/100 has fast-scan wall time strictly below pipelined K1 at ADDR_W 8, 10 and 12, and at least one training band stays on K1. If no such percent exists, next_fsd is 0.",
  wall: "training cycles / that design's own five-seed 45F median Fmax",
};
check("prereg locks N in {2,4}, separate seeds, and the procedure hash",
  prereg.selector_procedure.sha256 === createHash("sha256").update(JSON.stringify(proc)).digest("hex")
  && prereg.path2.training_high.seed === 11 && prereg.path2.held_out_high.seed === 13
  && prereg.path2.held_out_original.seed === 9 && prereg.path2.held_out_original.regenerated === false);

const freeze = JSON.parse(read("fixtures/scp/v0127-freeze.json")) as { n: number; percent: number; procedure_sha256: string };
check("freeze chooses N=4 and percent 55 from the locked procedure",
  freeze.n === 4 && freeze.percent === 55 && freeze.procedure_sha256 === prereg.selector_procedure.sha256);

const train = JSON.parse(read("fixtures/scp/v0127-train.json")) as {
  bit_exact: boolean;
  rows: { regime: string; engine: string; addr_w: number; fraction: number; cycles: number }[];
};
const f095 = [8, 10, 12].every((w) => {
  const n4 = train.rows.find((r) => r.regime === "high" && r.engine === "n4" && r.addr_w === w && r.fraction === 0.95);
  const k1 = train.rows.find((r) => r.regime === "high" && r.engine === "k1" && r.addr_w === w && r.fraction === 0.95);
  return !!n4 && !!k1 && n4.cycles < k1.cycles;
});
check("training is bit-exact and N=4 has fewer 0.95-band cycles than K1", train.bit_exact && f095);

const held = JSON.parse(read("fixtures/scp/v0127-heldout.json")) as {
  rows: { workload: string; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean }[];
};
const orig = held.rows.filter((r) => r.workload === "original");
const high = held.rows.filter((r) => r.workload === "high");
check("original held-out hybrid is bit-exact and chooses zero full-scan frames",
  orig.length === 3 && orig.every((r) => r.bit_exact && r.fsd_frames === 0 && r.k1_frames === 64)
  && orig.find((r) => r.addr_w === 12)?.cycles === 131426);
check("high-churn held-out chooses both engines and is not bit-exact",
  high.length === 3 && high.every((r) => r.fsd_frames >= 1 && r.k1_frames >= 1 && r.bit_exact === false));

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
check("v0.1.20 and v0.1.25 sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_fsd.v") === sha(read("hw/scp4d/rtl/scp4d_fsd.v"))
  && pinned("hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v") === sha(read("hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v"))
  && pinned("hw/scp4d/rtl/scp4d_ede_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_ede_pipe.v")));
const n4 = manifest.designs["loop-fsd4-w4l8"];
const seeds = n4?.seeds_45f ?? [];
check("N=4 full-scan loop routes five of five at median 34.75722122192383 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && seeds[0]?.utilization?.TRELLIS_COMB?.used === 33281
  && seeds[0]?.utilization?.DP16KD?.used === 39
  && n4?.fmax_mhz?.median === 34.75722122192383 && n4?.smallest_part === "45F");
const n4f = 34.75722122192383;
const k1f = 38.318580627441406;
const n4c = { 8: 12512, 10: 49609, 12: 99731 };
const k1c = { 8: 16416, 10: 65255, 12: 131378 };
check("pure N=4 wall time is under pipelined K1 on the original held-out set, and the hybrid is not",
  [8, 10, 12].every((w) => n4c[w as 8] / n4f < k1c[w as 8] / k1f)
  && (131426 / (manifest.designs["loop-hnfast-w4l8"]?.fmax_mhz?.median ?? 1)) > k1c[12] / k1f
  && (n4?.decisions_per_s_per_lut ?? 0) < 71397.91807427029);

if (failures.length) {
  console.error(`FAIL check-scp-v0127 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0127 (${passed} checks)`);
