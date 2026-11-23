/** TEST ONLY. Held-out runs of the frozen v0.1.27 hybrid. The freeze file
 * was written before this script. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0127-heldout.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const freeze = JSON.parse(readFileSync(join(root, "fixtures/scp/v0127-freeze.json"), "utf8")) as { n: number; percent: number };
if (freeze.n !== 4 || freeze.percent !== 55) {
  console.error("freeze is not N=4 percent 55");
  process.exit(1);
}

function build(addrW: number, seed: number, groups: { fraction: number; n: number }[]): { D: number; tokens: Tok[]; grids: number[][]; shape: { nx: number; ny: number; nz: number; channels: number } } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  const tokens: Tok[] = [];
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
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) { frames.push(cur); cur = []; }
  }
  return frames;
}

const workloads = {
  original: {
    seed: 9,
    groups: [
      { fraction: 0.01, n: 16 }, { fraction: 0.05, n: 16 }, { fraction: 0.2, n: 16 }, { fraction: 0.5, n: 16 },
    ],
  },
  high: {
    seed: 13,
    groups: [
      { fraction: 0.55, n: 8 }, { fraction: 0.65, n: 8 }, { fraction: 0.75, n: 8 }, { fraction: 0.85, n: 8 }, { fraction: 0.95, n: 8 },
      { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 }, { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 },
      { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 }, { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 },
    ],
  },
};

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0127h-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0127_held_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_hybrid_n.v",
  "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd_n.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const rows: { workload: string; addr_w: number; cycles: number; evals: number; fsd_frames: number; k1_frames: number; switches: number; bit_exact: boolean }[] = [];
let bad = false;

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
for (const [name, spec] of Object.entries(workloads)) {
  for (const addrW of [8, 10, 12]) {
    if (only && only !== `${name}${addrW}`) continue;
    const w = build(addrW, spec.seed, spec.groups);
    const T = w.grids.length;
    const times = Array.from({ length: T }, (_, i) => 1000 + i * 100);
    const h = hostHeader({ eps: [1], times, meta: null } as never);
    const tag = `${name}${addrW}`;
    writeFileSync(join(dir, `c${tag}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
    const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
    writeFileSync(join(dir, `h${tag}.hex`), hdr.join("\n") + "\n");
    const out = join(dir, `p${tag}.vvp`);
    const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0127_held_tb.ADDR_W=11", "-o", out, ...sources], { encoding: "utf8" });
    if (comp.status !== 0) { console.error(comp.stderr.slice(-900)); process.exit(1); }
    const args = [
      "+nbytes=0", `+codes=${join(dir, `c${tag}.hex`)}`, `+hdr=${join(dir, `h${tag}.hex`)}`,
      `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
      `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
    ];
    const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    const lines = (run.stdout ?? "").split("\n");
    const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
    const num = (k: string) => Number(total.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
    const frames = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
    const fsdFrames = frames.filter((p) => p[11] === "1").length;
    const switches = frames.reduce((a, p) => a + Number(p[12] ?? 0), 0);
    const sels = frames.map((p) => p[11] === "1");
    const state = freshEde(w.D);
    const want: Change[] = [];
    framesOf(w.tokens).forEach((frame, i) => {
      const step = sels[i] ? stepFsd(state, w.D, 0, frame) : stepEde(state, w.D, 0, false, [], frame);
      want.push(...step.changes);
    });
    const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4));
    const set = (xs: string[]) => xs.map((s) => s.split(" ").join(":")).sort();
    const gs = set(got);
    const ws = set(want.map((c) => `${c.frame} ${c.elem} ${c.decision}`));
    const exact = num("ok") === 1 && frames.length === T && gs.length === ws.length && gs.every((k, i) => k === ws[i]);
    if (!exact) {
      bad = true;
      const missing = ws.filter((k) => !gs.includes(k)).slice(0, 8);
      const extra = gs.filter((k) => !ws.includes(k)).slice(0, 8);
      console.error(" missing", missing.join(" | "), " extra", extra.join(" | "));
    }
    const row = {
      workload: name, addr_w: addrW, cycles: num("cycles"), evals: num("evals"),
      fsd_frames: fsdFrames, k1_frames: frames.length - fsdFrames, switches, bit_exact: exact,
    };
    rows.push(row);
    console.log(`${name} A${addrW} cycles ${row.cycles} fsd ${fsdFrames} k1 ${row.k1_frames} sw ${switches} exact ${exact} ${total}`);
    if (!exact) console.error(`mismatch chg ${got.length}/${want.length}`);
  }
}

writeFileSync(join(root, "fixtures/scp/v0127-heldout.json"), JSON.stringify({
  format: "scp4d-v0127-heldout",
  label: "Held-out runs after fixtures/scp/v0127-freeze.json. Power is needs real board. Fmax is not in this file.",
  rows,
  bit_exact: !bad,
}, null, 2) + "\n");
console.log(bad ? "HELD-OUT NOT BIT-EXACT" : "HELD-OUT BIT-EXACT");
process.exit(bad ? 1 : 0);
