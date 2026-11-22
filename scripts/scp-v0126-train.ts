/** TEST ONLY. Fit the v0.1.26 selector on training grids. Not the held-out set.
 * Seed 4. Fractions 0.02, 0.08, 0.15, 0.35, 0.45, 0.55. Eight frames each.
 * Held-out is seed 9 and fractions 0.01, 0.05, 0.2, 0.5. This file does not build that set.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0126-train.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const SEED = 4;
const FRACS = [0.02, 0.08, 0.15, 0.35, 0.45, 0.55];
const PER = 8;
const T = FRACS.length * PER;

function workload(addrW: number): { D: number; grids: number[][]; shape: { nx: number; ny: number; nz: number; channels: number }; events: number[] } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(SEED, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  const events: number[] = [];
  let frame = 0;
  for (const frac of FRACS) {
    const k = Math.max(1, Math.round(frac * D));
    for (let n = 0; n < PER; n++, frame++) {
      const idx = Array.from({ length: D }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (D - i));
        const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
      }
      const picked = idx.slice(0, k).sort((a, b) => a - b);
      const before = code.slice();
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((SEED + frame + cell) % 5));
      grids.push(code.slice());
      let ev = 0;
      for (let e = 0; e < D; e++) if (code[e] !== before[e]) ev++;
      events.push(ev);
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, grids, shape, events };
}

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0126-train-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0126_train_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const bands: { addr_w: number; fraction: number; k1_cycles: number; fsd_cycles: number; fsd_fewer: boolean }[] = [];

for (const addrW of [8, 10, 12]) {
  const w = workload(addrW);
  const times = Array.from({ length: T }, (_, i) => 5000 + i * 100);
  const h = hostHeader({ eps: [1], times, meta: null } as never);
  writeFileSync(join(dir, `c${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
  const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
  writeFileSync(join(dir, `h${addrW}.hex`), hdr.join("\n") + "\n");
  const args = [
    "+nbytes=0", `+codes=${join(dir, `c${addrW}.hex`)}`, `+hdr=${join(dir, `h${addrW}.hex`)}`,
    `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
    `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
  ];
  const walls: Record<string, number[]> = {};
  for (const [eng, name] of [["0", "k1"], ["1", "fsd"]] as const) {
    const out = join(dir, `p${addrW}-${name}.vvp`);
    const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0126_train_tb.ADDR_W=11", `-Pscp4d_loop_v0126_train_tb.ENGINE=${eng}`, "-o", out, ...sources], { encoding: "utf8" });
    if (comp.status !== 0) { console.error(comp.stderr.slice(-800)); process.exit(1); }
    const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const lines = (run.stdout ?? "").split("\n");
    const frames = lines.filter((l) => l.startsWith("FRAME ")).map((l) => Number(l.trim().split(/\s+/)[2]));
    const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
    console.log(`${name} A${addrW} frames ${frames.length} total ${total}`);
    if (frames.length !== T) { console.error("frame count"); process.exit(1); }
    walls[name] = frames;
  }
  for (let b = 0; b < FRACS.length; b++) {
    const k1 = walls.k1!.slice(b * PER, (b + 1) * PER).reduce((a, x) => a + x, 0);
    const fsd = walls.fsd!.slice(b * PER, (b + 1) * PER).reduce((a, x) => a + x, 0);
    bands.push({ addr_w: addrW, fraction: FRACS[b]!, k1_cycles: k1, fsd_cycles: fsd, fsd_fewer: fsd < k1 });
    console.log(`A${addrW} f${FRACS[b]} k1 ${k1} fsd ${fsd} fsd_fewer ${fsd < k1}`);
  }
}

const any = bands.some((b) => b.fsd_fewer);
writeFileSync(join(root, "fixtures/scp/v0126-train.json"), JSON.stringify({
  format: "scp4d-v0126-train",
  label: "Training only. Seed 4. Not the held-out seed 9 grids. Power is needs real board.",
  seed: SEED,
  fractions: FRACS,
  frames_per_fraction: PER,
  disjoint_from_held_out: "Held-out uses seed 9 and fractions 0.01, 0.05, 0.2, 0.5. Training uses seed 4 and fractions 0.02, 0.08, 0.15, 0.35, 0.45, 0.55. The RNG is mulberry32((seed * 10007 + addrW) >>> 0). No training frame is a held-out frame.",
  bands,
  fsd_fewer_on_any_band: any,
}, null, 2) + "\n");
console.log(any ? "TRAIN: full scan wins at least one band" : "TRAIN: full scan wins no band");
