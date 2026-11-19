/** TEST ONLY. 4D-SCP v0.1.16 — temporal-only S4DI v1 ENCODER with a SHORT EMITTER PATH
 * (hw/scp4d/rtl/scp4d_tenc_q.v): v0.1.15's pipelined encoder with the sparse gap carried in the event
 * record (no running-position subtraction in the emitter) and explicit byte / lane selectors in
 * place of variable shifts and `3 * lane` products (which yosys had mapped onto MULT18X18D blocks on
 * the ECP5 critical path). Byte-exact against the v0.1.10 integer model for every v0.1.14 job at the
 * six v0.1.15 configurations, cycle-for-cycle identical to v0.1.15, and a closed encode -> decode
 * loop with the unchanged v0.1.13 scp4d_tdec_w (same W: 2 or 4) in an open-source simulator. The
 * v0.1.14 and v0.1.15 encoder files stay unchanged (sha-pinned).
 *
 * Counted checks are deterministic and need NO simulator (so check-scp-all can pin the count):
 * unchanged pinned artefacts (every v0.1.10..v0.1.15 model, vector, report, RTL, testbench and
 * check), isolation, RTL static rules, the job list, and the committed report: byte-exact for every
 * job and (W, L) at full rate and with random input gaps + output backpressure, error codes for
 * corrupted configurations / inputs, measured cycles == exact cycle model == v0.1.15's measured
 * cycles, closed loop bit-exact, comparison / verdict recompute, labels (synthesis = estimate; no
 * energy measured).
 *
 * Simulator stage (NOT counted): if Icarus Verilog is on PATH or in /opt/eda/oss-cad-suite/bin every
 * run is re-simulated and must equal the committed report. "SKIP sim" without it; --require-sim
 * fails instead; --no-sim forces the skip. Synthesis / place-and-route only with --synth.
 * Writes nothing unless --write (refresh fixtures/scp/v0116-rtl-report.json; needs the simulator;
 * keeps the committed synthesis section unless --synth). Scratch files go to an OS temp dir.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0116-rtl.ts [--no-sim | --require-sim] [--synth] [--write]
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodeQuantized } from "../src/scp/pack";
import { BOUNDED_EPS } from "./scp-v01-fixture";
import { frameFixtures } from "./scp-v019-env-fixture";
import { envTemporalStreams } from "./scp-v0111-rtl-vectors";
import { ENC_MAX_D, composedHeader, encoderJobs, hostHeader, type EncJob } from "./scp-v0114-rtl-model";
import { ENCQ_BQ as ENCP_BQ, ENCQ_CLOSE_EDGES as ENCP_CLOSE_EDGES, ENCQ_CONFIGS as ENC_CONFIGS, LOOPQ_CONFIGS as LOOP_CONFIGS, encqES as encpES, encqMA as encpMA, tencqCycleModel as tencpCycleModel } from "./scp-v0116-rtl-model";

const root = resolve(join(import.meta.dirname, ".."));
const RTL = "hw/scp4d/rtl/scp4d_tenc_q.v";
const TB = "hw/scp4d/tb/scp4d_tenc_q_tb.v";
const TBL = "hw/scp4d/tb/scp4d_loop_q_tb.v";
const WRAP = "hw/scp4d/synth/scp4d_tenc_q_wrap.v";
const DEC = ["hw/scp4d/rtl/scp4d_tdec_w.v", "hw/scp4d/rtl/scp4d_fe_w.v"];
const MODEL = "scripts/scp-v0116-rtl-model.ts";
const REPORT = "fixtures/scp/v0116-rtl-report.json";
const V0115_REPORT = "fixtures/scp/v0115-rtl-report.json";
const V0114_REPORT = "fixtures/scp/v0114-rtl-report.json";
const V0110_VECTORS = "fixtures/scp/golden-vectors-scp4d.json";
const TEMPORAL_VECTORS = "fixtures/scp/golden-vectors-scp4d-temporal.json";
const PINNED: [string, string][] = [
  ["src/scp/pack.ts", "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a"],
  [V0110_VECTORS, "7e8b8165444e0b6f48c01622b2c41e9e035d80fa37b2a14dcd16de30d1e3cfd9"],
  ["fixtures/scp/v0110-int-report.json", "f5a9b42bd97ef3a108ecca656c82d4eabe23d311a4de288a6daab0a6af8c17b0"],
  ["scripts/scp-v0110-int-scp4d.ts", "9bebf5125141559f336a7c6fddf6d867afb50127f0c8758b4e76e1724a869007"],
  ["fixtures/scp/golden-vectors.json", "5b5776c7aca50e4aa151892f4c8315f31560863085c63ddc209334bbe877d175"],
  ["hw/scp4d/rtl/scp4d_fe_w.v", "69164af8e4240dc34a35258addc4750e5a87a7c799c437def28401b830a67dde"],
  ["hw/scp4d/rtl/scp4d_rdec.v", "224f71f8b8b51800d5e6a322cb7ccab6967284a29b07b080bbb89329160551f0"],
  ["hw/scp4d/rtl/scp4d_rdec_w.v", "455b0a335eabe6a0807407fec5306e3eeb17a5e99d55102709f051a0185bd161"],
  ["hw/scp4d/rtl/scp4d_tdec.v", "50065f66c044c3a69492952719655685c0a2d17deb5a8e406dd65c759a2a346b"],
  ["hw/scp4d/rtl/scp4d_tdec_w.v", "3ac1b80ca63cdbd3653c0ee40ba4fcc5b34a902580cb475b9cd319eb518432ab"],
  ["hw/scp4d/tb/scp4d_tb.v", "fe0ad1afc04aab39b032dd7d8f8f038df1b0c4309d34fa859da9caf4a6f3c4dc"],
  ["hw/scp4d/tb/scp4d_rdec_tb.v", "edd199dd7a1505193f7dfc7afc8cb6d7a768abbedae9c4c3d816f2bf48cfa289"],
  ["hw/scp4d/tb/scp4d_tdec_w_tb.v", "f154733a1627b093bc261932be37e666d81c33ea079f4e7b94c541635d23f38b"],
  ["hw/scp4d/tb/scp4d_rdec_w_tb.v", "f6d6bb00f65b71e168a45eb4f12aba1adc9b7406e4d810e61dbfd17151571985"],
  ["hw/scp4d/synth/synth.ys", "35c86f9af81e4b3d436ad6e5eaafca566301bf4e83f4e95117683765279aed83"],
  ["hw/scp4d/synth/synth_rdec.ys", "8eae149c2c3f7290e2140c28e25e4dce436873f93e133caa1ccddc4a927160e2"],
  ["hw/scp4d/synth/scp4d_pnr_wrap.v", "e64d823668048943ba03757b91d0db3ac27abdc36d0fb611d826b78333915354"],
  ["fixtures/scp/v0111-rtl-report.json", "2768f102678435b6a4c56bcd6be10635a33dd78bdb10685e94b828a052ec83a7"],
  ["fixtures/scp/v0112-rtl-report.json", "55996083a5c4b13407c905a0c480b280727e3c019a346575dfe034531f7cbc79"],
  ["fixtures/scp/v0113-rtl-report.json", "429bd2b0af4a2fe68eca68abd817a81f6ca87ef705e056820337d70fc686e00c"],
  [TEMPORAL_VECTORS, "11159272c519e7d77e885a239a5487b5003ed4ca4cfa478dff04e2bbf049d53a"],
  ["fixtures/scp/golden-vectors-scp4d-relations.json", "ce242dd4d961b430365f14961ea7ae3077d6d425a45755be866f55d9def43761"],
  ["scripts/scp-v0111-rtl-vectors.ts", "adc608330e4c244ab93bba94fa0877106bbd6ef7ae7c18bfbc2783138ec5aff3"],
  ["scripts/scp-v0112-rtl-vectors.ts", "40a1f63ccdb4ce988cb3f8d6fef4bdd3cd05e38aa202e25e54520b817e68d507"],
  ["scripts/scp-v0113-rtl-model.ts", "684ecdd8722fe236367a1392b6de61a198d0e12e02860b5cf84736567f452765"],
  ["scripts/check-scp-v0111-rtl.ts", "c64cb6ef2b71c14cff115925b90b56c59ce9e112ffa3cbcf1adf47429423998c"],
  ["scripts/check-scp-v0112-rtl.ts", "29f9c47b197b39665099949be6fe9538a806816accb2880949b1f4beb08d2bc2"],
  ["scripts/check-scp-v0113-rtl.ts", "7d3482aebacd4c12373d6e6f11e4843a6bad5c0aac77f981bd63605ff4b542ca"],
  ["hw/scp4d/rtl/scp4d_tenc_w.v", "e4901fcb0b646009c555fb65bfaa4cd3648ecc571238befc7dba7e6560661763"],
  ["hw/scp4d/tb/scp4d_tenc_w_tb.v", "916e5b9ea6f837e42f74e298d726902abe6d3158c7bd6d32d056194cf09d7bd8"],
  ["hw/scp4d/tb/scp4d_loop_tb.v", "d1541aecd15490976096c7df88c35b863dd3a175f6ddcfe6ae8d724ad97ddfc8"],
  ["hw/scp4d/synth/scp4d_tenc_wrap.v", "67f52a88e589ad9766fd5ddbcb31e8b43e53ac8d687d7871da667a82501cc4f7"],
  ["scripts/scp-v0114-rtl-model.ts", "8e6d221c558f976e2cd78147be6bf4adbdf25d571b01a63f0f58f80a0c8cbf88"],
  ["scripts/check-scp-v0114-rtl.ts", "c6bef9c67d1c17de0d77dc300b957b7986d695949c45933d0150c94c4b8182e9"],
  [V0114_REPORT, "23d487064a0f27f32251b620fb4f03740327a77e59b68b09f1fe5678ad642a73"],
  ["hw/scp4d/rtl/scp4d_tenc_p.v", "74aa4f10348fa9582c2fbc564e946321ff765ab0038d9493e9ca8902c1dc9b41"],
  ["hw/scp4d/tb/scp4d_tenc_p_tb.v", "df3d0524ecf5ccda1aac30ba03588a01a35487b72dbf6f90887fdf0d9d982573"],
  ["hw/scp4d/tb/scp4d_loop_p_tb.v", "1ce85732bc46ea3acf8e34334c203829c5aa12af3f9d3acdbc73e053784091a0"],
  ["hw/scp4d/synth/scp4d_tenc_p_wrap.v", "337bd014808a49b289b8a5f1d5e8a8f78f7c22559988e1512cba7c236bb21087"],
  ["scripts/scp-v0115-rtl-model.ts", "cdd9b681b0ec68b01f68c721a538089d2b5170f3448cbc8abe486dfac14918d8"],
  ["scripts/check-scp-v0115-rtl.ts", "9d9bfabed40e3e9f2e0b935b96d1d6bb2bbad2819f67846114bc4a88673433a3"],
  [V0115_REPORT, "97bdfd9b26cf2ad8f02e633c10fc3876c5e1412624ee3f9583d26c8d69e33dc4"],
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
const cfgKey = (c: { W: number; L: number }) => `W${c.W}L${c.L}`;
const PRED = ["zero", "last", "linear"];

// ---------- 1. Unchanged artefacts ----------
{
  const bad = PINNED.filter(([p, h]) => !existsSync(join(root, p)) || sha(read(p)) !== h).map(([p]) => p);
  check(`pack.ts, every v0.1.8 / v0.1.10 model, vector and report, and every v0.1.11 / v0.1.12 / v0.1.13 / v0.1.14 / v0.1.15 RTL file, testbench, synthesis script / wrapper, vector file, report, model, generator and check unchanged (${PINNED.length} files sha-pinned)`, bad.length === 0, bad.join(", ") || "all match");
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
      if (/scp-v011[456]/.test(t)) importers.push(rel);
      if (/["'][^"']*hw\/scp4d/.test(t)) hwRefs.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.14 / v0.1.15 / v0.1.16 scripts; hw/ holds no TS/JS and no app code references hw/scp4d", importers.length === 0 && tsInHw.length === 0 && hwRefs.length === 0, [...importers, ...tsInHw, ...hwRefs].join(", ") || "none");
  const m = stripTs(read(MODEL).toString());
  check("job / cycle model is pure: no I/O, env, clocks, randomness, hashing, Level 4 or app imports",
    !/node:fs|node:child_process|process\.env|Date\.now|Math\.random|createHash|node:crypto|level4|src\/app|metamorphic/i.test(m));
}

// ---------- 3. RTL static rules ----------
// `*` between non-literal operands outside (local)parameter declarations: products with an integer
// literal (bit-slice strides such as 32*b) are elaboration-time constants, not multipliers.
function varMuls(src: string): string[] {
  return src.split("\n").filter((l) => !/^\s*(localparam|parameter)\b/.test(l))
    .flatMap((l) => l.replace(/\(\*\)/g, "").match(/[^*/(\s\d]\s*\*\s*[^*/)\s\d]/g) ?? []);
}
const rtl = existsSync(join(root, RTL)) ? read(RTL).toString() : "";
{
  const c = stripV(rtl);
  check("RTL present: scp4d_tenc_q, one module, `default_nettype none, parameters W = 4, L = 8, ADDR_W = 11; v0.1.15 pipeline kept (S1r, S1a / S1b, S2a / S2b, BQ = 32, two sparse events per cycle at W = 4)",
    /module\s+scp4d_tenc_q\b/.test(c) && (c.match(/\bmodule\b/g) ?? []).length === 1 && /`default_nettype none/.test(c)
    && /parameter integer W\s+= 4\b/.test(c) && /parameter integer L\s+= 8\b/.test(c) && /parameter integer ADDR_W = 11\b/.test(c)
    && /localparam integer BQ = 32;/.test(c) && /localparam integer ES = \(W >= 4\) \? 2 : 1;/.test(c) && /a1_h1 <= n_h1/.test(c) && /b1_pr <= a_pr/.test(c) && /p2_q <= qst/.test(c)
    && ENCP_BQ === 32 && encpES(4) === 2 && encpMA(4) === 20 && ENCP_CLOSE_EDGES === 7);
  check("short emitter path: the record carries the first-event gap and the event count (written from S2b); FIFO pop / same-record decisions come from the counts (no `m3 == 0` / `m2 != 0` lane-pick chain); no running position (e_pp) in the emitter, no shift by a non-constant amount, no `3 *` product (lengths at a 4-bit stride)",
    /recm\[\{p2_half, nr2\[GA-1:0\]\}\] <= \{p2_g\[GA-1:0\], p2_cnt, p2_ev, big, gap, p2_ql, p2_q\}/.test(c) && /wire\s+same2 = \(ecnt > 1\);/.test(c) && /f_pop = m3z \?/.test(c) && !/m3 == 0|m2 != 0/.test(c) && !/\be_pp\b/.test(c) && !/<<\s*\{/.test(c)
    && !/\b3\s*\*\s*[A-Za-z_(]/.test(c) && /QL \+ 4\*k/.test(c));
  const all = [rtl, existsSync(join(root, WRAP)) ? read(WRAP).toString() : ""].map(stripV).join("\n");
  const banned = all.match(/\binitial\b|\$(?!signed\b|unsigned\b)\w+|\breal\b|\brealtime\b|\bshortreal\b|\bfork\b|#\s*\d/g) ?? [];
  const divs = all.split("\n").filter((l) => !/^\s*`/.test(l) && /[^/]\/[^/]|%/.test(l.replace(/"[^"]*"/g, "")));
  check("encoder RTL + P&R wrapper: synthesizable subset (no initial, system tasks other than $signed / $unsigned, real, fork, delays), no division or modulo, no multiplier in the per-element datapath (the only `*` is the configuration-time shape product)",
    banned.length === 0 && divs.length === 0 && varMuls(c).length === 1 && /mul_p = mul_a \* mul_b/.test(c), JSON.stringify(banned) + divs.join(" | ").slice(0, 200));
  check("encoder error codes declared (1 D, 2 T, 3 G, 4 predictor, 5 times/meta length, 6 overflow, 7 beat, 8 header beat) and the fixed header fields are written by the RTL (magic 'S4DI', version 1, FW 16)",
    /E_D = 5'd1, E_T = 5'd2, E_G = 5'd3, E_PRED = 5'd4, E_TM = 5'd5, E_OVF = 5'd6, E_BEAT = 5'd7, E_HDR = 5'd8/.test(c) && /8'd1, 8'h49, 8'h44, 8'h34, 8'h53/.test(c) && /8'd16/.test(c));
}

// ---------- 4. Job list ----------
const v0110 = JSON.parse(read(V0110_VECTORS).toString());
const tvf = JSON.parse(read(TEMPORAL_VECTORS).toString());
const { jobs, nativeMismatch } = encoderJobs(v0110, tvf);
const envT = envTemporalStreams();
{
  const natives = jobs.filter((j) => j.native);
  const envOk = envT.every((s) => { const j = jobs.find((x) => x.id === s.id); return !!j && sha(j.bytes) === sha(s.bytes); });
  check(`job list: ${jobs.length} encoder jobs (${natives.length} native golden configurations + ${jobs.length - natives.length} model-encoded predictor / G variants); every native job reproduces its committed golden bytes; env T64 / T256 equal envTemporalStreams (v0.1.10 report streams)`,
    jobs.length === 18 && natives.length === 7 && nativeMismatch.length === 0 && envOk && new Set(jobs.map((j) => j.id)).size === jobs.length, nativeMismatch.join(", ") || `${natives.map((j) => j.id).join(", ")}`);
  check("for every job: RTL-written header fields + host segments (eps bits, times / meta) == the model's header bytes (through the layout byte)",
    jobs.every((j) => Buffer.from(composedHeader(j)).equals(Buffer.from(j.bytes.slice(0, j.header_bytes + 1)))));
  check("for every job: model reconstruction within the deadband of the input code (|x − c| ≤ 2^G − 1) and every code / q fits signed 32 bits; D ≤ 2048",
    jobs.every((j) => j.D <= ENC_MAX_D && j.codes.every((f, t) => f.every((x, e) => Math.abs(x - j.decoded[t][e]) <= 2 ** j.cfg.G - 1 && Math.abs(j.decoded[t][e]) < 2 ** 31))));
}

// ---------- 5. Sim inputs, negatives, derived facts ----------
const hx = (b: ArrayLike<number>) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("\n") + "\n";
const w32 = (v: number) => ((v < 0 ? v + 2 ** 32 : v) >>> 0).toString(16).padStart(8, "0");
type Files = { stream: string; codes: string; hdr: string; dec: string };
type SimJob = { key: string; id: string; files: Files; args: Record<string, number>; nbytes: number; expect_err: number; flags: string[] };
const filesOf = (j: EncJob): Files => {
  const h = hostHeader(j);
  return { stream: hx(j.bytes), codes: j.codes.flatMap((f) => f.map(w32)).join("\n") + "\n", hdr: hx([...h.eps, ...h.tm]), dec: j.decoded.flatMap((f) => f.map(w32)).join("\n") + "\n" };
};
const argsOf = (j: EncJob): Record<string, number> => {
  const h = hostHeader(j);
  return { nx: j.shape.nx, ny: j.shape.ny, nz: j.shape.nz, c: j.shape.channels, t: j.T, g: j.cfg.G, pred: PRED.indexOf(j.cfg.predictor), tmlen: h.tm.length, nhdr: h.eps.length + h.tm.length };
};
const simJobs: SimJob[] = jobs.map((j) => ({ key: j.id, id: j.id, files: filesOf(j), args: argsOf(j), nbytes: j.bytes.length, expect_err: 0, flags: [] }));
const negatives: SimJob[] = [];
{
  const base = jobs.find((j) => j.id === "env-4x4x1-T8-temporal-last")!;
  const f = filesOf(base), a = argsOf(base);
  const neg = (id: string, over: Record<string, number>, errc: number, flags: string[] = [], files: Files = f) => negatives.push({ key: `neg:${id}`, id, files, args: { ...a, ...over }, nbytes: 0, expect_err: errc, flags });
  neg("neg-cfg-D0", { nx: 0 }, 1);
  neg("neg-cfg-D-too-big", { nx: 64, ny: 64 }, 1);
  neg("neg-cfg-T0", { t: 0 }, 2);
  neg("neg-cfg-G17", { g: 17 }, 3);
  neg("neg-cfg-predictor-3", { pred: 3 }, 4);
  neg("neg-cfg-times-meta-short", { tmlen: base.T }, 5);
  neg("neg-input-beat-lanes", {}, 7, ["+beat_err=1"]);
  neg("neg-host-header-empty-beat", {}, 8, ["+hdr_zero=1"]);
  // register overflow: x = 2^31 − 1 at G = 8 reconstructs to 2^31 (leaves signed 32 bits)
  const ov: Pick<EncJob, "eps" | "times" | "meta"> = { eps: [0.01], times: [0, 1], meta: null };
  const oh = hostHeader(ov);
  neg("neg-overflow-reconstruction", { nx: 1, ny: 1, nz: 1, c: 1, t: 2, g: 8, pred: 1, tmlen: oh.tm.length, nhdr: oh.eps.length + oh.tm.length }, 6, [],
    { stream: "00\n", codes: [2 ** 31 - 1, 0].map(w32).join("\n") + "\n", hdr: hx([...oh.eps, ...oh.tm]), dec: "00000000\n" });
}
const derived = jobs.map((j) => {
  const f = filesOf(j), a = argsOf(j);
  const dense = j.perFrame.filter((p) => p.dense).length, events = j.perFrame.reduce((s, p) => s + p.positions.length, 0);
  return {
    id: j.id, source: j.source, native: j.native, label: j.label, T: j.T, D: j.D, element_frames: j.T * j.D, predictor: j.cfg.predictor, G: j.cfg.G,
    bytes: j.bytes.length, bytes_sha256: sha(j.bytes), header_bytes: j.header_bytes + 1, host_header_bytes: a.nhdr, events, dense_frames: dense, sparse_frames: j.T - dense,
    sim_inputs_sha256: sha(f.stream + f.codes + f.hdr + f.dec + JSON.stringify(a)),
    v0110_encode_ops: j.encode_ops_total, v0110_encode_ops_per_value: r4(j.encode_ops_total / (j.T * j.D)),
    model: Object.fromEntries(ENC_CONFIGS.map((c) => { const m = tencpCycleModel(j, c.W, c.L, 8 * j.shape.channels, a.tmlen);
      return [cfgKey(c), { ...m, input_bound_cycles: j.T * Math.ceil(j.D / c.L), output_bound_cycles: Math.ceil(j.bytes.length / c.W) }]; })),
  };
});
const negDerived = negatives.map((n) => ({ id: n.id, expect_err_code: n.expect_err, args: n.args, flags: n.flags, sim_inputs_sha256: sha(n.files.stream + n.files.codes + n.files.hdr + JSON.stringify(n.args) + n.flags.join(" ")) }));

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
  const dir = mkdtempSync(join(tmpdir(), "scp4d-encq-sim-"));
  try {
    for (const c of ENC_CONFIGS) {
      const r = spawnSync(iverilog, ["-g2012", "-Wall", `-Pscp4d_tenc_q_tb.W=${c.W}`, `-Pscp4d_tenc_q_tb.L=${c.L}`, "-o", join(dir, `enc-${cfgKey(c)}.vvp`), join(root, TB), join(root, RTL)], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`iverilog failed: ${r.stderr}`);
    }
    for (const c of LOOP_CONFIGS) {
      const r = spawnSync(iverilog, ["-g2012", "-Wall", `-Pscp4d_loop_q_tb.W=${c.W}`, `-Pscp4d_loop_q_tb.L=${c.L}`, "-o", join(dir, `loop-${cfgKey(c)}.vvp`), join(root, TBL), join(root, RTL), ...DEC.map((d) => join(root, d))], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`iverilog failed: ${r.stderr}`);
    }
    const tasks: (() => Promise<[string, SimResult]>)[] = [];
    [...simJobs, ...negatives].forEach((s, n) => {
      const p = (k: string) => join(dir, `${n}.${k}.hex`);
      for (const k of ["stream", "codes", "hdr", "dec"] as const) writeFileSync(p(k), s.files[k]);
      const common = [`+stream=${p("stream")}`, `+codes=${p("codes")}`, `+hdr=${p("hdr")}`, ...Object.entries(s.args).map(([k, v]) => `+${k}=${v}`), `+id=${s.id}`];
      const isNeg = s.expect_err !== 0;
      for (const c of ENC_CONFIGS) for (const gb of isNeg ? [0] : [0, 1]) {
        const args = [join(dir, `enc-${cfgKey(c)}.vvp`), `+nbytes=${s.nbytes}`, ...common, `+expect_err=${s.expect_err}`, `+gaps=${gb}`, `+bp=${gb}`, ...s.flags];
        tasks.push(async () => { const r = await run(vvp, ["-n", ...args]); return [`enc|${s.key}|${cfgKey(c)}|${gb}`, parseResult(r.out)]; });
      }
      if (!isNeg) for (const c of LOOP_CONFIGS) for (const gb of [0, 1]) {
        const args = [join(dir, `loop-${cfgKey(c)}.vvp`), `+nbytes=${s.nbytes}`, ...common, `+dec=${p("dec")}`, `+gaps=${gb}`];
        tasks.push(async () => { const r = await run(vvp, ["-n", ...args]); return [`loop|${s.key}|${cfgKey(c)}|${gb}`, parseResult(r.out)]; });
      }
    });
    const res = await pool(tasks, NPAR);
    return { runs: new Map(res), tools: { iverilog: firstLine(iverilog, ["-V"]), vvp: firstLine(vvp, ["-V"]) } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- synthesis (--synth only) ----------
type Cells = { num_cells: number; by_type: Record<string, number> };
type Pnr = { device: string; seed: number; fits: boolean; fmax_mhz?: Record<string, number>; utilization?: Record<string, string>; error?: string };
const SYN_CONFIGS: { name: string; wrap: string; params: string; small: string }[] = [
  ...ENC_CONFIGS.map((c) => ({ name: `scp4d_tenc_q W=${c.W} L=${c.L}`, wrap: "wrap_tenc_q", params: `-set W ${c.W} -set L ${c.L}`, small: "-set A 9" })),
  ...[{ W: 2, L: 8 }, { W: 4, L: 8 }].map((c) => ({ name: `loop tenc_q W=${c.W} L=${c.L} -> tdec_w W=${c.W}`, wrap: "wrap_loop_q", params: `-set W ${c.W} -set L ${c.L}`, small: "-set A 9" })),
];
const PNR_TIMEOUT_S = 1500;
async function runSynth(): Promise<Record<string, unknown>> {
  const yosys = findBin("yosys"), np40 = findBin("nextpnr-ice40"), np5 = findBin("nextpnr-ecp5");
  if (!yosys) throw new Error("--synth needs yosys");
  const dir = mkdtempSync(join(tmpdir(), "scp4d-encq-synth-"));
  const files = [RTL, ...DEC, "hw/scp4d/synth/scp4d_pnr_wrap.v", WRAP].map((f) => join(root, f)).join(" ");
  const cells = (f: string): Cells => {
    const j = JSON.parse(readFileSync(f, "utf8")) as { design?: { num_cells: number; num_cells_by_type: Record<string, number> } };
    const d = j.design!;
    return { num_cells: d.num_cells, by_type: Object.fromEntries(Object.entries(d.num_cells_by_type).filter(([k]) => !k.startsWith("$")).sort(([a], [b]) => a.localeCompare(b))) };
  };
  const pnrOf = async (bin: string | null, args: string[], device: string, wd: string): Promise<Pnr | { skipped: string }> => {
    if (!bin) return { skipped: "place-and-route tool not found" };
    const r = await run("timeout", [String(PNR_TIMEOUT_S), bin, ...args, "--seed", "1", "--report", join(wd, "pnr.json")], wd);
    if (r.status === 124) return { skipped: `not run to completion: place-and-route exceeded the ${PNR_TIMEOUT_S} s bound` };
    if (r.status !== 0) return { device, seed: 1, fits: false, error: (r.out.match(/ERROR: [^\n]*/) ?? ["unknown error"])[0] };
    const rep = JSON.parse(readFileSync(join(wd, "pnr.json"), "utf8")) as { fmax: Record<string, { achieved: number }>; utilization: Record<string, { used: number; available: number }> };
    return { device, seed: 1, fits: true, fmax_mhz: Object.fromEntries(Object.entries(rep.fmax).map(([k, v]) => [k.replace(/\$glbnet\$|\$TRELLIS_IO_IN|\$SB_IO_IN/g, ""), r2(v.achieved)])),
      utilization: Object.fromEntries(Object.entries(rep.utilization).filter(([k, v]) => v.used > 0 && !["GND", "VCC"].includes(k)).map(([k, v]) => [k, `${v.used}/${v.available}`])) };
  };
  try {
    const tasks = SYN_CONFIGS.flatMap((c, n) => (["ecp5", "ice40", "xc7"] as const).map((dev) => async () => {
      const wd = join(dir, `${n}-${dev}`); spawnSync("mkdir", ["-p", wd]);
      const ch = `chparam ${c.params}${dev === "ice40" ? ` ${c.small}` : ""} ${c.wrap}; `;
      const synth = dev === "ecp5" ? `synth_ecp5 -top ${c.wrap} -json n.json` : dev === "ice40" ? `synth_ice40 -top ${c.wrap} -json n.json` : `synth_xilinx -top ${c.wrap} -family xc7`;
      const y = await run(yosys, ["-q", "-l", join(wd, "y.log"), "-p", `read_verilog ${files}; ${ch}hierarchy -top ${c.wrap}; ${synth}; tee -q -o stat.json stat -json`], wd);
      if (y.status !== 0) throw new Error(`yosys failed (${c.name} ${dev}): ${y.out.slice(-800)}`);
      const st = cells(join(wd, "stat.json"));
      const pr = dev === "ecp5" ? await pnrOf(np5, ["--45k", "--package", "CABGA381", "--json", join(wd, "n.json"), "--lpf-allow-unconstrained", "--freq", "12"], "ECP5 LFE5U-45F (CABGA381)", wd)
        : dev === "ice40" ? await pnrOf(np40, ["--hx8k", "--package", "ct256", "--json", join(wd, "n.json"), "--pcf-allow-unconstrained", "--freq", "12"], "iCE40-HX8K (ct256)", wd) : null;
      return [c.name, dev, { synth: st, ...(pr ? { place_and_route: pr } : {}) }] as const;
    }));
    const res = await pool(tasks, Math.max(1, Math.min(6, cpus().length)));
    const by: Record<string, Record<string, unknown>> = {};
    for (const [name, dev, v] of res) (by[name] ??= {})[dev === "ice40" ? "ice40_hx8k_addr_w9" : dev === "ecp5" ? "ecp5_45f_full_params" : "xc7_full_params"] = v;
    return {
      label: "SYNTHESIS / PLACE-AND-ROUTE ESTIMATES from open-source tools (one seed, --freq 12 target). Not a programmed-FPGA or silicon measurement; no board was used. xc7: yosys cell counts only (no open-source timing).",
      wrapper: `${WRAP}: configuration through a 1-bit shift register, the L x 32-bit code input through a 32-bit pin bus shifted into an L-word register, outputs registered and XOR-folded to 16 pins (scp4d_fold16 from hw/scp4d/synth/scp4d_pnr_wrap.v). The same wrapper logic is added to every configuration.`,
      parameters: { full: "ADDR_W 11 (D <= 2048)", ice40_small: "ADDR_W 9 (D <= 512)" },
      tools: { yosys: firstLine(yosys, ["-V"]), nextpnr_ecp5: firstLine(np5, ["--version"]), nextpnr_ice40: firstLine(np40, ["--version"]) },
      configs: by,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- 7. Measured section, comparison, report ----------
const MEAS_E = ["ok", "done", "err", "err_code", "out_bytes", "mismatches", "first_bad", "cycles", "beats_in", "beats_out", "first_in", "last_in", "first_out", "last_out", "in_stall", "timeout"] as const;
const MEAS_L = ["ok", "enc_done", "enc_err", "dec_done", "dec_err", "stream_bytes", "consumed", "frames", "cycles", "enc_done_cycle", "enc_last_out", "first_in", "last_in", "first_dec", "lat_min", "lat_max", "lat_sum", "mismatches", "eps_violations", "timeout"] as const;
function measuredSection(runs: Map<string, SimResult>) {
  const pick = (r: SimResult | undefined, keys: readonly string[]) => (r ? Object.fromEntries(keys.map((k) => [k, r[k] as number])) : null);
  return {
    encoder: jobs.map((j) => ({ id: j.id, ...Object.fromEntries(ENC_CONFIGS.map((c) => { const r = runs.get(`enc|${j.id}|${cfgKey(c)}|0`), g = runs.get(`enc|${j.id}|${cfgKey(c)}|1`);
      return [cfgKey(c), { ...pick(r, MEAS_E), cycles_per_value: r ? r4((r.cycles as number) / (j.T * j.D)) : null,
        gaps_backpressure_run: g ? { ok: g.ok as number, cycles: g.cycles as number, mismatches: g.mismatches as number, out_bytes: g.out_bytes as number, in_gap: g.in_gap as number, bp_cycles: g.bp_cycles as number } : null }]; })) })),
    negatives: negatives.map((n) => ({ id: n.id, ...Object.fromEntries(ENC_CONFIGS.map((c) => { const r = runs.get(`enc|${n.key}|${cfgKey(c)}|0`); return [cfgKey(c), pick(r, ["ok", "err", "done", "err_code", "out_bytes", "cycles"])]; })) })),
    loop: jobs.map((j) => ({ id: j.id, ...Object.fromEntries(LOOP_CONFIGS.map((c) => { const r = runs.get(`loop|${j.id}|${cfgKey(c)}|0`), g = runs.get(`loop|${j.id}|${cfgKey(c)}|1`);
      return [cfgKey(c), { ...pick(r, MEAS_L), gaps_run: g ? { ok: g.ok as number, cycles: g.cycles as number, mismatches: g.mismatches as number, eps_violations: g.eps_violations as number } : null }]; })) })),
  };
}
type Meas = ReturnType<typeof measuredSection>;
const fmaxOf = (p: unknown): number | null => { const f = (p as { fmax_mhz?: Record<string, number> } | undefined)?.fmax_mhz; return f ? Math.min(...Object.values(f)) : null; };
const devOf = (synth: Record<string, unknown> | null, name: string, dev: string) => (synth?.configs as Record<string, Record<string, { synth: Cells; place_and_route?: Pnr }>> | undefined)?.[name]?.[dev];
const ecp5 = (synth: Record<string, unknown> | null, name: string) => {
  const c = devOf(synth, name, "ecp5_45f_full_params");
  if (!c?.place_and_route?.utilization) return null;
  const u = c.place_and_route.utilization;
  return { fmax_mhz: fmaxOf(c.place_and_route), lut4: Number((u.TRELLIS_COMB ?? "0/0").split("/")[0]), ff: Number((u.TRELLIS_FF ?? "0/0").split("/")[0]), ebr: Number((u.DP16KD ?? "0/0").split("/")[0]), dsp: Number((u.MULT18X18D ?? "0/0").split("/")[0]) };
};
const V0113 = JSON.parse(read("fixtures/scp/v0113-rtl-report.json").toString());
const V0115 = JSON.parse(read(V0115_REPORT).toString());
type Tp = { fmax_mhz_estimate: number; values_per_s: number } | null;
/** Comparison + verdict, computed only from the committed measurements, derived facts, the v0.1.13 decoder report, the v0.1.14 encoder report and synthesis estimates. */
function comparison(m: Meas, synth: Record<string, unknown> | null) {
  const D = new Map(derived.map((d) => [d.id, d]));
  const E = new Map(m.encoder.map((e) => [e.id, e as unknown as Record<string, { cycles: number }>]));
  const Lp = new Map(m.loop.map((e) => [e.id, e as unknown as Record<string, Record<string, number>>]));
  const dec = (V0113.comparison.temporal_only as { stream: string; by_W: Record<string, { cycles: number; throughput_ecp5: Tp }> }[]);
  const old = (V0115.comparison.env as { stream: string; encoder: Record<string, { cycles: number; throughput_ecp5: Tp }> }[]);
  const streams = ["env-16x16x2-T64-temporal-last", "env-16x16x2-T256-temporal-last"];
  const rows = streams.map((sid) => {
    const d = D.get(sid)!, dB = dec.find((x) => x.stream === sid)!.by_W, o = old.find((x) => x.stream === sid)!.encoder;
    const decOf = (w: number) => { const x = dB[`W${w}`]; return { cycles: x.cycles, cycles_per_value: r4(x.cycles / d.element_frames), fmax_mhz_estimate: x.throughput_ecp5?.fmax_mhz_estimate ?? null, values_per_s: x.throughput_ecp5?.values_per_s ?? null }; };
    const dW2 = decOf(2), dW4 = decOf(4);
    const v0115Best = Object.entries(o).map(([k, v]) => ({ config: k, cycles: v.cycles, values_per_s: v.throughput_ecp5?.values_per_s ?? null, fmax_mhz_estimate: v.throughput_ecp5?.fmax_mhz_estimate ?? null }))
      .reduce((best, x) => ((x.values_per_s ?? 0) > (best.values_per_s ?? 0) ? x : best));
    return { stream: sid, bytes: d.bytes, element_frames: d.element_frames,
      decoder_W2: { ...dW2, source: "fixtures/scp/v0113-rtl-report.json (v0.1.13 scp4d_tdec_w W = 2, measured cycles × estimated fmax)" },
      decoder_W4: { ...dW4, source: "fixtures/scp/v0113-rtl-report.json (v0.1.13 scp4d_tdec_w W = 4, measured cycles × estimated fmax)" },
      v0115_encoder_best: { ...v0115Best, source: "fixtures/scp/v0115-rtl-report.json (v0.1.15 scp4d_tenc_p, measured cycles × estimated fmax)" },
      encoder: Object.fromEntries(ENC_CONFIGS.map((c) => { const k = cfgKey(c), cyc = E.get(sid)![k].cycles, mod = d.model[k], e = ecp5(synth, `scp4d_tenc_q W=${c.W} L=${c.L}`);
        const vps = e?.fmax_mhz ? Math.round((d.element_frames / cyc) * e.fmax_mhz * 1e6) : null;
        const prev = o[k] ?? null;
        return [k, { cycles: cyc, cycles_per_value: r4(cyc / d.element_frames), values_per_cycle: r4(d.element_frames / cyc), bytes_per_cycle: r4(d.bytes / cyc),
          input_bound_cycles: mod.input_bound_cycles, output_bound_cycles: mod.output_bound_cycles,
          bound: mod.input_bound_cycles >= mod.output_bound_cycles ? "input (codes / cycle)" : "output (bytes / cycle)",
          over_max_bound: r4(cyc / Math.max(mod.input_bound_cycles, mod.output_bound_cycles)),
          cycle_ratio_vs_decoder_W2: r4(cyc / dW2.cycles),
          v0115_same_config: prev ? { cycles: prev.cycles, cycle_speedup: r4(prev.cycles / cyc), fmax_mhz_estimate: prev.throughput_ecp5?.fmax_mhz_estimate ?? null, values_per_s: prev.throughput_ecp5?.values_per_s ?? null } : null,
          throughput_ecp5: e?.fmax_mhz ? { fmax_mhz_estimate: e.fmax_mhz, lut4: e.lut4, ff: e.ff, ebr: e.ebr, values_per_s: vps, stream_MB_per_s: r2((d.bytes / cyc) * e.fmax_mhz),
            keeps_up_with_decoder_W2: dW2.values_per_s !== null && vps !== null ? vps >= dW2.values_per_s : null, ratio_vs_decoder_W2: dW2.values_per_s && vps ? r4(vps / dW2.values_per_s) : null,
            keeps_up_with_decoder_W4: dW4.values_per_s !== null && vps !== null ? vps >= dW4.values_per_s : null, ratio_vs_decoder_W4: dW4.values_per_s && vps ? r4(vps / dW4.values_per_s) : null,
            ratio_vs_v0115_same_config: prev?.throughput_ecp5?.values_per_s && vps ? r4(vps / prev.throughput_ecp5.values_per_s) : null } : null }]; })),
      loop: Object.fromEntries(LOOP_CONFIGS.map((c) => { const k = cfgKey(c), l = Lp.get(sid)![k], encAlone = E.get(sid)![k].cycles, dd = c.W === 4 ? dW4 : dW2, e = ecp5(synth, `loop tenc_q W=${c.W} L=${c.L} -> tdec_w W=${c.W}`);
        return [k, { decoder: `scp4d_tdec_w W = ${c.W}`, end_to_end_cycles: l.cycles, encoder_standalone_cycles: encAlone, decoder_standalone_cycles: dd.cycles, loop_over_max_standalone: r4(l.cycles / Math.max(encAlone, dd.cycles)),
          drain_after_encoder_cycles: l.cycles - l.enc_last_out, first_decoded_cycle: l.first_dec, frame_latency_cycles: { min: l.lat_min, max: l.lat_max, mean: r2(l.lat_sum / d.T) },
          values_per_cycle: r4(d.element_frames / l.cycles),
          throughput_ecp5: e?.fmax_mhz ? { fmax_mhz_estimate: e.fmax_mhz, values_per_s: Math.round((d.element_frames / l.cycles) * e.fmax_mhz * 1e6), microseconds: r2(l.cycles / e.fmax_mhz) } : null }]; })) };
  });
  type Enc = { cycles: number; bound: string; over_max_bound: number; cycle_ratio_vs_decoder_W2: number; v0115_same_config: { cycles: number; cycle_speedup: number } | null;
    throughput_ecp5: { fmax_mhz_estimate: number; lut4: number; values_per_s: number; keeps_up_with_decoder_W2: boolean | null; ratio_vs_decoder_W2: number | null; keeps_up_with_decoder_W4: boolean | null; ratio_vs_decoder_W4: number | null; ratio_vs_v0115_same_config: number | null } | null };
  const t64 = rows[0], enc = t64.encoder as unknown as Record<string, Enc>;
  const e48 = enc.W4L8, e44 = enc.W4L4, e28 = enc.W2L8;
  const lp48 = t64.loop.W4L8 as { end_to_end_cycles: number; loop_over_max_standalone: number; throughput_ecp5: { values_per_s: number; fmax_mhz_estimate: number } | null };
  const keeps = (x: Enc) => x.throughput_ecp5?.keeps_up_with_decoder_W2 ?? null;
  const keepers = ENC_CONFIGS.filter((c) => keeps(enc[cfgKey(c)]) === true).map(cfgKey);
  const tp = (x: Enc) => x.throughput_ecp5 ? `${x.throughput_ecp5.fmax_mhz_estimate} MHz est. → ${r2(x.throughput_ecp5.values_per_s / 1e6)} M values/s = ${x.throughput_ecp5.ratio_vs_decoder_W2}× the W = 2 decoder` : "no synthesis estimate";
  return {
    label: "Cycles are MEASURED in simulation (Icarus Verilog) and equal the exact cycle model (full rate); fmax, LUT/FF/RAM are SYNTHESIS ESTIMATES (one seed, no board); throughput = measured cycles × estimated fmax. No energy was measured.",
    env: rows,
    verdict: {
      keeps_up: e48.throughput_ecp5
        ? `${keepers.length ? `Yes, at ${keepers.join(", ")}` : "No configuration"} keeps up with the v0.1.13 W = 2 decoder (${t64.decoder_W2.values_per_s !== null ? r2(t64.decoder_W2.values_per_s / 1e6) : "?"} M values/s) on env T64 (wall clock = measured cycles × ECP5 fmax estimate). W = 4, L = 8: ${e48.cycles} cycles (${e48.cycle_ratio_vs_decoder_W2}× the W = 2 decoder's ${t64.decoder_W2.cycles}), ${tp(e48)}; W = 4, L = 4: ${e44.cycles} cycles, ${tp(e44)}; W = 2, L = 8: ${e28.cycles} cycles, ${tp(e28)}. The v0.1.15 best was ${t64.v0115_encoder_best.config} at ${t64.v0115_encoder_best.values_per_s !== null ? r2(t64.v0115_encoder_best.values_per_s / 1e6) : "?"} M values/s.`
        : `No synthesis estimate committed yet: W = 4, L = 8 takes ${e48.cycles} cycles (${e48.cycle_ratio_vs_decoder_W2}× the W = 2 decoder's ${t64.decoder_W2.cycles}).`,
      bottleneck: `W = 4, L = 8 on env T64 is ${e48.bound}-bound: ${e48.cycles} cycles = ${e48.over_max_bound}× max(T × ceil(D / L), ceil(bytes / W)); the remainder is one START cycle per frame, the frame-pair double buffer (frame t + 2 waits for frame t to be emitted) and sparse records with a single event. Below L = 8 every configuration is input-bound (the encoder must read every code, unlike the event-driven decoder).`,
      loop: lp48.throughput_ecp5
        ? `Closed loop W = 4, L = 8 -> scp4d_tdec_w W = 4: ${lp48.end_to_end_cycles} cycles end to end (${lp48.loop_over_max_standalone}× the slower standalone run); the pair's ECP5 estimate is ${lp48.throughput_ecp5.fmax_mhz_estimate} MHz (the W = 4 decoder's clock), ${r2(lp48.throughput_ecp5.values_per_s / 1e6)} M values/s.`
        : `Closed loop W = 4, L = 8 -> scp4d_tdec_w W = 4: ${lp48.end_to_end_cycles} cycles end to end (${lp48.loop_over_max_standalone}× the slower standalone run).`,
    },
    energy: "not measured; no pJ figure is reported for v0.1.15",
  };
}

async function main(): Promise<void> {
  let sim: { runs: Map<string, SimResult>; tools: Record<string, string | null> } | null = null;
  const iverilog = NO_SIM ? null : findBin("iverilog"), vvp = NO_SIM ? null : findBin("vvp");
  if (iverilog && vvp) sim = await runSim(iverilog, vvp);
  else if (REQUIRE_SIM) { console.log("FAIL simulator required (--require-sim / --write) but iverilog/vvp not found"); process.exit(1); }
  else console.log("SKIP sim (iverilog/vvp not found or --no-sim): counted checks use the committed report");
  const committed = existsSync(join(root, REPORT)) ? JSON.parse(read(REPORT).toString()) : null;
  let rep = committed;
  if (WRITE && sim) {
    const synthesis = SYNTH ? await runSynth() : committed?.synthesis ?? null;
    const measured = measuredSection(sim.runs);
    rep = {
      format: "4d-scp-v0.1.16-rtl-encoder-report", version: 1,
      label: "TEST ONLY. Cycles MEASURED in simulation of hw/scp4d/rtl/scp4d_tenc_q.v (and the closed loop with the unchanged v0.1.13 scp4d_tdec_w, same W); synthesis figures are ESTIMATES; no energy measured; all inputs are labelled synthetic or hand-written fixtures.",
      rtl: Object.fromEntries([RTL, TB, TBL, WRAP, MODEL].map((f) => [f, sha(read(f))])),
      simulator: sim.tools,
      design: {
        input: "integer codes x (post-quantizer, grid g = eps / 2^G), L per cycle; the v0.1.8 ingest quantizer is not in the RTL",
        configuration: "fixed by the host (shape, T, G, predictor; no config search in hardware); eps bits and times / meta varints are host-composed header segments streamed through",
        scope: "S4DI v1, rank 0, relations off, zero / last / linear hold, D <= 2^ADDR_W = 2048, G <= 16",
        microarchitecture: `as v0.1.15 scp4d_tenc_p (S0 accept + read issue -> S1r registered read -> S1a predict / residual / deadband -> S1b q / reconstruction / write -> S2a sizing -> S2b accumulators + record write -> S3 close; 4-entry record FIFO; emitter START + sparse ${encpES(1)} / ${encpES(4)} events per cycle at W <= 2 / W = 4 or dense W elements -> ${ENCP_BQ}-byte queue, append iff queue + staged <= ${ENCP_BQ} - MA, MA = ${encpMA(1)} / ${encpMA(2)} / ${encpMA(4)}), with a short emitter path: the record carries its first event's gap, >= 128 flag and event count (computed in S2b); the FIFO pop and same-record decisions use the counts instead of the lane-pick chain; later events of a record use lane - previous lane - 1, q varint lengths sit at a 4-bit stride, and bytes are placed by explicit offset / lane selectors (no variable shift, no constant x variable product)`,
        error_codes: { 1: "D = 0 or D > 2048", 2: "T = 0", 3: "G > 16", 4: "predictor 3", 5: "times / meta length < T + 1", 6: "register overflow (pred, residual or reconstruction leaves signed 32 bits)", 7: "input beat lane count", 8: "host header beat overruns its segment (or 0 / > W bytes)" },
        cycle_count: "from the start cycle (1) to the cycle done is observed, inclusive (testbench count); full rate = a code beat and a header beat offered every cycle and out_ready = 1",
      },
      derived, negatives: negDerived, measured, synthesis,
      comparison: comparison(measured, synthesis),
    };
    writeFileSync(join(root, REPORT), `${JSON.stringify(rep, null, 2)}\n`);
    console.log(`wrote ${REPORT}`);
  }

  // ---------- counted checks on the (committed or freshly written) report ----------
  check("report present with the v0.1.16 format; recorded RTL / testbench / wrapper / model hashes match the files", !!rep && rep.format === "4d-scp-v0.1.16-rtl-encoder-report"
    && [RTL, TB, TBL, WRAP, MODEL].every((f) => rep.rtl?.[f] === sha(read(f))));
  check("report derived facts (bytes, sha, sim-input hashes, exact cycle model per (W, L)) recompute exactly", JSON.stringify(rep?.derived) === JSON.stringify(derived) && JSON.stringify(rep?.negatives) === JSON.stringify(negDerived));
  const M = rep?.measured as Meas | undefined;
  const encOf = (id: string, c: { W: number; L: number }) => (M?.encoder.find((e) => e.id === id) as unknown as Record<string, Record<string, number> & { gaps_backpressure_run: Record<string, number> | null }> | undefined)?.[cfgKey(c)];
  const loopOf = (id: string, c: { W: number; L: number }) => (M?.loop.find((e) => e.id === id) as unknown as Record<string, Record<string, number> & { gaps_run: Record<string, number> | null }> | undefined)?.[cfgKey(c)];
  check(`encoder byte-exact: all ${jobs.length} jobs × ${ENC_CONFIGS.length} (W, L) configurations (W1L1, W2L2, W2L4, W2L8 as v0.1.14, plus W4L4, W4L8) at full rate: every output byte equals the v0.1.10 model stream, no error, no timeout`,
    !!M && jobs.every((j) => ENC_CONFIGS.every((c) => { const r = encOf(j.id, c); return !!r && r.ok === 1 && r.mismatches === 0 && r.out_bytes === j.bytes.length && r.err === 0 && r.timeout === 0; })));
  check("encoder byte-exact with pseudo-random input / header gaps AND random output backpressure for every job and configuration",
    !!M && jobs.every((j) => ENC_CONFIGS.every((c) => { const g = encOf(j.id, c)?.gaps_backpressure_run; return !!g && g.ok === 1 && g.mismatches === 0 && g.out_bytes === j.bytes.length && g.bp_cycles > 0; })));
  check("measured full-rate cycles equal the exact cycle model for every job and configuration",
    !!M && jobs.every((j) => ENC_CONFIGS.every((c) => encOf(j.id, c)?.cycles === derived.find((d) => d.id === j.id)!.model[cfgKey(c)].cycles)));
  check(`${negatives.length} corrupted configurations / inputs (D = 0, D > 2048, T = 0, G = 17, predictor 3, short times/meta, wrong beat lanes, empty header beat, reconstruction overflow) stop with the expected error code at every configuration and never assert done`,
    !!M && negatives.every((n) => ENC_CONFIGS.every((c) => { const r = (M.negatives.find((x) => x.id === n.id) as unknown as Record<string, Record<string, number> | null> | undefined)?.[cfgKey(c)]; return !!r && r.ok === 1 && r.err === 1 && r.done === 0 && r.err_code === n.expect_err; })));
  check(`closed loop encoder (W = 2, L = 2 / 4 / 8 and W = 4, L = 4 / 8) -> scp4d_tdec_w (same W = 2 / 4, unchanged): every decoded element of every frame of all ${jobs.length} jobs bit-exact with the model reconstruction, within the deadband of the input code, decoder consumed every byte, at full rate and with input gaps`,
    !!M && jobs.every((j) => LOOP_CONFIGS.every((c) => { const l = loopOf(j.id, c); return !!l && l.ok === 1 && l.mismatches === 0 && l.eps_violations === 0 && l.consumed === j.bytes.length && l.frames === j.T && !!l.gaps_run && l.gaps_run.ok === 1 && l.gaps_run.mismatches === 0; })));
  {
    const envIds = ["env-16x16x2-T64-temporal-last", "env-16x16x2-T256-temporal-last"];
    const V15 = JSON.parse(read(V0115_REPORT).toString()) as { measured: { encoder: Record<string, unknown>[]; loop: Record<string, unknown>[] } };
    const decW2 = (id: string) => (V0113.comparison.temporal_only as { stream: string; by_W: Record<string, { cycles: number }> }[]).find((x) => x.stream === id)!.by_W.W2.cycles;
    const v15 = (id: string, c: { W: number; L: number }) => ((V15.measured.encoder.find((e) => e.id === id) as Record<string, { cycles: number }> | undefined)?.[cfgKey(c)])?.cycles;
    check("cycle-for-cycle identical to v0.1.15: every job × configuration takes exactly the v0.1.15 measured cycles (the change is clock-only)",
      !!M && jobs.every((j) => ENC_CONFIGS.every((c) => encOf(j.id, c)?.cycles === v15(j.id, c))));
    check("measured per-cycle rate: on env T64 and T256, W = 4, L = 8 takes fewer cycles than the v0.1.13 W = 2 decoder",
      !!M && envIds.every((id) => { const c = encOf(id, { W: 4, L: 8 })?.cycles; return !!c && c < decW2(id); }));
  }
  check("committed comparison and verdict recompute exactly from the committed measurements, derived facts, v0.1.13 decoder report, v0.1.15 encoder report and synthesis section",
    !!M && JSON.stringify(rep.comparison) === JSON.stringify(comparison(M, rep.synthesis ?? null)));
  check("labels: synthesis section (when present) is an ESTIMATE; throughput is measured cycles × estimated fmax; no energy measured and no pJ figure anywhere in the report",
    (!rep?.synthesis || /ESTIMATE/.test(String(rep.synthesis.label ?? ""))) && /MEASURED in simulation/.test(String(rep?.comparison?.label ?? ""))
    && !/pJ|picojoule/i.test(JSON.stringify({ ...(rep ?? {}), comparison: { ...(rep?.comparison ?? {}), energy: null } })) && /not measured/.test(String(rep?.comparison?.energy ?? "")));

  if (sim && committed && !WRITE) {
    const same = JSON.stringify(measuredSection(sim.runs)) === JSON.stringify(committed.measured);
    console.log(`${same ? "SIM PASS" : "SIM FAIL"} re-simulated ${jobs.length} jobs × ${ENC_CONFIGS.length} configs (+ gap / backpressure runs), ${negatives.length} negatives and the closed loop with ${sim.tools.iverilog}: ${same ? "identical to the committed report" : "DIFFERS from the committed report"}`);
    if (!same) failures.push("simulation differs from committed report");
  }

  // ---------- 8. Table ----------
  if (M) {
    console.log("\nvector                                   bytes   values   W1L1 cyc   W2L2 cyc   W2L4 cyc   W2L8 cyc   W4L4 cyc   W4L8 cyc  loop W4L8");
    for (const j of jobs) {
      const c = ENC_CONFIGS.map((x) => encOf(j.id, x)?.cycles ?? "-");
      console.log(`${j.id.padEnd(38)} ${String(j.bytes.length).padStart(7)} ${String(j.T * j.D).padStart(8)} ${c.map((x) => String(x).padStart(10)).join(" ")} ${String(loopOf(j.id, { W: 4, L: 8 })?.cycles ?? "-").padStart(12)}`);
    }
  }
  if (failures.length) { console.log(`FAIL check-scp-v0116-rtl (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
  console.log(`PASS check-scp-v0116-rtl (${passed} checks)`);
}
main().catch((e) => { console.log(`FAIL check-scp-v0116-rtl (${(e as Error).message})`); process.exit(1); });
