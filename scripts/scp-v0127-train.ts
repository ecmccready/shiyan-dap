/** TEST ONLY. v0.1.27 training cycles. Not held-out seed 9 or seed 13.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0127-train.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));

const regimes = {
  low: { seed: 4, fractions: [0.02, 0.08, 0.15, 0.35, 0.45, 0.55], mixed: [] as number[] },
  high: { seed: 11, fractions: [0.55, 0.65, 0.75, 0.85, 0.95], mixed: [0.05, 0.85, 0.05, 0.85, 0.05, 0.85, 0.05, 0.85] },
};

function workload(addrW: number, seed: number, fractions: number[], mixed: number[]): { D: number; tokens: Tok[]; grids: number[][]; shape: { nx: number; ny: number; nz: number; channels: number }; bands: { fraction: number; frames: number }[] } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  const tokens: Tok[] = [];
  const bands: { fraction: number; frames: number }[] = [];
  let frame = 0;
  const groups: { fraction: number; n: number }[] = [
    ...fractions.map((fraction) => ({ fraction, n: 8 })),
    ...mixed.map((fraction) => ({ fraction, n: 1 })),
  ];
  const total = groups.reduce((a, g) => a + g.n, 0);
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
    bands.push({ fraction: g.fraction, frames: g.n });
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, tokens, grids, shape, bands };
}

function golden(kind: "ede" | "fsd", D: number, tokens: readonly Tok[]): Change[] {
  const state = freshEde(D);
  const changes: Change[] = [];
  let cur: Tok[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) {
      const step = kind === "fsd" ? stepFsd(state, D, 0, cur) : stepEde(state, D, 0, false, [], cur);
      changes.push(...step.changes);
      cur = [];
    }
  }
  return changes;
}

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0127-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0127_train_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd_n.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const engines = [["0", "k1"], ["1", "n2"], ["2", "n4"]] as const;
type Row = { regime: string; engine: string; addr_w: number; fraction: number; cycles: number; bit_exact: boolean };
const rows: Row[] = [];
let bad = false;

for (const [regime, spec] of Object.entries(regimes)) {
  for (const addrW of [8, 10, 12]) {
    const w = workload(addrW, spec.seed, spec.fractions, spec.mixed);
    const T = w.grids.length;
    const times = Array.from({ length: T }, (_, i) => 8000 + i * 100);
    const h = hostHeader({ eps: [1], times, meta: null } as never);
    writeFileSync(join(dir, `c${regime}${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
    const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
    writeFileSync(join(dir, `h${regime}${addrW}.hex`), hdr.join("\n") + "\n");
    const args = [
      "+nbytes=0", `+codes=${join(dir, `c${regime}${addrW}.hex`)}`, `+hdr=${join(dir, `h${regime}${addrW}.hex`)}`,
      `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
      `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
    ];
    for (const [eng, name] of engines) {
      const out = join(dir, `p${regime}${addrW}-${name}.vvp`);
      const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0127_train_tb.ADDR_W=11", `-Pscp4d_loop_v0127_train_tb.ENGINE=${eng}`, "-o", out, ...sources], { encoding: "utf8" });
      if (comp.status !== 0) { console.error(comp.stderr.slice(-900)); process.exit(1); }
      const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
      const lines = (run.stdout ?? "").split("\n");
      const frames = lines.filter((l) => l.startsWith("FRAME ")).map((l) => Number(l.trim().split(/\s+/)[2]));
      const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
      const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4));
      const want = golden(name === "k1" ? "ede" : "fsd", w.D, w.tokens).map((c) => `${c.frame} ${c.elem} ${c.decision}`);
      const set = (xs: string[]) => xs.map((s) => s.split(" ").join(":")).sort();
      const gs = set(got), ws = set(want);
      const exact = frames.length === T && gs.length === ws.length && gs.every((k, i) => k === ws[i]);
      if (!exact) {
        bad = true;
        console.error(`${regime} ${name} A${addrW} mismatch frames ${frames.length}/${T} chg ${got.length}/${want.length} ${total}`);
      }
      let at = 0;
      const grouped = new Map<number, number>();
      for (const b of w.bands) {
        const sum = frames.slice(at, at + b.frames).reduce((a, x) => a + x, 0);
        grouped.set(b.fraction, (grouped.get(b.fraction) ?? 0) + sum);
        at += b.frames;
      }
      for (const [fraction, cycles] of grouped) {
        rows.push({ regime, engine: name, addr_w: addrW, fraction, cycles, bit_exact: exact });
        console.log(`${regime} ${name} A${addrW} f${fraction} ${cycles} exact ${exact}`);
      }
    }
  }
}

writeFileSync(join(root, "fixtures/scp/v0127-train.json"), JSON.stringify({
  format: "scp4d-v0127-train",
  label: "Training cycles only. Not held-out seed 9 or seed 13. Power is needs real board. No place-and-route.",
  rows,
  bit_exact: !bad,
}, null, 2) + "\n");
console.log(bad ? "TRAIN NOT BIT-EXACT" : "TRAIN BIT-EXACT");
process.exit(bad ? 1 : 0);
