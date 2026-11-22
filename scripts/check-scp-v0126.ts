/** TEST ONLY. v0.1.26 training-frozen hybrid. The rule is fixtures/scp/v0126-prereg.json.
 * Counted checks do not re-simulate or place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0126.ts
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

const prereg = JSON.parse(read("fixtures/scp/v0126-prereg.json")) as {
  selector: { rtl: string; sha256: string; threshold: string };
  training: { seed: number; fractions: number[] };
  verdict: { STOP: string };
};
const rule = {
  compare: "closed-loop wall cycles of scp4d_ede_pipe versus scp4d_fsd behind scp4d_tdec_s_w4_fast",
  feature: "event count of the frame just completed",
  rtl: "next_fsd = 1'b0",
  source: "fixtures/scp/v0126-train.json",
  switch: "between frames only, masked, and only if next_fsd differs from the engine in use. A constant 0 selects no switch from the initial K1 engine.",
  threshold: "select full scan only for a training fraction whose full-scan wall cycles were strictly lower. No training fraction qualified.",
};
const ruleHash = createHash("sha256").update(JSON.stringify(rule)).digest("hex");
check("prereg hash matches the frozen next_fsd = 0 rule",
  prereg.selector.rtl === "next_fsd = 1'b0" && prereg.selector.sha256 === ruleHash
  && prereg.training.seed === 4 && prereg.training.fractions.includes(0.55) && !prereg.training.fractions.includes(0.5)
  && prereg.verdict.STOP.includes("full-scan"));

const train = JSON.parse(read("fixtures/scp/v0126-train.json")) as {
  seed: number;
  fsd_fewer_on_any_band: boolean;
  bands: { fsd_fewer: boolean }[];
};
check("training seed 4 has no band where full scan has fewer cycles",
  train.seed === 4 && train.fsd_fewer_on_any_band === false && train.bands.length === 18
  && train.bands.every((b) => b.fsd_fewer === false));

const held = JSON.parse(read("fixtures/scp/v0126-heldout.json")) as {
  rows: { addr_w: number; cycles: number; fsd_frames: number; switches: number; k1_frames: number; bit_exact: boolean }[];
};
const want: Record<number, number> = { 8: 16463, 10: 65302, 12: 131426 };
const heldOk = [8, 10, 12].every((w) => {
  const r = held.rows.find((x) => x.addr_w === w);
  return !!r && r.bit_exact && r.cycles === want[w] && r.fsd_frames === 0 && r.switches === 0 && r.k1_frames === 64;
});
check("held-out chooses zero full-scan frames and matches the K1 decision set", heldOk);

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
check("v0.1.24 and v0.1.25 sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_hybrid_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_pipe.v"))
  && pinned("hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v") === sha(read("hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v"))
  && pinned("hw/scp4d/rtl/scp4d_fe_r_fast.v") === sha(read("hw/scp4d/rtl/scp4d_fe_r_fast.v"))
  && pinned("hw/scp4d/rtl/scp4d_ede_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_ede_pipe.v")));
const hy = read("hw/scp4d/rtl/scp4d_hybrid_fast.v");
check("scp4d_hybrid_fast keeps both engines and the frozen predicate",
  hy.includes("scp4d_ede_pipe") && hy.includes("scp4d_fsd") && hy.includes("1'b0 && very_high"));

const placed = manifest.designs["loop-hyfast-w4l8"];
const seeds = placed?.seeds_45f ?? [];
const median = placed?.fmax_mhz?.median;
check("loop-hyfast-w4l8 routes five of five at median 35.78841781616211 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && seeds[0]?.utilization?.TRELLIS_COMB?.used === 34005
  && seeds[0]?.utilization?.DP16KD?.used === 48
  && median === 35.78841781616211 && placed?.fmax_mhz?.n === 5
  && placed?.smallest_part === "45F");
const k1 = { 8: 428.408353, 10: 1702.959737, 12: 3428.571671 };
const loses = [8, 10, 12].every((w) => want[w]! / median! > k1[w as 8 | 10 | 12]);
check("hybrid wall time is above pipelined K1 at 8, 10 and 12", loses);
check("decisions/s per LUT is 161.61535904904028 and loses to standalone full scan",
  placed?.decisions_per_s_per_lut === 161.61535904904028
  && (placed?.decisions_per_s_per_lut ?? 0) < 71397.91807427029);

if (failures.length) {
  console.error(`FAIL check-scp-v0126 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0126 (${passed} checks)`);
