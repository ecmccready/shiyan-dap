/** TEST ONLY. v0.1.29 coherent hybrid. The rule is fixtures/scp/v0129-prereg.json.
 * The regression is synthetic. It does not use seed 9 or seed 13.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0129.ts
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

const prereg = JSON.parse(read("fixtures/scp/v0129-prereg.json")) as {
  training: { seed: number };
  held_out_original: { seed: number; regenerated: boolean };
  held_out_high: { seed: number; regenerated: boolean };
  selector_procedure: {
    sha256: string; feature: string; integer_test: string; percent_grid: number[];
    hold_grid: number[]; start_grid: string[]; choice_rule: string; engine_timing: string;
    tie: string; fail: string; wall: string; not_used_to_fit: string;
  };
  baselines_already_measured: {
    pipelined_k1: { wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
    n4_full_scan: { wall_us_original: Record<string, number>; wall_us_high: Record<string, number> };
  };
};
const p = prereg.selector_procedure;
const proc = {
  feature: p.feature, integer_test: p.integer_test, percent_grid: p.percent_grid,
  hold_grid: p.hold_grid, start_grid: p.start_grid, choice_rule: p.choice_rule,
  engine_timing: p.engine_timing, tie: p.tie, fail: p.fail, wall: p.wall, not_used_to_fit: p.not_used_to_fit,
};
check("prereg locks seed 21, held-out seeds, and the procedure hash",
  sha(JSON.stringify(proc)) === "a2b95b5bff379a55ef200a2a1097ba26cb00c44a30fad5bee87ba931a6feafb7"
  && p.sha256 === "a2b95b5bff379a55ef200a2a1097ba26cb00c44a30fad5bee87ba931a6feafb7"
  && prereg.training.seed === 21
  && prereg.held_out_original.seed === 9 && prereg.held_out_original.regenerated === false
  && prereg.held_out_high.seed === 13 && prereg.held_out_high.regenerated === false);

type Train = { percent: number; hold: number; start: string; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean };
const train = JSON.parse(read("fixtures/scp/v0129-train.json")) as { bit_exact: boolean; rows: Train[] };
const widths = [8, 10, 12];
const keyOf = (r: Train) => `${r.percent}|${r.hold}|${r.start}`;
const groups = new Map<string, Train[]>();
for (const r of train.rows) groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]);
const ranked = [...groups.entries()].map(([k, rs]) => {
  const legal = rs.length === 3 && rs.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1);
  return { k, legal, sum: rs.reduce((a, r) => a + r.cycles, 0) };
}).filter((g) => g.legal).sort((a, b) => a.sum - b.sum);
const freeze = JSON.parse(read("fixtures/scp/v0129-freeze.json")) as { percent: number; hold: number; start: string; procedure_sha256: string };
check("freeze is percent 8, hold 1, start k1, the legal minimum",
  freeze.percent === 8 && freeze.hold === 1 && freeze.start === "k1"
  && freeze.procedure_sha256 === p.sha256
  && ranked[0]?.k === "8|1|k1" && ranked[0]?.sum === 266848
  && train.bit_exact && train.rows.length === 96);

const reg = spawnSync("npx", ["--yes", "tsx@4", "--tsconfig", "./tsconfig.json", "scripts/scp-v0129-regress.ts"], {
  cwd: root, encoding: "utf8", env: { ...process.env, PATH: `/opt/eda/oss-cad-suite/bin:${process.env.PATH ?? ""}` },
});
check("synthetic traces match, including the v0.1.28 dropped-record trace",
  reg.status === 0 && /v0128-drop exact/.test(reg.stdout) && /switch-heavy exact/.test(reg.stdout) && /REGRESS PASS/.test(reg.stdout));

const profile = JSON.parse(read("fixtures/scp/v0129-profile.json")) as {
  rows: { shape: string; addr_w: number; classes: { class: string; eng_delta: number }[] }[];
};
const steady = profile.rows.filter((r) => r.shape === "high").every((r) =>
  r.classes.find((c) => c.class === "full_scan_steady")?.eng_delta === 0);
check("profile shows steady full-scan frames match N=4 engine cycles", steady && profile.rows.length === 6);

const held = JSON.parse(read("fixtures/scp/v0129-heldout.json")) as {
  percent: number; hold: number; start: string;
  rows: { workload: string; addr_w: number; cycles: number; fsd_frames: number; k1_frames: number; bit_exact: boolean }[];
};
const side = (name: string) => held.rows.filter((r) => r.workload === name);
const orig = side("original");
const high = side("high");
check("both held-out workloads are bit-exact and use both engines",
  held.percent === 8 && held.hold === 1 && held.start === "k1"
  && orig.length === 3 && high.length === 3
  && orig.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && high.every((r) => r.bit_exact && r.fsd_frames >= 1 && r.k1_frames >= 1)
  && orig.find((r) => r.addr_w === 8)?.cycles === 11913
  && high.find((r) => r.addr_w === 8)?.cycles === 24255);

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
check("v0.1.28 and v0.1.29 sources match the manifest",
  pinned("hw/scp4d/rtl/scp4d_hybrid_fix.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_fix.v"))
  && pinned("hw/scp4d/rtl/scp4d_fsd_n.v") === sha(read("hw/scp4d/rtl/scp4d_fsd_n.v"))
  && pinned("hw/scp4d/rtl/scp4d_ede_pipe.v") === sha(read("hw/scp4d/rtl/scp4d_ede_pipe.v"))
  && pinned("hw/scp4d/rtl/scp4d_hybrid_coh.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid_coh.v")));

const loop = manifest.designs["loop-hcoh-w4l8"];
const seeds = loop?.seeds_45f ?? [];
check("coherent hybrid routes five of five at median 36.48170471191406 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && loop?.fmax_mhz?.median === 36.48170471191406
  && loop?.resources_at_median_fmax_seed?.lut === 34920
  && loop?.resources_at_median_fmax_seed?.bram === 53
  && loop?.resources_at_median_fmax_seed?.ff === 10859
  && loop?.smallest_part === "45F"
  && loop?.fits?.["12F"] === false && loop?.fits?.["25F"] === false && loop?.fits?.["45F"] === true && loop?.fits?.["85F"] === true);

const fmax = loop?.fmax_mhz?.median ?? 0;
const k1 = prereg.baselines_already_measured.pipelined_k1;
const n4 = prereg.baselines_already_measured.n4_full_scan;
const underBoth = (row: { addr_w: number; cycles: number }, base: "original" | "high") => {
  const key = String(row.addr_w);
  const kw = base === "original" ? k1.wall_us_original[key]! : k1.wall_us_high[key]!;
  const nw = base === "original" ? n4.wall_us_original[key]! : n4.wall_us_high[key]!;
  return row.cycles / fmax < kw && row.cycles / fmax < nw;
};
check("wall time beats both baselines on the original set and not on the high-churn set",
  widths.every((w) => underBoth(orig.find((r) => r.addr_w === w)!, "original"))
  && widths.every((w) => !underBoth(high.find((r) => r.addr_w === w)!, "high")));

check("decisions/s per LUT is 724.2522623434322 and loses to standalone full scan",
  loop?.decisions_per_s_per_lut === 724.2522623434322 && 724.2522623434322 < 71397.91807427029);

if (failures.length) {
  console.log(`FAIL check-scp-v0129 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0129 (${passed} checks)`);
