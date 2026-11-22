/** TEST ONLY. v0.1.22 loop variants.
 * scp4d_tdec_s_w4_bram must match scp4d_tdec_s on the golden streams (same cycles).
 * scp4d_tenc_q_w4l8_bram must match the golden bytes; its cycle count may differ.
 * The closed loop of the two variants must be bit-exact on bytes. Cycles are reported.
 * v0.1.16 / v0.1.17 / v0.1.18 files stay byte-identical.
 *
 * Counted checks need no simulator. With iverilog, the streams below are re-simulated.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0122-rtl.ts
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encoderJobs, hostHeader } from "./scp-v0114-rtl-model";
import { envTemporalStreams, simFiles } from "./scp-v0111-rtl-vectors";
import { tdecSCycleModel } from "./scp-v0118-rtl-model";

const root = resolve(join(import.meta.dirname, ".."));
const read = (p: string) => readFileSync(join(root, p));
const sha = (b: Buffer | Uint8Array | string) => createHash("sha256").update(b).digest("hex");
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

const prereg = JSON.parse(read("fixtures/scp/v0122-prereg.json").toString()) as {
  part_45f: { target_trellis_comb: number }; verdict: { PASS: string; MIXED: string; FAIL: string };
};
check("v0.1.22 target is 37270 COMB and the three verdicts are locked",
  prereg.part_45f.target_trellis_comb === 37270 && /five/.test(prereg.verdict.PASS) && /three/.test(prereg.verdict.MIXED));

const v0116 = JSON.parse(read("fixtures/scp/v0116-rtl-report.json").toString()) as { rtl: Record<string, string> };
const v0117 = JSON.parse(read("fixtures/scp/v0117-rtl-report.json").toString()) as { rtl: Record<string, string> };
const v0118 = JSON.parse(read("fixtures/scp/v0118-rtl-report.json").toString()) as { rtl: Record<string, string> };
const pinned = [
  ["hw/scp4d/rtl/scp4d_tenc_q.v", v0116.rtl["hw/scp4d/rtl/scp4d_tenc_q.v"]],
  ["hw/scp4d/rtl/scp4d_fe_r.v", v0117.rtl["hw/scp4d/rtl/scp4d_fe_r.v"]],
  ["hw/scp4d/rtl/scp4d_tdec_s.v", v0118.rtl["hw/scp4d/rtl/scp4d_tdec_s.v"]],
];
check("v0.1.16 encoder, v0.1.17 front end and v0.1.18 decoder are byte-identical",
  pinned.every(([p, h]) => h && sha(read(p)) === h));

const wrap = read("hw/scp4d/synth/scp4d_ede_wrap.v").toString();
check("the loop wrapper instantiates the two v0.1.22 variants",
  wrap.includes("scp4d_tenc_q_w4l8_bram") && wrap.includes("scp4d_tdec_s_w4_bram") && !wrap.includes("scp4d_tenc_q #"));

const hier = JSON.parse(read("fixtures/scp/v0122-hierarchy-stat.json").toString()) as { tools: { yosys: string }; modules: { module: string; LUT4: number }[] };
check("hierarchy stat is from Yosys 0.71+50 583f380c6 and names the four loop blocks",
  hier.tools.yosys.includes("583f380c6") && ["scp4d_tenc_q", "scp4d_tdec_s", "scp4d_fe_r", "scp4d_k1_tap", "scp4d_ede"].every((id) => hier.modules.some((m) => m.module === id && m.LUT4 > 0)));

const hx = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("\n") + "\n";
const w32 = (v: number) => ((v < 0 ? v + 2 ** 32 : v) >>> 0).toString(16).padStart(8, "0");
function findBin(name: string): string | null {
  for (const cand of [name, `/opt/eda/oss-cad-suite/bin/${name}`]) {
    const r = spawnSync(cand, ["-V"], { encoding: "utf8" });
    if ((r.stdout ?? "").length > 0 || (r.stderr ?? "").includes("Icarus")) return cand;
  }
  return null;
}
const iverilog = findBin("iverilog");
const vvp = findBin("vvp");

if (!iverilog || !vvp) {
  console.log("SKIP sim — iverilog/vvp not found");
} else {
  const dir = mkdtempSync(join(tmpdir(), "v0122-"));
  const dec = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_tdec_s_tb.W=4", "-o", join(dir, "dec.vvp"),
    join(root, "hw/scp4d/tb/scp4d_tdec_s_w4_bram_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_r_share.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_w.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_w.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_r.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_r.v")], { encoding: "utf8" });
  if (dec.status !== 0) { console.log(dec.stderr); failures.push("decoder compile"); }
  const enc = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_tenc_q_w4l8_bram_tb.W=4", "-Pscp4d_tenc_q_w4l8_bram_tb.L=8", "-o", join(dir, "enc.vvp"),
    join(root, "hw/scp4d/tb/scp4d_tenc_q_w4l8_bram_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q.v")], { encoding: "utf8" });
  if (enc.status !== 0) { console.log(enc.stderr); failures.push("encoder compile"); }
  const encOld = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_tenc_q_tb.W=4", "-Pscp4d_tenc_q_tb.L=8", "-o", join(dir, "enc-old.vvp"),
    join(root, "hw/scp4d/tb/scp4d_tenc_q_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q.v")], { encoding: "utf8" });
  if (encOld.status !== 0) { console.log(encOld.stderr); failures.push("old encoder compile"); }
  const loop = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_loop_v0122_tb.W=4", "-Pscp4d_loop_v0122_tb.L=8", "-o", join(dir, "loop.vvp"),
    join(root, "hw/scp4d/tb/scp4d_loop_v0122_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_r_share.v")], { encoding: "utf8" });
  if (loop.status !== 0) { console.log(loop.stderr); failures.push("loop compile"); }
  const pipe = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_loop_v0122_pipe_tb.W=4", "-Pscp4d_loop_v0122_pipe_tb.L=8", "-o", join(dir, "pipe.vvp"),
    join(root, "hw/scp4d/tb/scp4d_loop_v0122_pipe_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_r_share.v"),
    join(root, "hw/scp4d/rtl/scp4d_k1_tap.v"),
    join(root, "hw/scp4d/rtl/scp4d_ede.v")], { encoding: "utf8" });
  if (pipe.status !== 0) { console.log(pipe.stderr); failures.push("pipe compile"); }
  const pipeOld = spawnSync(iverilog, ["-g2012", "-Wall", "-Pscp4d_loop_ede_pipe_tb.W=4", "-Pscp4d_loop_ede_pipe_tb.L=8", "-o", join(dir, "pipe-old.vvp"),
    join(root, "hw/scp4d/tb/scp4d_loop_ede_pipe_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_tenc_q.v"),
    join(root, "hw/scp4d/rtl/scp4d_tdec_s.v"),
    join(root, "hw/scp4d/rtl/scp4d_fe_r.v"),
    join(root, "hw/scp4d/rtl/scp4d_k1_tap.v"),
    join(root, "hw/scp4d/rtl/scp4d_ede.v")], { encoding: "utf8" });
  if (pipeOld.status !== 0) { console.log(pipeOld.stderr); failures.push("old pipe compile"); }

  const num = (line: string, k: string) => Number(line.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
  const resultOf = (bin: string, args: string[]) => {
    const r = spawnSync(vvp, ["-n", bin, ...args], { encoding: "utf8" });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")) ?? "";
    if (!line) console.log((r.stdout ?? "").slice(-400), (r.stderr ?? "").slice(-400));
    return line;
  };

  const gold = JSON.parse(read("fixtures/scp/golden-vectors-scp4d.json").toString()) as { vectors: { id: string; expected_bytes_hex: string; expected_decoded_codes: number[][]; expected_events: { positions: number[] }[] }[] };
  const med = gold.vectors.find((v) => v.id === "medicare-6");
  const env = envTemporalStreams().find((s) => s.id === "env-16x16x2-T64-temporal-last");
  if (!med || !env) failures.push("streams");
  else if (!failures.length) {
    const jobs = [
      { id: "medicare-6", T: med.expected_decoded_codes.length, D: med.expected_decoded_codes[0].length, bytes: Uint8Array.from(Buffer.from(med.expected_bytes_hex, "hex")), codes: med.expected_decoded_codes, events: med.expected_events.map((e) => e.positions.length) },
      { id: env.id, T: env.T, D: env.D, bytes: env.bytes, codes: env.codes, events: env.perFrame.map((f) => f.positions.length) },
    ];
    let decOk = true;
    for (const j of jobs) {
      const f = simFiles(j.bytes, j.codes, j.events);
      const p = (k: string) => join(dir, `${j.id}.${k}.hex`);
      writeFileSync(p("stream"), f.stream); writeFileSync(p("codes"), f.codes); writeFileSync(p("events"), f.events);
      const line = resultOf(join(dir, "dec.vvp"), [`+stream=${p("stream")}`, `+codes=${p("codes")}`, `+events=${p("events")}`, `+nbytes=${j.bytes.length}`, `+t=${j.T}`, `+d=${j.D}`, "+expect_unsup=0", "+expect_err=0", "+bubbles=0", `+id=${j.id}`]);
      const model = tdecSCycleModel(j.bytes, 4).cycles;
      const ok = num(line, "ok") === 1 && num(line, "mismatches") === 0 && num(line, "cycles") === model;
      console.log(`${ok ? "SIM PASS" : "SIM FAIL"} decoder ${j.id} cycles=${num(line, "cycles")} model=${model}`);
      if (!ok) decOk = false;
    }
    if (!decOk) failures.push("decoder variant bit-exact");

    const v0110 = JSON.parse(read("fixtures/scp/golden-vectors-scp4d.json").toString());
    const temporal = JSON.parse(read("fixtures/scp/golden-vectors-scp4d-temporal.json").toString());
    const { jobs: encJobs } = encoderJobs(v0110, temporal);
    const encWant = encJobs.filter((j) => j.id === "medicare-6" || j.id === "env-16x16x2-T64-temporal-last");
    let encOk = true;
    const encRows: { id: string; old_cycles: number; new_cycles: number }[] = [];
    for (const j of encWant) {
      const h = hostHeader(j);
      const files = { stream: hx(j.bytes), codes: j.codes.flatMap((f) => f.map(w32)).join("\n") + "\n", hdr: hx(Uint8Array.from([...h.eps, ...h.tm])) };
      const p = (k: string) => join(dir, `e-${j.id}.${k}.hex`);
      writeFileSync(p("stream"), files.stream); writeFileSync(p("codes"), files.codes); writeFileSync(p("hdr"), files.hdr);
      const args = [`+stream=${p("stream")}`, `+codes=${p("codes")}`, `+hdr=${p("hdr")}`, `+nbytes=${j.bytes.length}`,
        `+nx=${j.shape.nx}`, `+ny=${j.shape.ny}`, `+nz=${j.shape.nz}`, `+c=${j.shape.channels}`, `+t=${j.T}`, `+g=${j.cfg.G}`,
        `+pred=${["zero", "last", "linear"].indexOf(j.cfg.predictor)}`, `+tmlen=${h.tm.length}`, `+nhdr=${h.eps.length + h.tm.length}`, `+id=${j.id}`];
      const oldLine = resultOf(join(dir, "enc-old.vvp"), args);
      const newLine = resultOf(join(dir, "enc.vvp"), args);
      const ok = num(oldLine, "mismatches") === 0 && num(newLine, "mismatches") === 0 && num(newLine, "ok") === 1;
      encRows.push({ id: j.id, old_cycles: num(oldLine, "cycles"), new_cycles: num(newLine, "cycles") });
      console.log(`${ok ? "SIM PASS" : "SIM FAIL"} encoder ${j.id} old_cycles=${num(oldLine, "cycles")} new_cycles=${num(newLine, "cycles")}`);
      if (!ok) encOk = false;
    }
    if (!(encOk && encRows.length === 2)) failures.push("encoder variant byte-exact");
    writeFileSync(join(root, "fixtures/scp/v0122-variant-cycles.json"), JSON.stringify({
      format: "scp4d-v0122-variant-cycles",
      label: "Icarus. Decoder variant cycles match scp4d_tdec_s. Encoder variant is byte-exact and takes more cycles because each L=8 beat is two L=4 beats. Power is needs real board.",
      decoder: "cycle-identical to scp4d_tdec_s on medicare-6 and env T64",
      encoder: encRows,
    }, null, 2) + "\n");

    const envEnc = encWant.find((j) => j.id.startsWith("env-"));
    if (envEnc) {
      const h = hostHeader(envEnc);
      const p = (k: string) => join(dir, `e-${envEnc.id}.${k}.hex`);
      writeFileSync(join(dir, "unused.dec"), envEnc.decoded.flatMap((f) => f.map(w32)).join("\n") + "\n");
      const line2 = resultOf(join(dir, "loop.vvp"), [`+stream=${p("stream")}`, `+codes=${p("codes")}`, `+hdr=${p("hdr")}`, `+dec=${join(dir, "unused.dec")}`,
        `+nbytes=${envEnc.bytes.length}`, `+nx=${envEnc.shape.nx}`, `+ny=${envEnc.shape.ny}`, `+nz=${envEnc.shape.nz}`, `+c=${envEnc.shape.channels}`,
        `+t=${envEnc.T}`, `+g=${envEnc.cfg.G}`, `+pred=${["zero", "last", "linear"].indexOf(envEnc.cfg.predictor)}`,
        `+tmlen=${h.tm.length}`, `+nhdr=${h.eps.length + h.tm.length}`, `+id=${envEnc.id}`]);
      const ok = num(line2, "mismatches") === 0 && num(line2, "ok") === 1;
      console.log(`${ok ? "SIM PASS" : "SIM FAIL"} loop env T64 cycles=${num(line2, "cycles")} mismatches=${num(line2, "mismatches")} ${line2.slice(0, 220)}`);
      if (!ok) failures.push("variant loop bit-exact");
      const prev = JSON.parse(read("fixtures/scp/v0122-variant-cycles.json").toString());
      prev.loop_env_t64 = { cycles: num(line2, "cycles"), mismatches: num(line2, "mismatches") };
      const pipeLine = resultOf(join(dir, "pipe.vvp"), [`+codes=${p("codes")}`, `+hdr=${p("hdr")}`,
        `+nbytes=${envEnc.bytes.length}`, `+nx=${envEnc.shape.nx}`, `+ny=${envEnc.shape.ny}`, `+nz=${envEnc.shape.nz}`, `+c=${envEnc.shape.channels}`,
        `+t=${envEnc.T}`, `+g=${envEnc.cfg.G}`, `+pred=${["zero", "last", "linear"].indexOf(envEnc.cfg.predictor)}`,
        `+tmlen=${h.tm.length}`, `+nhdr=${h.eps.length + h.tm.length}`]);
      const oldPipe = resultOf(join(dir, "pipe-old.vvp"), [`+codes=${p("codes")}`, `+hdr=${p("hdr")}`,
        `+nbytes=${envEnc.bytes.length}`, `+nx=${envEnc.shape.nx}`, `+ny=${envEnc.shape.ny}`, `+nz=${envEnc.shape.nz}`, `+c=${envEnc.shape.channels}`,
        `+t=${envEnc.T}`, `+g=${envEnc.cfg.G}`, `+pred=${["zero", "last", "linear"].indexOf(envEnc.cfg.predictor)}`,
        `+tmlen=${h.tm.length}`, `+nhdr=${h.eps.length + h.tm.length}`]);
      const pipeOk = num(pipeLine, "ok") === 1 && num(oldPipe, "ok") === 1 && num(pipeLine, "evals") === 27590 && num(pipeLine, "ede_cycles") === 167716 && num(oldPipe, "evals") === 27590;
      console.log(`${pipeOk ? "SIM PASS" : "SIM FAIL"} k1 pipe old_cycles=${num(oldPipe, "cycles")} new_cycles=${num(pipeLine, "cycles")} evals=${num(pipeLine, "evals")}`);
      if (!pipeOk) failures.push("variant K1 pipe");
      prev.k1_pipe_env_t64 = {
        old_cycles: num(oldPipe, "cycles"), new_cycles: num(pipeLine, "cycles"),
        ede_cycles: num(pipeLine, "ede_cycles"), evals: num(pipeLine, "evals"),
      };
      writeFileSync(join(root, "fixtures/scp/v0122-variant-cycles.json"), JSON.stringify(prev, null, 2) + "\n");
    }
  }
}

if (failures.length) {
  console.log(`FAIL check-scp-v0122-rtl (${failures.length} failed: ${failures.join("; ")})`);
  process.exit(1);
}
console.log(`PASS check-scp-v0122-rtl (${passed} checks)`);
