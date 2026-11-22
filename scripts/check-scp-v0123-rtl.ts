/** TEST ONLY. v0.1.23 hybrid RTL. The pre-registration is fixtures/scp/v0123-prereg.json.
 * Counted checks do not need a simulator. If iverilog is on PATH the decision
 * records are re-simulated. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0123-rtl.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type FanSlot, type Tok } from "./scp-v0120-ede-model";
import { vectorFile, temporalVectors, relationsVectors, type EdeVector } from "./scp-v0120-ede-vectors";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const prereg = JSON.parse(read("fixtures/scp/v0123-prereg.json")) as {
  design: { module: string; initial_engine: string };
  verdict: { PASS: string; MIXED: string; FAIL: string };
};
check("prereg names scp4d_hybrid and locks PASS, MIXED and FAIL",
  prereg.design.module === "scp4d_hybrid" && prereg.design.initial_engine.startsWith("ede")
  && prereg.verdict.PASS.length > 0 && prereg.verdict.MIXED.length > 0 && prereg.verdict.FAIL.length > 0);
const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as { source_files: { path: string; sha256: string }[] };
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("scp4d_ede.v and scp4d_fsd.v match the committed manifest hashes",
  pinned("hw/scp4d/rtl/scp4d_ede.v") === sha(read("hw/scp4d/rtl/scp4d_ede.v"))
  && pinned("hw/scp4d/rtl/scp4d_fsd.v") === sha(read("hw/scp4d/rtl/scp4d_fsd.v")));
const hybrid = read("hw/scp4d/rtl/scp4d_hybrid.v");
check("hybrid instantiates both engines and has no initial block",
  /scp4d_ede\s+#/.test(hybrid) && /scp4d_fsd\s+#/.test(hybrid) && !/\binitial\b/.test(hybrid));
check("a frame switch uses the previous event count, and very high is events*20 >= cfg_D*7",
  /ev20 >= d7/.test(hybrid) && /next_fsd != use_fsd/.test(hybrid) && /vis_eof/.test(hybrid));

function nextFsd(events: number, D: number, relations: boolean): boolean {
  if (relations) return false;
  return events * 20 >= D * 7;
}

function framesOf(tokens: readonly Tok[]): Tok[][] {
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) { frames.push(cur); cur = []; }
  }
  if (cur.length) frames.push(cur);
  return frames;
}

function adaptive(D: number, threshold: number, relations: boolean, fan: readonly (readonly FanSlot[])[], tokens: readonly Tok[]): { changes: Change[]; picks: (0 | 1)[]; events: number[] } {
  const state = freshEde(D);
  const changes: Change[] = [];
  const picks: (0 | 1)[] = [];
  const events: number[] = [];
  let useFsd = false;
  for (const frame of framesOf(tokens)) {
    const step = useFsd ? stepFsd(state, D, threshold, frame) : stepEde(state, D, threshold, relations, fan, frame);
    if (step.err) return { changes, picks, events };
    changes.push(...step.changes);
    picks.push(useFsd ? 1 : 0);
    const n = frame.filter((t) => t.event).length;
    events.push(n);
    const last = frame[frame.length - 1]?.last === true;
    if (!last) useFsd = nextFsd(n, D, relations);
  }
  return { changes, picks, events };
}

function stim(v: { D: number; threshold: number; mode: string; fan: EdeVector["fan"]; tokens: EdeVector["tokens"] }, changes: Change[], err: number, picks: number[]): string {
  const lines = [`${v.D} ${v.threshold} ${v.mode === "relations" ? 1 : 0}`, String(v.fan.length)];
  for (const f of v.fan) lines.push(`${f.src} ${f.slot} ${f.tgt} ${f.valid}`);
  lines.push(String(v.tokens.length));
  for (const t of v.tokens) lines.push(`${t.elem} ${t.code} ${t.event} ${t.eof} ${t.last}`);
  lines.push(String(changes.length));
  for (const c of changes) lines.push(`${c.frame} ${c.elem} ${c.decision}`);
  lines.push(String(err));
  lines.push(String(picks.length));
  for (const p of picks) lines.push(String(p));
  return `${lines.join("\n")}\n`;
}

function findBin(name: string): string | null {
  const r = spawnSync(name, ["-V"], { encoding: "utf8" });
  return r.status === 0 || (r.stdout ?? "").length > 0 ? name : null;
}

const FRACTION: Record<string, number> = { low: 0.01, medium: 0.05, high: 0.2, very_high: 0.5 };

function heldTokens(addrW: number): { D: number; tokens: Tok[] } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(9, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const tokens: Tok[] = [];
  let frame = 0;
  for (const churn of ["low", "medium", "high", "very_high"]) {
    const k = Math.max(1, Math.round(FRACTION[churn]! * D));
    for (let n = 0; n < 16; n++, frame++) {
      const idx = Array.from({ length: D }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (D - i));
        const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
      }
      const picked = idx.slice(0, k).sort((a, b) => a - b);
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((9 + frame + cell) % 5));
      picked.forEach((cell, i) => {
        tokens.push({
          elem: cell, code: code[cell]!, event: true,
          eof: i === picked.length - 1, last: frame === 63 && i === picked.length - 1,
        });
      });
    }
  }
  return { D, tokens };
}

const iverilog = findBin("iverilog");
const vvp = findBin("vvp");
if (iverilog && vvp) {
  const dir = mkdtempSync(join(tmpdir(), "scp4d-hybrid-"));
  const comp = spawnSync(iverilog, ["-g2012", "-Pscp4d_hybrid_tb.ADDR_W=12", "-o", join(dir, "hy.vvp"),
    join(root, "hw/scp4d/tb/scp4d_hybrid_tb.v"),
    join(root, "hw/scp4d/rtl/scp4d_hybrid.v"),
    join(root, "hw/scp4d/rtl/scp4d_ede.v"),
    join(root, "hw/scp4d/rtl/scp4d_fsd.v")], { encoding: "utf8" });
  if (comp.status !== 0) {
    console.error((comp.stderr ?? "").slice(-800));
    process.exit(1);
  }
  const run = (text: string, tag: string): { ok: number; cycles: number; evals: number; line: string } => {
    const file = join(dir, `${tag}.txt`);
    writeFileSync(file, text);
    const r = spawnSync(vvp, ["-n", join(dir, "hy.vvp"), `+stim=${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")) ?? "";
    const num = (k: string) => Number(line.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
    return { ok: num("ok"), cycles: num("cycles"), evals: num("evals"), line };
  };
  const temporal = vectorFile("temporal", temporalVectors()).vectors;
  const relations = vectorFile("relations", relationsVectors()).vectors;
  let simFail = 0;
  let simN = 0;
  const fanBlank = (D: number): FanSlot[][] => Array.from({ length: D }, () => [
    { tgt: 0, valid: false }, { tgt: 0, valid: false }, { tgt: 0, valid: false }, { tgt: 0, valid: false },
  ]);
  const one = (v: EdeVector) => {
    const relationsOn = v.mode === "relations";
    const fan: FanSlot[][] = fanBlank(v.D);
    for (const f of v.fan) {
      const row = fan[f.src] ?? fanBlank(1)[0]!;
      row[f.slot] = { tgt: f.tgt, valid: f.valid === 1 };
    }
    const tokens: Tok[] = v.tokens.map((t) => ({ elem: t.elem, code: t.code, event: t.event === 1, eof: t.eof === 1, last: t.last === 1 }));
    const gold = v.ede.err !== 0 ? { changes: v.ede.changes, picks: [] as (0 | 1)[] } : adaptive(v.D, v.threshold, relationsOn, fan, tokens);
    const got = run(stim(v, gold.changes, v.ede.err, gold.picks), `v${simN}`);
    simN++;
    if (got.ok !== 1) { simFail++; console.error(`SIM FAIL ${v.id} ${got.line}`); }
  };
  for (const v of temporal) one(v);
  for (const v of relations) one(v);
  const held: { addr_w: number; hybrid_cycles: number; hybrid_evals: number; ede_cycles: number; ede_evals: number; fsd_cycles: number; fsd_evals: number; switches: number }[] = [];
  for (const addrW of [8, 10, 12]) {
    const { D, tokens } = heldTokens(addrW);
    const gold = adaptive(D, 0, false, fanBlank(D), tokens);
    const ede = freshEde(D);
    const fsd = freshEde(D);
    for (const frame of framesOf(tokens)) {
      stepEde(ede, D, 0, false, [], frame);
      stepFsd(fsd, D, 0, frame);
    }
    const asVec = {
      D, threshold: 0, mode: "temporal", fan: [] as EdeVector["fan"],
      tokens: tokens.map((t) => ({ elem: t.elem, code: t.code, event: t.event ? 1 : 0, eof: t.eof ? 1 : 0, last: t.last ? 1 : 0 })),
    };
    const got = run(stim(asVec, gold.changes, 0, gold.picks), `h${addrW}`);
    simN++;
    if (got.ok !== 1) { simFail++; console.error(`SIM FAIL held-out A${addrW} ${got.line}`); }
    const switches = gold.picks.slice(1).reduce((n, p, i) => n + (p === gold.picks[i] ? 0 : 1), 0);
    held.push({
      addr_w: addrW, hybrid_cycles: got.cycles, hybrid_evals: got.evals,
      ede_cycles: ede.cycles, ede_evals: ede.evals, fsd_cycles: fsd.cycles, fsd_evals: fsd.evals,
      switches,
    });
    console.log(`held-out A${addrW} hybrid ${got.cycles}/${got.evals} ede ${ede.cycles} fsd ${fsd.cycles} switches ${switches} ok ${got.ok}`);
  }
  if (simFail) {
    console.error(`SIM FAIL ${simFail} of ${simN}`);
    process.exit(1);
  }
  console.log(`SIM PASS ${simN} hybrid runs (not counted)`);
  const beats = held.every((h) => h.hybrid_cycles <= Math.min(h.ede_cycles, h.fsd_cycles));
  writeFileSync(join(root, "fixtures/scp/v0123-hybrid-sim.json"), JSON.stringify({
    format: "scp4d-v0123-hybrid-sim",
    label: "Icarus decision records versus the shared-state model. Fixed-engine cycles are the exact model on the same tokens. Power is needs real board.",
    sim_runs: simN,
    held_out: held,
    cycles_beat_or_tie_best_fixed: beats,
  }, null, 2) + "\n");
} else {
  console.log("SKIP sim (iverilog not on PATH)");
}

if (failures.length) {
  console.error(`FAIL check-scp-v0123-rtl (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0123-rtl (${passed} checks)`);
