/**
 * v0.1.19 industry benchmark. Lattice ECP5, open toolchain, serial place-and-route.
 *
 *   npx tsx scripts/bench-ecp5-v0119.ts --init
 *   npx tsx scripts/bench-ecp5-v0119.ts --bit-exact
 *   npx tsx scripts/bench-ecp5-v0119.ts --only=<id> --seed=<1-5>
 *   npx tsx scripts/bench-ecp5-v0119.ts --only=<id> --fit
 *   npx tsx scripts/bench-ecp5-v0119.ts --write-docs
 *
 * 45F timing is five seeds. 12F/25F/85F fit is seed 1: pack-only first, and a
 * full route only when packing succeeds. A run that exceeds the bound is
 * "not completed within N s" and has no Fmax. Power is not measured.
 * No network. Writes only the manifest, reports, and generated docs.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DESIGNS, READ_FILES, workloadFor, type Design } from "./ecp5-v0119-catalog.ts";
import { paretoIds, round6, throughputValuesPerSec, valuesPerCycle, median, THROUGHPUT_FORMULA } from "./ecp5-v0119-score.ts";
import { adviseFromBenchmark } from "../src/scp/evidence/benchmark-advisor.ts";

const root = resolve(join(import.meta.dirname, ".."));
const OSS = process.env.OSS_CAD_SUITE ?? "/opt/eda/oss-cad-suite";
const MANIFEST = "fixtures/scp/v0119-industry-benchmark.json";
const PNR_DIR = "fixtures/scp/v0119-pnr";
const WORK = "fixtures/scp/v0119-work";
const BOUND_S = 7200;
const SEEDS = [1, 2, 3, 4, 5] as const;
const FIT_SEED = 1;
export const POWER = "NOT MEASURED — needs a programmed board. No board power measurement was taken.";

const env = {
  ...process.env,
  PATH: `${OSS}/bin:${OSS}/py3bin:${process.env.PATH ?? ""}`,
  VERILATOR_ROOT: `${OSS}/share/verilator`,
};

type Util = Record<string, { used: number; available: number }>;
export type SeedRec = {
  seed: number;
  part: string;
  device: string;
  mode: "route" | "pack-only";
  command: string[];
  command_sha256: string;
  wall_clock_s: number;
  exit_code: number | null;
  status: "routed" | "packed" | "does_not_fit" | "not_completed" | "failed";
  not_completed_within_s: number | null;
  fmax_mhz: number | null;
  fmax_clocks: Record<string, number> | null;
  utilization: Util | null;
  lut: number | null;
  ff: number | null;
  bram: number | null;
  dsp: number | null;
  error: string | null;
  report_path: string | null;
  report_sha256: string | null;
  netlist_sha256: string | null;
  log_sha256: string | null;
};

const log = (s: string) => console.log(`${new Date().toISOString()} ${s}`);
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const read = (rel: string) => readFileSync(join(root, rel));
const abs = (rel: string) => join(root, rel);

function firstLine(bin: string, args: string[]): string {
  const r = spawnSync(bin, args, { encoding: "utf8", env });
  return `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
}

export function toolBlock() {
  const versionFile = join(OSS, "VERSION");
  return {
    oss_cad_suite: existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : null,
    yosys: firstLine("yosys", ["-V"]),
    nextpnr_ecp5: firstLine("nextpnr-ecp5", ["--version"]),
    nextpnr_ice40: firstLine("nextpnr-ice40", ["--version"]),
    ecppack: firstLine("ecppack", ["--version"]),
    iverilog: firstLine("iverilog", ["-V"]).split("\n")[0],
  };
}

function emptyManifest() {
  return {
    format: "scp4d-v0119-industry-benchmark",
    version: 1,
    label: "v0.1.19 Industry Performance Benchmark. Post-route static timing from nextpnr. Not a programmed board. Power is not measured.",
    power: POWER,
    formula: THROUGHPUT_FORMULA,
    bound_s: BOUND_S,
    seeds_45f: [...SEEDS],
    fit: {
      seed: FIT_SEED,
      note: "12F, 25F and 85F use one seed. nextpnr --pack-only runs first. If packing fails, routing is not run and the failure text is the record. If packing succeeds, one full place-and-route (router2, --timing-allow-fail, no --tmg-ripup) decides whether it fits. 45F timing is five seeds and is not pack-only.",
    },
    flow: {
      device_45f: "LFE5U-45F",
      package: "CABGA381",
      router: "router2",
      freq_mhz_target: 12,
      timing_allow_fail: true,
      note: "Achieved Fmax is the minimum clock in the nextpnr report. The 12 MHz flag is the target, not the result. --timing-allow-fail keeps a routed design that misses that target.",
    },
    design_set: "Every RTL encoder, decoder and loop module, at the configuration earlier specs compare (W=2 and W=4 where the width changes the netlist; encoders and loops at L=8). Other (W, L) values of the same module are not re-placed.",
    tools: null as ReturnType<typeof toolBlock> | null,
    source_files: [] as { path: string; sha256: string }[],
    bit_exact: null as unknown,
    designs: {} as Record<string, unknown>,
    pareto: [] as string[],
    ranked: null as unknown,
    advice: null as unknown,
  };
}

function loadManifest(): ReturnType<typeof emptyManifest> {
  const p = abs(MANIFEST);
  if (!existsSync(p)) return emptyManifest();
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveManifest(m: ReturnType<typeof emptyManifest>) {
  mkdirSync(abs("fixtures/scp"), { recursive: true });
  writeFileSync(abs(MANIFEST), JSON.stringify(m, null, 2) + "\n");
}

function sourceHashes() {
  return READ_FILES.map((p) => ({ path: p, sha256: sha256(read(p)) }));
}

const PARTS = {
  "12F": { flag: "--12k", device: "LFE5U-12F" },
  "25F": { flag: "--25k", device: "LFE5U-25F" },
  "45F": { flag: "--45k", device: "LFE5U-45F" },
  "85F": { flag: "--85k", device: "LFE5U-85F" },
} as const;

function metaPath(id: string, part: string, mode: string, seed: number) {
  return join(PNR_DIR, id, `${part}-${mode}-seed${seed}.json`);
}

function runTool(cmd: string, args: string[], cwd: string, logRel: string): { status: number | null; seconds: number; timedOut: boolean } {
  mkdirSync(abs(join(WORK, cwd)), { recursive: true });
  const started = process.hrtime.bigint();
  const r = spawnSync("timeout", ["--foreground", String(BOUND_S), cmd, ...args], {
    cwd: abs(join(WORK, cwd)), encoding: "utf8", env, maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  writeFileSync(abs(logRel), text);
  const timedOut = r.status === 124;
  return { status: r.status, seconds, timedOut };
}

function parseReport(rel: string): { fmax: number | null; clocks: Record<string, number>; util: Util } {
  if (!existsSync(abs(rel))) return { fmax: null, clocks: {}, util: {} };
  let j: { fmax?: Record<string, { achieved?: number }>; utilization?: Record<string, { used?: number; available?: number }> };
  try { j = JSON.parse(readFileSync(abs(rel), "utf8")); }
  catch { return { fmax: null, clocks: {}, util: {} }; }
  const clocks: Record<string, number> = {};
  for (const [k, v] of Object.entries(j.fmax ?? {})) {
    if (typeof v?.achieved === "number" && v.achieved > 0) clocks[k] = v.achieved;
  }
  const util: Util = {};
  for (const [k, v] of Object.entries(j.utilization ?? {})) {
    if (typeof v?.used === "number" && typeof v?.available === "number") util[k] = { used: v.used, available: v.available };
  }
  const vals = Object.values(clocks);
  return { fmax: vals.length ? Math.min(...vals) : null, clocks, util };
}

function used(util: Util | null, key: string): number | null {
  if (!util || Object.keys(util).length === 0) return null;
  return util[key]?.used ?? 0;
}

function classify(text: string, exitCode: number | null, timedOut: boolean, packOnly: boolean, fmax: number | null): SeedRec["status"] {
  if (timedOut) return "not_completed";
  if (exitCode === 0 && packOnly) return "packed";
  if (exitCode === 0 && fmax !== null) return "routed";
  if (/ERROR:/i.test(text) && /BEL|expand region|no BELs|failed to (place|route)|Could not place|unroutable|overuse|does not fit/i.test(text)) return "does_not_fit";
  if (exitCode !== 0 && /ERROR:/i.test(text)) return "does_not_fit";
  return "failed";
}

function place(d: Design, part: keyof typeof PARTS, seed: number, packOnly: boolean, netHash: string): SeedRec {
  const mode = packOnly ? "pack-only" : "route";
  const rel = metaPath(d.id, part, mode, seed);
  if (existsSync(abs(rel))) {
    log(`reuse ${rel}`);
    return JSON.parse(readFileSync(abs(rel), "utf8"));
  }
  const wd = join(d.id, part);
  const p = PARTS[part];
  const reportRel = join(PNR_DIR, d.id, `${part}-${mode}-seed${seed}.report.json`);
  const logRel = join(WORK, d.id, `${part}-${mode}-seed${seed}.log`);
  mkdirSync(abs(join(PNR_DIR, d.id)), { recursive: true });
  const args = [
    p.flag, "--package", "CABGA381", "--json", abs(join(WORK, d.id, "n.json")),
    "--lpf-allow-unconstrained", "--freq", "12", "--router", "router2", "--seed", String(seed),
    "--timing-allow-fail", "--report", abs(reportRel),
    ...(packOnly ? ["--pack-only"] : []),
  ];
  const command = ["nextpnr-ecp5", ...args];
  log(`start ${d.id} ${part} ${mode} seed ${seed}`);
  const ran = runTool("nextpnr-ecp5", args, wd, logRel);
  const text = existsSync(abs(logRel)) ? readFileSync(abs(logRel), "utf8") : "";
  const parsed = parseReport(reportRel);
  const status = classify(text, ran.status, ran.timedOut, packOnly, parsed.fmax);
  const fmax = status === "routed" ? parsed.fmax : null;
  const err = (text.match(/ERROR: [^\n]+/) ?? [null])[0];
  const rec: SeedRec = {
    seed, part, device: p.device, mode,
    command, command_sha256: sha256(command.join(" ")),
    wall_clock_s: round6(ran.seconds), exit_code: ran.status,
    status, not_completed_within_s: status === "not_completed" ? BOUND_S : null,
    fmax_mhz: fmax, fmax_clocks: fmax === null ? null : parsed.clocks,
    utilization: Object.keys(parsed.util).length ? parsed.util : null,
    lut: used(parsed.util, "TRELLIS_COMB"), ff: used(parsed.util, "TRELLIS_FF"),
    bram: used(parsed.util, "DP16KD"), dsp: used(parsed.util, "MULT18X18D"),
    error: err ? err.slice(0, 400) : null,
    report_path: existsSync(abs(reportRel)) ? reportRel : null,
    report_sha256: existsSync(abs(reportRel)) ? sha256(read(reportRel)) : null,
    netlist_sha256: netHash,
    log_sha256: existsSync(abs(logRel)) ? sha256(read(logRel)) : null,
  };
  if (rec.status !== "routed") rec.fmax_mhz = null;
  writeFileSync(abs(rel), JSON.stringify(rec, null, 2) + "\n");
  log(`done ${d.id} ${part} ${mode} seed ${seed} ${rec.status} ${rec.wall_clock_s}s${rec.fmax_mhz ? ` fmax ${rec.fmax_mhz}` : ""}`);
  return rec;
}

function synth(d: Design): { netlist_sha256: string; stat_sha256: string; yosys_s: number; num_cells: number } {
  const stamp = join(WORK, d.id, "yosys.json");
  if (existsSync(abs(stamp)) && existsSync(abs(join(WORK, d.id, "n.json")))) {
    return JSON.parse(readFileSync(abs(stamp), "utf8"));
  }
  mkdirSync(abs(join(WORK, d.id)), { recursive: true });
  const ch = d.sets.length ? `chparam ${d.sets.map((s) => `-set ${s.name} ${s.value}`).join(" ")} ${d.top}; ` : "";
  const files = READ_FILES.map((f) => abs(f)).join(" ");
  const script = `read_verilog ${files}; ${ch}hierarchy -top ${d.top}; synth_ecp5 -top ${d.top} -json n.json; tee -q -o stat.json stat -json`;
  log(`yosys ${d.id}`);
  const started = process.hrtime.bigint();
  const r = spawnSync("yosys", ["-q", "-l", "yosys.log", "-p", script], {
    cwd: abs(join(WORK, d.id)), encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  if (r.status !== 0) throw new Error(`yosys failed ${d.id}: ${(r.stderr ?? "").slice(-500)}`);
  const stat = JSON.parse(readFileSync(abs(join(WORK, d.id, "stat.json")), "utf8")) as { design?: { num_cells?: number } };
  const out = {
    netlist_sha256: sha256(read(join(WORK, d.id, "n.json"))),
    stat_sha256: sha256(read(join(WORK, d.id, "stat.json"))),
    yosys_s: round6(seconds),
    num_cells: stat.design?.num_cells ?? -1,
    yosys_script_sha256: sha256(script),
  };
  writeFileSync(abs(stamp), JSON.stringify(out, null, 2) + "\n");
  return out;
}

function summarize(d: Design, seeds: SeedRec[], fit: Record<string, { fits: boolean | null; pack: SeedRec; route: SeedRec | null }>) {
  const w = workloadFor(root, d);
  const vpc = valuesPerCycle(w.element_frames, w.cycles);
  const routed = seeds.filter((s) => s.status === "routed" && s.fmax_mhz !== null);
  const fmaxes = routed.map((s) => s.fmax_mhz as number);
  let fmax: { min: number; median: number; max: number; n: number } | null = null;
  let throughput: { min: number; median: number; max: number } | null = null;
  let resources: { seed: number; lut: number | null; ff: number | null; bram: number | null } | null = null;
  let efficiency: { per_lut: number | null; per_ff: number | null; per_bram: number | null; per_bram_note: string | null } | null = null;
  if (fmaxes.length === 5) {
    const sorted = [...routed].sort((a, b) => (a.fmax_mhz as number) - (b.fmax_mhz as number) || a.seed - b.seed);
    const mid = sorted[2];
    fmax = { min: sorted[0].fmax_mhz as number, median: median(fmaxes), max: sorted[4].fmax_mhz as number, n: 5 };
    const tp = (mhz: number) => throughputValuesPerSec(w.element_frames, w.cycles, mhz);
    throughput = { min: tp(fmax.min), median: tp(fmax.median), max: tp(fmax.max) };
    resources = { seed: mid.seed, lut: mid.lut, ff: mid.ff, bram: mid.bram };
    const per = (n: number | null) => (n && n > 0 && throughput ? throughput.median / n : null);
    efficiency = {
      per_lut: per(mid.lut), per_ff: per(mid.ff), per_bram: per(mid.bram),
      per_bram_note: mid.bram === 0 ? "BRAM used is 0; values/s per BRAM is undefined" : null,
    };
  }
  const order = ["12F", "25F", "45F", "85F"] as const;
  const fit45 = seeds.some((s) => s.status === "routed");
  const fits: Record<string, boolean | null> = {
    "12F": fit["12F"]?.fits ?? null,
    "25F": fit["25F"]?.fits ?? null,
    "45F": seeds.length === 5 ? fit45 : null,
    "85F": fit["85F"]?.fits ?? null,
  };
  // Do not call a larger part the smallest while a smaller part has not been tried.
  let smallest: string | null = null;
  for (const p of order) {
    if (fits[p] === null) break;
    if (fits[p] === true) { smallest = p; break; }
  }
  return {
    id: d.id, kind: d.kind, milestone: d.milestone, top: d.top,
    sets: d.sets, composed_of: d.composedOf ?? [],
    workload: w, values_per_cycle: vpc,
    seeds_45f: seeds, fit, fmax_mhz: fmax, throughput_values_per_s: throughput,
    resources_at_median_fmax_seed: resources, efficiency, fits, smallest_part: smallest,
    power: POWER,
  };
}

function refreshDerived(m: ReturnType<typeof emptyManifest>) {
  const rows = Object.values(m.designs as Record<string, {
    id: string; fmax_mhz: { median: number } | null; throughput_values_per_s: { median: number } | null;
    efficiency: { per_lut: number | null } | null; kind: Design["kind"]; milestone: string;
    resources_at_median_fmax_seed: { lut: number | null; ff: number | null; bram: number | null } | null;
    composed_of: string[];
  }>).filter((d) => d.fmax_mhz && d.throughput_values_per_s && d.efficiency?.per_lut !== null && d.efficiency?.per_lut !== undefined);
  const scored = rows.map((d) => ({
    id: d.id, fmax_mhz: d.fmax_mhz!.median, throughput_values_per_s: d.throughput_values_per_s!.median,
    values_per_s_per_lut: d.efficiency!.per_lut as number,
  }));
  m.pareto = paretoIds(scored);
  const rank = (key: "fmax_mhz" | "throughput_values_per_s" | "values_per_s_per_lut") =>
    [...scored].sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id)).map((r) => r.id);
  m.ranked = scored.length ? { by_fmax: rank("fmax_mhz"), by_throughput: rank("throughput_values_per_s"), by_values_per_s_per_lut: rank("values_per_s_per_lut") } : null;
  m.advice = adviseFromBenchmark({
    power: POWER,
    designs: Object.values(m.designs as Record<string, {
      id: string; kind: Design["kind"]; milestone: string;
      fmax_mhz: { median: number } | null; throughput_values_per_s: { median: number } | null;
      efficiency: { per_lut: number | null } | null;
      resources_at_median_fmax_seed: { lut: number | null; ff: number | null; bram: number | null } | null;
      composed_of: string[];
    }>).map((d) => ({
      id: d.id, kind: d.kind, milestone: d.milestone,
      fmax_mhz_median: d.fmax_mhz?.median ?? null,
      throughput_values_per_s_median: d.throughput_values_per_s?.median ?? null,
      values_per_s_per_lut: d.efficiency?.per_lut ?? null,
      lut: d.resources_at_median_fmax_seed?.lut ?? null,
      ff: d.resources_at_median_fmax_seed?.ff ?? null,
      bram: d.resources_at_median_fmax_seed?.bram ?? null,
      composed_of: d.composed_of,
    })),
  });
}

function upsertDesign(d: Design) {
  const m = loadManifest();
  m.tools ??= toolBlock();
  m.source_files = sourceHashes();
  const seeds = SEEDS.map((seed) => {
    const p = metaPath(d.id, "45F", "route", seed);
    return existsSync(abs(p)) ? JSON.parse(readFileSync(abs(p), "utf8")) as SeedRec : null;
  }).filter((s): s is SeedRec => !!s);
  const fit: Record<string, { fits: boolean | null; pack: SeedRec; route: SeedRec | null }> = {};
  for (const part of ["12F", "25F", "85F"] as const) {
    const packP = metaPath(d.id, part, "pack-only", FIT_SEED);
    if (!existsSync(abs(packP))) continue;
    const pack = JSON.parse(readFileSync(abs(packP), "utf8")) as SeedRec;
    const routeP = metaPath(d.id, part, "route", FIT_SEED);
    const route = existsSync(abs(routeP)) ? JSON.parse(readFileSync(abs(routeP), "utf8")) as SeedRec : null;
    const fits = pack.status === "does_not_fit" || pack.status === "failed" ? false
      : route?.status === "routed" ? true
        : route?.status === "does_not_fit" || route?.status === "failed" ? false
          : null;
    fit[part] = { fits, pack, route };
  }
  (m.designs as Record<string, unknown>)[d.id] = summarize(d, seeds, fit);
  refreshDerived(m);
  saveManifest(m);
}

function ensureSynth(d: Design): string {
  const y = synth(d);
  return y.netlist_sha256;
}

const SIMS = [
  "scripts/check-scp-v0111-rtl.ts",
  "scripts/check-scp-v0112-rtl.ts",
  "scripts/check-scp-v0113-rtl.ts",
  "scripts/check-scp-v0114-rtl.ts",
  "scripts/check-scp-v0115-rtl.ts",
  "scripts/check-scp-v0116-rtl.ts",
  "scripts/check-scp-v0117-rtl.ts",
  "scripts/check-scp-v0118-rtl.ts",
];

function bitExact() {
  const runs = [];
  for (const script of SIMS) {
    log(`bit-exact ${script}`);
    const started = process.hrtime.bigint();
    const r = spawnSync("npx", ["--yes", "tsx@4", "--tsconfig", "./tsconfig.json", script, "--require-sim"], {
      cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024,
    });
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    const pass = out.split("\n").find((l) => l.startsWith("PASS ") || l.startsWith("FAIL ")) ?? null;
    runs.push({ script, args: ["--require-sim"], exit_code: r.status, wall_clock_s: round6(seconds), pass_line: pass, ok: r.status === 0 && !!pass?.startsWith("PASS ") });
    log(`${script} exit ${r.status} ${seconds.toFixed(1)}s`);
  }
  const m = loadManifest();
  m.tools ??= toolBlock();
  m.source_files = sourceHashes();
  m.bit_exact = { method: "Re-simulate each RTL check against the committed golden vectors (Icarus Verilog).", runs, ok: runs.every((r) => r.ok) };
  saveManifest(m);
}

function writeDocs() {
  const m = loadManifest();
  const designs = Object.values(m.designs as Record<string, {
    id: string; kind: string; milestone: string; fmax_mhz: { min: number; median: number; max: number } | null;
    throughput_values_per_s: { median: number } | null; efficiency: { per_lut: number | null; per_ff: number | null; per_bram: number | null } | null;
    resources_at_median_fmax_seed: { lut: number | null; ff: number | null; bram: number | null } | null;
    smallest_part: string | null; seeds_45f: SeedRec[]; workload: { cycles: number; element_frames: number; stream: string };
  }>);
  const cell = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(n));
  const lines = [
    "# v0.1.19 industry benchmark (generated)",
    "",
    "Generated by `scripts/bench-ecp5-v0119.ts --write-docs` from `fixtures/scp/v0119-industry-benchmark.json`. Do not edit by hand.",
    "",
    m.power as string,
    "",
    `Formula: ${THROUGHPUT_FORMULA}`,
    "",
    "A five-seed median is reported only when all five 45F routes finished. A seed that did not finish is `not completed within 7200 s` and contributes no Fmax.",
    "",
    "| design | kind | Fmax min | median | max | values/s (median) | LUT | FF | BRAM | per LUT | per FF | per BRAM | smallest part |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const d of DESIGNS) {
    const row = designs.find((x) => x.id === d.id);
    if (!row) { lines.push(`| ${d.id} | ${d.kind} | not run | | | | | | | | | | |`); continue; }
    const done = row.seeds_45f?.filter((s) => s.status === "routed").length ?? 0;
    const missed = row.seeds_45f?.filter((s) => s.status === "not_completed").length ?? 0;
    if (!row.fmax_mhz) {
      lines.push(`| ${row.id} | ${row.kind} | ${missed ? `not completed within ${BOUND_S} s (${missed} seed${missed === 1 ? "" : "s"})` : `${done}/5 routed`} | | | | | | | | | | ${row.smallest_part ?? "—"} |`);
      continue;
    }
    const res = row.resources_at_median_fmax_seed;
    const eff = row.efficiency;
    lines.push(`| ${row.id} | ${row.kind} | ${row.fmax_mhz.min} | ${row.fmax_mhz.median} | ${row.fmax_mhz.max} | ${cell(row.throughput_values_per_s?.median)} | ${cell(res?.lut)} | ${cell(res?.ff)} | ${cell(res?.bram)} | ${cell(eff?.per_lut)} | ${cell(eff?.per_ff)} | ${cell(eff?.per_bram)} | ${row.smallest_part ?? "—"} |`);
  }
  lines.push("", `Pareto set (clock, throughput, values/s per LUT): ${(m.pareto as string[]).join(", ") || "(none yet)"}.`, "");
  writeFileSync(abs("docs/design/v0119-industry-benchmark.md"), lines.join("\n"));
  const tools = m.tools as { yosys?: string; nextpnr_ecp5?: string; ecppack?: string; oss_cad_suite?: string } | null;
  const repro = [
    "# Reproduce the v0.1.19 numbers",
    "",
    "These commands are the ones the benchmark runs. Figures in the manifest are whatever this command wrote. Do not copy a number in by hand.",
    "",
    "```bash",
    "export PATH=\"/opt/eda/oss-cad-suite/bin:$PATH\"",
    "npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --bit-exact",
    "npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --seed=<1-5>",
    "npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only=<design-id> --fit",
    "npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --write-docs",
    "```",
    "",
    `Place-and-route bound: ${BOUND_S} s per invocation (\`timeout --foreground ${BOUND_S}\`). Exit 124 is recorded as not completed within ${BOUND_S} s. No Fmax is filled in for that seed.`,
    "",
    "45F route command (seed N):",
    "",
    "```text",
    "nextpnr-ecp5 --45k --package CABGA381 --json n.json --lpf-allow-unconstrained --freq 12 --router router2 --seed N --timing-allow-fail --report <report.json>",
    "```",
    "",
    "Fit command, seed 1, part in {--12k, --25k, --85k}, package CABGA381. `--pack-only` first. The route command above is run only when packing exits 0.",
    "",
    tools ? `Tools recorded in the manifest: Yosys ${tools.yosys ?? ""}; ${tools.nextpnr_ecp5 ?? ""}; ${tools.ecppack ?? ""}; OSS CAD Suite ${tools.oss_cad_suite ?? ""}.` : "Tool versions are filled when the benchmark runs.",
    "",
    "Power is not measured. It needs a programmed board.",
    "",
  ].join("\n");
  writeFileSync(abs("docs/design/v0119-reproduce.md"), repro);
}

function init() {
  const m = loadManifest();
  m.tools = toolBlock();
  m.source_files = sourceHashes();
  saveManifest(m);
  writeDocs();
  log(`wrote ${MANIFEST}`);
}

function main() {
  const argv = process.argv.slice(2);
  const only = argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const seedArg = argv.find((a) => a.startsWith("--seed="));
  const seed = seedArg ? Number(seedArg.slice("--seed=".length)) : null;
  if (argv.includes("--list")) { for (const d of DESIGNS) console.log(d.id); return; }
  if (argv.includes("--print-workload")) {
    for (const d of DESIGNS) { const w = workloadFor(root, d); console.log(`${d.id} ${w.cycles} ${w.element_frames}`); }
    return;
  }
  if (argv.includes("--init")) { init(); return; }
  if (argv.includes("--bit-exact")) { bitExact(); writeDocs(); return; }
  if (argv.includes("--write-docs")) { writeDocs(); return; }
  if (!only) { console.error("pass --init, --bit-exact, --only=<id> [--seed=N | --fit], --write-docs, or --list"); process.exit(2); }
  const d = DESIGNS.find((x) => x.id === only);
  if (!d) throw new Error(`unknown design ${only}`);
  const net = ensureSynth(d);
  if (seed !== null) {
    if (!(SEEDS as readonly number[]).includes(seed)) throw new Error("seed must be 1..5");
    place(d, "45F", seed, false, net);
  } else if (argv.includes("--fit")) {
    for (const part of ["12F", "25F", "85F"] as const) {
      const pack = place(d, part, FIT_SEED, true, net);
      if (pack.status === "packed") place(d, part, FIT_SEED, false, net);
    }
  } else {
    for (const s of SEEDS) place(d, "45F", s, false, net);
    for (const part of ["12F", "25F", "85F"] as const) {
      const pack = place(d, part, FIT_SEED, true, net);
      if (pack.status === "packed") place(d, part, FIT_SEED, false, net);
    }
  }
  upsertDesign(d);
  writeDocs();
}

const invoked = process.argv[1]?.endsWith("bench-ecp5-v0119.ts") || process.argv[1]?.endsWith("bench-ecp5-v0119.js");
if (invoked) main();
