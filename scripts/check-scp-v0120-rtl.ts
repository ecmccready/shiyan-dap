/** TEST ONLY. v0.1.20 K1 RTL check: scp4d_ede (temporal-only default, relations mode bit)
 * and scp4d_fsd. Counted checks do not need a simulator. If iverilog is on PATH the
 * vectors are re-simulated and must match the model. --synth runs Yosys only
 * (no nextpnr). Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0120-rtl.ts [--synth]
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/scp/measurement";
import { encodeIntScp4d } from "./scp-v0110-int-scp4d";
import { hostHeader, type EncJob } from "./scp-v0114-rtl-model";
import { EDE_ANALYTIC_CODE_BITS, EDE_DECLARED_CODE_BITS, runEde, runFsd, type FanSlot, type Tok } from "./scp-v0120-ede-model";
import { envTemporalStreams } from "./scp-v0111-rtl-vectors";
import { relationsVectors, temporalVectors, vectorFile, type EdeVector } from "./scp-v0120-ede-vectors";
import { decoderCycles, k1Cycles, k1MemoryBytes, DECODER_CYCLE_TOLERANCE, K1_CYCLE_TOLERANCE } from "./scp-v0120-system-model";

const root = resolve(join(import.meta.dirname, ".."));
const TEMPORAL = "fixtures/scp/golden-vectors-scp4d-ede.json";
const RELATIONS = "fixtures/scp/golden-vectors-scp4d-ede-relations.json";
const SYNTH = process.argv.includes("--synth");

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const read = (p: string) => readFileSync(join(root, p), "utf8");
const pretty = (v: unknown) => `${JSON.stringify(JSON.parse(canonicalJson(v)), null, 2)}\n`;

const temporal = vectorFile("temporal", temporalVectors());
const relations = vectorFile("relations", relationsVectors());
check("temporal golden file matches the model", read(TEMPORAL) === pretty(temporal), `${temporal.vectors.length} vectors`);
check("relations golden file matches the model", read(RELATIONS) === pretty(relations), `${relations.vectors.length} vectors`);

const all = [...temporal.vectors, ...relations.vectors];
check("census ≤ analytic bound ≤ declared width on every vector",
  all.every((v) => v.census_bits <= EDE_ANALYTIC_CODE_BITS && EDE_ANALYTIC_CODE_BITS <= EDE_DECLARED_CODE_BITS));
check("temporal non-error vectors have the same decision-change set as full scan",
  temporal.vectors.filter((v) => v.ede.err === 0).every((v) => v.same_change_set === true));
const relChurn = relations.vectors.find((v) => v.id === "churn-low-seed1");
const tmpChurn = temporal.vectors.find((v) => v.id === "churn-low-seed1");
check("relations mode evaluates more cells than temporal-only on the low-churn stream",
  !!relChurn && !!tmpChurn && relChurn.ede.evals > tmpChurn.ede.evals && relChurn.ede.cycles > tmpChurn.ede.cycles,
  relChurn && tmpChurn ? `${relChurn.ede.evals} > ${tmpChurn.ede.evals}` : "missing");
check("negative streams return elem and fan-target errors",
  temporal.vectors.find((v) => v.id === "neg-elem")?.ede.err === 1
  && relations.vectors.find((v) => v.id === "neg-fan-target")?.ede.err === 2);
check("a code equal to the threshold is not a decision change",
  temporal.vectors.find((v) => v.id === "margin-zero")?.ede.changes.length === 0);

const edeRtl = read("hw/scp4d/rtl/scp4d_ede.v");
const fsdRtl = read("hw/scp4d/rtl/scp4d_fsd.v");
const rtlBody = `${edeRtl}\n${fsdRtl}`.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check("K1 RTL is Verilog-2005: no initial, no multiply, mode_relations is a port",
  !/\binitial\b/.test(rtlBody)
  && !rtlBody.split("\n").some((l) => /[^*/(\s\dA-Z_]\s*\*\s*[^*/)\s\d]/.test(l.replace(/\b[A-Z][A-Z0-9_]*\s*\*/g, "").replace(/\*\s*[A-Z][A-Z0-9_]*/g, "")))
  && /input\s+wire\s+mode_relations/.test(edeRtl)
  && /temporal-only by default/i.test(edeRtl));

// System model vs a committed v0.1.18 cycle count (tolerance 0) and vs K1 (tolerance 0).
{
  const v0118 = JSON.parse(read("fixtures/scp/v0118-rtl-report.json")) as { derived: { decoder: { id: string; model?: { W2?: { cycles: number } } }[] } };
  const committed = v0118.derived.decoder.find((d) => d.id === "medicare-6")?.model?.W2?.cycles;
  const golden = JSON.parse(read("fixtures/scp/golden-vectors-scp4d.json")) as { vectors: { id: string; expected_bytes_hex: string }[] };
  const hex = golden.vectors.find((v) => v.id === "medicare-6")?.expected_bytes_hex ?? "";
  const got = hex ? decoderCycles(Buffer.from(hex, "hex"), 2) : -1;
  check("system model reproduces the v0.1.18 medicare-6 W2 cycle count (tolerance 0)",
    committed !== undefined && got === committed && DECODER_CYCLE_TOLERANCE === 0, `${got} vs ${committed}`);
  const sample = temporal.vectors[0];
  const fan = Array.from({ length: sample.D }, () => [{ tgt: 0, valid: false }, { tgt: 0, valid: false }, { tgt: 0, valid: false }, { tgt: 0, valid: false }]);
  const tokens = sample.tokens.map((t) => ({ elem: t.elem, code: t.code, event: t.event === 1, eof: t.eof === 1, last: t.last === 1 }));
  const k1 = k1Cycles(sample.D, sample.threshold, false, fan, tokens);
  check("system model K1 cycles match the exact model (tolerance 0)", k1 === sample.ede.cycles && K1_CYCLE_TOLERANCE === 0, String(k1));
  const events = sample.tokens.filter((t) => t.event === 1).length;
  check("K1 memory traffic is the closed form and is positive", k1MemoryBytes(events, sample.ede.evals) === events * 6 + sample.ede.evals * 5 && k1MemoryBytes(events, sample.ede.evals) > 0);
}

function findBin(name: string): string | null {
  const r = spawnSync(name, ["-V"], { encoding: "utf8" });
  return r.status === 0 || (r.stdout ?? "").length > 0 ? name : null;
}

function stim(v: EdeVector, changes: EdeVector["ede"]["changes"], err: number): string {
  const lines = [`${v.D} ${v.threshold} ${v.mode === "relations" ? 1 : 0}`, String(v.fan.length)];
  for (const f of v.fan) lines.push(`${f.src} ${f.slot} ${f.tgt} ${f.valid}`);
  lines.push(String(v.tokens.length));
  for (const t of v.tokens) lines.push(`${t.elem} ${t.code} ${t.event} ${t.eof} ${t.last}`);
  lines.push(String(changes.length));
  for (const c of changes) lines.push(`${c.frame} ${c.elem} ${c.decision}`);
  lines.push(String(err));
  return `${lines.join("\n")}\n`;
}

const iverilog = findBin("iverilog");
const vvp = findBin("vvp");
if (iverilog && vvp) {
  const dir = mkdtempSync(join(tmpdir(), "scp4d-ede-"));
  const comp = spawnSync(iverilog, ["-g2012", "-o", join(dir, "ede.vvp"),
    join(root, "hw/scp4d/tb/scp4d_ede_tb.v"), join(root, "hw/scp4d/rtl/scp4d_ede.v"), join(root, "hw/scp4d/rtl/scp4d_fsd.v")],
    { encoding: "utf8" });
  if (comp.status !== 0) {
    check("iverilog compiled K1", false, comp.stderr.slice(-400));
  } else {
    let simFail = 0;
    let simN = 0;
    const runOne = (v: EdeVector, dut: 0 | 1) => {
      const exp = dut === 0 ? v.ede : v.fsd;
      if (!exp) return;
      const file = join(dir, `s${simN}.txt`);
      writeFileSync(file, stim(v, exp.changes, exp.err));
      const r = spawnSync(vvp, ["-n", join(dir, "ede.vvp"), `+stim=${file}`, `+dut=${dut}`], { encoding: "utf8" });
      const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT "));
      simN++;
      if (!line) { simFail++; return; }
      const num = (k: string) => Number(line.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
      if (num("ok") !== 1) simFail++;
      else if (exp.err === 0 && (num("cycles") !== exp.cycles || num("evals") !== exp.evals)) simFail++;
    };
    for (const v of temporal.vectors) { runOne(v, 0); if (v.fsd) runOne(v, 1); }
    for (const v of relations.vectors) runOne(v, 0);
    if (simFail) {
      console.error(`SIM FAIL ${simFail} of ${simN} K1 runs`);
      process.exit(1);
    }
    console.log(`SIM PASS ${simN} K1 runs bit-exact in both modes (not counted)`);
    const shape = { nx: 2, ny: 2, nz: 1, channels: 1 };
    const raw = [Float64Array.from([0, 0, 0, 0]), Float64Array.from([4, 0, 0, -4]), Float64Array.from([4, 6, 0, -4])];
    const enc = encodeIntScp4d({ shape, times: [1000, 1100, 1200], eps: [1], relations: [] }, raw, { rank: 0, relations: false, predictor: "last", G: 1 });
    const job = { eps: [1], times: [1000, 1100, 1200], meta: null, shape, T: raw.length, D: 4, cfg: enc.cfg } as unknown as EncJob;
    const h = hostHeader(job);
    const tokens: Tok[] = [];
    enc.perFrame.forEach((fr, t) => {
      for (const elem of fr.positions) tokens.push({ elem, code: enc.decoded[t][elem], event: true, eof: false, last: false });
      tokens.push({ elem: 0, code: 0, event: false, eof: true, last: t === raw.length - 1 });
    });
    const model = runEde(4, 0, false, [], tokens);
    const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
    const hx = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("\n") + "\n";
    writeFileSync(join(dir, "codes.hex"), raw.flatMap((f) => Array.from(f).map(w32)).join("\n") + "\n");
    writeFileSync(join(dir, "dec.hex"), enc.decoded.flatMap((f) => Array.from(f).map((n) => w32(n))).join("\n") + "\n");
    writeFileSync(join(dir, "hdr.hex"), hx(Uint8Array.from([...h.eps, ...h.tm])));
    writeFileSync(join(dir, "chg.txt"), [String(model.changes.length), ...model.changes.map((c) => `${c.frame} ${c.elem} ${c.decision}`)].join("\n") + "\n");
    const lc = spawnSync(iverilog, ["-g2012", "-o", join(dir, "loop.vvp"),
      join(root, "hw/scp4d/tb/scp4d_loop_ede_tb.v"), join(root, "hw/scp4d/rtl/scp4d_tenc_q.v"),
      join(root, "hw/scp4d/rtl/scp4d_tdec_s.v"), join(root, "hw/scp4d/rtl/scp4d_fe_r.v"), join(root, "hw/scp4d/rtl/scp4d_ede.v")],
      { encoding: "utf8" });
    if (lc.status !== 0) { console.error(lc.stderr.slice(-400)); process.exit(1); }
    const lr = spawnSync(vvp, ["-n", join(dir, "loop.vvp"),
      `+codes=${join(dir, "codes.hex")}`, `+dec=${join(dir, "dec.hex")}`, `+hdr=${join(dir, "hdr.hex")}`, `+chg=${join(dir, "chg.txt")}`,
      `+nbytes=${enc.bytes.length}`, `+nhdr=${h.eps.length + h.tm.length}`,
      "+nx=2", "+ny=2", "+nz=1", "+c=1", "+t=3", "+g=1", "+pred=1", `+tmlen=${h.tm.length}`, "+thr=0", "+id=tiny"],
      { encoding: "utf8" });
    const lline = (lr.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")) ?? "";
    const lok = /ok=1/.test(lline) && /dec_ok=1/.test(lline);
    if (!lok) { console.error(`LOOP FAIL ${lline || lr.stderr.slice(-300)}`); process.exit(1); }
    const lcycles = Number(lline.match(/cycles=(-?\d+)/)?.[1]);
    console.log(`LOOP PASS tenc_q → tdec_s → scp4d_ede bit-exact on the tiny job (decoder codes and decision records; EDE cycles ${lcycles} measured; not counted)`);
  }
} else {
  console.log("SKIP sim (iverilog not on PATH)");
}

{
  const stream = envTemporalStreams().find((s) => s.id === "env-16x16x2-T64-temporal-last");
  const tokens: Tok[] = [];
  stream?.perFrame.forEach((fr, t) => {
    fr.positions.forEach((elem, i) => tokens.push({ elem, code: fr.q[i], event: true, eof: false, last: false }));
    tokens.push({ elem: 0, code: 0, event: false, eof: true, last: t === (stream?.perFrame.length ?? 1) - 1 });
  });
  const D = stream?.D ?? 0;
  const fan: FanSlot[][] = Array.from({ length: D }, (_, i) => [
    { tgt: (i + 1) % D, valid: true }, { tgt: 0, valid: false }, { tgt: 0, valid: false }, { tgt: 0, valid: false },
  ]);
  const temporal = runEde(D, 0, false, fan, tokens);
  const relations = runEde(D, 0, true, fan, tokens);
  const fsd = runFsd(D, 0, tokens);
  const env = JSON.parse(read("fixtures/scp/v0120-k1-env.json")) as {
    ede_temporal: { cycles: number; evals: number };
    ede_relations: { cycles: number; evals: number };
    fsd: { cycles: number; evals: number };
    loop_ede_w4l8: { cycles: number; evals: number; overflow: number };
  };
  check("env T64 K1 file matches the exact model, the concurrent loop wall clock equals that EDE count, and power needs a real board",
    temporal.cycles === env.ede_temporal.cycles && temporal.evals === env.ede_temporal.evals
    && relations.cycles === env.ede_relations.cycles && relations.evals === env.ede_relations.evals
    && fsd.cycles === env.fsd.cycles && fsd.evals === env.fsd.evals
    && env.loop_ede_w4l8.cycles === env.ede_temporal.cycles && env.loop_ede_w4l8.evals === temporal.evals
    && env.loop_ede_w4l8.overflow === 0,
    String(temporal.cycles));
}
if (SYNTH) {
  const yosys = findBin("yosys");
  if (!yosys) { console.error("SYNTH FAIL yosys not on PATH"); process.exit(1); }
  const cells: number[] = [];
  for (const top of ["scp4d_ede", "scp4d_fsd"]) {
    const file = join(root, `hw/scp4d/rtl/${top}.v`);
    const p = `read_verilog ${file}; hierarchy -top ${top}; synth; stat`;
    const r = spawnSync(yosys, ["-p", p], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const n = Number((r.stdout ?? "").match(/Number of cells:\s+(\d+)/)?.[1]);
    if (r.status !== 0 || !(n > 0)) {
      console.error(`SYNTH FAIL ${top} ${(r.stderr || r.stdout).slice(-400)}`);
      process.exit(1);
    }
    cells.push(n);
  }
  console.log(`SYNTH PASS yosys generic cells ede=${cells[0]} fsd=${cells[1]} (estimate; memories not mapped to EBR; not place-and-route; power needs real board)`);
}

if (failures.length) {
  console.error(`FAIL check-scp-v0120-rtl (${passed} passed, ${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0120-rtl (${passed} checks)`);
