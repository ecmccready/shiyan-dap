/** TEST ONLY. 4D-SCP v0.1.13 — W-byte-per-cycle front end (hw/scp4d/rtl/scp4d_fe_w.v) for both RTL
 * decoders: scp4d_tdec_w (temporal-only, P = W banked state) and scp4d_rdec_w (relations; the
 * v0.1.12 datapath fed by tokens), measured at W = 1, 2, 4 in an open-source simulator against the
 * v0.1.10 model's golden vectors, with exact cycle models (scripts/scp-v0113-rtl-model.ts).
 *
 * Counted checks are deterministic and need NO simulator (so check-scp-all can pin the count):
 * unchanged pinned artefacts (incl. every v0.1.11 / v0.1.12 RTL file, vector and report), isolation,
 * RTL static rules, the job list, and the committed report: bit-exact at every W (full rate and
 * with pseudo-random input gaps), corrupted streams flagged with the right error code at every W,
 * measured cycles == cycle model for every (vector, W), cycle-class accounting closes, the
 * comparison / verdict recomputes from the committed measurements, labels (synthesis = estimate;
 * no energy measured).
 *
 * Simulator stage (NOT counted): if Icarus Verilog is found on PATH or in /opt/eda/oss-cad-suite/bin
 * every job is re-simulated at W = 1, 2, 4 and must equal the committed report. "SKIP sim" without
 * it; --require-sim fails instead; --no-sim forces the skip. Synthesis / place-and-route (yosys,
 * nextpnr-ecp5, nextpnr-ice40) only with --synth (needs --write to be recorded).
 *
 * Writes nothing unless --write (refresh fixtures/scp/v0113-rtl-report.json; needs the simulator;
 * keeps the committed synthesis section unless --synth). Scratch files go to an OS temp dir.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0113-rtl.ts [--no-sim | --require-sim] [--synth] [--write]
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeQuantized } from "../src/scp/pack";
import { BOUNDED_EPS } from "./scp-v01-fixture";
import { frameFixtures } from "./scp-v019-env-fixture";
import { envTemporalStreams, simFiles, streamStructure, temporalVectorFile } from "./scp-v0111-rtl-vectors";
import { RDEC_MAX_D, envRelationsStreams, rdecSimFiles, relationsVectorFile, rtlProgram, type RtlProgram } from "./scp-v0112-rtl-vectors";
import { RDECW_TAIL, TDECW_TAIL, W_LIST, payloadTokens, rdecWCycleModel, tdecWCycleModel } from "./scp-v0113-rtl-model";

const root = resolve(join(import.meta.dirname, ".."));
const FE = "hw/scp4d/rtl/scp4d_fe_w.v";
const RTL_T = "hw/scp4d/rtl/scp4d_tdec_w.v";
const RTL_R = "hw/scp4d/rtl/scp4d_rdec_w.v";
const TB_T = "hw/scp4d/tb/scp4d_tdec_w_tb.v";
const TB_R = "hw/scp4d/tb/scp4d_rdec_w_tb.v";
const WRAP = "hw/scp4d/synth/scp4d_pnr_wrap.v";
const MODEL = "scripts/scp-v0113-rtl-model.ts";
const REPORT = "fixtures/scp/v0113-rtl-report.json";
const V0110_VECTORS = "fixtures/scp/golden-vectors-scp4d.json";
const PINNED: [string, string, string][] = [
  ["src/scp/pack.ts", "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a", "pack.ts unchanged"],
  [V0110_VECTORS, "7e8b8165444e0b6f48c01622b2c41e9e035d80fa37b2a14dcd16de30d1e3cfd9", "v0.1.10 golden vectors unchanged"],
  ["fixtures/scp/v0110-int-report.json", "f5a9b42bd97ef3a108ecca656c82d4eabe23d311a4de288a6daab0a6af8c17b0", "v0.1.10 report unchanged"],
  ["scripts/scp-v0110-int-scp4d.ts", "9bebf5125141559f336a7c6fddf6d867afb50127f0c8758b4e76e1724a869007", "v0.1.10 integer model unchanged"],
  ["fixtures/scp/golden-vectors.json", "5b5776c7aca50e4aa151892f4c8315f31560863085c63ddc209334bbe877d175", "v0.1.8 golden vectors unchanged"],
];
/** every v0.1.11 / v0.1.12 artefact (RTL, testbenches, synthesis scripts, vectors, reports, generators, checks) */
const PINNED_RTL: [string, string][] = [
  ["hw/scp4d/rtl/scp4d_tdec.v", "50065f66c044c3a69492952719655685c0a2d17deb5a8e406dd65c759a2a346b"],
  ["hw/scp4d/rtl/scp4d_rdec.v", "224f71f8b8b51800d5e6a322cb7ccab6967284a29b07b080bbb89329160551f0"],
  ["hw/scp4d/tb/scp4d_tb.v", "fe0ad1afc04aab39b032dd7d8f8f038df1b0c4309d34fa859da9caf4a6f3c4dc"],
  ["hw/scp4d/tb/scp4d_rdec_tb.v", "edd199dd7a1505193f7dfc7afc8cb6d7a768abbedae9c4c3d816f2bf48cfa289"],
  ["hw/scp4d/synth/synth.ys", "35c86f9af81e4b3d436ad6e5eaafca566301bf4e83f4e95117683765279aed83"],
  ["hw/scp4d/synth/synth_rdec.ys", "8eae149c2c3f7290e2140c28e25e4dce436873f93e133caa1ccddc4a927160e2"],
  ["fixtures/scp/v0111-rtl-report.json", "2768f102678435b6a4c56bcd6be10635a33dd78bdb10685e94b828a052ec83a7"],
  ["fixtures/scp/v0112-rtl-report.json", "55996083a5c4b13407c905a0c480b280727e3c019a346575dfe034531f7cbc79"],
  ["fixtures/scp/golden-vectors-scp4d-temporal.json", "11159272c519e7d77e885a239a5487b5003ed4ca4cfa478dff04e2bbf049d53a"],
  ["fixtures/scp/golden-vectors-scp4d-relations.json", "ce242dd4d961b430365f14961ea7ae3077d6d425a45755be866f55d9def43761"],
  ["scripts/scp-v0111-rtl-vectors.ts", "adc608330e4c244ab93bba94fa0877106bbd6ef7ae7c18bfbc2783138ec5aff3"],
  ["scripts/scp-v0112-rtl-vectors.ts", "40a1f63ccdb4ce988cb3f8d6fef4bdd3cd05e38aa202e25e54520b817e68d507"],
  ["scripts/check-scp-v0111-rtl.ts", "c64cb6ef2b71c14cff115925b90b56c59ce9e112ffa3cbcf1adf47429423998c"],
  ["scripts/check-scp-v0112-rtl.ts", "29f9c47b197b39665099949be6fe9538a806816accb2880949b1f4beb08d2bc2"],
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
const r2 = (x: number) => Number(x.toFixed(2));
const fromHex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

// ---------- 1. Unchanged artefacts ----------
for (const [p, h, label] of PINNED) check(`${label} (sha pinned)`, existsSync(join(root, p)) && sha(read(p)) === h);
{
  const bad = PINNED_RTL.filter(([p, h]) => !existsSync(join(root, p)) || sha(read(p)) !== h).map(([p]) => p);
  check(`every v0.1.11 / v0.1.12 RTL, testbench, synthesis script, vector file, report, generator and check unchanged (${PINNED_RTL.length} files sha-pinned)`, bad.length === 0, bad.join(", ") || "all match");
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
      if (/scp-v0113/.test(t)) importers.push(rel);
      if (/["'][^"']*hw\/scp4d/.test(t)) hwRefs.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.13 scripts; hw/ holds no TS/JS and no app code references hw/scp4d", importers.length === 0 && tsInHw.length === 0 && hwRefs.length === 0, [...importers, ...tsInHw, ...hwRefs].join(", ") || "none");
  const m = stripTs(read(MODEL).toString());
  check("cycle model is pure: no I/O, env, clocks, randomness, hashing, Level 4 or app imports",
    !/node:fs|node:child_process|process\.env|Date\.now|Math\.random|createHash|node:crypto|level4|src\/app|metamorphic/i.test(m));
}

// ---------- 3. RTL static rules ----------
const fe = existsSync(join(root, FE)) ? read(FE).toString() : "";
const rtlT = existsSync(join(root, RTL_T)) ? read(RTL_T).toString() : "";
const rtlR = existsSync(join(root, RTL_R)) ? read(RTL_R).toString() : "";
{
  const one = (t: string, name: string) => { const c = stripV(t); return new RegExp(`module\\s+${name}\\b`).test(c) && (c.match(/\bmodule\b/g) ?? []).length === 1 && /`default_nettype none/.test(c); };
  check("RTL present: scp4d_fe_w / scp4d_tdec_w / scp4d_rdec_w, one module per file, `default_nettype none",
    one(fe, "scp4d_fe_w") && one(rtlT, "scp4d_tdec_w") && one(rtlR, "scp4d_rdec_w"));
  const all = [fe, rtlT, rtlR, existsSync(join(root, WRAP)) ? read(WRAP).toString() : ""].map(stripV).join("\n");
  const banned = all.match(/\binitial\b|\$\w+|\breal\b|\brealtime\b|\bshortreal\b|\bfork\b|#\s*\d/g) ?? [];
  const divs = all.split("\n").filter((l) => !/^\s*`/.test(l) && /[^/]\/[^/]|%/.test(l.replace(/"[^"]*"/g, "")));
  check("new RTL + P&R wrapper: synthesizable subset (no initial, system tasks, real, fork, delays), no division or modulo", banned.length === 0 && divs.length === 0, JSON.stringify(banned) + divs.join(" | ").slice(0, 200));
  const cT = stripV(rtlT);
  check("scp4d_tdec_w rejects rank > 0 and relations with unsupported = 1 (as scp4d_tdec); W default 2, ADDR_W 11, P = W banks",
    /S_RANK:[\s\S]*?fail\(E_RANK, 1'b1\)/.test(cT) && /S_REL:[\s\S]*?fail\(E_REL, 1'b1\)/.test(cT) && /parameter integer W\s+= 2\b/.test(cT) && /parameter integer ADDR_W = 11\b/.test(cT) && /localparam integer P\s+= W;/.test(cT));
  const base = read("hw/scp4d/rtl/scp4d_rdec.v").toString();
  const region = (s: string) => { const i = s.indexOf("  // ---------------- program memories"), j = s.indexOf("  /* verilator lint_off BLKSEQ */"); return i >= 0 && j > i ? s.slice(i, j) : null; };
  const tail = (s: string) => { const i = s.indexOf("        S_FAN: begin"); return i >= 0 ? s.slice(i) : null; };
  check("scp4d_rdec_w keeps scp4d_rdec's datapath byte-identical (program / state memories, multiply, execute, write ports) and its fan-out / settle / flush / pipeline tail",
    region(base) !== null && region(base) === region(rtlR) && tail(base) !== null && tail(base) === tail(rtlR));
}

// ---------- 4. Job list ----------
type Path = "tdec_w" | "rdec_w";
type Job = {
  key: string; path: Path; id: string; source: string; kind: string; in_scope: boolean; bytes: Uint8Array; T: number; D: number;
  codes: number[][]; events: number[]; prog: RtlProgram | null; expect_unsup: number; expect_err: number;
};
const jobs: Job[] = [];
const emptyProg = (D: number) => rtlProgram(Math.min(Math.max(D, 1), RDEC_MAX_D), []);
const v0110 = JSON.parse(read(V0110_VECTORS).toString()) as { vectors: { id: string; config: { rank: number; relations: boolean; predictor: string }; relations_fixed_point: { target: number; sources: number[]; W: number[]; bias: number }[]; expected_bytes_hex: string; expected_decoded_codes: number[][]; expected_events: { positions: number[] }[] }[] };
const tv = temporalVectorFile(), rv = relationsVectorFile(), envT = envTemporalStreams(), envR = envRelationsStreams();
const add = (j: Omit<Job, "key">) => jobs.push({ ...j, key: `${j.path}:${j.id}` });
const evs = (e: { positions: number[] }[]) => e.map((x) => x.positions.length);
// scp4d_tdec_w
for (const v of v0110.vectors) {
  const ins = v.config.rank === 0 && !v.config.relations;
  add({ path: "tdec_w", id: v.id, source: V0110_VECTORS, kind: ins ? "temporal" : "out-of-scope", in_scope: ins, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length,
    codes: v.expected_decoded_codes, events: evs(v.expected_events), prog: null, expect_unsup: ins ? 0 : v.config.rank > 0 ? 8 : 9, expect_err: 0 });
}
for (const v of tv.vectors) add({ path: "tdec_w", id: v.id, source: "fixtures/scp/golden-vectors-scp4d-temporal.json", kind: "temporal", in_scope: true, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length, codes: v.expected_decoded_codes, events: evs(v.expected_events), prog: null, expect_unsup: 0, expect_err: 0 });
for (const s of envT) add({ path: "tdec_w", id: s.id, source: "regenerated (scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)", kind: "temporal", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes, events: s.perFrame.map((f) => f.positions.length), prog: null, expect_unsup: 0, expect_err: 0 });
// scp4d_rdec_w
for (const v of v0110.vectors) {
  const D = v.expected_decoded_codes[0].length, ins = v.config.rank === 0 && v.config.predictor === "last";
  add({ path: "rdec_w", id: v.id, source: V0110_VECTORS, kind: ins ? "relations" : "out-of-scope", in_scope: ins, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D,
    codes: v.expected_decoded_codes, events: evs(v.expected_events), prog: v.config.relations && v.config.rank === 0 ? rtlProgram(D, v.relations_fixed_point) : emptyProg(D), expect_unsup: ins ? 0 : v.config.rank > 0 ? 8 : 19, expect_err: 0 });
}
for (const v of rv.vectors) { const D = v.expected_decoded_codes[0].length; add({ path: "rdec_w", id: v.id, source: "fixtures/scp/golden-vectors-scp4d-relations.json", kind: "relations", in_scope: true, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D, codes: v.expected_decoded_codes, events: evs(v.expected_events), prog: rtlProgram(D, v.relations_fixed_point), expect_unsup: 0, expect_err: 0 }); }
for (const v of tv.vectors) { const D = v.expected_decoded_codes[0].length, last = v.config.predictor === "last"; add({ path: "rdec_w", id: v.id, source: "fixtures/scp/golden-vectors-scp4d-temporal.json", kind: last ? "temporal" : "out-of-scope", in_scope: last, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D, codes: v.expected_decoded_codes, events: evs(v.expected_events), prog: emptyProg(D), expect_unsup: last ? 0 : 19, expect_err: 0 }); }
for (const s of envR) add({ path: "rdec_w", id: s.id, source: "regenerated (scripts/scp-v0112-rtl-vectors.ts envRelationsStreams)", kind: "relations", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes, events: s.perFrame.map((f) => f.positions.length), prog: rtlProgram(s.D, s.rels), expect_unsup: 0, expect_err: 0 });
for (const s of envT) add({ path: "rdec_w", id: s.id, source: "regenerated (scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)", kind: "temporal", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes, events: s.perFrame.map((f) => f.positions.length), prog: emptyProg(s.D), expect_unsup: 0, expect_err: 0 });

/** first sparse frame with >= 2 events whose head, first index, q1, gap2, q2 are one-byte varints */
function payloadSites(buf: Uint8Array): { first: number; q1: number; gap2: number; q2: number } {
  const s = streamStructure(buf);
  let i = s.fixed_bytes + s.header_tail_bytes;
  const allDense = buf[i - 1] === 1;
  const rd = () => { const at = i; let v = 0, sh = 0; for (;;) { const b = buf[i++]; v += (b & 0x7f) * 2 ** sh; sh += 7; if (!(b & 0x80)) break; } return { at, len: i - at, v }; };
  for (let t = 0; t < s.T; t++) {
    if (allDense) { for (let e = 0; e < s.D; e++) rd(); continue; }
    const h = rd(), n = Math.floor(h.v / 2);
    if (h.v % 2 === 1) { for (let e = 0; e < s.D; e++) rd(); continue; }
    if (n < 2) { for (let k = 0; k < n; k++) { rd(); rd(); } continue; }
    const f = rd(), q1 = rd(), g2 = rd(), q2 = rd();
    if (f.len === 1 && q1.len === 1 && g2.len === 1 && q2.len === 1 && q2.at + 5 <= buf.length) return { first: f.at, q1: q1.at, gap2: g2.at, q2: q2.at };
    for (let k = 2; k < n; k++) { rd(); rd(); }
  }
  throw new Error("no suitable sparse frame for payload negatives");
}
const mut = (b0: Uint8Array, at: number, ...v: number[]) => { const b = Uint8Array.from(b0); v.forEach((x, k) => { b[at + k] = x; }); return b; };
{
  // scp4d_tdec_w negatives: v0.1.11's header set + payload (token path) corruptions
  const base = jobs.find((j) => j.key === "tdec_w:env-4x4x1-T8-temporal-last")!;
  const s = streamStructure(base.bytes);
  const layoutAt = s.fixed_bytes + s.header_tail_bytes - 1, predAt = layoutAt - 2, relAt = layoutAt - 3, rankAt = layoutAt - 4;
  if (base.bytes[relAt] !== 0 || base.bytes[predAt] !== 1 || base.bytes[layoutAt - 1] !== 16) throw new Error("unexpected header layout (tdec base)");
  const ps = payloadSites(base.bytes);
  const neg = (id: string, bytes: Uint8Array, unsup: number, errc: number, src: string) =>
    add({ path: "tdec_w", id, source: `negative: ${base.id} ${src}`, kind: "negative", in_scope: false, bytes, T: base.T, D: base.D, codes: [], events: [], prog: null, expect_unsup: unsup, expect_err: errc });
  neg("neg-bad-magic", mut(base.bytes, 0, 0x58), 0, 1, "byte 0 := 0x58");
  neg("neg-bad-version", mut(base.bytes, 4, 2), 0, 2, "byte 4 (version) := 2");
  neg("neg-rank-1", mut(base.bytes, rankAt, 1), 8, 0, `byte ${rankAt} (rank) := 1`);
  neg("neg-relations-on", mut(base.bytes, relAt, 1), 9, 0, `byte ${relAt} (relations) := 1`);
  neg("neg-bad-predictor", mut(base.bytes, predAt, 3), 0, 10, `byte ${predAt} (predictor) := 3`);
  neg("neg-sparse-q-zero", mut(base.bytes, ps.q1, 0), 0, 15, `byte ${ps.q1} (first one-byte sparse q) := 0`);
  neg("neg-first-index-oob", mut(base.bytes, ps.first, base.D), 0, 16, `byte ${ps.first} (first event index) := D`);
  neg("neg-gap-oob", mut(base.bytes, ps.gap2, 0x7f), 0, 16, `byte ${ps.gap2} (second event gap) := 127`);
  neg("neg-long-varint", mut(base.bytes, ps.q2, 0x80, 0x80, 0x80, 0x80, 0x80), 0, 13, `bytes ${ps.q2}..${ps.q2 + 4} := 0x80 (payload varint > 5 bytes)`);
}
{
  // scp4d_rdec_w negatives: v0.1.12's set + the token path (merged first-index / gap, long varint)
  const base = jobs.find((j) => j.key === "rdec_w:env-4x4x1-T8-relations-last")!;
  const s = streamStructure(base.bytes);
  const layoutAt = s.fixed_bytes + s.header_tail_bytes - 1, fwAt = layoutAt - 1, predAt = layoutAt - 2, relAt = layoutAt - 3, rankAt = layoutAt - 4;
  if (base.bytes[relAt] !== 1 || base.bytes[predAt] !== 1 || base.bytes[fwAt] !== 16) throw new Error("unexpected header layout (rdec base)");
  const ps = payloadSites(base.bytes);
  const neg = (id: string, bytes: Uint8Array, prog: RtlProgram, unsup: number, errc: number, src: string) =>
    add({ path: "rdec_w", id, source: `negative: ${base.id} ${src}`, kind: "negative", in_scope: false, bytes, T: base.T, D: base.D, codes: [], events: [], prog, expect_unsup: unsup, expect_err: errc });
  const p0 = base.prog!;
  neg("neg-bad-magic", mut(base.bytes, 0, 0x58), p0, 0, 1, "byte 0 := 0x58");
  neg("neg-rank-1", mut(base.bytes, rankAt, 1), p0, 8, 0, `byte ${rankAt} (rank) := 1`);
  neg("neg-predictor-zero", mut(base.bytes, predAt, 0), p0, 19, 0, `byte ${predAt} (predictor) := 0 (zero hold: out of scope)`);
  neg("neg-bad-predictor", mut(base.bytes, predAt, 3), p0, 0, 10, `byte ${predAt} (predictor) := 3`);
  neg("neg-no-program", base.bytes, emptyProg(base.D), 0, 20, "relations stream, empty relation program (nT = 0)");
  neg("neg-program-wrong-D", base.bytes, rtlProgram(3, [{ target: 1, sources: [0], W: [65536], bias: 0 }]), 0, 20, "program built for D = 3");
  neg("neg-sparse-q-zero", mut(base.bytes, ps.q1, 0), p0, 0, 15, `byte ${ps.q1} (first one-byte sparse q) := 0`);
  const ovf = rtlProgram(base.D, v0110.vectors.find((v) => v.id === base.id)!.relations_fixed_point.map((r, i) => (i === 0 ? { ...r, bias: 2 ** 47 - 1 } : r)));
  neg("neg-acc-overflow", base.bytes, ovf, 0, 18, "relation 0 bias := 2^47 − 1 (ACC + 2^15 leaves 48 bits at the frame-0 flush)");
  neg("neg-first-index-oob", mut(base.bytes, ps.first, base.D), p0, 0, 16, `byte ${ps.first} (first event index, merged with the head at W >= 2) := D`);
  neg("neg-gap-oob", mut(base.bytes, ps.gap2, 0x7f), p0, 0, 16, `byte ${ps.gap2} (second event gap, merged with q1 at W >= 2) := 127`);
  neg("neg-long-varint", mut(base.bytes, ps.q2, 0x80, 0x80, 0x80, 0x80, 0x80), p0, 0, 13, `bytes ${ps.q2}..${ps.q2 + 4} := 0x80 (payload varint > 5 bytes)`);
  const tl = jobs.find((j) => j.key === "rdec_w:env-4x4x1-T8-temporal-last")!;
  const ts = streamStructure(tl.bytes);
  add({ path: "rdec_w", id: "neg-temporal-relations-on-no-program", source: `negative: ${tl.id} relations byte := 1, empty program`, kind: "negative", in_scope: false,
    bytes: mut(tl.bytes, ts.fixed_bytes + ts.header_tail_bytes - 4, 1), T: tl.T, D: tl.D, codes: [], events: [], prog: emptyProg(tl.D), expect_unsup: 0, expect_err: 20 });
}
const inScope = jobs.filter((j) => j.in_scope);
check(`job list: ${jobs.filter((j) => j.path === "tdec_w").length} scp4d_tdec_w jobs (${inScope.filter((j) => j.path === "tdec_w").length} in scope) and ${jobs.filter((j) => j.path === "rdec_w").length} scp4d_rdec_w jobs (${inScope.filter((j) => j.path === "rdec_w").length} in scope): every in-scope job's per-frame events sum to the stream walk's total; unique keys`,
  new Set(jobs.map((j) => j.key)).size === jobs.length && inScope.every((j) => j.events.reduce((a, b) => a + b, 0) === streamStructure(j.bytes).events)
  && inScope.filter((j) => j.path === "tdec_w").length === 7 && inScope.filter((j) => j.path === "rdec_w").length === 13);

// ---------- 5. Derived facts + cycle models (simulator-independent) ----------
type Rep = { measured: { id: string; cycles: number; kind?: string }[] };
const V0111 = JSON.parse(read("fixtures/scp/v0111-rtl-report.json").toString()) as Rep;
const V0112 = JSON.parse(read("fixtures/scp/v0112-rtl-report.json").toString()) as Rep;
const baselineCycles = (j: Job): number | null => { const m = (j.path === "tdec_w" ? V0111 : V0112).measured.find((x) => x.id === j.id); return m && typeof m.cycles === "number" ? m.cycles : null; };
const filesOf = (j: Job) => j.path === "tdec_w"
  ? { ...simFiles(j.bytes, j.in_scope ? j.codes : [[0]], j.in_scope ? j.events : [0]), prog: "", nprog: 0 }
  : rdecSimFiles(j.bytes, j.in_scope ? j.codes : [], j.in_scope ? j.events : [], j.prog!);
const derived = jobs.map((j) => {
  const f = filesOf(j);
  const base = { key: j.key, path: j.path, id: j.id, source: j.source, kind: j.kind, in_scope: j.in_scope, bytes: j.bytes.length, bytes_sha256: sha(j.bytes),
    sim_inputs_sha256: sha(f.stream + f.codes + f.events + f.prog), expect_unsupported_code: j.expect_unsup, expect_err_code: j.expect_err };
  if (!j.in_scope) return base;
  const s = streamStructure(j.bytes), pt = payloadTokens(j.bytes);
  const model = Object.fromEntries(W_LIST.map((W) => [`W${W}`, j.path === "tdec_w" ? tdecWCycleModel(j.bytes, W) : rdecWCycleModel(j.bytes, W, s.relations === 1 ? j.prog : null)]));
  return { ...base, T: s.T, D: s.D, element_frames: s.T * s.D, predictor: ["zero", "last", "linear"][s.predictor], relations: s.relations === 1,
    header_bytes: pt.header, payload_tokens: pt.toks.length, multi_byte_tokens: pt.toks.filter((t) => t.len > 1).length, events: s.events,
    baseline_cycles: baselineCycles(j), baseline: j.path === "tdec_w" ? "v0.1.11 scp4d_tdec (fixtures/scp/v0111-rtl-report.json)" : "v0.1.12 scp4d_rdec (fixtures/scp/v0112-rtl-report.json)", model };
});

// ---------- 6. Simulator (uncounted) ----------
type SimResult = Record<string, string | number>;
function findBin(name: string): string | null {
  for (const cand of [name, `/opt/eda/oss-cad-suite/bin/${name}`]) {
    const r = spawnSync(cand, ["-V"], { encoding: "utf8" });
    if (r.status === 0 || (r.stdout ?? "").length > 0) return cand;
    const r2 = spawnSync(cand, ["--version"], { encoding: "utf8" });
    if (r2.status === 0) return cand;
  }
  return null;
}
const firstLine = (bin: string | null, args: string[]) => {
  if (!bin) return null;
  const r = spawnSync(bin, args, { encoding: "utf8" });
  return `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? null;
};
const parseResult = (s: string): SimResult => {
  const line = s.split("\n").find((l) => l.startsWith("RESULT "));
  if (!line) throw new Error(`no RESULT line: ${s.slice(-500)}`);
  return Object.fromEntries(line.slice(7).split(" ").map((kv) => { const [k, v] = kv.split("="); return [k, /^-?\d+$/.test(v) ? Number(v) : v]; }));
};
async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (next < tasks.length) { const k = next++; out[k] = await tasks[k](); } }));
  return out;
}
const run = (bin: string, args: string[], cwd?: string): Promise<{ status: number | null; out: string }> => new Promise((res) => {
  const p = spawn(bin, args, { cwd }); let out = "";
  p.stdout.on("data", (d) => { out += d; }); p.stderr.on("data", (d) => { out += d; });
  p.on("close", (status) => res({ status, out }));
});
const NPAR = Math.max(1, Math.min(8, cpus().length));
async function runSim(iverilog: string, vvp: string): Promise<{ runs: Map<string, SimResult>; tools: Record<string, string | null> }> {
  const dir = mkdtempSync(join(tmpdir(), "scp4d-w-sim-"));
  try {
    for (const W of W_LIST) {
      for (const [p, tb, rtl, top] of [["tdec_w", TB_T, RTL_T, "scp4d_tdec_w_tb"], ["rdec_w", TB_R, RTL_R, "scp4d_rdec_w_tb"]] as const) {
        const c = spawnSync(iverilog, ["-g2012", "-Wall", `-P${top}.W=${W}`, "-o", join(dir, `${p}-${W}.vvp`), join(root, tb), join(root, rtl), join(root, FE)], { encoding: "utf8" });
        if (c.status !== 0) throw new Error(`iverilog failed: ${c.stderr}`);
      }
    }
    const tasks: (() => Promise<[string, SimResult]>)[] = [];
    jobs.forEach((j, n) => {
      const f = filesOf(j);
      const p = (k: string) => join(dir, `${n}.${k}.hex`);
      writeFileSync(p("stream"), f.stream); writeFileSync(p("codes"), f.codes); writeFileSync(p("events"), f.events);
      if (j.path === "rdec_w") writeFileSync(p("prog"), f.prog);
      for (const W of W_LIST) for (const bub of j.in_scope ? [0, 1] : [0]) {
        const args = [join(dir, `${j.path}-${W}.vvp`), `+stream=${p("stream")}`, `+codes=${p("codes")}`, `+events=${p("events")}`, `+nbytes=${j.bytes.length}`, `+t=${j.T}`, `+d=${j.D}`,
          `+expect_unsup=${j.expect_unsup}`, `+expect_err=${j.expect_err}`, `+bubbles=${bub}`, `+id=${j.id}`,
          ...(j.path === "rdec_w" ? [`+prog=${p("prog")}`, `+nprog=${f.nprog}`] : [])];
        tasks.push(async () => { const r = await run(vvp, ["-n", ...args]); return [`${j.key}|${W}|${bub}`, parseResult(r.out)]; });
      }
    });
    const res = await pool(tasks, NPAR);
    return { runs: new Map(res), tools: { iverilog: firstLine(iverilog, ["-V"]), vvp: firstLine(vvp, ["-V"]) } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- synthesis (--synth only) ----------
type Cells = { num_cells: number; by_type: Record<string, number> };
type Pnr = { device: string; seed: number; fits: boolean; fmax_mhz?: Record<string, number>; utilization?: Record<string, string>; error?: string };
async function runSynth(): Promise<Record<string, unknown>> {
  const yosys = findBin("yosys"), np40 = findBin("nextpnr-ice40"), np5 = findBin("nextpnr-ecp5");
  if (!yosys) throw new Error("--synth needs yosys");
  const dir = mkdtempSync(join(tmpdir(), "scp4d-w-synth-"));
  const files = [FE, RTL_T, RTL_R, "hw/scp4d/rtl/scp4d_tdec.v", "hw/scp4d/rtl/scp4d_rdec.v", WRAP].map((f) => join(root, f)).join(" ");
  const configs: { name: string; wrap: string; W: number | null; path: Path }[] = [
    { name: "scp4d_tdec (v0.1.11)", wrap: "wrap_tdec", W: null, path: "tdec_w" },
    ...W_LIST.map((W) => ({ name: `scp4d_tdec_w W=${W}`, wrap: "wrap_tdec_w", W, path: "tdec_w" as Path })),
    { name: "scp4d_rdec (v0.1.12)", wrap: "wrap_rdec", W: null, path: "rdec_w" },
    ...W_LIST.map((W) => ({ name: `scp4d_rdec_w W=${W}`, wrap: "wrap_rdec_w", W, path: "rdec_w" as Path })),
  ];
  const cells = (f: string): Cells => {
    const j = JSON.parse(readFileSync(f, "utf8")) as { design?: { num_cells: number; num_cells_by_type: Record<string, number> } };
    const d = j.design!;
    return { num_cells: d.num_cells, by_type: Object.fromEntries(Object.entries(d.num_cells_by_type).filter(([k]) => !k.startsWith("$")).sort(([a], [b]) => a.localeCompare(b))) };
  };
  const pnrOf = async (bin: string | null, args: string[], device: string, wd: string): Promise<Pnr | { skipped: string }> => {
    if (!bin) return { skipped: "place-and-route tool not found" };
    const r = await run(bin, [...args, "--seed", "1", "--report", join(wd, "pnr.json")], wd);
    if (r.status !== 0) return { device, seed: 1, fits: false, error: (r.out.match(/ERROR: [^\n]*/) ?? ["unknown error"])[0] };
    const rep = JSON.parse(readFileSync(join(wd, "pnr.json"), "utf8")) as { fmax: Record<string, { achieved: number }>; utilization: Record<string, { used: number; available: number }> };
    return { device, seed: 1, fits: true, fmax_mhz: Object.fromEntries(Object.entries(rep.fmax).map(([k, v]) => [k.replace(/\$glbnet\$|\$TRELLIS_IO_IN|\$SB_IO_IN/g, ""), r2(v.achieved)])),
      utilization: Object.fromEntries(Object.entries(rep.utilization).filter(([k, v]) => v.used > 0 && !["GND", "VCC"].includes(k)).map(([k, v]) => [k, `${v.used}/${v.available}`])) };
  };
  try {
    const tasks = configs.flatMap((c, n) => (["ecp5", "ice40", "xc7"] as const).map((dev) => async () => {
      const wd = join(dir, `${n}-${dev}`); spawnSync("mkdir", ["-p", wd]);
      const small = dev === "ice40" ? (c.path === "tdec_w" ? `chparam -set A 9 ${c.wrap}; ` : `chparam -set A 9 -set RW 8 -set FW 9 ${c.wrap}; `) : "";
      const chW = c.W !== null ? `chparam -set W ${c.W} ${c.wrap}; ` : "";
      const synth = dev === "ecp5" ? `synth_ecp5 -top ${c.wrap} -json n.json` : dev === "ice40" ? `synth_ice40 -top ${c.wrap} -json n.json` : `synth_xilinx -top ${c.wrap} -family xc7`;
      const y = await run(yosys, ["-q", "-l", join(wd, "y.log"), "-p", `read_verilog ${files}; ${chW}${small}hierarchy -top ${c.wrap}; ${synth}; tee -q -o stat.json stat -json`], wd);
      if (y.status !== 0) throw new Error(`yosys failed (${c.name} ${dev}): ${y.out.slice(-800)}`);
      const st = cells(join(wd, "stat.json"));
      const pr = dev === "ecp5" ? await pnrOf(np5, ["--45k", "--package", "CABGA381", "--json", join(wd, "n.json"), "--lpf-allow-unconstrained", "--freq", "12"], "ECP5 LFE5U-45F (CABGA381)", wd)
        : dev === "ice40" ? await pnrOf(np40, ["--hx8k", "--package", "ct256", "--json", join(wd, "n.json"), "--pcf-allow-unconstrained", "--freq", "12"], "iCE40-HX8K (ct256)", wd) : null;
      return [c.name, dev, { synth: st, ...(pr ? { place_and_route: pr } : {}) }] as const;
    }));
    const res = await pool(tasks, Math.max(1, Math.min(4, cpus().length)));
    const by: Record<string, Record<string, unknown>> = {};
    for (const [name, dev, v] of res) (by[name] ??= {})[dev === "ice40" ? "ice40_hx8k_addr_w9" : dev === "ecp5" ? "ecp5_45f_full_params" : "xc7_full_params"] = v;
    return {
      label: "SYNTHESIS / PLACE-AND-ROUTE ESTIMATES from open-source tools (one seed, --freq 12 target). Not a programmed-FPGA or silicon measurement; no board was used.",
      wrapper: `${WRAP}: every configuration (baselines included) is placed inside the same thin wrapper (stream inputs on pins, outputs registered and XOR-folded to 16 pins, relation program through a 1-bit shift register) because the W = 4 decoders have more ports than the packages have pins.`,
      parameters: { full: "ADDR_W 11 (REL_W 10, FAN_W 11 for rdec)", ice40_small: "ADDR_W 9 (REL_W 8, FAN_W 9 for rdec)" },
      tools: { yosys: firstLine(yosys, ["-V"]), nextpnr_ecp5: firstLine(np5, ["--version"]), nextpnr_ice40: firstLine(np40, ["--version"]) },
      configs: by,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- 7. Measured section, comparison, report ----------
const MEAS_T = ["ok", "done", "err", "unsupported", "err_code", "reject_byte", "accepted", "consumed", "frames", "cycles", "beats", "c_hdr", "c_clear", "c_pay", "c_drain", "starved", "end_token", "end_bank", "end_frame", "end_steps", "end_fail", "steps", "pops", "lanes", "events", "mismatches", "ev_mismatch_frames", "timeout"] as const;
const MEAS_R = ["ok", "done", "err", "unsupported", "err_code", "reject_byte", "accepted", "consumed", "frames", "cycles", "beats", "c_hdr", "c_clear", "c_parse", "c_pair", "c_starve", "c_fan", "c_settle", "c_flush", "c_drain", "tokens", "events", "fan_ops", "flush_ops", "mismatches", "ev_mismatch_frames", "max_code", "max_q", "max_prod", "max_acc", "max_pvarint", "timeout"] as const;
type Run = Record<string, number | Record<string, number> | null>;
function measuredSection(runs: Map<string, SimResult>) {
  return jobs.map((j) => {
    const keys = j.path === "tdec_w" ? MEAS_T : MEAS_R;
    const per = Object.fromEntries(W_LIST.map((W) => {
      const r = runs.get(`${j.key}|${W}|0`)!, b = runs.get(`${j.key}|${W}|1`);
      const o: Run = Object.fromEntries(keys.map((k) => [k, r[k] as number]));
      if (j.in_scope) { o.cycles_per_element_frame = r4((r.cycles as number) / (j.T * j.D)); o.bubble_run = b ? { ok: b.ok as number, cycles: b.cycles as number, bubbles: b.bubbles as number, mismatches: b.mismatches as number } : null; }
      return [`W${W}`, o];
    }));
    return { key: j.key, ...per };
  });
}
type Meas = ReturnType<typeof measuredSection>[number];
const fmaxOf = (p: unknown): number | null => { const f = (p as { fmax_mhz?: Record<string, number> } | undefined)?.fmax_mhz; return f ? Math.min(...Object.values(f)) : null; };
const ecp5 = (synth: Record<string, unknown> | null, name: string) => {
  const c = (synth?.configs as Record<string, { ecp5_45f_full_params?: { synth: Cells; place_and_route: Pnr } }> | undefined)?.[name]?.ecp5_45f_full_params;
  if (!c) return null;
  const u = c.place_and_route.utilization ?? {};
  return { fmax_mhz: fmaxOf(c.place_and_route), lut4: Number((u.TRELLIS_COMB ?? "0/0").split("/")[0]), ff: Number((u.TRELLIS_FF ?? "0/0").split("/")[0]), ebr: Number((u.DP16KD ?? "0/0").split("/")[0]), dsp: Number((u.MULT18X18D ?? "0/0").split("/")[0]) };
};
/** Comparison + verdict, computed only from the committed measurements, stream sizes and synthesis estimates. */
function comparison(measured: Meas[], synth: Record<string, unknown> | null) {
  const M = new Map(measured.map((m) => [m.key, m]));
  const D = new Map(derived.map((d) => [d.key, d]));
  const cyc = (key: string, W: number) => ((M.get(key) as unknown as Record<string, Run>)[`W${W}`].cycles as number);
  const cls = (key: string, W: number) => (M.get(key) as unknown as Record<string, Run>)[`W${W}`] as Record<string, number>;
  const streams = ["env-16x16x2-T64", "env-16x16x2-T256"];
  const thr = (name: string, key: string, W: number) => {
    const e = ecp5(synth, name), d = D.get(key) as { bytes: number; element_frames: number };
    if (!e || !e.fmax_mhz) return null;
    const c = cyc(key, W);
    return { fmax_mhz_estimate: e.fmax_mhz, values_per_s: Math.round((d.element_frames / c) * e.fmax_mhz * 1e6), stream_MB_per_s: r2((d.bytes / c) * e.fmax_mhz), microseconds: r2(c / e.fmax_mhz) };
  };
  const pathRows = (path: Path, kind: string) => streams.map((sid) => {
    const key = `${path}:${sid}-${kind}-last`, d = D.get(key) as { bytes: number; element_frames: number; baseline_cycles: number };
    const base = d.baseline_cycles, c1 = cyc(key, 1);
    const baseName = path === "tdec_w" ? "scp4d_tdec (v0.1.11)" : "scp4d_rdec (v0.1.12)";
    return { stream: `${sid}-${kind}-last`, bytes: d.bytes, element_frames: d.element_frames, baseline_cycles: base,
      baseline_throughput_ecp5: (() => { const e = ecp5(synth, baseName); return e?.fmax_mhz ? { fmax_mhz_estimate: e.fmax_mhz, values_per_s: Math.round((d.element_frames / base) * e.fmax_mhz * 1e6), stream_MB_per_s: r2((d.bytes / base) * e.fmax_mhz) } : null; })(),
      by_W: Object.fromEntries(W_LIST.map((W) => [`W${W}`, { cycles: cyc(key, W), cycles_per_value: r4(cyc(key, W) / d.element_frames), bytes_per_cycle: r4(d.bytes / cyc(key, W)),
        speedup_vs_W1: r4(c1 / cyc(key, W)), speedup_vs_baseline: r4(base / cyc(key, W)),
        throughput_ecp5: thr(`scp4d_${path} W=${W}`, key, W) }])) };
  });
  const tRows = pathRows("tdec_w", "temporal"), rRows = pathRows("rdec_w", "relations");
  // where the cycles go
  const tdecBreak = streams.map((sid) => { const key = `tdec_w:${sid}-temporal-last`; return { stream: sid, by_W: Object.fromEntries(W_LIST.map((W) => { const c = cls(key, W); return [`W${W}`, {
    header: c.c_hdr, clear_wait: c.c_clear, payload: c.c_pay, drain: c.c_drain + 1, payload_end_reasons: { token_starved: c.end_token, bank_conflict: c.end_bank, frame_end: c.end_frame, step_limit: c.end_steps },
    bank_conflict_share_of_payload: r4(c.end_bank / c.c_pay), steps_per_payload_cycle: r4(c.steps / c.c_pay) }]; })) }; });
  const rdecAmdahl = streams.map((sid) => {
    const key = `rdec_w:${sid}-relations-last`;
    const by = Object.fromEntries(W_LIST.map((W) => { const c = cls(key, W); const input = c.c_hdr + c.c_clear + c.c_parse + c.c_starve, core = c.c_fan + c.c_settle + c.c_flush;
      return [`W${W}`, { cycles: c.cycles, input_bound: input, input_parts: { header: c.c_hdr, clear_wait: c.c_clear, parse: c.c_parse, paired_parse_cycles: c.c_pair, starved: c.c_starve },
        core_bound: core, core_parts: { fan_out: c.c_fan, settle: c.c_settle, flush: c.c_flush }, drain: c.c_drain + 1, core_share: r4(core / c.cycles) }]; }));
    const w1 = by.W1 as { cycles: number; core_bound: number; drain: number }, w4 = by.W4 as { cycles: number; core_bound: number; input_parts: { parse: number } };
    const evts = (D.get(key) as { events: number }).events;
    const fan = (by.W2 as { core_parts: { fan_out: number; flush: number } }).core_parts;
    const c2 = (by.W2 as { cycles: number }).cycles;
    return { stream: sid, by_W: by,
      amdahl_limit_input_free: { cycles: w1.core_bound + w1.drain, speedup_vs_W1: r4(w1.cycles / (w1.core_bound + w1.drain)), note: "if every stream-side cycle (header, clear, parse) vanished; fan-out, settle and flush unchanged" },
      parse_floor_note: `the W >= 2 parser retires one event per cycle (${evts} events); W = 4 is ${w4.cycles === c2 ? "identical to" : "within a few cycles of"} W = 2 because a second event per cycle needs a second ORD read and second H1 / ACC ports`,
      projection_banked: [2, 4].map((B) => ({ banks: B, cycles: c2 - fan.fan_out - fan.flush + Math.ceil(fan.fan_out / B) + Math.ceil(fan.flush / B),
        cycles_per_value: r4((c2 - fan.fan_out - fan.flush + Math.ceil(fan.fan_out / B) + Math.ceil(fan.flush / B)) / (D.get(key) as { element_frames: number }).element_frames),
        label: "PROJECTION (not built): W = 2 front end + fan-out and flush split across B conflict-free ACC/LIST banks; optimistic (no bank conflicts, no extra pipeline)" })) };
  });
  // relations vs temporal at each W (same environment data)
  const relVsTemp = streams.map((sid, k) => {
    const t = tRows[k], r = rRows[k];
    return { stream: sid, bytes_temporal: t.bytes, bytes_relations: r.bytes, byte_ratio: r4(t.bytes / r.bytes),
      by_W: Object.fromEntries(W_LIST.map((W) => { const tt = (t.by_W as Record<string, { cycles: number; throughput_ecp5: { values_per_s: number; fmax_mhz_estimate: number } | null }>)[`W${W}`], rr = (r.by_W as typeof t.by_W & Record<string, { cycles: number; throughput_ecp5: { values_per_s: number; fmax_mhz_estimate: number } | null }>)[`W${W}`] as { cycles: number; throughput_ecp5: { values_per_s: number; fmax_mhz_estimate: number } | null };
        const tSec = tt.throughput_ecp5 ? tt.cycles / (tt.throughput_ecp5.fmax_mhz_estimate * 1e6) : null, rSec = rr.throughput_ecp5 ? rr.cycles / (rr.throughput_ecp5.fmax_mhz_estimate * 1e6) : null;
        return [`W${W}`, { cycle_ratio_relations_over_temporal: r4(rr.cycles / tt.cycles), time_ratio_ecp5: tSec && rSec ? r4(rSec / tSec) : null,
          link_break_even_MB_per_s_ecp5: rSec ? r2(t.bytes / rSec / 1e6) : null }]; })) };
  });
  const t64 = tRows[0].by_W as Record<string, { speedup_vs_W1: number; throughput_ecp5: { values_per_s: number } | null }>;
  const r64 = rRows[0].by_W as Record<string, { speedup_vs_W1: number; throughput_ecp5: { values_per_s: number } | null }>;
  const ra = rdecAmdahl[0].by_W as Record<string, { core_share: number }>;
  const tb = tdecBreak[0].by_W as Record<string, { bank_conflict_share_of_payload: number }>;
  const best = (rows: Record<string, { throughput_ecp5: { values_per_s: number } | null }>) => { let b = "W1", v = -1; for (const W of W_LIST) { const x = rows[`W${W}`].throughput_ecp5?.values_per_s ?? -1; if (x > v) { v = x; b = `W${W}`; } } return v > 0 ? b : null; };
  const rv64 = relVsTemp[0].by_W as Record<string, { link_break_even_MB_per_s_ecp5: number | null; time_ratio_ecp5: number | null }>;
  return {
    label: "Cycles are MEASURED in simulation (Icarus Verilog) and equal the cycle model; fmax, LUT/FF/RAM are SYNTHESIS ESTIMATES (one seed, no board); throughput = measured cycles × estimated fmax. No energy was measured.",
    temporal_only: tRows, relations: rRows, temporal_breakdown: tdecBreak, relations_amdahl: rdecAmdahl, relations_vs_temporal: relVsTemp,
    verdict: {
      temporal_only: `Pays off in cycles, less in wall-clock time. Env T64: ${t64.W2.speedup_vs_W1}× fewer cycles at W = 2 and ${t64.W4.speedup_vs_W1}× at W = 4 (bank conflicts end ${r4(100 * tb.W4.bank_conflict_share_of_payload)}% of W = 4 payload cycles). With ECP5 fmax estimates the best wall-clock point is ${best(t64) ?? "n/a (no synthesis)"}: W = 4's 4-step issue chain roughly halves fmax, so W = 4 is about as fast as W = 2 in time.`,
      relations: `Little: env T64 gets ${r64.W2.speedup_vs_W1}× at W = 2 and ${r64.W4.speedup_vs_W1}× at W = 4. ${r4(100 * ra.W2.core_share)}% of W = 2 cycles are fan-out, settle and flush, which do not read the stream (Amdahl limit with an infinitely wide input: ${rdecAmdahl[0].amdahl_limit_input_free.speedup_vs_W1}×).`,
      new_bottleneck: "temporal-only: the combinational issue chain (token select -> step decode -> index add -> bank check, repeated W times, then the token-queue pop) sets fmax, and bank conflicts cap W = 4 at ~3.7× fewer cycles; relations: the one-ACC-update-per-cycle fan-out and the per-frame dirty flush (stream input is no longer the limit).",
      relations_vs_temporal: `Unchanged, and stronger: inside the decoder relations stay slower at every W (time ratio ${rv64.W2.time_ratio_ecp5 ?? "n/a"}× at W = 2); they only finish first when the link feeding the decoder is slower than ~${rv64.W2.link_break_even_MB_per_s_ecp5 ?? "n/a"} MB/s (W = 2, ECP5 estimates; ~29 MB/s in v0.1.12). Keep temporal-only as the hardware default; relations remain a memory/link-bound option.`,
    },
    energy: "not measured; no energy figure in this report",
  };
}

async function main(): Promise<void> {
  let sim: Awaited<ReturnType<typeof runSim>> | null = null;
  const iverilog = NO_SIM ? null : findBin("iverilog"), vvp = NO_SIM ? null : findBin("vvp");
  if (iverilog && vvp) sim = await runSim(iverilog, vvp);
  else if (REQUIRE_SIM) { console.log("FAIL simulator required (--require-sim / --write) but iverilog/vvp not found"); process.exit(1); }
  else console.log(NO_SIM ? "SKIP sim — --no-sim; counted checks below use the committed results" : "SKIP sim — iverilog/vvp not found (install: sudo apt install iverilog); counted checks below use the committed results");

  const committed = existsSync(join(root, REPORT)) ? JSON.parse(read(REPORT).toString()) : null;
  let report = committed;
  if (WRITE && sim) {
    const synth = SYNTH ? await runSynth() : (committed?.synthesis ?? null);
    const measured = measuredSection(sim.runs);
    report = {
      format: "4d-scp-v0.1.13-rtl-wide-input-report", label: "TEST ONLY. RTL simulation measurements (cycles) + synthesis estimates; synthetic / hand-written vectors only; no board, no energy measurement.",
      rtl: { front_end: FE, front_end_sha256: sha(read(FE)), tdec_w: RTL_T, tdec_w_sha256: sha(read(RTL_T)), rdec_w: RTL_R, rdec_w_sha256: sha(read(RTL_R)),
        testbenches_sha256: { [TB_T]: sha(read(TB_T)), [TB_R]: sha(read(TB_R)) }, pnr_wrapper_sha256: sha(read(WRAP)), cycle_model_sha256: sha(read(MODEL)), W: [...W_LIST] },
      simulator: sim.tools,
      design: {
        front_end: "scp4d_fe_w: W-byte beats -> byte queue (2W) -> header bytes one per cycle | payload varint tokens (tokenizer, W bytes/cycle, zigzag pre-decode) -> token queue (2W + K)",
        tdec_w: "issue chain of W steps per cycle (one token or one sweep element each), P = W banks of state memory (element e -> bank e mod P), per-bank A/B pipeline as scp4d_tdec",
        rdec_w: "scp4d_rdec datapath unchanged; payload consumed as tokens; W >= 2 retires head + first index and q + next gap in one cycle (one event per cycle); W = 4 same as W = 2 on the parser side",
        cycle_model: `${MODEL}: register-transfer cycle model (full-rate input); cycles = cycle of the last frame + ${TDECW_TAIL} (tdec_w) / ${RDECW_TAIL} (rdec_w) drain`,
      },
      derived, measured, synthesis: synth, comparison: comparison(measured, synth),
    };
    writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`NOTE wrote ${REPORT}`);
  }

  // Counted: committed report consistency (no simulator needed)
  const rep = report as { rtl?: Record<string, unknown> & { testbenches_sha256?: Record<string, string> }; derived?: unknown[]; measured?: Meas[]; synthesis?: Record<string, unknown> | null; comparison?: unknown; label?: string } | null;
  check(`committed ${REPORT} exists and pins the current front end, both W decoders, both testbenches, the P&R wrapper and the cycle model (sha256)`,
    rep !== null && !!rep.rtl && rep.rtl.front_end_sha256 === sha(read(FE)) && rep.rtl.tdec_w_sha256 === sha(read(RTL_T)) && rep.rtl.rdec_w_sha256 === sha(read(RTL_R))
    && rep.rtl.testbenches_sha256?.[TB_T] === sha(read(TB_T)) && rep.rtl.testbenches_sha256?.[TB_R] === sha(read(TB_R)) && rep.rtl.pnr_wrapper_sha256 === sha(read(WRAP)) && rep.rtl.cycle_model_sha256 === sha(read(MODEL)));
  check("report's derived section (stream structure, sim-input hashes, baselines, cycle models at W = 1, 2, 4) matches this run", JSON.stringify(rep?.derived) === JSON.stringify(derived));
  const meas = new Map((rep?.measured ?? []).map((m) => [m.key, m as unknown as Record<string, Record<string, unknown>>]));
  const runOf = (j: Job, W: number) => meas.get(j.key)?.[`W${W}`] as Record<string, unknown> | undefined;
  const exact = (j: Job, W: number) => { const m = runOf(j, W); return !!m && m.ok === 1 && m.err === 0 && m.mismatches === 0 && m.ev_mismatch_frames === 0 && m.consumed === j.bytes.length && m.accepted === j.bytes.length && m.frames === j.T && m.timeout === 0; };
  const tIn = inScope.filter((j) => j.path === "tdec_w"), rIn = inScope.filter((j) => j.path === "rdec_w");
  check(`scp4d_tdec_w: all ${tIn.length} temporal-only vectors (zero / last / linear; v0.1.10, v0.1.11 and env T64 / T256) bit-exact at W = 1, 2 and 4: every element of every frame, per-frame event counts, every byte consumed`, tIn.length === 7 && tIn.every((j) => W_LIST.every((W) => exact(j, W))));
  check(`scp4d_rdec_w: all ${rIn.length} last-value vectors (${rIn.filter((j) => j.kind === "relations").length} with relations, ${rIn.filter((j) => j.kind === "temporal").length} temporal-only) bit-exact at W = 1, 2 and 4`, rIn.length === 13 && rIn.every((j) => W_LIST.every((W) => exact(j, W))));
  check("every in-scope job is also bit-exact at every W with pseudo-random input gaps (W-byte valid/ready beats, fixed-seed LFSR)",
    inScope.every((j) => W_LIST.every((W) => { const b = runOf(j, W)?.bubble_run as { ok: number; mismatches: number; bubbles: number } | null | undefined; return !!b && b.ok === 1 && b.mismatches === 0 && b.bubbles > 0; })));
  const rejects = (path: Path) => jobs.filter((j) => j.path === path && !j.in_scope).every((j) => W_LIST.every((W) => { const m = runOf(j, W); return !!m && m.ok === 1 && m.err === 1 && m.err_code === (j.expect_unsup || j.expect_err) && m.unsupported === (j.expect_unsup ? 1 : 0); }));
  check(`scp4d_tdec_w: ${jobs.filter((j) => j.path === "tdec_w" && !j.in_scope).length} out-of-scope / corrupted streams (header + token-path: q = 0, index and gap out of range, 6-byte varint) rejected with the expected error code at every W`, rejects("tdec_w"));
  check(`scp4d_rdec_w: ${jobs.filter((j) => j.path === "rdec_w" && !j.in_scope).length} out-of-scope / corrupted streams (v0.1.12 set + merged first-index / gap out of range, 6-byte varint) rejected with the expected error code at every W`, rejects("rdec_w"));
  const dmap = new Map((derived as { key: string; model?: Record<string, { cycles: number }> }[]).map((d) => [d.key, d]));
  const modelEq = (path: Path) => inScope.filter((j) => j.path === path).every((j) => W_LIST.every((W) => runOf(j, W)?.cycles === dmap.get(j.key)!.model![`W${W}`].cycles));
  check("scp4d_tdec_w: measured cycles equal the cycle model exactly for every vector at W = 1, 2, 4", modelEq("tdec_w"));
  check("scp4d_rdec_w: measured cycles equal the cycle model exactly for every vector at W = 1, 2, 4", modelEq("rdec_w"));
  check("cycle accounting closes: header + clear + payload (+ fan-out + settle + flush) + drain = measured cycles for every in-scope run",
    inScope.every((j) => W_LIST.every((W) => { const m = runOf(j, W) as Record<string, number> | undefined; if (!m) return false;
      return j.path === "tdec_w" ? m.c_hdr + m.c_clear + m.c_pay + m.c_drain + 1 === m.cycles : m.c_hdr + m.c_clear + m.c_parse + m.c_starve + m.c_fan + m.c_settle + m.c_flush + m.c_drain + 1 === m.cycles; })));
  check("W = 1 costs at most 4 cycles more than the v0.1.11 / v0.1.12 single-byte decoders on every shared vector (front-end queue latency), and never more payload work",
    inScope.every((j) => { const b = dmap.get(j.key) as { baseline_cycles?: number | null }; const c = runOf(j, 1)?.cycles as number | undefined; return b.baseline_cycles == null || (c !== undefined && c <= b.baseline_cycles + 4); }));
  check("committed comparison and verdict recompute exactly from the committed measurements and synthesis section",
    !!rep?.measured && JSON.stringify(rep.comparison) === JSON.stringify(comparison(rep.measured, rep.synthesis ?? null)));
  check("labels: synthesis section (when present) is an ESTIMATE; throughput is measured cycles × estimated fmax; no energy measured (no pJ figure in the report)",
    (!rep?.synthesis || /ESTIMATE/.test(String(rep.synthesis.label ?? ""))) && /MEASURED in simulation/.test(JSON.stringify(rep?.comparison ?? "")) && !/pJ|picojoule/i.test(JSON.stringify(rep ?? {})));

  // Uncounted: fresh simulation must equal the committed measurements
  if (sim && committed && !WRITE) {
    const same = JSON.stringify(measuredSection(sim.runs)) === JSON.stringify(committed.measured);
    console.log(`${same ? "SIM PASS" : "SIM FAIL"} re-simulated ${jobs.length} jobs × W ∈ {1, 2, 4} (+ gap runs) with ${sim.tools.iverilog}: ${same ? "identical to the committed report" : "DIFFERS from the committed report"}`);
    if (!same) failures.push("simulation differs from committed report");
  }

  // ---------- 8. Table ----------
  if (rep?.measured) {
    console.log("\npath    vector                                 bytes    W=1 cyc   W=2 cyc   W=4 cyc   base cyc  W4 speedup");
    for (const j of inScope) {
      const d = dmap.get(j.key) as { baseline_cycles?: number | null };
      const c = W_LIST.map((W) => runOf(j, W)?.cycles as number);
      console.log(`${j.path.padEnd(7)} ${j.id.padEnd(38)} ${String(j.bytes.length).padStart(6)}  ${c.map((x) => String(x).padStart(8)).join("  ")}  ${String(d.baseline_cycles ?? "-").padStart(8)}  ${(c[0] / c[2]).toFixed(2)}×`);
    }
  }
  if (failures.length) { console.log(`FAIL check-scp-v0113-rtl (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
  console.log(`PASS check-scp-v0113-rtl (${passed} checks)`);
}
main().catch((e) => { console.log(`FAIL check-scp-v0113-rtl (${(e as Error).message})`); process.exit(1); });
