/** TEST ONLY. v0.1.30 training on seeds 31 and 35. Not seed 9 or seed 13.
 * --only=31,8,1,8 is seed, percent, hold, addrW.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0130-train.ts --only=31,8,1,8 --out=/tmp/a.json
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const prereg = JSON.parse(readFileSync(join(root, "fixtures/scp/v0130-prereg.json"), "utf8")) as {
  training: { low_open: { seed: number; opening: number; then: number[]; frames_per_fraction: number }; high_open: { seed: number; opening: number; then: number[]; frames_per_fraction: number } };
};
function specOf(seed: number) {
  const s = seed === prereg.training.low_open.seed ? prereg.training.low_open : prereg.training.high_open;
  if (s.seed !== seed) throw new Error(`seed ${seed} is not a training seed`);
  return { opening: s.opening, then: s.then, per: s.frames_per_fraction };
}

function build(addrW: number, seed: number) {
  const spec = specOf(seed);
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  const tokens: Tok[] = [];
  const groups = [{ fraction: spec.opening, n: spec.per }, ...spec.then.map((fraction) => ({ fraction, n: spec.per }))];
  const total = groups.reduce((a, g) => a + g.n, 0);
  let frame = 0;
  for (const g of groups) {
    const k = Math.max(1, Math.round(g.fraction * D));
    for (let n = 0; n < g.n; n++, frame++) {
      const idx = Array.from({ length: D }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (D - i));
        const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
      }
      const picked = idx.slice(0, k).sort((a, b) => a - b);
      const before = code.slice();
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + frame + cell) % 5));
      grids.push(code.slice());
      const changed: number[] = [];
      for (let e = 0; e < D; e++) if (code[e] !== before[e]) changed.push(e);
      const last = frame === total - 1;
      if (changed.length === 0) tokens.push({ elem: 0, code: 0, event: false, eof: true, last });
      else changed.forEach((elem, i) => tokens.push({
        elem, code: code[elem]!, event: true, eof: i === changed.length - 1, last: last && i === changed.length - 1,
      }));
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, tokens, grids, shape };
}
function framesOf(tokens: readonly Tok[]): Tok[][] {
  const frames: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of tokens) { cur.push(t); if (t.eof) { frames.push(cur); cur = []; } }
  return frames;
}

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
if (!only) { console.error("pass --only=seed,percent,hold,addr"); process.exit(2); }
const [seedS, ps, hs, as] = only.split(",");
const seed = Number(seedS), percent = Number(ps), hold = Number(hs), addrW = Number(as);
const dir = mkdtempSync(join(tmpdir(), "scp4d-v0130t-"));
const w = build(addrW, seed);
const T = w.grids.length;
const times = Array.from({ length: T }, (_, i) => 1000 + i * 100);
const h = hostHeader({ eps: [1], times, meta: null } as never);
writeFileSync(join(dir, "c.hex"), w.grids.flat().map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("\n") + "\n");
const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
writeFileSync(join(dir, "h.hex"), hdr.join("\n") + "\n");
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0130_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_hybrid_ff.v",
  "hw/scp4d/rtl/scp4d_ede_coh.v", "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
].map((p) => join(root, p));
const out = join(dir, "p.vvp");
const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0130_tb.ADDR_W=11",
  `-Pscp4d_loop_v0130_tb.PERCENT=${percent}`, `-Pscp4d_loop_v0130_tb.HOLD=${hold}`,
  "-o", out, ...sources], { encoding: "utf8" });
if (comp.status !== 0) { console.error(comp.stderr.slice(-900)); process.exit(1); }
const run = spawnSync("vvp", ["-n", out, "+nbytes=0", `+codes=${join(dir, "c.hex")}`, `+hdr=${join(dir, "h.hex")}`,
  `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
  `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const lines = (run.stdout ?? "").split("\n");
const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
const num = (k: string) => Number(total.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
const fr = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
let useFsd = false, prevHi = false, seen = false;
const pred: boolean[] = [];
for (const p of fr) {
  const hi = Number(p[10]) * 100 >= w.D * percent;
  if (!seen) { useFsd = hi; prevHi = hi; seen = true; pred.push(useFsd); continue; }
  pred.push(useFsd);
  const voteFsd = hold <= 1 ? hi : hi && prevHi;
  const voteK1 = hold <= 1 ? !hi : !hi && !prevHi;
  if (!useFsd && voteFsd) useFsd = true;
  else if (useFsd && voteK1) useFsd = false;
  prevHi = hi;
}
const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4).trim().split(/\s+/).join(":")).sort();
const want: Change[] = [];
const state = freshEde(w.D);
for (const [i, one] of framesOf(w.tokens).entries()) {
  const step = pred[i] ? stepFsd(state, w.D, 0, one) : stepEde(state, w.D, 0, false, [], one);
  for (const c of step.changes) want.push({ ...c, frame: i });
}
const ws = want.map((c) => `${c.frame}:${c.elem}:${c.decision}`).sort();
const selOk = fr.length === T && fr.every((p, i) => (p[11] === "1") === pred[i]);
const exact = num("ok") === 1 && selOk && got.length === ws.length && got.every((k, i) => k === ws[i]);
const fsdFrames = fr.filter((p) => p[11] === "1").length;
const switches = fr.reduce((a, p) => a + Number(p[12] ?? 0), 0);
if (!exact) {
  console.error(`NOT EXACT ok=${num("ok")} selOk=${selOk} frames ${fr.length}/${T} missing ${ws.filter((k) => !got.includes(k)).slice(0, 4).join(" ")} extra ${got.filter((k) => !ws.includes(k)).slice(0, 4).join(" ")}`);
}
const row = { seed, percent, hold, addr_w: addrW, cycles: num("cycles"), evals: num("evals"), fsd_frames: fsdFrames, k1_frames: fr.length - fsdFrames, switches, bit_exact: exact, first_sel: fr[0]?.[11] ?? "" };
console.log(`s${seed} p${percent} h${hold} A${addrW} cycles ${row.cycles} fsd ${fsdFrames} k1 ${row.k1_frames} sw ${switches} first ${row.first_sel} exact ${exact}`);
const dest = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);
if (dest) writeFileSync(dest, JSON.stringify(row) + "\n");
process.exit(exact ? 0 : 1);
