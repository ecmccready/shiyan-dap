/** TEST ONLY. 4D-SCP v0.1.12 — RTL event-driven RELATIONS decoder (hw/scp4d/rtl/scp4d_rdec.v)
 * verified against the v0.1.10 integer golden model, with measured cycle counts from an open-source
 * simulator, and the question "are relations worth their extra cost in hardware?" answered from
 * measured cycles plus labelled estimates.
 *
 * Counted checks are deterministic and need NO simulator (so check-scp-all can pin the count):
 * unchanged pinned artefacts (incl. the whole v0.1.11 RTL deliverable), isolation, RTL static rules,
 * the new relations vectors regenerate byte-identically from the v0.1.10 model, the regenerated
 * environment relations streams are exactly the v0.1.10 report's, the sim inputs hash to the
 * committed values, and the committed simulation results agree with the closed-form cycle model,
 * are bit-exact, and the committed comparison / verdict numbers recompute from them.
 *
 * Simulator stage (NOT counted): if Icarus Verilog (iverilog + vvp) is found on PATH or in
 * /opt/eda/oss-cad-suite/bin, every job is re-simulated; any difference from the committed results
 * fails the script (exit 1). Without it: "SKIP sim". --require-sim fails instead of skipping;
 * --no-sim forces the skip. Synthesis / place-and-route (yosys, nextpnr-ice40, nextpnr-ecp5) only
 * with --synth.
 *
 * Writes nothing unless --write (refresh fixtures/scp/golden-vectors-scp4d-relations.json and
 * fixtures/scp/v0112-rtl-report.json; needs the simulator; with --synth also the synthesis stats).
 * Scratch files go to an OS temp dir and are removed.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0112-rtl.ts [--no-sim | --require-sim] [--synth] [--write]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeQuantized } from "../src/scp/pack";
import { BOUNDED_EPS } from "./scp-v01-fixture";
import { ENV_EPS, frameFixtures, makeEnvironment } from "./scp-v019-env-fixture";
import { DECLARED_WIDTHS, decodeIntScp4dEventDriven, fixRelations, intOpsTotal, signedBits } from "./scp-v0110-int-scp4d";
import { envTemporalStreams, streamStructure, temporalVectorFile } from "./scp-v0111-rtl-vectors";
import {
  RDEC, RDEC_DRAIN, RDEC_FW, RDEC_MAX_D, envRelationsStreams, eventPositions, rdecCycleModel, rdecSimFiles, relationsVectorFile, rtlProgram,
  type RtlProgram,
} from "./scp-v0112-rtl-vectors";

const root = resolve(join(import.meta.dirname, ".."));
const RTL = "hw/scp4d/rtl/scp4d_rdec.v";
const TB = "hw/scp4d/tb/scp4d_rdec_tb.v";
const SYNTH_YS = "hw/scp4d/synth/synth_rdec.ys";
const RTL_T = "hw/scp4d/rtl/scp4d_tdec.v";
const VECTORS_V0110 = "fixtures/scp/golden-vectors-scp4d.json";
const VECTORS_T = "fixtures/scp/golden-vectors-scp4d-temporal.json";
const VECTORS_R = "fixtures/scp/golden-vectors-scp4d-relations.json";
const REPORT_V0111 = "fixtures/scp/v0111-rtl-report.json";
const REPORT = "fixtures/scp/v0112-rtl-report.json";
const PINNED: [string, string, string][] = [
  ["src/scp/pack.ts", "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a", "pack.ts unchanged"],
  [VECTORS_V0110, "7e8b8165444e0b6f48c01622b2c41e9e035d80fa37b2a14dcd16de30d1e3cfd9", "v0.1.10 golden vectors unchanged"],
  ["fixtures/scp/v0110-int-report.json", "f5a9b42bd97ef3a108ecca656c82d4eabe23d311a4de288a6daab0a6af8c17b0", "v0.1.10 report unchanged"],
  ["scripts/scp-v0110-int-scp4d.ts", "9bebf5125141559f336a7c6fddf6d867afb50127f0c8758b4e76e1724a869007", "v0.1.10 integer model unchanged"],
  ["fixtures/scp/v019-bench-report.json", "b76cbe7d7108df758e632d334027a6359e98bf9b4cd183316371507a83676d7f", "v0.1.9 report unchanged"],
  ["fixtures/scp/golden-vectors.json", "5b5776c7aca50e4aa151892f4c8315f31560863085c63ddc209334bbe877d175", "v0.1.8 golden vectors unchanged"],
  [RTL_T, "50065f66c044c3a69492952719655685c0a2d17deb5a8e406dd65c759a2a346b", "v0.1.11 RTL scp4d_tdec.v unchanged"],
  ["hw/scp4d/tb/scp4d_tb.v", "fe0ad1afc04aab39b032dd7d8f8f038df1b0c4309d34fa859da9caf4a6f3c4dc", "v0.1.11 testbench unchanged"],
  ["hw/scp4d/synth/synth.ys", "35c86f9af81e4b3d436ad6e5eaafca566301bf4e83f4e95117683765279aed83", "v0.1.11 synthesis script unchanged"],
  [REPORT_V0111, "2768f102678435b6a4c56bcd6be10635a33dd78bdb10685e94b828a052ec83a7", "v0.1.11 report unchanged"],
  [VECTORS_T, "11159272c519e7d77e885a239a5487b5003ed4ca4cfa478dff04e2bbf049d53a", "v0.1.11 temporal vectors unchanged"],
  ["scripts/scp-v0111-rtl-vectors.ts", "adc608330e4c244ab93bba94fa0877106bbd6ef7ae7c18bfbc2783138ec5aff3", "v0.1.11 vector generator unchanged"],
  ["scripts/check-scp-v0111-rtl.ts", "c64cb6ef2b71c14cff115925b90b56c59ce9e112ffa3cbcf1adf47429423998c", "v0.1.11 check unchanged"],
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
{
  const bad = PINNED.filter(([p, h]) => !existsSync(join(root, p)) || sha(read(p)) !== h).map(([, , l]) => l);
  check(`${PINNED.length} pinned artefacts unchanged (pack.ts, v0.1.8–v0.1.10 model/vectors/reports, the whole v0.1.11 RTL deliverable)`, bad.length === 0, bad.join(", ") || "all sha256 match");
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
      if (/scp-v0112/.test(t)) importers.push(rel);
      if (/["'][^"']*hw\/scp4d/.test(t)) hwRefs.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.12 scripts; hw/ holds no TS/JS and no app code references hw/scp4d",
    importers.length === 0 && tsInHw.length === 0 && hwRefs.length === 0, [...importers, ...tsInHw, ...hwRefs].join(", ") || "none");
  const gen = stripTs(read("scripts/scp-v0112-rtl-vectors.ts").toString());
  check("vector / program generator is pure: no I/O, env, clocks, randomness, hashing, Level 4 or app imports",
    !/node:fs|node:child_process|process\.env|Date\.now|Math\.random|createHash|node:crypto|level4|src\/app|metamorphic/i.test(gen));
}

// ---------- 3. RTL static rules ----------
const rtlText = existsSync(join(root, RTL)) ? read(RTL).toString() : "";
{
  const code = stripV(rtlText);
  check("RTL present: one module scp4d_rdec, `default_nettype none", /module\s+scp4d_rdec\b/.test(code) && (code.match(/\bmodule\b/g) ?? []).length === 1 && /`default_nettype none/.test(code));
  const banned = code.match(/\binitial\b|\$\w+|\breal\b|\brealtime\b|\bshortreal\b|\bfork\b|#\s*\d/g) ?? [];
  const divs = code.split("\n").filter((l) => !/^\s*`/.test(l) && /[^/]\/[^/]|%/.test(l.replace(/"[^"]*"/g, "")));
  check("RTL synthesizable subset: no initial blocks, system tasks, real types, fork, delays, division or modulo", banned.length === 0 && divs.length === 0, JSON.stringify([...banned, ...divs]).slice(0, 200));
  check("RTL accepts relations (no reject at S_REL) and rejects out-of-scope streams with unsupported = 1 (rank > 0; predictor other than last-value hold)",
    /S_REL:[\s\S]*?hdr_rel <= \(in_data == 8'd1\)/.test(code) && !/S_REL:[^\n]*fail\(/.test(code) && /S_RANK:[\s\S]*?fail\(E_RANK, 1'b1\)/.test(code) && /S_PRED:[\s\S]*?fail\(E_HOLD, 1'b1\)/.test(code));
  const params = Object.entries(RDEC).every(([k, v]) => new RegExp(`parameter integer ${k}\\s*=\\s*${v}\\b`).test(code));
  check(`RTL parameters match the generator (ADDR_W ${RDEC.ADDR_W}, REL_W ${RDEC.REL_W}, FAN_W ${RDEC.FAN_W}, FC_W ${RDEC.FC_W}; FW ${RDEC_FW})`, params && /FW_LAST = 3'd3/.test(code) && RDEC_FW === 4);
}

// ---------- 4. Relations vectors (generated by the v0.1.10 model) ----------
const rv = relationsVectorFile();
const rvJson = `${JSON.stringify(rv.file, null, 2)}\n`;
check("relations vectors: model encode -> decode round-trips (accumulators verified against full recompute) and the program order equals the model's plan", rv.ok);
check("relations vectors: every one is rank 0, relations on, last-value hold; >= 5 vectors incl. a non-zero relation bias",
  rv.vectors.length >= 5 && rv.vectors.every((v) => v.config.rank === 0 && v.config.relations && v.config.predictor === "last") && rv.vectors.some((v) => v.relations_fixed_point.some((r) => r.bias !== 0)));
if (WRITE) { writeFileSync(join(root, VECTORS_R), rvJson); console.log(`NOTE wrote ${VECTORS_R}`); }
check(`committed ${VECTORS_R} regenerates byte-identically`, existsSync(join(root, VECTORS_R)) && read(VECTORS_R).toString() === rvJson, `sha ${sha(rvJson).slice(0, 16)}, ${rv.vectors.length} vectors`);

// ---------- 5. Job list ----------
type Job = {
  id: string; source: string; kind: "relations" | "temporal" | "out-of-scope" | "negative"; in_scope: boolean;
  bytes: Uint8Array; T: number; D: number; codes: number[][]; events: number[]; prog: RtlProgram; expect_unsup: number; expect_err: number;
};
const jobs: Job[] = [];
const emptyProg = (D: number) => rtlProgram(Math.min(Math.max(D, 1), RDEC_MAX_D), []);
const v0110 = JSON.parse(read(VECTORS_V0110).toString()) as { vectors: { id: string; shape: { nx: number; ny: number; nz: number; channels: number }; config: { rank: number; relations: boolean; predictor: string }; relations_fixed_point: { target: number; sources: number[]; W: number[]; bias: number }[]; processing_order: number[]; expected_bytes_hex: string; expected_decoded_codes: number[][]; expected_events: { positions: number[] }[] }[] };
const fromHex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));
{
  for (const v of v0110.vectors) {
    const D = v.expected_decoded_codes[0].length;
    const inScope = v.config.rank === 0 && v.config.predictor === "last";
    const prog = v.config.relations && v.config.rank === 0 ? rtlProgram(D, v.relations_fixed_point) : emptyProg(D);
    jobs.push({ id: v.id, source: VECTORS_V0110, kind: inScope ? "relations" : "out-of-scope", in_scope: inScope, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D,
      codes: v.expected_decoded_codes, events: v.expected_events.map((e) => e.positions.length), prog, expect_unsup: inScope ? 0 : v.config.rank > 0 ? 8 : 19, expect_err: 0 });
  }
  for (const v of rv.vectors) {
    const D = v.expected_decoded_codes[0].length;
    jobs.push({ id: v.id, source: VECTORS_R, kind: "relations", in_scope: true, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D, codes: v.expected_decoded_codes,
      events: v.expected_events.map((e) => e.positions.length), prog: rtlProgram(D, v.relations_fixed_point), expect_unsup: 0, expect_err: 0 });
  }
  const tv = temporalVectorFile();
  for (const v of tv.vectors) {
    const D = v.expected_decoded_codes[0].length, last = v.config.predictor === "last";
    jobs.push({ id: v.id, source: VECTORS_T, kind: last ? "temporal" : "out-of-scope", in_scope: last, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D,
      codes: v.expected_decoded_codes, events: v.expected_events.map((e) => e.positions.length), prog: emptyProg(D), expect_unsup: last ? 0 : 19, expect_err: 0 });
  }
}
const envR = envRelationsStreams();
const envT = envTemporalStreams();
{
  const rep = JSON.parse(read("fixtures/scp/v0110-int-report.json").toString()) as { fixtures: Record<string, { rows: { strategy: string; sha256_16: string; bytes: number; decode: { ops_per_ef: number } }[] }> };
  const pinOk = envR.every((s) => {
    const row = rep.fixtures[s.id.replace("-relations-last", "")].rows.find((r) => r.strategy === "scp4d-int event-driven +relations")!;
    const ed = decodeIntScp4dEventDriven(s.bytes, makeEnvironment({ nx: 16, ny: 16, nz: 2, T: s.T }).surface.relations);
    return s.bytes.length === row.bytes && sha(s.bytes).slice(0, 16) === row.sha256_16 && Number((intOpsTotal(ed.ops) / (s.T * s.D)).toPrecision(6)) === row.decode.ops_per_ef
      && ed.codes.every((f, t) => f.every((x, e) => x === s.codes[t][e]));
  });
  check(`env-16x16x2 T64 / T256 relations streams regenerate as the v0.1.10 report's "event-driven +relations" rows (${envR.map((s) => `${s.bytes.length} B`).join(", ")}; sha + ops/ef match; event-driven decode == frame decode)`, pinOk);
  for (const s of envR) jobs.push({ id: s.id, source: "regenerated (scripts/scp-v0112-rtl-vectors.ts envRelationsStreams)", kind: "relations", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes,
    events: s.perFrame.map((f) => f.positions.length), prog: rtlProgram(s.D, s.rels), expect_unsup: 0, expect_err: 0 });
  for (const s of envT) jobs.push({ id: s.id, source: "regenerated (scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)", kind: "temporal", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes,
    events: s.perFrame.map((f) => f.positions.length), prog: emptyProg(s.D), expect_unsup: 0, expect_err: 0 });
}
{
  // the original v0.1.10 relations vector: its fixed-point relations / order are the model's setup for the environment
  const o = v0110.vectors.find((v) => v.id === "env-4x4x1-T8-relations-last")!;
  const s = makeEnvironment({ nx: 4, ny: 4, nz: 1, T: 8 }).surface;
  const fx = fixRelations(s.relations, s.shape, [...ENV_EPS], 8);
  check("v0.1.10 vector env-4x4x1-T8-relations-last: its relations_fixed_point and processing_order equal the RTL program built from the model setup",
    JSON.stringify(fx.map((r) => ({ target: r.target, sources: r.sources, W: r.W, bias: r.bias }))) === JSON.stringify(o.relations_fixed_point) && JSON.stringify(rtlProgram(64, fx).order) === JSON.stringify(o.processing_order));
}
{
  // Negative tests on the original v0.1.10 relations vector
  const base = jobs.find((j) => j.id === "env-4x4x1-T8-relations-last")!;
  const s = streamStructure(base.bytes);
  const layoutAt = s.fixed_bytes + s.header_tail_bytes - 1, fwAt = layoutAt - 1, predAt = layoutAt - 2, relAt = layoutAt - 3, rankAt = layoutAt - 4;
  if (base.bytes[relAt] !== 1 || base.bytes[predAt] !== 1 || base.bytes[fwAt] !== 16) throw new Error("unexpected header layout in base vector");
  const neg = (id: string, bytes: Uint8Array, prog: RtlProgram, unsup: number, errc: number, src: string) =>
    jobs.push({ id, source: `negative: ${base.id} ${src}`, kind: "negative", in_scope: false, bytes, T: base.T, D: base.D, codes: [], events: [], prog, expect_unsup: unsup, expect_err: errc });
  const mut = (at: number, v: number) => { const b = Uint8Array.from(base.bytes); b[at] = v; return b; };
  neg("neg-bad-magic", mut(0, 0x58), base.prog, 0, 1, "byte 0 := 0x58");
  neg("neg-rank-1", mut(rankAt, 1), base.prog, 8, 0, `byte ${rankAt} (rank) := 1`);
  neg("neg-predictor-zero", mut(predAt, 0), base.prog, 19, 0, `byte ${predAt} (predictor) := 0 (zero hold: out of scope)`);
  neg("neg-bad-predictor", mut(predAt, 3), base.prog, 0, 10, `byte ${predAt} (predictor) := 3`);
  neg("neg-no-program", base.bytes, emptyProg(base.D), 0, 20, "relations stream, empty relation program (nT = 0)");
  neg("neg-program-wrong-D", base.bytes, rtlProgram(3, [{ target: 1, sources: [0], W: [65536], bias: 0 }]), 0, 20, "program built for D = 3");
  // first sparse event whose q is a one-byte varint: q := 0
  let qAt = -1;
  { let i = s.fixed_bytes + s.header_tail_bytes; const rd = () => { while (base.bytes[i] & 0x80) i++; i++; };
    for (let t = 0; t < s.T && qAt < 0; t++) {
      const h0 = i; rd(); let h = 0, sh = 0; for (let k = h0; k < i; k++) { h += (base.bytes[k] & 0x7f) * 2 ** sh; sh += 7; }
      const n = Math.floor(h / 2);
      if (h % 2 === 1) { for (let p = 0; p < s.D; p++) rd(); continue; }
      for (let k = 0; k < n; k++) { rd(); const q0 = i; rd(); if (qAt < 0 && i === q0 + 1) qAt = q0; }
    } }
  if (qAt < 0) throw new Error("no one-byte sparse q found");
  neg("neg-sparse-q-zero", mut(qAt, 0), base.prog, 0, 15, `byte ${qAt} (first one-byte sparse q) := 0`);
  const ovf = rtlProgram(base.D, v0110.vectors.find((v) => v.id === base.id)!.relations_fixed_point.map((r, i) => (i === 0 ? { ...r, bias: 2 ** 47 - 1 } : r)));
  neg("neg-acc-overflow", base.bytes, ovf, 0, 18, "relation 0 bias := 2^47 − 1 (ACC + 2^15 leaves 48 bits at the frame-0 flush)");
  // relations flag on a temporal stream without a program
  const tl = jobs.find((j) => j.id === "env-4x4x1-T8-temporal-last")!;
  const ts = streamStructure(tl.bytes); const tb = Uint8Array.from(tl.bytes); tb[ts.fixed_bytes + ts.header_tail_bytes - 4] = 1;
  jobs.push({ id: "neg-temporal-relations-on-no-program", source: `negative: ${tl.id} relations byte := 1, empty program`, kind: "negative", in_scope: false, bytes: tb, T: tl.T, D: tl.D, codes: [], events: [], prog: emptyProg(tl.D), expect_unsup: 0, expect_err: 20 });
}

const structures = new Map<string, ReturnType<typeof streamStructure>>();
const derived = jobs.map((j) => {
  const files = rdecSimFiles(j.bytes, j.codes, j.events, j.prog);
  const base = { id: j.id, source: j.source, kind: j.kind, in_scope: j.in_scope, bytes: j.bytes.length, bytes_sha256: sha(j.bytes),
    program_words: j.prog.words.length, sim_inputs_sha256: sha(files.stream + files.codes + files.events + files.prog), expect_unsupported_code: j.expect_unsup, expect_err_code: j.expect_err };
  if (!j.in_scope) return { ...base };
  const s = streamStructure(j.bytes);
  structures.set(j.id, s);
  const m = rdecCycleModel(j.bytes, s.relations === 1 ? j.prog : null);
  return { ...base, T: s.T, D: s.D, element_frames: s.T * s.D, relations: s.relations === 1, G: s.G, nT: j.prog.nT, fan_entries: j.prog.fanEntries,
    header_bytes: s.fixed_bytes + s.header_tail_bytes, payload_bytes: s.payload_bytes, sparse_frames: s.sparse_frames, dense_frames: s.dense_frames, events: s.events,
    source_events: m.source_events, target_events: m.target_events,
    model_cycles: m.cycles, model_clear_stall: m.clear_stall, model_fan_cycles: m.fan_cycles, model_settle_cycles: m.settle_cycles, model_flush_cycles: m.flush_cycles };
});
check("work list: every in-scope job's per-frame events equal the stream walk, and event positions are in range",
  jobs.filter((j) => j.in_scope).every((j) => { const s = structures.get(j.id)!; const ps = eventPositions(j.bytes, s); return j.events.reduce((a, b) => a + b, 0) === s.events && ps.every((p, t) => p.length === j.events[t] && p.every((x) => x >= 0 && x < s.D)); }));
check(`work list: every in-scope stream fits the RTL (D <= ${RDEC_MAX_D}, G <= 16, rank 0, last-value hold) and every relations job has a program with nT > 0`,
  jobs.filter((j) => j.in_scope).every((j) => { const s = structures.get(j.id)!; return s.D <= RDEC_MAX_D && s.G <= 16 && s.rank === 0 && s.predictor === 1 && (s.relations !== 1 || j.prog.nT > 0); }));

// ---------- 6. Simulator / synthesis (uncounted) ----------
type SimResult = Record<string, string | number>;
function findBin(name: string): string | null {
  for (const cand of [name, `/opt/eda/oss-cad-suite/bin/${name}`]) {
    const r = spawnSync(cand, name === "vvp" || name === "iverilog" ? ["-V"] : ["--version"], { encoding: "utf8" });
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
  const dir = mkdtempSync(join(tmpdir(), "scp4d-rsim-"));
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
      const f = rdecSimFiles(j.bytes, j.codes, j.events, j.prog);
      const p = (k: string) => join(dir, `${n}.${k}.hex`);
      writeFileSync(p("stream"), f.stream); writeFileSync(p("codes"), f.codes); writeFileSync(p("events"), f.events); writeFileSync(p("prog"), f.prog);
      const args = (bub: number) => [out, `+stream=${p("stream")}`, `+codes=${p("codes")}`, `+events=${p("events")}`, `+prog=${p("prog")}`, `+nprog=${f.nprog}`, `+nbytes=${j.bytes.length}`,
        `+t=${j.T}`, `+d=${j.D}`, `+expect_unsup=${j.expect_unsup}`, `+expect_err=${j.expect_err}`, `+bubbles=${bub}`, `+id=${j.id}`];
      full.set(j.id, parse(spawnSync(vvp, ["-n", ...args(0)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).stdout ?? ""));
      if (j.in_scope) bubbles.set(j.id, parse(spawnSync(vvp, ["-n", ...args(1)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).stdout ?? ""));
    });
    return { full, bubbles, tools: { iverilog: firstLine(iverilog, ["-V"]), vvp: firstLine(vvp, ["-V"]) } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

type Cells = { num_cells: number; by_type: Record<string, number> };
function runSynth(): Record<string, unknown> {
  const yosys = findBin("yosys"), np40 = findBin("nextpnr-ice40"), np5 = findBin("nextpnr-ecp5");
  if (!yosys) throw new Error("--synth needs yosys");
  const dir = mkdtempSync(join(tmpdir(), "scp4d-rsynth-"));
  const cells = (f: string): Cells => {
    const m = Object.values((JSON.parse(readFileSync(join(dir, f), "utf8")) as { modules: Record<string, { num_cells: number; num_cells_by_type: Record<string, number> }> }).modules)[0];
    return { num_cells: m.num_cells, by_type: Object.fromEntries(Object.entries(m.num_cells_by_type).sort(([a], [b]) => a.localeCompare(b))) };
  };
  const ys = (script: string, log: string) => {
    const y = spawnSync(yosys, ["-q", "-l", join(dir, log), "-p", script], { encoding: "utf8", cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    if (y.status !== 0) throw new Error(`yosys failed: ${y.stderr}${y.stdout}`);
  };
  const pnr = (bin: string | null, args: string[], device: string): Record<string, unknown> => {
    if (!bin) return { skipped: "place-and-route tool not found" };
    const p = spawnSync(bin, [...args, "--seed", "1", "--report", join(dir, "pnr.json")], { encoding: "utf8", cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    const log = `${p.stdout ?? ""}\n${p.stderr ?? ""}`;
    if (p.status !== 0) {
      const util = Object.fromEntries([...log.matchAll(/Info:\s+(\w+):\s+(\d+)\/\s*(\d+)\s+\d+%/g)].map((m) => [m[1], `${m[2]}/${m[3]}`]));
      return { device, seed: 1, fits: false, error: (log.match(/ERROR: [^\n]*/) ?? ["unknown error"])[0], utilization_requested: util };
    }
    const rep = JSON.parse(readFileSync(join(dir, "pnr.json"), "utf8")) as { fmax: Record<string, { achieved: number }>; utilization: Record<string, { used: number; available: number }> };
    rmSync(join(dir, "pnr.json"));
    return { device, seed: 1, fits: true, fmax_mhz: Object.fromEntries(Object.entries(rep.fmax).map(([k, v]) => [k, r4(v.achieved)])),
      utilization: Object.fromEntries(Object.entries(rep.utilization).filter(([, v]) => v.used > 0).map(([k, v]) => [k, `${v.used}/${v.available}`])) };
  };
  try {
    const rtl = join(root, RTL), rtlT = join(root, RTL_T);
    ys(`read_verilog ${rtl}; script ${join(root, SYNTH_YS)}`, "yosys.log");
    const generic = cells("generic_stat.json"), ice = cells("ice40_stat.json"), xc7 = cells("xc7_stat.json");
    const ltp = readFileSync(join(dir, "yosys.log"), "utf8").match(/Longest topological path in \S+ \(length=(\d+)\)/g) ?? [];
    const iceFull = pnr(np40, ["--hx8k", "--package", "ct256", "--json", join(dir, "ice40.json"), "--pcf-allow-unconstrained", "--freq", "12"], "iCE40-HX8K (ct256)");
    // like-for-like: both decoders on ECP5 (full parameters) and on iCE40-HX8K at ADDR_W = 9 (both fit)
    const both: Record<string, unknown> = {};
    for (const [top, file, small] of [["scp4d_tdec", rtlT, "-set ADDR_W 9"], ["scp4d_rdec", rtl, "-set ADDR_W 9 -set REL_W 8 -set FAN_W 9"]] as const) {
      ys(`read_verilog ${file}; synth_ecp5 -top ${top} -json ecp5.json; tee -o ecp5_stat.json stat -json`, `ecp5_${top}.log`);
      const e5 = cells("ecp5_stat.json");
      const e5p = pnr(np5, ["--45k", "--package", "CABGA381", "--json", join(dir, "ecp5.json"), "--lpf-allow-unconstrained", "--freq", "12"], "ECP5 LFE5U-45F (CABGA381)");
      ys(`read_verilog ${file}; chparam ${small} ${top}; synth_ice40 -top ${top} -json ice40s.json; tee -o ice40s_stat.json stat -json`, `ice40s_${top}.log`);
      const i9 = cells("ice40s_stat.json");
      const i9p = pnr(np40, ["--hx8k", "--package", "ct256", "--json", join(dir, "ice40s.json"), "--pcf-allow-unconstrained", "--freq", "12"], "iCE40-HX8K (ct256)");
      both[top] = { ecp5_full_params: { synth: e5, place_and_route: e5p }, ice40_addr_w9: { parameters: small, synth: i9, place_and_route: i9p } };
    }
    return {
      label: "SYNTHESIS / PLACE-AND-ROUTE ESTIMATES from open-source tools (one seed). Not a programmed-FPGA or silicon measurement; no board was used.",
      tools: { yosys: firstLine(yosys, ["-V"]), nextpnr_ice40: firstLine(np40, ["--version"]), nextpnr_ecp5: firstLine(np5, ["--version"]) },
      rdec_full_params: { parameters: RDEC, generic: { note: "yosys generic gates; memories kept as $mem_v2 cells", ...generic, longest_topological_path: ltp[0] ?? null }, ice40: ice, xc7, ice40_hx8k_place_and_route: iceFull },
      like_for_like: both,
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

const MEAS_KEYS = ["ok", "done", "err", "unsupported", "err_code", "reject_byte", "consumed", "frames", "cycles", "take", "stall_clear", "stall_fan", "stall_flush", "stall_other", "drain", "tokens", "events", "fan_ops", "flush_ops", "mismatches", "ev_mismatch_frames", "max_code", "max_q", "max_prod", "max_acc", "max_pvarint", "timeout"] as const;
const pick = (r: SimResult) => Object.fromEntries(MEAS_KEYS.map((k) => [k, r[k]]));
function measuredSection(s: NonNullable<typeof sim>) {
  return derived.map((d) => {
    const r = s.full.get(d.id)!, b = s.bubbles.get(d.id);
    const ef = "element_frames" in d ? (d.element_frames as number) : 0;
    const cycles = r.cycles as number;
    return { id: d.id, ...pick(r),
      ...(d.in_scope ? { cycles_per_element_frame: r4(cycles / ef), cycles_per_byte: r4(cycles / d.bytes),
        register_bits: { code: signedBits(r.max_code as number), q: signedBits(r.max_q as number), rel_product: signedBits(r.max_prod as number), rel_acc: signedBits(r.max_acc as number), payload_varint: signedBits(r.max_pvarint as number) - 1 },
        bubble_run: b ? { ok: b.ok, cycles: b.cycles, bubbles: b.bubbles, mismatches: b.mismatches } : null } : {}) };
  });
}

type M = Record<string, number>;
const V0111 = JSON.parse(read(REPORT_V0111).toString()) as { measured: M[]; synthesis: { ice40: Cells; xc7: Cells; ice40_place_and_route: { fmax_mhz: Record<string, number>; utilization: Record<string, string> } } };
/** Comparison + verdict, computed only from measured cycles, stream sizes, synthesis estimates and the v0.1.10 cost table. */
function comparison(measured: M[], synth: Record<string, unknown> | null) {
  const get = (id: string) => measured.find((m) => (m as unknown as { id: string }).id === id)!;
  const der = (id: string) => derived.find((d) => d.id === id) as unknown as M;
  const fmaxOf = (p: unknown) => { const f = (p as { fmax_mhz?: Record<string, number> } | undefined)?.fmax_mhz; return f ? Math.min(...Object.values(f)) : null; };
  const lfl = (synth?.like_for_like ?? null) as Record<string, { ecp5_full_params: { synth: Cells; place_and_route: unknown }; ice40_addr_w9: { synth: Cells; place_and_route: unknown } }> | null;
  const f5 = { t: lfl ? fmaxOf(lfl.scp4d_tdec.ecp5_full_params.place_and_route) : null, r: lfl ? fmaxOf(lfl.scp4d_rdec.ecp5_full_params.place_and_route) : null };
  const f9 = { t: lfl ? fmaxOf(lfl.scp4d_tdec.ice40_addr_w9.place_and_route) : null, r: lfl ? fmaxOf(lfl.scp4d_rdec.ice40_addr_w9.place_and_route) : null };
  const fixtures = [64, 256].map((T) => {
    const tid = `env-16x16x2-T${T}-temporal-last`, rid = `env-16x16x2-T${T}-relations-last`;
    const t = get(tid), r = get(rid), dt = der(tid), dr = der(rid);
    const ef = dt.element_frames;
    const side = (m: M, d: M, fm5: number | null, fm9: number | null) => ({ bytes: d.bytes, cycles: m.cycles, cycles_per_element_frame: r4(m.cycles / ef), cycles_per_byte: r4(m.cycles / d.bytes),
      cycle_breakdown: { bytes: d.bytes, clear_stall: d.model_clear_stall, fan_out: d.model_fan_cycles ?? 0, frame_settle: d.model_settle_cycles ?? 0, target_flush: d.model_flush_cycles ?? 0, drain: RDEC_DRAIN },
      element_frames_per_second_at_ecp5_fmax_estimate: fm5 ? Math.round((ef / m.cycles) * fm5 * 1e6) : null,
      element_frames_per_second_at_ice40_w9_fmax_estimate: fm9 ? Math.round((ef / m.cycles) * fm9 * 1e6) : null });
    const L = f5.t && f5.r ? r4((dt.bytes * f5.r) / r.cycles) : null; // MB/s (bytes per µs)
    return {
      fixture: `env-16x16x2-T${T}`, element_frames: ef,
      temporal_only: side(t, dt, f5.t, f9.t), relations: side(r, dr, f5.r, f9.r),
      bytes_ratio_temporal_over_relations: r4(dt.bytes / dr.bytes),
      cycles_ratio_relations_over_temporal: r4(r.cycles / t.cycles),
      link_break_even_MB_per_s_ecp5: L,
      link_break_even_note: "Labelled scenario: decode time = max(stream bytes / link bandwidth, cycles / fmax) at each design's ECP5 fmax estimate. Below this link bandwidth the relations decoder finishes first (fewer bytes to wait for); above it the temporal-only decoder does (fewer cycles).",
    };
  });
  const v10 = JSON.parse(read("fixtures/scp/v0110-int-report.json").toString()) as { fixtures: Record<string, { rows: { strategy: string; decode_resident_surface?: { pj_per_ef: number[] } }[] }> };
  const pj = (fx: string, st: string) => v10.fixtures[fx].rows.find((x) => x.strategy === st)!.decode_resident_surface!.pj_per_ef[0];
  const e64 = fixtures[0];
  const savedB = (e64.temporal_only.bytes - e64.relations.bytes) / e64.element_frames;
  const extraPj = pj("env-16x16x2-T64", "scp4d-int event-driven +relations") - pj("env-16x16x2-T64", "scp4d-int event-driven temporal-only");
  const extraCyc = e64.relations.cycles_per_element_frame - e64.temporal_only.cycles_per_element_frame;
  const rdecFull = (synth?.rdec_full_params ?? null) as { xc7: Cells; ice40: Cells; ice40_hx8k_place_and_route: unknown } | null;
  const area = {
    label: "TOOL ESTIMATES (yosys / nextpnr, one seed); no board.",
    ecp5_full_params: lfl ? { tdec: lfl.scp4d_tdec.ecp5_full_params.place_and_route, rdec: lfl.scp4d_rdec.ecp5_full_params.place_and_route } : null,
    ice40_hx8k_addr_w9: lfl ? { tdec: lfl.scp4d_tdec.ice40_addr_w9.place_and_route, rdec: lfl.scp4d_rdec.ice40_addr_w9.place_and_route } : null,
    ice40_hx8k_full_params: { tdec_v0111: V0111.synthesis.ice40_place_and_route, rdec: rdecFull?.ice40_hx8k_place_and_route ?? null },
    xc7_full_params: { tdec_v0111: V0111.synthesis.xc7.by_type, rdec: rdecFull?.xc7.by_type ?? null },
  };
  const breakEven = {
    label: "LABELLED ESTIMATES (not measurements): bytes and cycles are measured; energy prices are the v0.1.10 45 nm model table (Horowitz ISSCC 2014 + labelled assumptions).",
    bytes_saved_per_element_frame: r4(savedB),
    extra_decode_pj_per_element_frame_model: r4(extraPj),
    break_even_transfer_pj_per_byte: r4(extraPj / savedB),
    reference_transfer_pj_per_byte: { dram_class_offchip: [162.5, 325], onchip_sram_8kb_to_32kb: [1.25, 2.5] },
    extra_cycles_per_element_frame_measured: r4(extraCyc),
    break_even_byte_cost_in_decoder_cycles: r4(extraCyc / savedB),
    break_even_byte_cost_note: "If energy per decoder cycle is E_c, relations save energy only when moving one stream byte costs more than this many E_c (measured cycles and bytes; E_c itself is not measured).",
  };
  const fanShare = e64.relations.cycle_breakdown.fan_out / e64.relations.cycles;
  const projCycles = e64.relations.cycles - e64.relations.cycle_breakdown.fan_out + der("env-16x16x2-T64-relations-last").source_events;
  const projection = {
    label: "PROJECTION, NOT MEASURED: a variant with the fan-out handled in parallel (4 ACC banks, one source event per cycle) would remove the per-entry stall; cycles = measured − fan_out + source_events.",
    env_T64_cycles: projCycles,
    env_T64_cycles_per_element_frame: r4(projCycles / e64.element_frames),
  };
  const verdict = {
    answer: "DEPENDS on where the stream lives",
    decoder_bound: `NOT worth it inside the decoder: relations cut the stream ${e64.bytes_ratio_temporal_over_relations}× (T64) but cost ${e64.cycles_ratio_relations_over_temporal}× the measured cycles (${e64.relations.cycles_per_element_frame} vs ${e64.temporal_only.cycles_per_element_frame} cycles/element-frame); ${(100 * fanShare).toFixed(1)}% of the relations cycles are fan-out accumulator updates (one per cycle), plus the per-frame dirty-target flush.`,
    link_or_memory_bound: `WORTH it when moving stream bytes is the cost: below ~${e64.link_break_even_MB_per_s_ecp5 ?? "n/a"} MB/s of link bandwidth (ECP5 fmax estimates) the relations decoder finishes first, and with bytes priced above ~${breakEven.break_even_transfer_pj_per_byte} pJ/B (DRAM-class 162.5–325 pJ/B in the model table) it is the lower-energy path; with on-chip SRAM pricing (1.25–2.5 pJ/B) it is not.`,
    area: "Relations need the program memories (order, fan-out, accumulators, dirty list) and an 18×32 multiplier: see area (estimates).",
  };
  return { fixtures, area, break_even: breakEven, projection, verdict };
}

let report = committed as Record<string, unknown> | null;
if (WRITE && sim) {
  const lint = (() => { const v = findBin("verilator"); if (!v) return { tool: null, clean: null }; const r = spawnSync(v, ["--lint-only", "-Wall", join(root, RTL)], { encoding: "utf8" }); return { tool: firstLine(v, ["--version"]), command: "verilator --lint-only -Wall", clean: r.status === 0 && !/%Warning|%Error/.test(r.stderr ?? "") }; })();
  const measured = measuredSection(sim);
  const synth = SYNTH ? runSynth() : (committed?.synthesis ?? null);
  report = {
    format: "4d-scp-v0.1.12-rtl-report",
    version: 1,
    note: "TEST ONLY. Deterministic outputs of scripts/check-scp-v0112-rtl.ts --write. Cycle counts are MEASURED by simulating this RTL (Icarus Verilog), cycle-accurate for this design. Energy is NOT measured. Synthesis / place-and-route numbers are tool ESTIMATES. Environment fixtures are SYNTHETIC; no production data.",
    rtl: { file: RTL, sha256: sha(read(RTL)), testbench: TB, testbench_sha256: sha(read(TB)), parameters: RDEC, frame_settle_cycles: RDEC_FW, drain_cycles: RDEC_DRAIN,
      scope: "S4DI v1, rank 0, last-value hold, relations on or off (relation program loaded out of band). rank > 0 or predictor zero / linear -> unsupported (rejected at the header); zero / linear temporal-only streams stay on scp4d_tdec (v0.1.11, unchanged). A relation target may not also be a source." },
    tools: { ...sim.tools, verilator_lint: lint },
    vectors: { v0110: { path: VECTORS_V0110, sha256: sha(read(VECTORS_V0110)) }, temporal: { path: VECTORS_T, sha256: sha(read(VECTORS_T)) }, relations: { path: VECTORS_R, sha256: sha(rvJson) } },
    cycle_model: "cycles = bytes + max(0, D − header_tail_bytes) + fan_out + [relations] (4·T + nT + Σ_{t≥1} dirty_targets(t)) + 5; fan_out = Σ over non-target source events of the source's fan-out entries (full-rate input; counted from the first cycle after reset to done, inclusive)",
    derived,
    measured,
    comparison: comparison(measured as unknown as M[], synth as Record<string, unknown> | null),
    synthesis: synth,
  };
  writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`NOTE wrote ${REPORT}`);
}

// Counted: committed report consistency (no simulator needed)
{
  const rep = report as { rtl?: { sha256: string; testbench_sha256: string }; derived?: unknown[]; measured?: M[]; vectors?: { relations: { sha256: string } }; synthesis?: { label?: string } | null; comparison?: unknown } | null;
  check(`committed ${REPORT} exists and pins the current RTL, testbench and relations vector file (sha256)`,
    rep !== null && !!rep.rtl && rep.rtl.sha256 === sha(read(RTL)) && rep.rtl.testbench_sha256 === sha(read(TB)) && rep.vectors?.relations.sha256 === sha(rvJson));
  check("report's derived section (stream structure, program sizes, sim-input hashes, cycle model) matches this run", JSON.stringify(rep?.derived) === JSON.stringify(derived));
  const meas = new Map((rep?.measured ?? []).map((m) => [(m as unknown as { id: string }).id, m as unknown as Record<string, unknown>]));
  const inScope = derived.filter((d) => d.in_scope);
  const rel = inScope.filter((d) => d.kind === "relations"), tmp = inScope.filter((d) => d.kind === "temporal");
  const exact = (d: (typeof derived)[number]) => { const m = meas.get(d.id); return !!m && m.ok === 1 && m.mismatches === 0 && m.ev_mismatch_frames === 0 && m.consumed === d.bytes && m.frames === (d as { T: number }).T && m.timeout === 0; };
  check(`every relations vector (${rel.length}: the v0.1.10 env-4x4x1-T8 vector, ${rv.vectors.length} new, env T64 + T256) decoded bit-exact in simulation: all frames, all elements, per-frame event counts, all bytes consumed`, rel.length === rv.vectors.length + 3 && rel.every(exact));
  check(`every temporal-only last-value vector (${tmp.length}) decodes bit-exact through scp4d_rdec too (it is a superset of scp4d_tdec's last-value mode)`, tmp.length === 5 && tmp.every(exact));
  check("every in-scope vector is also bit-exact with pseudo-random input bubbles (valid/ready handshake)",
    inScope.every((d) => { const b = (meas.get(d.id)?.bubble_run ?? null) as { ok: number; mismatches: number } | null; return !!b && b.ok === 1 && b.mismatches === 0; }));
  check("measured cycles == closed-form cycle model for every in-scope vector (full-rate input)", inScope.length > 0 && inScope.every((d) => meas.get(d.id)?.cycles === (d as { model_cycles: number }).model_cycles));
  const v11 = new Map(V0111.measured.map((m) => [(m as unknown as { id: string }).id, m]));
  check("temporal-only last-value streams: scp4d_rdec cycles == scp4d_tdec (v0.1.11 measured) + 1 (one more pipeline stage to drain)",
    tmp.every((d) => meas.get(d.id)?.cycles === (v11.get(d.id)?.cycles ?? NaN) + 1));
  check("fan-out / flush op counts measured in simulation equal the stream + program walk (fan_ops = fan-out entries hit, flush_ops = nT + Σ dirty)",
    rel.every((d) => { const m = meas.get(d.id), dd = d as unknown as M; return !!m && m.fan_ops === dd.model_fan_cycles && m.flush_ops === dd.model_flush_cycles; }));
  const outScope = derived.filter((d) => !d.in_scope);
  check(`every out-of-scope / corrupted stream or program (${outScope.length}) is rejected with the expected unsupported / error code, never decoded`,
    outScope.length >= 14 && outScope.every((d) => { const m = meas.get(d.id); return !!m && m.ok === 1 && m.err === 1 && m.done === 0 && m.unsupported === (d.expect_unsupported_code ? 1 : 0) && m.err_code === (d.expect_unsupported_code || d.expect_err_code); }));
  check("observed RTL register maxima stay within the declared widths (code 32, q 32, rel_product 48, rel_acc 48) and the 35-bit payload varint",
    inScope.every((d) => { const rb = meas.get(d.id)?.register_bits as Record<string, number> | undefined; return !!rb && rb.code <= DECLARED_WIDTHS.code && rb.q <= DECLARED_WIDTHS.q && rb.rel_product <= DECLARED_WIDTHS.rel_product && rb.rel_acc <= DECLARED_WIDTHS.rel_acc && rb.payload_varint <= 35; }));
  const recomputed = rep?.measured ? comparison(rep.measured, (rep.synthesis ?? null) as Record<string, unknown> | null) : null;
  check("report's comparison / break-even / verdict section recomputes exactly from the committed measurements and synthesis estimates", !!recomputed && JSON.stringify(recomputed) === JSON.stringify(rep?.comparison));
  check("synthesis section is labelled as an estimate, and break-even / projection are labelled (no measured energy claim)",
    !!rep?.synthesis && /ESTIMATE/.test(rep.synthesis.label ?? "") && !!recomputed && /LABELLED ESTIMATES/.test(recomputed.break_even.label) && /NOT MEASURED/.test(recomputed.projection.label));
}

// Uncounted: fresh simulation must equal the committed measurements
if (sim && report) {
  const same = JSON.stringify(measuredSection(sim)) === JSON.stringify((report as { measured: unknown }).measured);
  console.log(`${same ? "SIM PASS" : "SIM FAIL"} re-simulated ${jobs.length} jobs (${derived.filter((d) => d.in_scope).length} in scope + bubble runs) with ${sim.tools.iverilog}: ${same ? "identical to the committed report" : "DIFFERS from the committed report"}`);
  if (!same) failures.push("simulation differs from committed report");
}

// ---------- 8. Table ----------
const rep8 = report as { measured?: Record<string, unknown>[]; comparison?: ReturnType<typeof comparison> } | null;
if (rep8?.measured) {
  console.log("\nvector                                   kind       bytes   T×D        bit-exact  cycles    cyc/ef   cyc/B   model");
  for (const d of derived) {
    const m = rep8.measured.find((x) => x.id === d.id)!;
    if (d.in_scope) {
      const dd = d as typeof d & { T: number; D: number; model_cycles: number };
      console.log(`${d.id.padEnd(40)} ${d.kind.padEnd(9)} ${String(d.bytes).padStart(7)}  ${`${dd.T}×${dd.D}`.padEnd(9)} ${m.ok === 1 ? "yes" : "NO "}        ${String(m.cycles).padStart(7)}  ${String(m.cycles_per_element_frame).padStart(7)}  ${String(m.cycles_per_byte).padStart(6)}  ${dd.model_cycles}`);
    } else console.log(`${d.id.padEnd(40)} ${d.kind.padEnd(9)} ${String(d.bytes).padStart(7)}  rejected: ${m.unsupported ? "unsupported" : "error"} code ${m.err_code} at byte ${m.reject_byte}`);
  }
  if (rep8.comparison) console.log(`\nVERDICT ${rep8.comparison.verdict.answer}\n  ${rep8.comparison.verdict.decoder_bound}\n  ${rep8.comparison.verdict.link_or_memory_bound}`);
}

if (failures.length) { console.log(`FAIL check-scp-v0112-rtl (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
console.log(`PASS check-scp-v0112-rtl (${passed} checks)`);
