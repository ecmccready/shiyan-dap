/** TEST ONLY. 4D-SCP v0.1.11 — RTL temporal-only decoder (hw/scp4d) verified against the v0.1.10
 * integer golden model, with measured cycle counts from an open-source simulator.
 *
 * Counted checks are deterministic and need NO simulator (so check-scp-all can pin the count):
 * isolation, unchanged pinned artefacts, RTL static rules, the new temporal-only vectors regenerate
 * byte-identically from the v0.1.10 model, the regenerated environment streams are exactly the
 * v0.1.10 report's temporal-only streams, the sim input files hash to the committed values, and the
 * committed simulation results agree with the closed-form RTL cycle model and are bit-exact.
 *
 * Simulator stage (NOT counted, so the count is identical with or without it): if Icarus Verilog
 * (iverilog + vvp) is found on PATH or in /opt/eda/oss-cad-suite/bin, the RTL is compiled and every
 * vector is re-simulated; any difference from the committed results fails the script (exit 1).
 * Without a simulator it prints "SKIP sim" and the counted checks still run. --require-sim fails
 * instead of skipping; --no-sim forces the skip. Synthesis (yosys / nextpnr) only runs with --synth.
 *
 * Writes nothing unless --write (refresh fixtures/scp/golden-vectors-scp4d-temporal.json and
 * fixtures/scp/v0111-rtl-report.json; needs the simulator; with --synth also the synthesis stats).
 * Sim scratch files go to an OS temp dir and are removed.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts [--no-sim | --require-sim] [--synth] [--write]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeQuantized } from "../src/scp/pack";
import { BOUNDED_EPS } from "./scp-v01-fixture";
import { frameFixtures } from "./scp-v019-env-fixture";
import { DECLARED_WIDTHS, decodeIntScp4d, decodeIntScp4dEventDriven, intOpsTotal, signedBits } from "./scp-v0110-int-scp4d";
import {
  RTL_ADDR_W, RTL_DRAIN, RTL_MAX_D, envTemporalStreams, rtlCycleModel, simFiles, streamStructure, temporalVectorFile,
  type StreamStructure,
} from "./scp-v0111-rtl-vectors";

const root = resolve(join(import.meta.dirname, ".."));
const RTL = "hw/scp4d/rtl/scp4d_tdec.v";
const TB = "hw/scp4d/tb/scp4d_tb.v";
const SYNTH_YS = "hw/scp4d/synth/synth.ys";
const VECTORS_V0110 = "fixtures/scp/golden-vectors-scp4d.json";
const VECTORS_T = "fixtures/scp/golden-vectors-scp4d-temporal.json";
const REPORT = "fixtures/scp/v0111-rtl-report.json";
const PINNED: [string, string, string][] = [
  ["src/scp/pack.ts", "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a", "pack.ts unchanged"],
  [VECTORS_V0110, "7e8b8165444e0b6f48c01622b2c41e9e035d80fa37b2a14dcd16de30d1e3cfd9", "v0.1.10 golden vectors unchanged"],
  ["fixtures/scp/v0110-int-report.json", "f5a9b42bd97ef3a108ecca656c82d4eabe23d311a4de288a6daab0a6af8c17b0", "v0.1.10 report unchanged"],
  ["scripts/scp-v0110-int-scp4d.ts", "9bebf5125141559f336a7c6fddf6d867afb50127f0c8758b4e76e1724a869007", "v0.1.10 integer model unchanged"],
  ["fixtures/scp/v019-bench-report.json", "b76cbe7d7108df758e632d334027a6359e98bf9b4cd183316371507a83676d7f", "v0.1.9 report unchanged"],
  ["fixtures/scp/golden-vectors.json", "5b5776c7aca50e4aa151892f4c8315f31560863085c63ddc209334bbe877d175", "v0.1.8 golden vectors unchanged"],
];
const V01_QUANTIZED_SHA = "07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc";
const WRITE = process.argv.includes("--write");
const SYNTH = process.argv.includes("--synth");
const REQUIRE_SIM = process.argv.includes("--require-sim") || WRITE;
const NO_SIM = process.argv.includes("--no-sim") && !REQUIRE_SIM;

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const read = (p: string) => readFileSync(join(root, p));
const stripV = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const stripTs = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const r4 = (x: number) => Number(x.toFixed(4));

// ---------- 1. Unchanged artefacts ----------
for (const [p, h, label] of PINNED) check(`${label} (sha pinned)`, existsSync(join(root, p)) && sha(read(p)) === h);
{
  const packEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
  check("v0.1 quantized sha unchanged (07a3d041…69d6bc)", sha(encodeQuantized(frameFixtures()[0].points, packEps).bytes) === V01_QUANTIZED_SHA);
}

// ---------- 2. Isolation ----------
{
  const SKIP = new Set(["node_modules", ".git", ".next"]);
  const importers: string[] = [], tsInHw: string[] = [], hwRefs: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(n.name)) continue;
      const p = join(d, n.name), rel = p.slice(root.length + 1);
      if (n.isDirectory()) { walk(p); continue; }
      if (rel.startsWith("hw/") && /\.(ts|tsx|mts|js|mjs|jsx)$/.test(n.name)) tsInHw.push(rel);
      if (!/\.(ts|tsx|mts|js|mjs)$/.test(n.name) || rel.startsWith("scripts/")) continue;
      const t = readFileSync(p, "utf8");
      if (/scp-v0111/.test(t)) importers.push(rel);
      if (/["'][^"']*hw\/scp4d/.test(t)) hwRefs.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.11 scripts (test-only, unwired)", importers.length === 0, importers.join(", ") || "none");
  check("hw/ holds no TS/JS (outside the Next.js and tsc build) and no app code references hw/scp4d", tsInHw.length === 0 && hwRefs.length === 0, [...tsInHw, ...hwRefs].join(", ") || "none");
  const gen = stripTs(read("scripts/scp-v0111-rtl-vectors.ts").toString());
  check("vector generator is pure: no I/O, env, clocks, randomness, hashing, Level 4 or app imports",
    !/node:fs|node:child_process|process\.env|Date\.now|Math\.random|createHash|node:crypto|level4|src\/app|metamorphic/i.test(gen));
}

// ---------- 3. RTL static rules ----------
const rtlText = existsSync(join(root, RTL)) ? read(RTL).toString() : "";
{
  const code = stripV(rtlText);
  check("RTL present: one module scp4d_tdec, `default_nettype none, Verilog-2005 subset", /module\s+scp4d_tdec\b/.test(code) && (code.match(/\bmodule\b/g) ?? []).length === 1 && /`default_nettype none/.test(code));
  const banned = code.match(/\binitial\b|\$\w+|\breal\b|\brealtime\b|\bshortreal\b|\bfork\b|#\s*\d/g) ?? [];
  check("RTL synthesizable subset: no initial blocks, system tasks, real types, fork or delays", banned.length === 0, JSON.stringify(banned));
  const divs = code.split("\n").filter((l) => !/^\s*`/.test(l) && /[^/]\/[^/]|%/.test(l.replace(/"[^"]*"/g, "")));
  check("RTL datapath has no division or modulo operators", divs.length === 0, divs.join(" | ").slice(0, 200));
  check("RTL rejects out-of-scope streams (rank > 0, relations) with unsupported = 1 instead of decoding them",
    /S_RANK:[\s\S]*?fail\(E_RANK, 1'b1\)/.test(code) && /S_REL:[\s\S]*?fail\(E_REL, 1'b1\)/.test(code));
  check(`RTL memory depth matches the generator (ADDR_W = ${RTL_ADDR_W}, max D = ${RTL_MAX_D})`, new RegExp(`parameter integer ADDR_W = ${RTL_ADDR_W}\\b`).test(code));
}

// ---------- 4. New temporal-only vectors (generated by the v0.1.10 model) ----------
const tv = temporalVectorFile();
const tvJson = `${JSON.stringify(tv.file, null, 2)}\n`;
check("temporal vectors: model encode -> decode round-trips for every vector", tv.ok);
check("temporal vectors: every one is rank 0 with relations off (in RTL scope)", tv.vectors.every((v) => v.config.rank === 0 && v.config.relations === false));
check("temporal vectors: >= 2 last-value-hold (event-driven) vectors and one linear-predictor vector",
  tv.vectors.filter((v) => v.config.predictor === "last").length >= 2 && tv.vectors.some((v) => v.config.predictor === "linear"));
if (WRITE) { writeFileSync(join(root, VECTORS_T), tvJson); console.log(`NOTE wrote ${VECTORS_T}`); }
check(`committed ${VECTORS_T} regenerates byte-identically`, existsSync(join(root, VECTORS_T)) && read(VECTORS_T).toString() === tvJson, `sha ${sha(tvJson).slice(0, 16)}, ${tv.vectors.length} vectors`);

// ---------- 5. Simulation work list ----------
type Job = {
  id: string; source: string; in_scope: boolean; bytes: Uint8Array; T: number; D: number;
  codes: number[][]; events: number[]; expect_unsup: number; expect_err: number; kind: "vector" | "negative";
};
const jobs: Job[] = [];
{
  const g = JSON.parse(read(VECTORS_V0110).toString()) as { vectors: { id: string; config: { rank: number; relations: boolean }; expected_bytes_hex: string; expected_decoded_codes: number[][]; expected_events: { positions: number[] }[]; decode_ops: Record<string, number> }[] };
  for (const v of g.vectors) {
    const inScope = v.config.rank === 0 && !v.config.relations;
    jobs.push({ id: v.id, source: VECTORS_V0110, in_scope: inScope, bytes: Uint8Array.from(Buffer.from(v.expected_bytes_hex, "hex")),
      T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length, codes: v.expected_decoded_codes, events: v.expected_events.map((e) => e.positions.length),
      expect_unsup: inScope ? 0 : v.config.rank > 0 ? 8 : 9, expect_err: 0, kind: "vector" });
  }
  for (const v of tv.vectors) jobs.push({ id: v.id, source: VECTORS_T, in_scope: true, bytes: Uint8Array.from(Buffer.from(v.expected_bytes_hex, "hex")),
    T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length, codes: v.expected_decoded_codes, events: v.expected_events.map((e) => e.positions.length),
    expect_unsup: 0, expect_err: 0, kind: "vector" });
}
const envStreams = envTemporalStreams();
{
  const rep = JSON.parse(read("fixtures/scp/v0110-int-report.json").toString()) as { fixtures: Record<string, { rows: { strategy: string; sha256_16: string; bytes: number; decode: { ops_per_ef: number } }[] }> };
  for (const s of envStreams) {
    const row = rep.fixtures[s.id.replace("-temporal-last", "")].rows.find((r) => r.strategy === "scp4d-int event-driven temporal-only")!;
    check(`${s.id}: regenerated stream is the v0.1.10 report's temporal-only stream (${row.bytes} B, sha ${row.sha256_16}) with the same decode ops/ef (${row.decode.ops_per_ef})`,
      sha(s.bytes).slice(0, 16) === row.sha256_16 && s.bytes.length === row.bytes && Number((intOpsTotal(decodeIntScp4dEventDriven(s.bytes, []).ops) / (s.T * s.D)).toPrecision(6)) === row.decode.ops_per_ef);
    jobs.push({ id: s.id, source: "regenerated (scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes,
      events: s.perFrame.map((f) => f.positions.length), expect_unsup: 0, expect_err: 0, kind: "vector" });
  }
}
{
  // Negative tests: corrupt one header byte of a valid temporal stream; the RTL must flag it.
  const base = jobs.find((j) => j.id === "env-4x4x1-T8-temporal-last")!;
  const s = streamStructure(base.bytes);
  const tail = s.fixed_bytes + 8 * 4 + 1; // first header byte after G
  let i = tail; const T = s.T;
  const skipV = () => { while (base.bytes[i] & 0x80) i++; i++; };
  for (let k = 0; k < T; k++) skipV();
  const metaAt = i; i++;
  const rankAt = i, relAt = i + 1, predAt = i + 2;
  const mut = (id: string, at: number, v: number, unsup: number, errc: number) => {
    const b = Uint8Array.from(base.bytes); b[at] = v;
    jobs.push({ id, source: `negative: ${base.id} byte ${at} := 0x${v.toString(16)}`, in_scope: false, bytes: b, T: base.T, D: base.D, codes: [], events: [], expect_unsup: unsup, expect_err: errc, kind: "negative" });
  };
  if (base.bytes[metaAt] !== 0) throw new Error("unexpected meta flag in base vector");
  mut("neg-bad-magic", 0, 0x58, 0, 1);
  mut("neg-bad-version", 4, 2, 0, 2);
  mut("neg-rank-1", rankAt, 1, 8, 0);
  mut("neg-relations-on", relAt, 1, 9, 0);
  mut("neg-bad-predictor", predAt, 3, 0, 10);
}

// v0.1.10 op-count model for the same stream: the event-driven decoder for last-value-hold streams
// (what the 2.38 pJ/ef estimate used), the generic frame decoder for zero / linear. Header included.
function modelOps(bytes: Uint8Array, predictor: number): number {
  return intOpsTotal(predictor === 1 ? decodeIntScp4dEventDriven(bytes, []).ops : decodeIntScp4d(bytes, []).ops);
}
// Derived (simulator-independent) facts per job
const structures = new Map<string, StreamStructure>();
const derived = jobs.map((j) => {
  const files = simFiles(j.bytes, j.codes, j.events);
  const base = { id: j.id, source: j.source, kind: j.kind, in_scope: j.in_scope, bytes: j.bytes.length, bytes_sha256: sha(j.bytes),
    sim_inputs_sha256: sha(files.stream + files.codes + files.events), expect_unsupported_code: j.expect_unsup, expect_err_code: j.expect_err };
  if (!j.in_scope) return { ...base };
  const s = streamStructure(j.bytes);
  structures.set(j.id, s);
  const m = rtlCycleModel(s);
  return { ...base, T: s.T, D: s.D, element_frames: s.T * s.D, predictor: ["zero", "last", "linear"][s.predictor], G: s.G,
    header_bytes: s.fixed_bytes + s.header_tail_bytes, payload_bytes: s.payload_bytes, sparse_frames: s.sparse_frames, dense_frames: s.dense_frames, events: s.events,
    model_cycles: m.cycles, model_clear_stall: m.clear_stall, model_sweep: m.sweep, model_decode_ops_total: modelOps(j.bytes, s.predictor) };
});
check("work list: every in-scope job's events per frame equal the stream walk's event total",
  jobs.filter((j) => j.in_scope).every((j) => j.events.reduce((a, b) => a + b, 0) === structures.get(j.id)!.events));
check(`work list: every in-scope stream fits the RTL (D <= ${RTL_MAX_D}, G <= 16, rank 0, relations off)`,
  [...structures.values()].every((s) => s.D <= RTL_MAX_D && s.G <= 16 && s.rank === 0 && s.relations !== 1));

// ---------- 6. Simulator (uncounted) ----------
type SimResult = Record<string, string | number>;
function findBin(name: string): string | null {
  for (const cand of [name, `/opt/eda/oss-cad-suite/bin/${name}`]) {
    const r = spawnSync(cand, name === "vvp" ? ["-V"] : name === "iverilog" ? ["-V"] : ["--version"], { encoding: "utf8" });
    if (r.status === 0 || (r.stdout ?? "").length > 0) return cand;
  }
  return null;
}
const firstLine = (bin: string | null, args: string[]) => {
  if (!bin) return null;
  const r = spawnSync(bin, args, { encoding: "utf8" });
  return `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? null;
};
function runSim(iverilog: string, vvp: string): { full: Map<string, SimResult>; bubbles: Map<string, SimResult>; tools: Record<string, string | null> } {
  const dir = mkdtempSync(join(tmpdir(), "scp4d-sim-"));
  try {
    const out = join(dir, "tb.vvp");
    const c = spawnSync(iverilog, ["-g2012", "-Wall", "-o", out, join(root, TB), join(root, RTL)], { encoding: "utf8" });
    if (c.status !== 0) throw new Error(`iverilog failed: ${c.stderr}`);
    const parse = (s: string): SimResult => {
      const line = s.split("\n").find((l) => l.startsWith("RESULT "));
      if (!line) throw new Error(`no RESULT line: ${s.slice(-500)}`);
      return Object.fromEntries(line.slice(7).split(" ").map((kv) => { const [k, v] = kv.split("="); return [k, /^-?\d+$/.test(v) ? Number(v) : v]; }));
    };
    const full = new Map<string, SimResult>(), bubbles = new Map<string, SimResult>();
    jobs.forEach((j, n) => {
      const f = simFiles(j.bytes, j.codes, j.events);
      const p = (k: string) => join(dir, `${n}.${k}.hex`);
      writeFileSync(p("stream"), f.stream); writeFileSync(p("codes"), f.codes); writeFileSync(p("events"), f.events);
      const args = (bub: number) => [out, `+stream=${p("stream")}`, `+codes=${p("codes")}`, `+events=${p("events")}`, `+nbytes=${j.bytes.length}`, `+t=${j.T}`, `+d=${j.D}`,
        `+expect_unsup=${j.expect_unsup}`, `+expect_err=${j.expect_err}`, `+bubbles=${bub}`, `+id=${j.id}`];
      const r = spawnSync(vvp, ["-n", ...args(0)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
      full.set(j.id, parse(r.stdout ?? ""));
      if (j.in_scope) { const rb = spawnSync(vvp, ["-n", ...args(1)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }); bubbles.set(j.id, parse(rb.stdout ?? "")); }
    });
    return { full, bubbles, tools: { iverilog: firstLine(iverilog, ["-V"]), vvp: firstLine(vvp, ["-V"]) } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function runSynth(): Record<string, unknown> {
  const yosys = findBin("yosys"), nextpnr = findBin("nextpnr-ice40");
  if (!yosys) throw new Error("--synth needs yosys");
  const dir = mkdtempSync(join(tmpdir(), "scp4d-synth-"));
  try {
    const y = spawnSync(yosys, ["-q", "-l", join(dir, "yosys.log"), "-p", `read_verilog ${join(root, RTL)}; tee -o ${join(dir, "generic.txt")} script ${join(root, SYNTH_YS)}`], { encoding: "utf8", cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    if (y.status !== 0) throw new Error(`yosys failed: ${y.stderr}${y.stdout}`);
    const stat = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
    const generic = stat("generic_stat.json"), ice = stat("ice40_stat.json"), xil = stat("xc7_stat.json");
    const cells = (s: { modules: Record<string, { num_cells: number; num_cells_by_type: Record<string, number> }> }) => {
      const m = Object.values(s.modules)[0];
      return { num_cells: m.num_cells, by_type: Object.fromEntries(Object.entries(m.num_cells_by_type).sort(([a], [b]) => a.localeCompare(b))) };
    };
    const ltp = readFileSync(join(dir, "yosys.log"), "utf8").match(/Longest topological path in \S+ \(length=(\d+)\)/g) ?? [];
    let pnr: Record<string, unknown> = { skipped: "nextpnr-ice40 not found" };
    if (nextpnr) {
      const p = spawnSync(nextpnr, ["--hx8k", "--package", "ct256", "--json", join(dir, "ice40.json"), "--pcf-allow-unconstrained", "--freq", "12", "--seed", "1", "--report", join(dir, "pnr.json")], { encoding: "utf8", cwd: dir, maxBuffer: 64 * 1024 * 1024 });
      if (p.status !== 0) pnr = { error: (p.stderr ?? "").split("\n").slice(-5).join(" ") };
      else {
        const rep = JSON.parse(readFileSync(join(dir, "pnr.json"), "utf8")) as { fmax: Record<string, { achieved: number; constraint: number }>; utilization: Record<string, { used: number; available: number }> };
        pnr = { device: "iCE40-HX8K (ct256)", seed: 1, fmax_mhz: Object.fromEntries(Object.entries(rep.fmax).map(([k, v]) => [k, r4(v.achieved)])),
          utilization: Object.fromEntries(Object.entries(rep.utilization).filter(([, v]) => v.used > 0).map(([k, v]) => [k, `${v.used}/${v.available}`])) };
      }
    }
    return {
      label: "SYNTHESIS / PLACE-AND-ROUTE ESTIMATES from open-source tools for one parameterisation (ADDR_W = 11). Not a programmed-FPGA or silicon measurement; no board was used.",
      tools: { yosys: firstLine(yosys, ["-V"]), nextpnr_ice40: firstLine(nextpnr, ["--version"]) },
      generic: { note: "yosys generic gates; state memories kept as $mem_v2 cells (2 × 2^ADDR_W × 32 bit)", ...cells(generic), longest_topological_path: ltp[0] ?? null },
      ice40: cells(ice),
      xc7: cells(xil),
      ice40_place_and_route: pnr,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- 7. Report ----------
const committed = existsSync(join(root, REPORT)) ? JSON.parse(read(REPORT).toString()) : null;
const iverilog = NO_SIM ? null : findBin("iverilog"), vvp = NO_SIM ? null : findBin("vvp");
let sim: ReturnType<typeof runSim> | null = null;
if (iverilog && vvp) sim = runSim(iverilog, vvp);
else if (REQUIRE_SIM) { console.log("FAIL simulator required (--require-sim / --write) but iverilog/vvp not found"); process.exit(1); }
else console.log(NO_SIM ? "SKIP sim — --no-sim; counted checks below use the committed results" : "SKIP sim — iverilog/vvp not found (install: sudo apt install iverilog); counted checks below use the committed results");

const MEAS_KEYS = ["ok", "done", "err", "unsupported", "err_code", "reject_byte", "consumed", "frames", "cycles", "take", "stall_clear", "stall_sweep", "stall_other", "drain", "tokens", "events", "mismatches", "ev_mismatch_frames", "max_code", "max_hold", "max_q", "max_dq", "max_pvarint", "timeout"] as const;
const pick = (r: SimResult) => Object.fromEntries(MEAS_KEYS.map((k) => [k, r[k]]));
function measuredSection(s: NonNullable<typeof sim>) {
  return derived.map((d) => {
    const r = s.full.get(d.id)!, b = s.bubbles.get(d.id);
    const ef = "element_frames" in d ? (d.element_frames as number) : 0;
    const cycles = r.cycles as number;
    return { id: d.id, ...pick(r),
      ...(d.in_scope ? { cycles_per_element_frame: r4(cycles / ef), cycles_per_byte: r4(cycles / d.bytes),
        register_bits: { code: signedBits(r.max_code as number), hold: signedBits(r.max_hold as number), q: signedBits(r.max_q as number), dq: signedBits(r.max_dq as number), payload_varint: signedBits(r.max_pvarint as number) - 1 },
        bubble_run: b ? { ok: b.ok, cycles: b.cycles, bubbles: b.bubbles, mismatches: b.mismatches } : null } : {}) };
  });
}

let report = committed as Record<string, unknown> | null;
if (WRITE && sim) {
  const lint = (() => { const v = findBin("verilator"); if (!v) return { tool: null, clean: null }; const r = spawnSync(v, ["--lint-only", "-Wall", join(root, RTL)], { encoding: "utf8" }); return { tool: firstLine(v, ["--version"]), command: "verilator --lint-only -Wall", clean: r.status === 0 && !/%Warning|%Error/.test(r.stderr ?? "") }; })();
  const measured = measuredSection(sim);
  const env64 = measured.find((m) => m.id === "env-16x16x2-T64-temporal-last")! as unknown as Record<string, number>;
  const d64 = derived.find((d) => d.id === "env-16x16x2-T64-temporal-last")! as unknown as Record<string, number>;
  const synth = SYNTH ? runSynth() : (committed?.synthesis ?? null);
  const fmax = (synth as { ice40_place_and_route?: { fmax_mhz?: Record<string, number> } } | null)?.ice40_place_and_route?.fmax_mhz;
  const fm = fmax ? Math.min(...Object.values(fmax)) : null;
  report = {
    format: "4d-scp-v0.1.11-rtl-report",
    version: 1,
    note: "TEST ONLY. Deterministic outputs of scripts/check-scp-v0111-rtl.ts --write. Cycle counts are MEASURED by simulating this RTL (Icarus Verilog), cycle-accurate for this design. Energy is NOT measured. Synthesis numbers are tool ESTIMATES. Environment fixtures are SYNTHETIC; no production data.",
    rtl: { file: RTL, sha256: sha(read(RTL)), testbench: TB, testbench_sha256: sha(read(TB)), ADDR_W: RTL_ADDR_W, max_D: RTL_MAX_D, drain_cycles: RTL_DRAIN,
      scope: "S4DI v1, rank 0, relations off; predictors zero / last (event-driven) / linear. rank > 0 or relations == 1 -> unsupported (rejected at the header)." },
    tools: { ...sim.tools, verilator_lint: lint },
    vectors: { v0110: { path: VECTORS_V0110, sha256: sha(read(VECTORS_V0110)) }, temporal: { path: VECTORS_T, sha256: sha(tvJson) } },
    cycle_model: "cycles = bytes + max(0, D − header_tail_bytes) + sweep_tokens(zero/linear sparse frames) + 4 (full-rate input; counted from the first cycle after reset to done, inclusive)",
    derived,
    measured,
    comparison: {
      fixture: "env-16x16x2-T64-temporal-last (the stream behind the v0.1.10 2.38 pJ/ef estimate)",
      rtl_cycles: env64.cycles, element_frames: d64.element_frames, bytes: d64.bytes,
      rtl_cycles_per_element_frame: env64.cycles_per_element_frame,
      rtl_payload_cycles_per_element_frame: r4(d64.payload_bytes / d64.element_frames),
      rtl_overhead_cycles: { header_bytes: d64.header_bytes, clear_stall: d64.model_clear_stall, drain: RTL_DRAIN },
      model_decode_ops_per_element_frame_incl_header: r4(d64.model_decode_ops_total / d64.element_frames),
      model_note: "v0.1.10 op-count model: event-driven temporal-only decoder, scalar ops (add/shift/bit/cmp/mul) per element-frame, header included; it assumes no parallelism.",
      model_ops_per_rtl_cycle: r4(d64.model_decode_ops_total / env64.cycles),
      ice40_fmax_mhz_estimate: fm,
      element_frames_per_second_at_ice40_fmax_estimate: fm ? Math.round((d64.element_frames / env64.cycles) * fm * 1e6) : null,
      energy: "not measured; the v0.1.10 2.38 pJ/ef figure remains a 45 nm op-count model estimate",
    },
    synthesis: synth,
  };
  writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`NOTE wrote ${REPORT}`);
}

// Counted: committed report consistency (no simulator needed)
{
  const rep = report as { rtl?: { sha256: string; testbench_sha256: string }; derived?: unknown[]; measured?: Record<string, unknown>[]; vectors?: { temporal: { sha256: string } }; synthesis?: { label?: string } } | null;
  check(`committed ${REPORT} exists`, rep !== null);
  check("report pins the current RTL and testbench (sha256)", !!rep?.rtl && rep.rtl.sha256 === sha(read(RTL)) && rep.rtl.testbench_sha256 === sha(read(TB)));
  check("report pins the temporal vector file", rep?.vectors?.temporal.sha256 === sha(tvJson));
  check("report's derived section (stream structure, sim-input hashes, cycle model) matches this run", JSON.stringify(rep?.derived) === JSON.stringify(derived));
  const meas = new Map((rep?.measured ?? []).map((m) => [m.id as string, m]));
  const inScope = derived.filter((d) => d.in_scope);
  check(`every in-scope vector (${inScope.length}) decoded bit-exact in simulation: all frames, all elements, per-frame event counts, all bytes consumed`,
    inScope.every((d) => { const m = meas.get(d.id); return !!m && m.ok === 1 && m.mismatches === 0 && m.ev_mismatch_frames === 0 && m.consumed === d.bytes && m.frames === (d as { T: number }).T && m.timeout === 0; }));
  check("every in-scope vector is also bit-exact with pseudo-random input bubbles (valid/ready handshake)",
    inScope.every((d) => { const b = (meas.get(d.id)?.bubble_run ?? null) as { ok: number; mismatches: number } | null; return !!b && b.ok === 1 && b.mismatches === 0; }));
  check("measured cycles == closed-form RTL cycle model for every in-scope vector (full-rate input)",
    inScope.every((d) => meas.get(d.id)?.cycles === (d as { model_cycles: number }).model_cycles));
  const outScope = derived.filter((d) => !d.in_scope);
  check(`every out-of-scope / corrupted stream (${outScope.length}) is rejected with the expected unsupported / error code`,
    outScope.every((d) => { const m = meas.get(d.id); return !!m && m.ok === 1 && m.err === 1 && m.done === 0 && m.unsupported === (d.expect_unsupported_code ? 1 : 0) && m.err_code === (d.expect_unsupported_code || d.expect_err_code); }));
  check("observed RTL register maxima stay within the declared widths (code 32, q 32) and the RTL's 35-bit payload varint",
    inScope.every((d) => { const rb = meas.get(d.id)?.register_bits as Record<string, number> | undefined; return !!rb && rb.code <= DECLARED_WIDTHS.code && rb.hold <= DECLARED_WIDTHS.code && rb.q <= DECLARED_WIDTHS.q && rb.payload_varint <= 35; }));
  check("synthesis section, when present, is labelled as an estimate (not a hardware measurement)", !rep?.synthesis || /ESTIMATE/.test(rep.synthesis.label ?? ""));
}

// Uncounted: fresh simulation must equal the committed measurements
if (sim && report) {
  const fresh = JSON.stringify(measuredSection(sim));
  const same = fresh === JSON.stringify((report as { measured: unknown }).measured);
  console.log(`${same ? "SIM PASS" : "SIM FAIL"} re-simulated ${jobs.length} streams (${derived.filter((d) => d.in_scope).length} in scope + bubble runs) with ${sim.tools.iverilog}: ${same ? "identical to the committed report" : "DIFFERS from the committed report"}`);
  if (!same) failures.push("simulation differs from committed report");
}

// ---------- 8. Table ----------
const rep = report as { measured?: Record<string, unknown>[] } | null;
if (rep?.measured) {
  console.log("\nvector                               bytes   T×D        events  bit-exact  cycles    cyc/ef   cyc/B   model_cycles");
  for (const d of derived) {
    const m = rep.measured.find((x) => x.id === d.id)!;
    if (d.in_scope) {
      const dd = d as typeof d & { T: number; D: number; events: number; model_cycles: number };
      console.log(`${d.id.padEnd(36)} ${String(d.bytes).padStart(6)}  ${`${dd.T}×${dd.D}`.padEnd(9)} ${String(dd.events).padStart(7)}  ${m.ok === 1 ? "yes" : "NO "}        ${String(m.cycles).padStart(7)}  ${String(m.cycles_per_element_frame).padStart(7)}  ${String(m.cycles_per_byte).padStart(6)}  ${dd.model_cycles}`);
    } else console.log(`${d.id.padEnd(36)} ${String(d.bytes).padStart(6)}  rejected: ${m.unsupported ? "unsupported" : "error"} code ${m.err_code} at byte ${m.reject_byte}`);
  }
}

if (failures.length) { console.log(`FAIL check-scp-v0111-rtl (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
console.log(`PASS check-scp-v0111-rtl (${passed} checks)`);
