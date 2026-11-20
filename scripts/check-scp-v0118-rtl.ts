/** TEST ONLY. 4D-SCP v0.1.18 — temporal-only S4DI v1 DECODER SPLIT INTO TWO STAGES
 * (hw/scp4d/rtl/scp4d_tdec_s.v, front end hw/scp4d/rtl/scp4d_fe_r.v from v0.1.17, unchanged): a token
 * classifier (fixed per-position roles, range checks precomputed on queue entry, records with event
 * element / q / limit / frame end / error) and a bank issuer (last hold: event records in order until a
 * bank repeats; zero / linear hold: aligned blocks of P elements around a cursor), joined by a record
 * register and a pop-late record queue. Cycles CHANGE (new exact cycle model,
 * scripts/scp-v0118-rtl-model.ts). Bit-exact against the v0.1.10 model's golden vectors at W = 1, 2, 4
 * (full rate and with random input gaps); every issued value of every frame equal to the unchanged
 * v0.1.13 scp4d_tdec_w and v0.1.17 scp4d_tdec_r run on the same stream (own beat feeders; cycles may
 * differ); and a closed encode -> decode loop with the unchanged v0.1.16 scp4d_tenc_q (same W). Every
 * v0.1.10 .. v0.1.17 file stays unchanged (sha-pinned).
 *
 * Counted checks are deterministic and need NO simulator (so check-scp-all can pin the count):
 * unchanged pinned artefacts, isolation, RTL static rules, the job lists, and the committed report:
 * bit-exact at every W (full rate and gaps), output tables identical to tdec_w and tdec_r on every run,
 * corrupted / out-of-scope streams rejected with the right code at every W, measured cycles and
 * classifier / issuer counters == the exact cycle model, reference cycles == v0.1.13's committed
 * cycles, closed loop bit-exact, comparison / verdict recompute, labels (synthesis = estimate; no
 * energy measured).
 *
 * Simulator stage (NOT counted): if Icarus Verilog is on PATH or in /opt/eda/oss-cad-suite/bin every
 * run is re-simulated and must equal the committed report. "SKIP sim" without it; --require-sim
 * fails instead; --no-sim forces the skip. Synthesis / place-and-route only with --synth.
 * Writes nothing unless --write (refresh fixtures/scp/v0118-rtl-report.json; needs the simulator;
 * keeps the committed synthesis section unless --synth). Scratch files go to an OS temp dir.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0118-rtl.ts [--no-sim | --require-sim] [--synth] [--write]
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
import { encoderJobs, hostHeader, type EncJob } from "./scp-v0114-rtl-model";
import { payloadTokens } from "./scp-v0113-rtl-model";
import { LOOPS_CONFIGS as LOOP_CONFIGS, TDECS_TAIL, TDECS_W_LIST as W_LIST, tdecSCycleModel, tdecsRQ } from "./scp-v0118-rtl-model";

const root = resolve(join(import.meta.dirname, ".."));
const RTL = "hw/scp4d/rtl/scp4d_tdec_s.v";
const FE = "hw/scp4d/rtl/scp4d_fe_r.v";             // v0.1.17, unchanged (pinned)
const TB = "hw/scp4d/tb/scp4d_tdec_s_tb.v";
const TBL = "hw/scp4d/tb/scp4d_loop_s_tb.v";
const WRAP = "hw/scp4d/synth/scp4d_tdec_s_wrap.v";
const REF_R = "hw/scp4d/rtl/scp4d_tdec_r.v";
const REF_DEC = ["hw/scp4d/rtl/scp4d_tdec_w.v", "hw/scp4d/rtl/scp4d_fe_w.v", REF_R];
const ENC = "hw/scp4d/rtl/scp4d_tenc_q.v";
const MODEL = "scripts/scp-v0118-rtl-model.ts";
const REPORT = "fixtures/scp/v0118-rtl-report.json";
const V0113_REPORT = "fixtures/scp/v0113-rtl-report.json";
const V0116_REPORT = "fixtures/scp/v0116-rtl-report.json";
const V0117_REPORT = "fixtures/scp/v0117-rtl-report.json";
const V0110_VECTORS = "fixtures/scp/golden-vectors-scp4d.json";
const TEMPORAL_VECTORS = "fixtures/scp/golden-vectors-scp4d-temporal.json";
const PINNED: [string, string][] = [
  ["src/scp/pack.ts", "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a"],
  ["fixtures/scp/golden-vectors-scp4d.json", "7e8b8165444e0b6f48c01622b2c41e9e035d80fa37b2a14dcd16de30d1e3cfd9"],
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
  ["fixtures/scp/golden-vectors-scp4d-temporal.json", "11159272c519e7d77e885a239a5487b5003ed4ca4cfa478dff04e2bbf049d53a"],
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
  ["fixtures/scp/v0114-rtl-report.json", "23d487064a0f27f32251b620fb4f03740327a77e59b68b09f1fe5678ad642a73"],
  ["hw/scp4d/rtl/scp4d_tenc_p.v", "74aa4f10348fa9582c2fbc564e946321ff765ab0038d9493e9ca8902c1dc9b41"],
  ["hw/scp4d/tb/scp4d_tenc_p_tb.v", "df3d0524ecf5ccda1aac30ba03588a01a35487b72dbf6f90887fdf0d9d982573"],
  ["hw/scp4d/tb/scp4d_loop_p_tb.v", "1ce85732bc46ea3acf8e34334c203829c5aa12af3f9d3acdbc73e053784091a0"],
  ["hw/scp4d/synth/scp4d_tenc_p_wrap.v", "337bd014808a49b289b8a5f1d5e8a8f78f7c22559988e1512cba7c236bb21087"],
  ["scripts/scp-v0115-rtl-model.ts", "cdd9b681b0ec68b01f68c721a538089d2b5170f3448cbc8abe486dfac14918d8"],
  ["scripts/check-scp-v0115-rtl.ts", "9d9bfabed40e3e9f2e0b935b96d1d6bb2bbad2819f67846114bc4a88673433a3"],
  ["fixtures/scp/v0115-rtl-report.json", "97bdfd9b26cf2ad8f02e633c10fc3876c5e1412624ee3f9583d26c8d69e33dc4"],
  ["hw/scp4d/rtl/scp4d_tenc_q.v", "2fb75974c5d21aa70d4fe8133c8b2a471d7744b4bc247bb82dfff4db88e04f46"],
  ["hw/scp4d/tb/scp4d_tenc_q_tb.v", "3eaecd61a58c8f230339ff183fee5f7734e3075d63369321f2f2da753215ccb1"],
  ["hw/scp4d/tb/scp4d_loop_q_tb.v", "82ac8d350df5aba2e0db432995645fc0010ea5902a46d2e9ee37e908c3495aef"],
  ["hw/scp4d/synth/scp4d_tenc_q_wrap.v", "e43f21d5cbb6626d19e77ada1c9a03cedb6e7b8337de96c682a5f18ec282e955"],
  ["scripts/scp-v0116-rtl-model.ts", "2f318752bd0f3389320a000354b1dfa9b146f03849201ceff74fccc316b5d323"],
  ["scripts/check-scp-v0116-rtl.ts", "713b761f04b89dc6e2f90d32950aea013b51727643b842fe700b8f4a3595e259"],
  ["fixtures/scp/v0116-rtl-report.json", "9d9b3556568faf51e4cf311aa5678215d44ff3cd2b2b9deb417cdd4b6553f27d"],
  ["hw/scp4d/rtl/scp4d_fe_r.v", "d6f806c44e0da9dac9ef948cf5a5693ba947c122f6d89c183d42190d93975aa4"],
  ["hw/scp4d/rtl/scp4d_tdec_r.v", "d3f26ee8dbebaf3d3559b324d41bacea44604386b66cacb434af9024e81eb8e9"],
  ["hw/scp4d/tb/scp4d_tdec_r_tb.v", "498e7a12822b3d5cb9591eb4e3944a88311ef69008adec731eb090a8247a8db2"],
  ["hw/scp4d/tb/scp4d_loop_r_tb.v", "8c206efbf69382ad997bec2a4e193286953e37fcb0c06b67bb912e8ff39b0106"],
  ["hw/scp4d/synth/scp4d_tdec_r_wrap.v", "64ae9c7cf31ed85025993b94e87d22afff2df975550a8aa39785845cdea9ecf8"],
  ["scripts/scp-v0117-rtl-model.ts", "18808c0bf6e80d7a716c9ffd35081212e16ef12f4dd653e914d320371d256e2b"],
  ["scripts/check-scp-v0117-rtl.ts", "1653f5d301c2d7d057418909cad4809b643cca22d7c6c50aba37e052495c38d9"],
  ["fixtures/scp/v0117-rtl-report.json", "3b421bbd3216cd7e0f0cc03e7cc2daecf8f115185b7c2dbd77ecf7ed4c211371"],
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
const cfgKey = (c: { W: number; L: number }) => `W${c.W}L${c.L}`;
const PRED = ["zero", "last", "linear"];

// ---------- 1. Unchanged artefacts ----------
{
  const bad = PINNED.filter(([p, h]) => !existsSync(join(root, p)) || sha(read(p)) !== h).map(([p]) => p);
  check(`pack.ts, every v0.1.8 / v0.1.10 model, vector and report, and every v0.1.11 .. v0.1.17 RTL file (scp4d_tdec_w / scp4d_tdec_r / scp4d_fe_r / scp4d_tenc_q included), testbench, synthesis script / wrapper, vector file, report, model, generator and check unchanged (${PINNED.length} files sha-pinned)`, bad.length === 0, bad.join(", ") || "all match");
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
      if (/scp-v011[4-8]/.test(t)) importers.push(rel);
      if (/["'][^"']*hw\/scp4d/.test(t)) hwRefs.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.14 .. v0.1.18 scripts; hw/ holds no TS/JS and no app code references hw/scp4d", importers.length === 0 && tsInHw.length === 0 && hwRefs.length === 0, [...importers, ...tsInHw, ...hwRefs].join(", ") || "none");
  const m = stripTs(read(MODEL).toString());
  check("cycle model is pure: no I/O, env, clocks, randomness, hashing, Level 4 or app imports",
    !/node:fs|node:child_process|process\.env|Date\.now|Math\.random|createHash|node:crypto|level4|src\/app|metamorphic/i.test(m));
}

// ---------- 3. RTL static rules ----------
// `*` between non-constant operands outside (local)parameter declarations: products with a literal or an
// UPPER-CASE parameter (bit-slice strides such as EW*m, p*TQ) are elaboration-time constants, not multipliers.
function varMuls(src: string): string[] {
  return src.split("\n").filter((l) => !/^\s*(localparam|parameter)\b/.test(l))
    .map((l) => l.replace(/\(\*\)/g, "").replace(/\b[A-Z][A-Z0-9_]*\s*\*/g, "").replace(/\*\s*\(?[A-Z][A-Z0-9_]*\b/g, ""))
    .flatMap((l) => l.match(/[^*/(\s\d]\s*\*\s*[^*/)\s\d]/g) ?? []);
}
const src = (p: string) => (existsSync(join(root, p)) ? read(p).toString() : "");
const rtl = src(RTL), fe = src(FE), tdw = src(REF_DEC[0]), tdr = src(REF_R);
{
  const c = stripV(rtl), f = stripV(fe), w = stripV(tdw), rr = stripV(tdr);
  const decl = (t: string) => (t.match(/localparam \[4:0\] E_[\s\S]*?;\s*localparam \[4:0\] S_[\s\S]*?;/) ?? [""])[0];
  check("RTL present: scp4d_tdec_s, one module per file, `default_nettype none; same ports, parameters (W 2, ADDR_W 11, G_MAX 16), error / state codes and header parser as scp4d_tdec_w; rank > 0 / relations rejected with unsupported = 1; P = W banks; front end is the unchanged v0.1.17 scp4d_fe_r",
    /module\s+scp4d_tdec_s\b/.test(c) && (c.match(/\bmodule\b/g) ?? []).length === 1 && /`default_nettype none/.test(c)
    && c.slice(c.indexOf("#("), c.indexOf(");") + 2) === w.slice(w.indexOf("#("), w.indexOf(");") + 2)
    && decl(c) !== "" && decl(c) === decl(w) && /fail\(E_RANK, 1'b1\)/.test(c) && /fail\(E_REL, 1'b1\)/.test(c) && /localparam integer P\s+= W;/.test(c)
    && /scp4d_fe_r #\(\.W\(W\), \.K\(K\), \.ADDR_W\(ADDR_W\)\) fe \(/.test(c) && /module\s+scp4d_fe_r\b/.test(f));
  check("stage 1, token classifier: fixed per-position roles (head alone; gap / q alternate from the registered phase; dense one element per token), no per-step state variable, gap B range check from gap A's sum without an incrementer, pop count by priority encode, records in fixed slots",
    /isq\[i\] = ph \? \(\(i % 2\) == 0\) : \(\(i % 2\) == 1\);/.test(c) && /\$signed\(\{1'b0, xeA\}\) >= \$signed\(dmgB\)/.test(c) && /xeA = bp \+ loA;/.test(c)
    && /proc\[i\] = !c_blk && tv\[i\];/.test(c) && /always @\(\*\) t_pop = c_k;/.test(c) && /function \[RW-1:0\] mkrec/.test(c)
    && !/\bc_st\b|\bkh\b|\bt_val\b|\btv\s*=/.test(c) && /\(ph \? \(\(i \+ 1\) \/ 2 == s\) : \(i \/ 2 == s\)\)/.test(c.replace(/\s+/g, " ")));
  check("record path: classifier records are registered (rec_r) and enter a pop-late record queue (candidate per issuer pop count from registered state; i_p only selects); the classifier runs only while rq_cnt + rec_n + K <= RQ (RQ = 3W)",
    /rec_r\[ii\] <= c_rec\[ii\];/.test(c) && /if \(i_p == rp\) rq\[rj\] <= rcand\[rp\*RQ \+ rj\];/.test(c) && /if \(i_p == rp\) rq_cnt <= rccnt\[rp\];/.test(c)
    && /wire c_room = \(\{1'b0, rq_cnt\} \+ \{1'b0, rec_n\} \+ K6\) <= RQ6;/.test(c) && /localparam integer RQ = 3 \* W;/.test(c) && tdecsRQ(4) === 12);
  const banks = (t: string) => { const a = t.indexOf("genvar gb;"), b = t.indexOf("end endgenerate", a); return a < 0 || b < 0 ? "" : t.slice(a, b); };
  check("stage 2, bank issuer: separate block over the first P records (last hold: in order until a bank repeats; sweep: aligned block of P elements up to the last visible record's limit; a record is consumed iff its limit <= the registered block end); classifier errors travel as records and err is raised only when the issuer reaches them; the bank pipeline (A read / B execute, write, forward) is scp4d_tdec_r's, text-identical",
    /if \(rq\[j\]\[R_EV\] && \(\(i_used & i_bsel\) != \{P\{1'b0\}\}\)\) i_stop = 1'b1;/.test(c) && /bb = cur & ~PM1; lmax = cur;/.test(c) && /rq\[j\]\[R_LIM \+: ADDR_W\+1\] <= cbe\)/.test(c) && /cbe <= \(n_cur & ~PM1\) \+ PW;/.test(c) && /iss_v = i_v & \{P\{!err\}\};/.test(c) && /if \(i_fail\) fail\(i_code, 1'b0\);/.test(c)
    && (c.match(/fail\(E_(INDEX|QZERO|QWIDTH|PVARINT|COUNT)/g) ?? []).length === 0 && banks(c) !== "" && banks(c) === banks(rr));
  const all = [rtl, src(WRAP)].map(stripV).join("\n");
  const banned = all.match(/\binitial\b|\$(?!signed\b|unsigned\b)\w+|\breal\b|\brealtime\b|\bshortreal\b|\bfork\b|#\s*\d/g) ?? [];
  const divs = all.split("\n").filter((l) => !/^\s*`/.test(l) && /[^/]\/[^/]|%/.test(l.replace(/"[^"]*"/g, "")));
  // the classifier's role / slot expressions use "% 2" and "/ 2" on the integer loop index only (elaboration-time constants)
  const divsVar = divs.filter((l) => !/\(i % 2\)|\(i \+ 1\) \/ 2|i \/ 2/.test(l));
  check("decoder RTL + P&R wrapper: synthesizable subset (no initial, system tasks other than $signed / $unsigned, real, fork, delays), no division or modulo on signals (only on the constant loop index), the only multiplier is the header's D product (as scp4d_tdec_w)",
    banned.length === 0 && divsVar.length === 0 && varMuls(c).length === 1 && /prod\s+= dacc \* fld/.test(c), JSON.stringify(banned) + divsVar.join(" | ").slice(0, 200));
}

// ---------- 4. Job lists ----------
type DJob = { key: string; id: string; source: string; kind: string; in_scope: boolean; bytes: Uint8Array; T: number; D: number; codes: number[][]; events: number[]; expect_unsup: number; expect_err: number };
const djobs: DJob[] = [];
const v0110 = JSON.parse(read(V0110_VECTORS).toString()) as { vectors: { id: string; config: { rank: number; relations: boolean; predictor: string }; expected_bytes_hex: string; expected_decoded_codes: number[][]; expected_events: { positions: number[] }[] }[] };
const tvf = temporalVectorFile(), envT = envTemporalStreams();
const addD = (j: Omit<DJob, "key">) => djobs.push({ ...j, key: `tdec_w:${j.id}` });   // keys as in the v0.1.13 report
const evs = (e: { positions: number[] }[]) => e.map((x) => x.positions.length);
for (const v of v0110.vectors) {
  const ins = v.config.rank === 0 && !v.config.relations;
  addD({ id: v.id, source: V0110_VECTORS, kind: ins ? "temporal" : "out-of-scope", in_scope: ins, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length,
    codes: v.expected_decoded_codes, events: evs(v.expected_events), expect_unsup: ins ? 0 : v.config.rank > 0 ? 8 : 9, expect_err: 0 });
}
for (const v of tvf.vectors) addD({ id: v.id, source: TEMPORAL_VECTORS, kind: "temporal", in_scope: true, bytes: fromHex(v.expected_bytes_hex), T: v.expected_decoded_codes.length, D: v.expected_decoded_codes[0].length, codes: v.expected_decoded_codes, events: evs(v.expected_events), expect_unsup: 0, expect_err: 0 });
for (const s of envT) addD({ id: s.id, source: "regenerated (scripts/scp-v0111-rtl-vectors.ts envTemporalStreams)", kind: "temporal", in_scope: true, bytes: s.bytes, T: s.T, D: s.D, codes: s.codes, events: s.perFrame.map((f) => f.positions.length), expect_unsup: 0, expect_err: 0 });
/** first sparse frame with >= 2 events whose head, first index, q1, gap2, q2 are one-byte varints (as v0.1.13) */
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
  // v0.1.13's scp4d_tdec_w negatives (header set + token path), unchanged
  const base = djobs.find((j) => j.key === "tdec_w:env-4x4x1-T8-temporal-last")!;
  const s = streamStructure(base.bytes);
  const layoutAt = s.fixed_bytes + s.header_tail_bytes - 1, predAt = layoutAt - 2, relAt = layoutAt - 3, rankAt = layoutAt - 4;
  const ps = payloadSites(base.bytes);
  const neg = (id: string, bytes: Uint8Array, unsup: number, errc: number, why: string) =>
    addD({ id, source: `negative: ${base.id} ${why}`, kind: "negative", in_scope: false, bytes, T: base.T, D: base.D, codes: [], events: [], expect_unsup: unsup, expect_err: errc });
  neg("neg-bad-magic", mut(base.bytes, 0, 0x58), 0, 1, "byte 0 := 0x58");
  neg("neg-bad-version", mut(base.bytes, 4, 2), 0, 2, "byte 4 (version) := 2");
  neg("neg-rank-1", mut(base.bytes, rankAt, 1), 8, 0, `byte ${rankAt} (rank) := 1`);
  neg("neg-relations-on", mut(base.bytes, relAt, 1), 9, 0, `byte ${relAt} (relations) := 1`);
  neg("neg-bad-predictor", mut(base.bytes, predAt, 3), 0, 10, `byte ${predAt} (predictor) := 3`);
  neg("neg-sparse-q-zero", mut(base.bytes, ps.q1, 0), 0, 15, `byte ${ps.q1} (first one-byte sparse q) := 0`);
  neg("neg-first-index-oob", mut(base.bytes, ps.first, base.D), 0, 16, `byte ${ps.first} (first event index) := D`);
  neg("neg-gap-oob", mut(base.bytes, ps.gap2, 0x7f), 0, 16, `byte ${ps.gap2} (second event gap) := 127`);
  neg("neg-long-varint", mut(base.bytes, ps.q2, 0x80, 0x80, 0x80, 0x80, 0x80), 0, 13, `bytes ${ps.q2}..${ps.q2 + 4} := 0x80 (payload varint > 5 bytes)`);
  // v0.1.17 additions: the narrowed range checks at their edges (gap / first index exactly D - 1 / D)
  const ps2 = ps;
  neg("neg-first-index-D-plus-1", mut(base.bytes, ps2.first, base.D + 1), 0, 16, `byte ${ps2.first} (first event index) := D + 1`);
}
const inD = djobs.filter((j) => j.in_scope);
const V0113 = JSON.parse(read(V0113_REPORT).toString()) as { measured: Record<string, unknown>[]; comparison: { temporal_only: { stream: string; by_W: Record<string, { cycles: number; throughput_ecp5: { fmax_mhz_estimate: number; values_per_s: number } | null }> }[] } };
const v13 = (key: string, W: number) => (V0113.measured.find((m) => m.key === key) as Record<string, { cycles: number; err_code: number; unsupported: number }> | undefined)?.[`W${W}`];
check(`decoder job list: ${djobs.length} streams (${inD.length} in-scope temporal-only: v0.1.10, v0.1.11 and env T64 / T256; ${djobs.filter((j) => j.kind === "out-of-scope").length} out of scope; ${djobs.filter((j) => j.kind === "negative").length} corrupted); every in-scope job's per-frame events sum to the stream walk's total; every v0.1.13 job has a committed v0.1.13 W = 1 / 2 / 4 result`,
  new Set(djobs.map((j) => j.key)).size === djobs.length && inD.length === 7 && inD.every((j) => j.events.reduce((a, b) => a + b, 0) === streamStructure(j.bytes).events)
  && djobs.filter((j) => !j.id.endsWith("D-plus-1")).every((j) => W_LIST.every((W) => typeof v13(j.key, W)?.cycles === "number")));
const { jobs: ljobs, nativeMismatch } = encoderJobs(JSON.parse(read(V0110_VECTORS).toString()), JSON.parse(read(TEMPORAL_VECTORS).toString()));
check(`closed-loop job list: the ${ljobs.length} v0.1.14 encoder jobs (native golden configurations reproduce their committed bytes) at ${LOOP_CONFIGS.length} (W, L) configurations`,
  ljobs.length === 18 && nativeMismatch.length === 0 && LOOP_CONFIGS.length === 5);

// ---------- 5. Sim inputs + derived facts ----------
const hx = (b: ArrayLike<number>) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("\n") + "\n";
const w32 = (v: number) => ((v < 0 ? v + 2 ** 32 : v) >>> 0).toString(16).padStart(8, "0");
const dFiles = (j: DJob) => simFiles(j.bytes, j.in_scope ? j.codes : [[0]], j.in_scope ? j.events : [0]);
const lFiles = (j: EncJob) => { const h = hostHeader(j); return { stream: hx(j.bytes), codes: j.codes.flatMap((f) => f.map(w32)).join("\n") + "\n", hdr: hx([...h.eps, ...h.tm]), dec: j.decoded.flatMap((f) => f.map(w32)).join("\n") + "\n" }; };
const lArgs = (j: EncJob): Record<string, number> => { const h = hostHeader(j); return { nx: j.shape.nx, ny: j.shape.ny, nz: j.shape.nz, c: j.shape.channels, t: j.T, g: j.cfg.G, pred: PRED.indexOf(j.cfg.predictor), tmlen: h.tm.length, nhdr: h.eps.length + h.tm.length }; };
const derived = {
  decoder: djobs.map((j) => {
    const f = dFiles(j);
    const base = { key: j.key, id: j.id, source: j.source, kind: j.kind, in_scope: j.in_scope, bytes: j.bytes.length, bytes_sha256: sha(j.bytes), sim_inputs_sha256: sha(f.stream + f.codes + f.events), expect_unsupported_code: j.expect_unsup, expect_err_code: j.expect_err };
    if (!j.in_scope) return base;
    const s = streamStructure(j.bytes), pt = payloadTokens(j.bytes);
    return { ...base, T: s.T, D: s.D, element_frames: s.T * s.D, predictor: PRED[s.predictor], header_bytes: pt.header, payload_tokens: pt.toks.length, events: s.events,
      model: Object.fromEntries(W_LIST.map((W) => [`W${W}`, tdecSCycleModel(j.bytes, W)])) };
  }),
  loop: ljobs.map((j) => { const f = lFiles(j); return { id: j.id, T: j.T, D: j.D, element_frames: j.T * j.D, bytes: j.bytes.length, bytes_sha256: sha(j.bytes), sim_inputs_sha256: sha(f.stream + f.codes + f.hdr + f.dec + JSON.stringify(lArgs(j))) }; }),
};

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
  const dir = mkdtempSync(join(tmpdir(), "scp4d-decs-sim-"));
  try {
    for (const W of W_LIST) {
      const r = spawnSync(iverilog, ["-g2012", "-Wall", `-Pscp4d_tdec_s_tb.W=${W}`, "-o", join(dir, `dec-${W}.vvp`), join(root, TB), join(root, RTL), join(root, FE), ...REF_DEC.map((d) => join(root, d))], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`iverilog failed: ${r.stderr}`);
    }
    for (const c of LOOP_CONFIGS) {
      const r = spawnSync(iverilog, ["-g2012", "-Wall", `-Pscp4d_loop_s_tb.W=${c.W}`, `-Pscp4d_loop_s_tb.L=${c.L}`, "-o", join(dir, `loop-${cfgKey(c)}.vvp`), join(root, TBL), join(root, ENC), join(root, RTL), join(root, FE)], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`iverilog failed: ${r.stderr}`);
    }
    const tasks: (() => Promise<[string, SimResult]>)[] = [];
    djobs.forEach((j, n) => {
      const f = dFiles(j), p = (k: string) => join(dir, `d${n}.${k}.hex`);
      writeFileSync(p("stream"), f.stream); writeFileSync(p("codes"), f.codes); writeFileSync(p("events"), f.events);
      for (const W of W_LIST) for (const bub of j.in_scope ? [0, 1] : [0]) {
        const args = [join(dir, `dec-${W}.vvp`), `+stream=${p("stream")}`, `+codes=${p("codes")}`, `+events=${p("events")}`, `+nbytes=${j.bytes.length}`, `+t=${j.T}`, `+d=${j.D}`,
          `+expect_unsup=${j.expect_unsup}`, `+expect_err=${j.expect_err}`, `+bubbles=${bub}`, `+id=${j.id}`];
        tasks.push(async () => { const r = await run(vvp, ["-n", ...args]); return [`dec|${j.key}|${W}|${bub}`, parseResult(r.out)]; });
      }
    });
    ljobs.forEach((j, n) => {
      const f = lFiles(j), a = lArgs(j), p = (k: string) => join(dir, `l${n}.${k}.hex`);
      for (const k of ["stream", "codes", "hdr", "dec"] as const) writeFileSync(p(k), f[k]);
      const common = [`+stream=${p("stream")}`, `+codes=${p("codes")}`, `+hdr=${p("hdr")}`, `+dec=${p("dec")}`, `+nbytes=${j.bytes.length}`, ...Object.entries(a).map(([k, v]) => `+${k}=${v}`), `+id=${j.id}`];
      for (const c of LOOP_CONFIGS) for (const gb of [0, 1]) {
        tasks.push(async () => { const r = await run(vvp, ["-n", join(dir, `loop-${cfgKey(c)}.vvp`), ...common, `+gaps=${gb}`]); return [`loop|${j.id}|${cfgKey(c)}|${gb}`, parseResult(r.out)]; });
      }
    });
    const res = await pool(tasks, NPAR);
    return { runs: new Map(res), tools: { iverilog: firstLine(iverilog, ["-V"]), vvp: firstLine(vvp, ["-V"]) } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- synthesis (--synth only) ----------
type Cells = { num_cells: number; by_type: Record<string, number> };
type Pnr = { device: string; seed: number; fits: boolean; fmax_mhz?: Record<string, number>; utilization?: Record<string, string>; error?: string };
// ECP5 place-and-route uses nextpnr's router2, as v0.1.16 / v0.1.17. The same run re-places the unchanged
// v0.1.17 scp4d_tdec_r (W = 2 / 4), the v0.1.13 scp4d_tdec_w (W = 2 / 4), the v0.1.16 encoder scp4d_tenc_q
// W = 4, L = 8 and the v0.1.17 loop (tenc_q -> tdec_r, W = 4, L = 8) as "ref" rows, so every comparison
// below is like-for-like (same tools, flow, seed, wrapper logic).
const ECP5_ROUTER = "router2";
const NEW_DEC = (w: number) => `scp4d_tdec_s W=${w}`;
const NEW_LOOP = (w: number) => `loop tenc_q W=${w} L=8 -> tdec_s W=${w}`;
const REF_TDEC_R = (w: number) => `ref v0.1.17 scp4d_tdec_r W=${w}`;
const REF_TDEC_W = (w: number) => `ref v0.1.13 scp4d_tdec_w W=${w}`;
const REF_TENC_Q = "ref v0.1.16 scp4d_tenc_q W=4 L=8";
const REF_LOOP_R = "ref v0.1.17 loop tenc_q W=4 L=8 -> tdec_r W=4";
const SYN_CONFIGS: { name: string; wrap: string; params: string; small: string; devs: readonly ("ecp5" | "ice40" | "xc7")[] }[] = [
  ...[2, 4].map((w) => ({ name: NEW_DEC(w), wrap: "wrap_tdec_s", params: `-set W ${w}`, small: "-set A 9", devs: ["ecp5", "ice40", "xc7"] as const })),
  ...[2, 4].map((w) => ({ name: NEW_LOOP(w), wrap: "wrap_loop_s", params: `-set W ${w} -set L 8`, small: "-set A 9", devs: ["ecp5", "ice40", "xc7"] as const })),
  ...[2, 4].map((w) => ({ name: REF_TDEC_R(w), wrap: "wrap_tdec_r", params: `-set W ${w}`, small: "-set A 9", devs: ["ecp5", "ice40"] as const })),
  ...[2, 4].map((w) => ({ name: REF_TDEC_W(w), wrap: "wrap_tdec_w", params: `-set W ${w}`, small: "-set A 9", devs: ["ecp5"] as const })),
  { name: REF_TENC_Q, wrap: "wrap_tenc_q", params: "-set W 4 -set L 8", small: "", devs: ["ecp5"] as const },
  { name: REF_LOOP_R, wrap: "wrap_loop_r", params: "-set W 4 -set L 8", small: "", devs: ["ecp5"] as const },
];
const PNR_TIMEOUT_S = 2400;
async function runSynth(): Promise<Record<string, unknown>> {
  const yosys = findBin("yosys"), np40 = findBin("nextpnr-ice40"), np5 = findBin("nextpnr-ecp5");
  if (!yosys) throw new Error("--synth needs yosys");
  const dir = mkdtempSync(join(tmpdir(), "scp4d-decs-synth-"));
  const files = [RTL, FE, ...REF_DEC, ENC, "hw/scp4d/synth/scp4d_pnr_wrap.v", "hw/scp4d/synth/scp4d_tenc_q_wrap.v", "hw/scp4d/synth/scp4d_tdec_r_wrap.v", WRAP].map((f) => join(root, f)).join(" ");
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
    const tasks = SYN_CONFIGS.flatMap((c, n) => c.devs.map((dev) => async () => {
      const wd = join(dir, `${n}-${dev}`); spawnSync("mkdir", ["-p", wd]);
      const ch = `chparam ${c.params}${dev === "ice40" ? ` ${c.small}` : ""} ${c.wrap}; `;
      const synth = dev === "ecp5" ? `synth_ecp5 -top ${c.wrap} -json n.json` : dev === "ice40" ? `synth_ice40 -top ${c.wrap} -json n.json` : `synth_xilinx -top ${c.wrap} -family xc7`;
      const y = await run(yosys, ["-q", "-l", join(wd, "y.log"), "-p", `read_verilog ${files}; ${ch}hierarchy -top ${c.wrap}; ${synth}; tee -q -o stat.json stat -json`], wd);
      if (y.status !== 0) throw new Error(`yosys failed (${c.name} ${dev}): ${y.out.slice(-800)}`);
      const st = cells(join(wd, "stat.json"));
      const pr = dev === "ecp5" ? await pnrOf(np5, ["--45k", "--package", "CABGA381", "--json", join(wd, "n.json"), "--lpf-allow-unconstrained", "--freq", "12", "--router", ECP5_ROUTER], "ECP5 LFE5U-45F (CABGA381)", wd)
        : dev === "ice40" ? await pnrOf(np40, ["--hx8k", "--package", "ct256", "--json", join(wd, "n.json"), "--pcf-allow-unconstrained", "--freq", "12"], "iCE40-HX8K (ct256)", wd) : null;
      console.log(`synth done: ${c.name} ${dev}`);
      return [c.name, dev, { synth: st, ...(pr ? { place_and_route: pr } : {}) }] as const;
    }));
    const res = await pool(tasks, Math.max(1, Math.min(6, cpus().length)));
    const by: Record<string, Record<string, unknown>> = {};
    for (const [name, dev, v] of res) (by[name] ??= {})[dev === "ice40" ? "ice40_hx8k_addr_w9" : dev === "ecp5" ? "ecp5_45f_full_params" : "xc7_full_params"] = v;
    return {
      label: "SYNTHESIS / PLACE-AND-ROUTE ESTIMATES from open-source tools (one seed, --freq 12 target; ECP5 with nextpnr --router router2; the v0.1.17 and v0.1.13 decoders, the v0.1.16 encoder and the v0.1.17 loop re-placed with the same flow as 'ref' rows for a like-for-like comparison). Not a programmed-FPGA or silicon measurement; no board was used. xc7: yosys cell counts only (no open-source timing).",
      wrapper: `${WRAP}: wrap_tdec_s = wrap_tdec_w (hw/scp4d/synth/scp4d_pnr_wrap.v) with the decoder swapped; wrap_loop_s = wrap_loop_q (hw/scp4d/synth/scp4d_tenc_q_wrap.v) with the decoder swapped (as wrap_tdec_r / wrap_loop_r in hw/scp4d/synth/scp4d_tdec_r_wrap.v). Stream inputs on pins, outputs registered and XOR-folded to 16 pins. The same wrapper logic is added to the new and the reference configurations.`,
      ecp5_router: ECP5_ROUTER,
      parameters: { full: "ADDR_W 11 (D <= 2048)", ice40_small: "ADDR_W 9 (D <= 512)" },
      tools: { yosys: firstLine(yosys, ["-V"]), nextpnr_ecp5: firstLine(np5, ["--version"]), nextpnr_ice40: firstLine(np40, ["--version"]) },
      configs: by,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---------- 7. Measured section, comparison, report ----------
const MEAS_D = ["ok", "done", "err", "unsupported", "err_code", "reject_byte", "accepted", "consumed", "frames", "cycles", "ref_w_cycles", "ref_r_cycles", "beats", "c_hdr", "c_pay", "pops", "records", "iss_idle", "cls_stall", "lanes", "events", "eofs", "dups", "mismatches", "ev_mismatch_frames", "out_diff_w", "out_diff_r", "timeout"] as const;
const MEAS_L = ["ok", "enc_done", "enc_err", "dec_done", "dec_err", "stream_bytes", "consumed", "frames", "cycles", "enc_done_cycle", "enc_last_out", "first_in", "last_in", "first_dec", "lat_min", "lat_max", "lat_sum", "mismatches", "eps_violations", "timeout"] as const;
function measuredSection(runs: Map<string, SimResult>) {
  const pick = (r: SimResult | undefined, keys: readonly string[]) => (r ? Object.fromEntries(keys.map((k) => [k, r[k] as number])) : null);
  return {
    decoder: djobs.map((j) => ({ key: j.key, ...Object.fromEntries(W_LIST.map((W) => {
      const r = runs.get(`dec|${j.key}|${W}|0`), b = runs.get(`dec|${j.key}|${W}|1`);
      const o: Record<string, unknown> = { ...pick(r, MEAS_D) };
      if (j.in_scope && r) { o.cycles_per_element_frame = r4((r.cycles as number) / (j.T * j.D)); o.bubble_run = b ? { ok: b.ok as number, cycles: b.cycles as number, bubbles: b.bubbles as number, mismatches: b.mismatches as number, out_diff_w: b.out_diff_w as number, out_diff_r: b.out_diff_r as number, dups: b.dups as number } : null; }
      return [`W${W}`, o];
    })) })),
    loop: ljobs.map((j) => ({ id: j.id, ...Object.fromEntries(LOOP_CONFIGS.map((c) => { const r = runs.get(`loop|${j.id}|${cfgKey(c)}|0`), g = runs.get(`loop|${j.id}|${cfgKey(c)}|1`);
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
const ice40 = (synth: Record<string, unknown> | null, name: string) => {
  const c = devOf(synth, name, "ice40_hx8k_addr_w9");
  const p = c?.place_and_route;
  if (!p) return null;
  return { fits: p.fits, fmax_mhz: fmaxOf(p), lc: p.utilization?.ICESTORM_LC ?? null, ram: p.utilization?.ICESTORM_RAM ?? null, error: p.error ?? null };
};
const V0116 = JSON.parse(read(V0116_REPORT).toString()) as { measured: { loop: Record<string, unknown>[]; encoder: Record<string, unknown>[] }; synthesis: Record<string, unknown> | null };
const V0117 = JSON.parse(read(V0117_REPORT).toString()) as { synthesis: Record<string, unknown> | null };
const STREAMS = ["env-16x16x2-T64-temporal-last", "env-16x16x2-T256-temporal-last"];
/** Comparison + verdict, computed only from the committed measurements, derived facts, the v0.1.13 / v0.1.16 / v0.1.17 reports and the synthesis section. */
function comparison(m: Meas, synth: Record<string, unknown> | null) {
  const M = new Map(m.decoder.map((d) => [d.key, d as unknown as Record<string, { cycles: number }>]));
  const Lp = new Map(m.loop.map((e) => [e.id, e as unknown as Record<string, { cycles: number }>]));
  const D = new Map(derived.decoder.map((d) => [d.id, d as { element_frames?: number; bytes: number }]));
  const v13c = V0113.comparison.temporal_only;
  const v17 = (name: string) => ecp5(V0117.synthesis, name);
  const vps = (frames: number, cyc: number, f: number | null | undefined) => (f ? Math.round((frames / cyc) * f * 1e6) : null);
  const ratio = (a: number | null | undefined, b: number | null | undefined) => (a && b ? r4(a / b) : null);
  const fN = (w: number) => ecp5(synth, NEW_DEC(w)), fR = (w: number) => ecp5(synth, REF_TDEC_R(w)), fW = (w: number) => ecp5(synth, REF_TDEC_W(w));
  const encRef = ecp5(synth, REF_TENC_Q), loopNew = ecp5(synth, NEW_LOOP(4)), loopRef = ecp5(synth, REF_LOOP_R), loopNew2 = ecp5(synth, NEW_LOOP(2));
  const v17Loop = v17("loop tenc_q W=4 L=8 -> tdec_r W=4"), v17Dec4 = v17("scp4d_tdec_r W=4");
  const rows = STREAMS.map((sid) => {
    const d = D.get(sid)!, frames = d.element_frames!, key = `tdec_w:${sid}`, byW = v13c.find((x) => x.stream === sid)!.by_W;
    const enc = V0116.measured.encoder.find((e) => (e as { id: string }).id === sid) as Record<string, { cycles: number }>;
    const encCyc = enc.W4L8.cycles;
    const dec = Object.fromEntries([2, 4].map((w) => {
      const cyc = M.get(key)![`W${w}`].cycles, oldCyc = byW[`W${w}`].cycles, n = fN(w), r = fR(w), ww = fW(w);
      const v = vps(frames, cyc, n?.fmax_mhz), vr = vps(frames, oldCyc, r?.fmax_mhz), vw = vps(frames, oldCyc, ww?.fmax_mhz);
      return [`W${w}`, { cycles: cyc, v0113_v0117_cycles: oldCyc, cycle_ratio_vs_v0117: r4(cyc / oldCyc), cycles_per_value: r4(cyc / frames),
        tdec_s: n ? { fmax_mhz_estimate: n.fmax_mhz, lut4: n.lut4, ff: n.ff, ebr: n.ebr, dsp: n.dsp, values_per_s: v, stream_MB_per_s: n.fmax_mhz ? r2((d.bytes / cyc) * n.fmax_mhz) : null } : null,
        ref_tdec_r_same_flow: r ? { fmax_mhz_estimate: r.fmax_mhz, lut4: r.lut4, ff: r.ff, ebr: r.ebr, values_per_s: vr } : null,
        ref_tdec_w_same_flow: ww ? { fmax_mhz_estimate: ww.fmax_mhz, lut4: ww.lut4, ff: ww.ff, values_per_s: vw } : null,
        clock_gain_vs_tdec_r_same_flow: ratio(n?.fmax_mhz, r?.fmax_mhz), values_gain_vs_tdec_r_same_flow: ratio(v, vr), values_gain_vs_tdec_w_same_flow: ratio(v, vw) }];
    }));
    const encV = vps(frames, encCyc, encRef?.fmax_mhz);
    const l = Lp.get(sid)!.W4L8.cycles, l2 = Lp.get(sid)!.W2L8.cycles;
    const l16 = (V0116.measured.loop.find((x) => (x as { id: string }).id === sid) as Record<string, { cycles: number }>).W4L8.cycles;
    const lv = vps(frames, l, loopNew?.fmax_mhz), lvr = vps(frames, l16, loopRef?.fmax_mhz), lv17 = vps(frames, l16, v17Loop?.fmax_mhz);
    return { stream: sid, bytes: d.bytes, element_frames: frames, decoder: dec,
      encoder_tenc_q_W4L8: { cycles: encCyc, same_flow: encRef ? { fmax_mhz_estimate: encRef.fmax_mhz, values_per_s: encV } : null,
        decoder_W4_over_encoder_same_flow: ratio((dec.W4 as { tdec_s: { values_per_s: number | null } | null }).tdec_s?.values_per_s, encV) },
      loop_W4L8: { cycles: l, v0116_v0117_cycles: l16, cycle_ratio_vs_v0117: r4(l / l16),
        loop_s: loopNew ? { fmax_mhz_estimate: loopNew.fmax_mhz, lut4: loopNew.lut4, ff: loopNew.ff, ebr: loopNew.ebr, values_per_s: lv, microseconds: loopNew.fmax_mhz ? r2(l / loopNew.fmax_mhz) : null } : null,
        ref_loop_r_same_flow: loopRef ? { fmax_mhz_estimate: loopRef.fmax_mhz, values_per_s: lvr } : null,
        v0117_committed: v17Loop ? { fmax_mhz_estimate: v17Loop.fmax_mhz, values_per_s: lv17 } : null,
        clock_gain_same_flow: ratio(loopNew?.fmax_mhz, loopRef?.fmax_mhz), values_gain_same_flow: ratio(lv, lvr), values_gain_vs_v0117_committed: ratio(lv, lv17) },
      loop_W2L8: { cycles: l2, loop_s: loopNew2 ? { fmax_mhz_estimate: loopNew2.fmax_mhz, values_per_s: vps(frames, l2, loopNew2.fmax_mhz) } : null },
    };
  });
  const t = rows[0];
  const n4 = fN(4), r4_ = fR(4), n2 = fN(2), r2_ = fR(2);
  const limiter = !n4?.fmax_mhz || !encRef?.fmax_mhz || !loopNew?.fmax_mhz ? null : n4.fmax_mhz < encRef.fmax_mhz ? "decoder" : "encoder";
  const fmt = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : String(x));
  const d4 = t.decoder.W4 as { cycles: number; v0113_v0117_cycles: number; tdec_s: { values_per_s: number | null } | null; values_gain_vs_tdec_r_same_flow: number | null };
  return {
    label: "Cycles are MEASURED in simulation (Icarus Verilog) and equal the exact cycle model (full rate); v0.1.13 / v0.1.17 cycles are their committed (identical) counts; fmax, LUT/FF/RAM are SYNTHESIS ESTIMATES (one seed, no board); throughput = measured cycles × estimated fmax, each design with its own cycles. No energy was measured.",
    env: rows,
    ice40: Object.fromEntries([NEW_DEC(2), NEW_DEC(4), REF_TDEC_R(2), REF_TDEC_R(4), NEW_LOOP(2), NEW_LOOP(4)].map((k) => [k, ice40(synth, k)])),
    verdict: synth ? {
      decoder_clock: `Same flow (ECP5 router2, seed 1): scp4d_tdec_s W = 4 ${fmt(n4?.fmax_mhz)} MHz est. vs scp4d_tdec_r W = 4 ${fmt(r4_?.fmax_mhz)} MHz (${fmt(ratio(n4?.fmax_mhz, r4_?.fmax_mhz))}×; v0.1.17 committed ${fmt(v17Dec4?.fmax_mhz)} MHz); W = 2 ${fmt(n2?.fmax_mhz)} vs ${fmt(r2_?.fmax_mhz)} MHz (${fmt(ratio(n2?.fmax_mhz, r2_?.fmax_mhz))}×).`,
      decoder_throughput: `env T64, W = 4: ${d4.cycles} cycles (v0.1.17: ${d4.v0113_v0117_cycles}) -> ${fmt(d4.tdec_s?.values_per_s)} values/s est., ${fmt(d4.values_gain_vs_tdec_r_same_flow)}× tdec_r in the same run (cycle change included).`,
      loop: `Closed loop tenc_q W4L8 -> tdec_s W4: ${t.loop_W4L8.cycles} cycles (v0.1.17: ${t.loop_W4L8.v0116_v0117_cycles}), ${fmt(t.loop_W4L8.loop_s?.fmax_mhz_estimate)} MHz est. -> ${fmt(t.loop_W4L8.loop_s?.values_per_s)} values/s; v0.1.17 loop in the same run ${fmt(t.loop_W4L8.ref_loop_r_same_flow?.fmax_mhz_estimate)} MHz (${fmt(t.loop_W4L8.ref_loop_r_same_flow?.values_per_s)} values/s), committed ${fmt(t.loop_W4L8.v0117_committed?.fmax_mhz_estimate)} MHz (${fmt(t.loop_W4L8.v0117_committed?.values_per_s)} values/s).`,
      limiter: limiter === null ? "unknown (no estimate)" : limiter === "decoder"
        ? `The W = 4 decoder still sets the loop's clock: standalone ${fmt(n4?.fmax_mhz)} MHz est. vs encoder tenc_q W4L8 ${fmt(encRef?.fmax_mhz)} MHz in the same run (loop ${fmt(loopNew?.fmax_mhz)} MHz).`
        : `The decoder no longer limits the loop: standalone W = 4 decoder ${fmt(n4?.fmax_mhz)} MHz est. vs encoder tenc_q W4L8 ${fmt(encRef?.fmax_mhz)} MHz in the same run (loop ${fmt(loopNew?.fmax_mhz)} MHz).`,
    } : null,
    energy: "not measured; no pJ figure is reported for v0.1.18",
  };
}

async function main(): Promise<void> {
  // ---------- simulator stage (uncounted) ----------
  const iverilog = NO_SIM ? null : findBin("iverilog"), vvp = NO_SIM ? null : findBin("vvp");
  let sim: Awaited<ReturnType<typeof runSim>> | null = null;
  if (iverilog && vvp) sim = await runSim(iverilog, vvp);
  else if (REQUIRE_SIM) { console.log("FAIL check-scp-v0118-rtl (--require-sim / --write: Icarus Verilog not found)"); process.exit(1); }
  else console.log("SKIP sim (Icarus Verilog not found or --no-sim): verifying the committed report only");

  const hashes = Object.fromEntries([RTL, FE, TB, TBL, WRAP, MODEL].map((p) => [p, existsSync(join(root, p)) ? sha(read(p)) : null]));
  let committed = existsSync(join(root, REPORT)) ? JSON.parse(read(REPORT).toString()) : null;
  if (WRITE && sim) {
    const measured = measuredSection(sim.runs);
    const synthesis = SYNTH ? await runSynth() : committed?.synthesis ?? null;
    const rep = {
      format: "scp4d-v0118-rtl-report", version: 1,
      label: "TEST ONLY. Cycles MEASURED in simulation of hw/scp4d/rtl/scp4d_tdec_s.v (+ the unchanged v0.1.17 scp4d_fe_r.v), with the unchanged v0.1.13 scp4d_tdec_w and v0.1.17 scp4d_tdec_r decoding the same streams (outputs compared per frame and element), and of the closed loop with the unchanged v0.1.16 scp4d_tenc_q (same W); synthesis figures are ESTIMATES; no energy measured; all inputs are labelled synthetic or hand-written fixtures.",
      rtl: hashes, simulator: sim.tools,
      design: {
        change: "v0.1.17 scp4d_tdec_r's single issue chain split into two stages: a token classifier (fixed per-position roles, at most two narrow gap adds per cycle at K = 4, pop count by priority encode, element records with limit / frame end / error) and a bank issuer (last hold: event records in order until a bank repeats; zero / linear hold: aligned block of P elements around a cursor), joined by a record register and a pop-late record queue (RQ = 3W). Errors travel as records. Front end (scp4d_fe_r) and bank pipeline unchanged.",
        cycle_behaviour: `changed; exact cycle model scripts/scp-v0118-rtl-model.ts (classifier runs during the state clear, head token classified alone, one record-register cycle, RQ = 3W occupancy rule, issuer window of P records with bank / block rules, tail ${TDECS_TAIL})`,
        W: [...W_LIST], loop_configs: LOOP_CONFIGS.map(cfgKey),
      },
      derived, measured, synthesis,
      comparison: comparison(measured, synthesis),
    };
    writeFileSync(join(root, REPORT), JSON.stringify(rep, null, 2) + "\n");
    console.log(`wrote ${REPORT}`);
    committed = rep;
  }
  const rep = committed;
  const M = rep?.measured as Meas | undefined;
  const dOf = (key: string, W: number) => (M?.decoder.find((d) => d.key === key) as Record<string, Record<string, number>> | undefined)?.[`W${W}`];
  check(`committed ${REPORT} exists and pins the current decoder, front end, both testbenches, the P&R wrapper and the cycle model (sha256)`,
    !!rep && JSON.stringify(rep.rtl) === JSON.stringify(hashes));
  check("report's derived section (job lists, stream structure, sim-input hashes, cycle models at W = 1, 2, 4) matches this run", JSON.stringify(rep?.derived) === JSON.stringify(derived));
  const exact = (j: DJob, W: number) => { const r = dOf(j.key, W); return !!r && r.ok === 1 && r.done === 1 && r.err === 0 && r.mismatches === 0 && r.ev_mismatch_frames === 0 && r.frames === j.T && r.consumed === j.bytes.length && r.timeout === 0; };
  check(`all ${inD.length} in-scope temporal-only vectors (zero / last / linear; v0.1.10, v0.1.11 and env T64 / T256) bit-exact at W = 1, 2 and 4: every element of every frame, per-frame event counts, every byte consumed`,
    !!M && inD.every((j) => W_LIST.every((W) => exact(j, W))));
  check("every in-scope vector is also bit-exact at every W with pseudo-random input gaps (fixed-seed LFSR)",
    !!M && inD.every((j) => W_LIST.every((W) => { const b = dOf(j.key, W)?.bubble_run as unknown as { ok: number; mismatches: number; bubbles: number } | null | undefined; return !!b && b.ok === 1 && b.mismatches === 0 && b.bubbles > 0; })));
  check(`output comparison with the unchanged v0.1.13 scp4d_tdec_w AND v0.1.17 scp4d_tdec_r decoding the same stream (own beat feeders): every run (${djobs.length} streams × 3 W, full rate and gaps, negatives included) issues the same elements with the same codes and event flags in every frame, no element twice in a frame, the same lane / frame-end counts and the same done / err / error code / unsupported`,
    !!M && djobs.every((j) => W_LIST.every((W) => { const r = dOf(j.key, W); const b = r?.bubble_run as unknown as { out_diff_w: number; out_diff_r: number; dups: number } | null | undefined;
      return !!r && r.out_diff_w === 0 && r.out_diff_r === 0 && r.dups === 0 && (!j.in_scope || (!!b && b.out_diff_w === 0 && b.out_diff_r === 0 && b.dups === 0)); })));
  check(`${djobs.filter((j) => !j.in_scope).length} out-of-scope / corrupted streams (header + token path: q = 0, index / gap out of range, first index D + 1, 6-byte varint) rejected with the expected unsupported / error code at every W`,
    !!M && djobs.filter((j) => !j.in_scope).every((j) => W_LIST.every((W) => { const r = dOf(j.key, W); return !!r && r.ok === 1 && r.err === 1 && r.done === 0 && r.unsupported === (j.expect_unsup ? 1 : 0) && r.err_code === (j.expect_unsup || j.expect_err); })));
  const mOf = (j: DJob, W: number) => (derived.decoder.find((x) => x.key === j.key) as unknown as { model: Record<string, Record<string, number>> }).model[`W${W}`];
  check("measured cycles equal the new exact cycle model (scripts/scp-v0118-rtl-model.ts) for every in-scope vector at W = 1, 2, 4",
    !!M && inD.every((j) => W_LIST.every((W) => dOf(j.key, W)?.cycles === mOf(j, W).cycles)));
  check("the model also reproduces the classifier / issuer counters for every in-scope vector at W = 1, 2, 4: header and payload cycles, tokens popped, records, lanes, issuer cycles with nothing to issue, classifier cycles blocked by the record queue",
    !!M && inD.every((j) => W_LIST.every((W) => { const r = dOf(j.key, W), o = mOf(j, W); return !!r && r.c_hdr === o.header_cycles && r.c_pay === o.payload_cycles && r.pops === o.pops && r.records === o.records && r.lanes === o.lanes && r.iss_idle === o.iss_idle && r.cls_stall === o.cls_stall; })));
  check("the reference decoders ran as committed: in every run (full rate) the unchanged scp4d_tdec_w and scp4d_tdec_r took exactly v0.1.13's committed cycles (v0.1.17 = v0.1.13 cycle for cycle)",
    !!M && djobs.filter((j) => !j.id.endsWith("D-plus-1")).every((j) => W_LIST.every((W) => { const r = dOf(j.key, W), o = v13(j.key, W); return !!r && !!o && r.ref_w_cycles === o.cycles && r.ref_r_cycles === o.cycles; })));
  const lOf = (id: string, k: string) => (M?.loop.find((l) => l.id === id) as Record<string, Record<string, number>> | undefined)?.[k];
  check(`closed loop: every one of the ${ljobs.length} jobs at ${LOOP_CONFIGS.map(cfgKey).join(", ")} (tenc_q -> tdec_s, same W) decodes bit-exact to the model's reconstruction and within the deadband of the input codes, at full rate and with random gaps; every stream byte consumed`,
    !!M && ljobs.every((j) => LOOP_CONFIGS.every((c) => { const r = lOf(j.id, cfgKey(c)); const g = r?.gaps_run as unknown as { ok: number; mismatches: number; eps_violations: number } | undefined;
      return !!r && r.ok === 1 && r.enc_err === 0 && r.dec_err === 0 && r.dec_done === 1 && r.mismatches === 0 && r.eps_violations === 0 && r.consumed === j.bytes.length && r.frames === j.T && !!g && g.ok === 1 && g.mismatches === 0 && g.eps_violations === 0; })));
  check("closed loop timing is consistent: for every job × configuration the decoder is done after the encoder's last output beat and its first frame is decoded after the encoder's first input; cycles are recorded for the comparison (they change against v0.1.16 / v0.1.17's loop)",
    !!M && ljobs.every((j) => LOOP_CONFIGS.every((c) => { const a = lOf(j.id, cfgKey(c)); return !!a && a.cycles > a.enc_last_out && a.first_dec > a.first_in && a.lat_max >= a.lat_min; })));
  check("committed comparison and verdict recompute exactly from the committed measurements, derived facts, the v0.1.13 / v0.1.16 / v0.1.17 reports and the synthesis section",
    !!M && JSON.stringify(rep.comparison) === JSON.stringify(comparison(M, rep.synthesis ?? null)));
  check("labels: synthesis section (when present) is an ESTIMATE; throughput is measured cycles × estimated fmax; no energy measured and no pJ figure anywhere in the report",
    (!rep?.synthesis || /ESTIMATE/.test(String(rep.synthesis.label ?? ""))) && /MEASURED in simulation/.test(String(rep?.comparison?.label ?? ""))
    && !/pJ|picojoule/i.test(JSON.stringify({ ...(rep ?? {}), comparison: { ...(rep?.comparison ?? {}), energy: null } })) && /not measured/.test(String(rep?.comparison?.energy ?? "")));

  if (sim && committed && !WRITE) {
    const same = JSON.stringify(measuredSection(sim.runs)) === JSON.stringify(committed.measured);
    console.log(`${same ? "SIM PASS" : "SIM FAIL"} re-simulated ${djobs.length} decoder streams × ${W_LIST.length} W (+ gap runs, outputs compared with tdec_w / tdec_r) and ${ljobs.length} loop jobs × ${LOOP_CONFIGS.length} configs with ${sim.tools.iverilog}: ${same ? "identical to the committed report" : "DIFFERS from the committed report"}`);
    if (!same) failures.push("simulation differs from committed report");
  }

  // ---------- 8. Table ----------
  if (M) {
    console.log("\nvector                                   bytes   values    W1 cyc    W2 cyc    W4 cyc  v0117 W4  outputs  loop W4L8");
    for (const j of inD) {
      const c = W_LIST.map((W) => dOf(j.key, W)?.cycles ?? "-");
      console.log(`${j.id.padEnd(38)} ${String(j.bytes.length).padStart(7)} ${String(j.T * j.D).padStart(8)} ${c.map((x) => String(x).padStart(9)).join(" ")} ${String(dOf(j.key, 4)?.ref_r_cycles ?? "-").padStart(9)} ${W_LIST.every((W) => dOf(j.key, W)?.out_diff_w === 0 && dOf(j.key, W)?.out_diff_r === 0) ? "    same" : "    DIFF"} ${String(lOf(j.id, "W4L8")?.cycles ?? "-").padStart(10)}`);
    }
  }
  if (failures.length) { console.log(`FAIL check-scp-v0118-rtl (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
  console.log(`PASS check-scp-v0118-rtl (${passed} checks)`);
}
main().catch((e) => { console.log(`FAIL check-scp-v0118-rtl (${(e as Error).message})`); process.exit(1); });
