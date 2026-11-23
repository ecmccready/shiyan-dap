/** TEST ONLY. v0.1.28 handoff fix. The rule is fixtures/scp/v0128-prereg.json.
 * The regression simulates a synthetic trace. It does not use seed 9 or seed 13.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0128.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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

const prereg = JSON.parse(read("fixtures/scp/v0128-prereg.json")) as {
  training: { seed: number };
  held_out_original: { seed: number; regenerated: boolean };
  held_out_high: { seed: number; regenerated: boolean };
  selector_procedure: {
    sha256: string; percent_grid: number[]; feature: string; integer_test: string;
    percent_rule: string; engine_timing: string; tie: string; fail: string; wall: string; not_used_to_fit: string;
  };
  baselines_already_measured: {
    pipelined_k1: { fmax_mhz_median: number; wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
    n4_full_scan: { fmax_mhz_median: number; wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
  };
};
const proc = {
  feature: prereg.selector_procedure.feature,
  integer_test: prereg.selector_procedure.integer_test,
  percent_grid: prereg.selector_procedure.percent_grid,
  percent_rule: prereg.selector_procedure.percent_rule,
  engine_timing: prereg.selector_procedure.engine_timing,
  tie: prereg.selector_procedure.tie,
  fail: prereg.selector_procedure.fail,
  wall: prereg.selector_procedure.wall,
  not_used_to_fit: prereg.selector_procedure.not_used_to_fit,
};
check("prereg locks seed 17, held-out seeds 9 and 13, and the procedure hash",
  sha(JSON.stringify(proc)) === "aa4026ee3d12d458b46131df04f302c95974e9d814a2dad82f726dda1e38fe09"
  && prereg.selector_procedure.sha256 === "aa4026ee3d12d458b46131df04f302c95974e9d814a2dad82f726dda1e38fe09"
  && prereg.training.seed === 17
  && prereg.held_out_original.seed === 9 && prereg.held_out_original.regenerated === false
  && prereg.held_out_high.seed === 13 && prereg.held_out_high.regenerated === false);

const train = JSON.parse(read("fixtures/scp/v0128-train.json")) as {
  bit_exact: boolean;
  rows: { percent: number; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean }[];
};
const widths = [8, 10, 12];
const sumOf = (percent: number) => widths.reduce((a, w) => a + (train.rows.find((r) => r.percent === percent && r.addr_w === w)?.cycles ?? 0), 0);
const legal = (percent: number) => widths.every((w) => {
  const r = train.rows.find((row) => row.percent === percent && row.addr_w === w);
  return !!r && r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1;
});
const ranked = [...prereg.selector_procedure.percent_grid].filter(legal).sort((a, b) => sumOf(a) - sumOf(b) || a - b);
const freeze = JSON.parse(read("fixtures/scp/v0128-freeze.json")) as { percent: number; procedure_sha256: string };
check("freeze percent 15 is the legal training minimum",
  freeze.percent === 15 && ranked[0] === 15 && freeze.procedure_sha256 === prereg.selector_procedure.sha256
  && sumOf(15) === 274143 && sumOf(15) < sumOf(8) && sumOf(15) < sumOf(25));

const reg = spawnSync("npx", ["--yes", "tsx@4", "--tsconfig", "./tsconfig.json", "scripts/scp-v0128-regress.ts"], {
  cwd: root, encoding: "utf8", env: { ...process.env, PATH: `/opt/eda/oss-cad-suite/bin:${process.env.PATH ?? ""}` },
});
check("synthetic handoff drops element 0 on the old hybrid and matches on the new one",
  reg.status === 0 && /missing 3:0:0 5:0:1/.test(reg.stdout) && /new exact true/.test(reg.stdout) && /REGRESS PASS/.test(reg.stdout));

check("training seed 17 is bit-exact at every percent and width",
  train.bit_exact && train.rows.length === 24 && train.rows.every((r) => r.bit_exact));

const held = JSON.parse(read("fixtures/scp/v0128-heldout.json")) as {
  percent: number;
  rows: { workload: string; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; switches: number; bit_exact: boolean }[];
};
const both = (name: string) => held.rows.filter((r) => r.workload === name);
const orig = both("original");
const high = both("high");
check("both held-out workloads are bit-exact and use both engines",
  held.percent === 15 && orig.length === 3 && high.length === 3
  && orig.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && high.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && orig.find((r) => r.addr_w === 12)?.cycles === 95836
  && high.find((r) => r.addr_w === 12)?.cycles === 269367);

const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as {
  source_files: { path: string; sha256: string }[];
  designs: Record<string, {
    smallest_part?: string;
    decisions_per_s_per_lut?: number;
    fits?: Record<string, boolean>;
    fmax_mhz?: { median?: number; n?: number };
    resources_at_median_fmax_seed?: { lut?: number; bram?: number };
    seeds_45f?: { status: string }[];
  }>;
};
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("v0.1.27 hybrid and scan sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_hybrid_n.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_n.v"))
  && pinned("hw/scp4d/rtl/scp4d_fsd_n.v") === sha(read("hw/scp4d/rtl/scp4d_fsd_n.v"))
  && pinned("hw/scp4d/rtl/scp4d_ede_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_ede_pipe.v"))
  && pinned("hw/scp4d/rtl/scp4d_hybrid_fix.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_fix.v")));

const loop = manifest.designs["loop-hnfix-w4l8"];
const seeds = loop?.seeds_45f ?? [];
check("fixed hybrid routes five of five at median 37.61236572265625 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && loop?.fmax_mhz?.n === 5 && loop?.fmax_mhz?.median === 37.61236572265625
  && loop?.resources_at_median_fmax_seed?.lut === 34559
  && loop?.resources_at_median_fmax_seed?.bram === 51
  && loop?.smallest_part === "45F"
  && loop?.fits?.["12F"] === false && loop?.fits?.["25F"] === false && loop?.fits?.["45F"] === true);

const fmax = loop?.fmax_mhz?.median ?? 0;
const wall = (cycles: number) => cycles / fmax;
const k1 = prereg.baselines_already_measured.pipelined_k1;
const n4 = prereg.baselines_already_measured.n4_full_scan;
const underBoth = (row: { addr_w: number; cycles: number }, base: "original" | "high") => {
  const key = String(row.addr_w);
  const kw = base === "original" ? k1.wall_us_original[key]! : k1.wall_us_high[key]!;
  const nw = base === "original" ? n4.wall_us_original[key]! : n4.wall_us_high[key]!;
  return wall(row.cycles) < kw && wall(row.cycles) < nw;
};
check("wall time beats both baselines only at original ADDR_W 10 and 12",
  fmax === 37.61236572265625
  && underBoth(orig.find((r) => r.addr_w === 10)!, "original")
  && underBoth(orig.find((r) => r.addr_w === 12)!, "original")
  && !underBoth(orig.find((r) => r.addr_w === 8)!, "original")
  && widths.every((w) => !underBoth(high.find((r) => r.addr_w === w)!, "high")));

check("decisions/s per LUT is 745.3661690238097 and loses to standalone full scan",
  loop?.decisions_per_s_per_lut === 745.3661690238097 && 745.3661690238097 < 71397.91807427029);

if (failures.length) {
  console.log(`FAIL check-scp-v0128 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0128 (${passed} checks)`);
