/** TEST ONLY. v0.1.30 first-frame hybrid. The rule is fixtures/scp/v0130-prereg.json.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0130.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name}`); }
}
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

const prereg = JSON.parse(read("fixtures/scp/v0130-prereg.json")) as {
  training: { low_open: { seed: number; opening: number }; high_open: { seed: number; opening: number } };
  held_out_original: { seed: number; regenerated: boolean };
  held_out_high: { seed: number; regenerated: boolean };
  selector_procedure: {
    sha256: string; feature: string; integer_test: string; percent_grid: number[]; hold_grid: number[];
    first_frame: string; latency: string; choice_rule: string; engine_timing: string; tie: string;
    fail: string; wall: string; not_used_to_fit: string;
  };
  baselines_already_measured: {
    pipelined_k1: { wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
    n4_full_scan: { wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
  };
};
const p = prereg.selector_procedure;
const proc = {
  feature: p.feature, integer_test: p.integer_test, percent_grid: p.percent_grid, hold_grid: p.hold_grid,
  first_frame: p.first_frame, latency: p.latency, choice_rule: p.choice_rule, engine_timing: p.engine_timing,
  tie: p.tie, fail: p.fail, wall: p.wall, not_used_to_fit: p.not_used_to_fit,
};
check("prereg locks seeds 31 and 35, held-out seeds, and the procedure hash",
  sha(JSON.stringify(proc)) === "202d95ef8fbff7206a4721968f9dfc5d3b755e1674e6ea8422bc48e469674581"
  && p.sha256 === "202d95ef8fbff7206a4721968f9dfc5d3b755e1674e6ea8422bc48e469674581"
  && prereg.training.low_open.seed === 31 && prereg.training.low_open.opening === 0.05
  && prereg.training.high_open.seed === 35 && prereg.training.high_open.opening === 0.75
  && prereg.held_out_original.seed === 9 && prereg.held_out_original.regenerated === false
  && prereg.held_out_high.seed === 13 && prereg.held_out_high.regenerated === false);

type Train = { seed: number; percent: number; hold: number; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean };
const train = JSON.parse(read("fixtures/scp/v0130-train.json")) as { bit_exact: boolean; rows: Train[] };
const groups = new Map<string, Train[]>();
for (const r of train.rows) {
  const k = `${r.percent}|${r.hold}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}
const ranked = [...groups.entries()].map(([k, rs]) => ({
  k, sum: rs.reduce((a, r) => a + r.cycles, 0),
  legal: rs.length === 6 && rs.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1),
})).filter((g) => g.legal).sort((a, b) => a.sum - b.sum);
const freeze = JSON.parse(read("fixtures/scp/v0130-freeze.json")) as { percent: number; hold: number; procedure_sha256: string };
check("freeze is percent 8 and hold 1, the legal minimum",
  freeze.percent === 8 && freeze.hold === 1 && freeze.procedure_sha256 === p.sha256
  && ranked[0]?.k === "8|1" && ranked[0]?.sum === 589961 && train.rows.length === 96 && train.bit_exact);

const reg = spawnSync("npx", ["--yes", "tsx@4", "--tsconfig", "./tsconfig.json", "scripts/scp-v0130-regress.ts"], {
  cwd: root, encoding: "utf8", env: { ...process.env, PATH: `/opt/eda/oss-cad-suite/bin:${process.env.PATH ?? ""}` },
});
check("synthetic traces match, including the v0.1.28 dropped-record trace",
  reg.status === 0 && /v0128-drop exact/.test(reg.stdout) && /first-high exact/.test(reg.stdout) && /first-low exact/.test(reg.stdout) && /REGRESS PASS/.test(reg.stdout));

const held = JSON.parse(read("fixtures/scp/v0130-heldout.json")) as {
  percent: number; hold: number;
  rows: { workload: string; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean }[];
};
const side = (n: string) => held.rows.filter((r) => r.workload === n);
const orig = side("original");
const high = side("high");
check("both held-out workloads are bit-exact and use both engines",
  held.percent === 8 && held.hold === 1 && orig.length === 3 && high.length === 3
  && orig.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && high.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && high.find((r) => r.addr_w === 8)?.fsd_frames === 44
  && high.find((r) => r.addr_w === 8)?.cycles === 24017);

const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as {
  source_files: { path: string; sha256: string }[];
  designs: Record<string, {
    smallest_part?: string; decisions_per_s_per_lut?: number; fits?: Record<string, boolean>;
    fmax_mhz?: { median?: number; n?: number };
    resources_at_median_fmax_seed?: { lut?: number; bram?: number; ff?: number };
    seeds_45f?: { status: string }[];
  }>;
};
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("v0.1.29 coherent sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_hybrid_coh.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_coh.v"))
  && pinned("hw/scp4d/rtl/scp4d_hybrid_ff.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_ff.v")));

const loop = manifest.designs["loop-hff-w4l8"];
const seeds = loop?.seeds_45f ?? [];
check("first-frame hybrid routes five of five at median 39.474205017089844 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && loop?.fmax_mhz?.median === 39.474205017089844
  && loop?.resources_at_median_fmax_seed?.lut === 35438
  && loop?.resources_at_median_fmax_seed?.bram === 59
  && loop?.resources_at_median_fmax_seed?.ff === 10992
  && loop?.smallest_part === "45F"
  && loop?.fits?.["12F"] === false && loop?.fits?.["25F"] === false && loop?.fits?.["45F"] === true && loop?.fits?.["85F"] === true);

const fmax = loop?.fmax_mhz?.median ?? 0;
const k1 = prereg.baselines_already_measured.pipelined_k1;
const n4 = prereg.baselines_already_measured.n4_full_scan;
const under = (row: { addr_w: number; cycles: number }, base: "original" | "high") => {
  const key = String(row.addr_w);
  const kw = base === "original" ? k1.wall_us_original[key]! : k1.wall_us_high[key]!;
  const nw = base === "original" ? n4.wall_us_original[key]! : n4.wall_us_high[key]!;
  return row.cycles / fmax < kw && row.cycles / fmax < nw;
};
check("wall time is strictly under both baselines at all six cells",
  [8, 10, 12].every((w) => under(orig.find((r) => r.addr_w === w)!, "original") && under(high.find((r) => r.addr_w === w)!, "high")));

check("decisions/s per LUT is 772.2059796638306 and loses to standalone full scan",
  loop?.decisions_per_s_per_lut === 772.2059796638306 && 772.2059796638306 < 71397.91807427029);

const open = (seed: number) => train.rows.find((r) => r.seed === seed && r.percent === 8 && r.hold === 1 && r.addr_w === 8) as Train & { first_sel?: string };
check("seed 31 opens on K1 and seed 35 opens on full scan",
  open(31)?.first_sel === "0" && open(35)?.first_sel === "1" && open(31)?.bit_exact === true && open(35)?.bit_exact === true);

if (failures.length) {
  console.log(`FAIL check-scp-v0130 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0130 (${passed} checks)`);
