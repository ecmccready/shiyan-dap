/** TEST ONLY. v0.1.23b hybrid loop versus the trimmed ede loop.
 * The thresholds are fixtures/scp/v0123-prereg.json key v0123b, committed first.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0123b-loop.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
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

const prereg = JSON.parse(read("fixtures/scp/v0123-prereg.json")) as { v0123b?: { loop?: { name?: string; cycles_PASS?: string } } };
check("v0123b names the hybrid loop and a stricter cycle threshold",
  prereg.v0123b?.loop?.name === "wrap_loop_hybrid" && (prereg.v0123b?.loop?.cycles_PASS ?? "").includes("strictly fewer"));
const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as { source_files: { path: string; sha256: string }[] };
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("wrap_loop_ede source still matches the committed manifest",
  pinned("hw/scp4d/synth/scp4d_ede_wrap.v") === sha(read("hw/scp4d/synth/scp4d_ede_wrap.v")));
const wrap = read("hw/scp4d/synth/scp4d_loop_hybrid_wrap.v");
check("hybrid loop instantiates the v0.1.22 codec and scp4d_hybrid",
  wrap.includes("scp4d_tenc_q_w4l8_bram") && wrap.includes("scp4d_tdec_s_w4_bram") && wrap.includes("scp4d_hybrid"));

const FRACTION: Record<string, number> = { low: 0.01, medium: 0.05, high: 0.2, very_high: 0.5 };

function nextFsd(events: number, D: number): boolean {
  return events * 20 >= D * 7;
}
function framesOf(tokens: readonly Tok[]): Tok[][] {
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) { frames.push(cur); cur = []; }
  }
  return frames;
}
function adaptive(D: number, tokens: readonly Tok[]): Change[] {
  const state = freshEde(D);
  const changes: Change[] = [];
  let useFsd = false;
  for (const frame of framesOf(tokens)) {
    const step = useFsd ? stepFsd(state, D, 0, frame) : stepEde(state, D, 0, false, [], frame);
    changes.push(...step.changes);
    const n = frame.filter((t) => t.event).length;
    const last = frame[frame.length - 1]?.last === true;
    if (!last) useFsd = nextFsd(n, D);
  }
  return changes;
}
function runEdeOnly(D: number, tokens: readonly Tok[]): { cycles: number; evals: number } {
  const state = freshEde(D);
  for (const frame of framesOf(tokens)) stepEde(state, D, 0, false, [], frame);
  return { cycles: state.cycles, evals: state.evals };
}

function workload(addrW: number): { D: number; tokens: Tok[]; grids: number[][]; shape: { nx: number; ny: number; nz: number; channels: number } } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(9, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
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
      const before = code.slice();
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((9 + frame + cell) % 5));
      grids.push(code.slice());
      const changed = [];
      for (let e = 0; e < D; e++) if (code[e] !== before[e]) changed.push(e);
      const ev = changed.length ? changed : [];
      if (ev.length === 0) tokens.push({ elem: 0, code: 0, event: false, eof: true, last: frame === 63 });
      else ev.forEach((elem, i) => tokens.push({
        elem, code: code[elem]!, event: true, eof: i === ev.length - 1, last: frame === 63 && i === ev.length - 1,
      }));
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, tokens, grids, shape };
}

function findBin(name: string): string | null {
  const r = spawnSync(name, ["-V"], { encoding: "utf8" });
  return r.status === 0 || (r.stdout ?? "").length > 0 ? name : null;
}

const iverilog = findBin("iverilog");
const vvp = findBin("vvp");
const rows: { addr_w: number; D: number; hybrid_cycles: number; ede_cycles: number; hybrid_evals: number; ede_evals: number; bit_exact: boolean; strictly_fewer: boolean }[] = [];

if (iverilog && vvp) {
  const dir = mkdtempSync(join(tmpdir(), "scp4d-loop-hy-"));
  const sources = [
    "hw/scp4d/tb/scp4d_loop_hybrid_tb.v",
    "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
    "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v", "hw/scp4d/rtl/scp4d_fe_r_share.v", "hw/scp4d/rtl/scp4d_k1_tap.v",
    "hw/scp4d/rtl/scp4d_hybrid.v", "hw/scp4d/rtl/scp4d_ede.v", "hw/scp4d/rtl/scp4d_fsd.v",
  ].map((p) => join(root, p));
  const compile = (addrW: number, useHyb: number, out: string) => {
    const r = spawnSync(iverilog, ["-g2012",
      `-Pscp4d_loop_hybrid_tb.ADDR_W=${addrW}`, `-Pscp4d_loop_hybrid_tb.USE_HYB=${useHyb}`,
      "-o", out, ...sources], { encoding: "utf8" });
    if (r.status !== 0) { console.error((r.stderr ?? "").slice(-600)); process.exit(1); }
  };
  const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const only = Number(process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "0");
  for (const addrW of [8, 10, 12].filter((a) => !only || a === only)) {
    const w = workload(addrW);
    const rtlW = 11;
    const gold = adaptive(w.D, w.tokens);
    const times = Array.from({ length: 64 }, (_, i) => 1000 + i * 100);
    const h = hostHeader({ eps: [1], times, meta: null } as never);
    const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
    writeFileSync(join(dir, `c${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
    writeFileSync(join(dir, `h${addrW}.hex`), hdr.join("\n") + "\n");
    const args = [
      "+nbytes=0", `+codes=${join(dir, `c${addrW}.hex`)}`, `+hdr=${join(dir, `h${addrW}.hex`)}`,
      `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
      "+t=64", "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
    ];
    const run = (useHyb: number) => {
      const out = join(dir, `p${addrW}-${useHyb}.vvp`);
      compile(rtlW, useHyb, out);
      const r = spawnSync(vvp, ["-n", out, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      const lines = (r.stdout ?? "").split("\n");
      const result = lines.find((l) => l.startsWith("RESULT ")) ?? "";
      const num = (k: string) => Number(result.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
      const chg = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4));
      const events: Tok[] = [];
      let cur: { elem: number; code: number }[] = [];
      let fi = 0;
      for (const l of lines) {
        if (l.startsWith("EVF")) {
          const last = fi === 63;
          if (cur.length === 0) events.push({ elem: 0, code: 0, event: false, eof: true, last });
          else cur.forEach((e, i) => events.push({ elem: e.elem, code: e.code, event: true, eof: i === cur.length - 1, last: last && i === cur.length - 1 }));
          cur = [];
          fi++;
        } else if (l.startsWith("EV ")) {
          const [es, cs] = l.slice(3).split(" ");
          cur.push({ elem: Number(es), code: Number(cs) });
        }
      }
      return { ok: num("ok"), cycles: num("cycles"), evals: num("evals"), chg, events, result };
    };
    const ede = run(0);
    const hy = run(1);
    const live = adaptive(w.D, w.tokens);
    const want = live.map((c) => `${c.frame} ${c.elem} ${c.decision}`);
    const key = (s: string) => s.split(" ").join(":");
    const sameSet = (a: string[], b: string[]) => {
      const sa = a.map(key).sort();
      const sb = b.map(key).sort();
      return sa.length === sb.length && sa.every((k, i) => k === sb[i]);
    };
    const exact = hy.ok === 1 && sameSet(hy.chg, want);
    const fewer = hy.ok === 1 && ede.ok === 1 && hy.cycles < ede.cycles;
    if (!exact) console.error(`SIM FAIL hybrid A${addrW} ${hy.result} set ${hy.chg.length}/${want.length}`);
    if (ede.ok !== 1) console.error(`SIM FAIL ede loop A${addrW} ${ede.result}`);
    console.log(`loop A${addrW} hybrid ${hy.cycles} ede ${ede.cycles} exact ${exact} fewer ${fewer}`);
    rows.push({
      addr_w: addrW, D: w.D, hybrid_cycles: hy.cycles, ede_cycles: ede.cycles,
      hybrid_evals: hy.evals, ede_evals: ede.evals, bit_exact: exact, strictly_fewer: fewer,
    });
    const model = runEdeOnly(w.D, w.tokens);
    console.log(`  model ede cycles ${model.cycles} evals ${model.evals}; rtl ede evals ${ede.evals}`);
  }
  const allExact = rows.every((r) => r.bit_exact);
  const allFewer = rows.every((r) => r.strictly_fewer);
  if (!allExact) { console.error("SIM FAIL hybrid loop decisions"); process.exit(1); }
  console.log(`SIM PASS hybrid loop bit-exact; strictly fewer at all widths: ${allFewer}`);
  writeFileSync(join(root, "fixtures/scp/v0123b-loop-sim.json"), JSON.stringify({
    format: "scp4d-v0123b-loop-sim",
    label: "Icarus wall cycles of the closed loop on the held-out grids. Power is needs real board.",
    rows,
    bit_exact: allExact,
    strictly_fewer: allFewer,
  }, null, 2) + "\n");
} else console.log("SKIP sim (iverilog not on PATH)");

if (failures.length) {
  console.error(`FAIL check-scp-v0123b-loop (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0123b-loop (${passed} checks)`);
