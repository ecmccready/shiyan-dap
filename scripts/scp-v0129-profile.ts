/** TEST ONLY. v0.1.29 cycle profile on training seed 17. Not seed 9 or seed 13.
 * --only=hy,8 or k1,8 or n4,8 writes one JSON row to --out.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0129-profile.ts --only=hy,8 --out=/tmp/p.json
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const prereg = JSON.parse(readFileSync(join(root, "fixtures/scp/v0128-prereg.json"), "utf8")) as {
  training: { seed: number; fractions: number[]; frames_per_fraction: number };
};
const seedArg = process.argv.find((a) => a.startsWith("--seed="))?.slice("--seed=".length);
const seed = seedArg ? Number(seedArg) : prereg.training.seed;
if (seed === 9 || seed === 13) {
  console.error("seed 9 and seed 13 are held-out");
  process.exit(2);
}
const shape = process.argv.find((a) => a.startsWith("--shape="))?.slice("--shape=".length) ?? "dense";
const fractions = shape === "high"
  ? [0.55, 0.65, 0.75, 0.85, 0.95]
  : prereg.training.fractions;
const per = prereg.training.frames_per_fraction;
const tail = shape === "high" ? [0.05, 0.85, 0.05, 0.85, 0.05, 0.85, 0.05, 0.85] : [];

function build(addrW: number) {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  let frame = 0;
  const groups = [...fractions.map((fraction) => ({ fraction, n: per })), ...tail.map((fraction) => ({ fraction, n: 1 }))];
  const total = groups.reduce((a, g) => a + g.n, 0);
  for (const g of groups) {
    const fraction = g.fraction;
    const k = Math.max(1, Math.round(fraction * D));
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
      void before; void total;
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, grids, shape };
}

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
if (!only) {
  console.error("pass --only=hy,8");
  process.exit(2);
}
const [kind, addrS] = only.split(",");
const addrW = Number(addrS);
const dir = mkdtempSync(join(tmpdir(), "scp4d-v0129p-"));
const w = build(addrW);
const T = w.grids.length;
const times = Array.from({ length: T }, (_, i) => 1000 + i * 100);
const h = hostHeader({ eps: [1], times, meta: null } as never);
const tag = `${kind}${addrW}`;
writeFileSync(join(dir, `c${tag}.hex`), w.grids.flat().map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("\n") + "\n");
const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
writeFileSync(join(dir, `h${tag}.hex`), hdr.join("\n") + "\n");

const common = [
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd_n.v",
];
const spec = kind === "hy"
  ? { tb: "hw/scp4d/tb/scp4d_loop_v0129_profile_tb.v", top: "scp4d_loop_v0129_profile_tb", extra: ["hw/scp4d/rtl/scp4d_hybrid_fix.v"], defs: ["-Pscp4d_loop_v0129_profile_tb.PERCENT=15"] }
  : { tb: "hw/scp4d/tb/scp4d_loop_v0127_train_tb.v", top: "scp4d_loop_v0127_train_tb", extra: [] as string[], defs: [`-Pscp4d_loop_v0127_train_tb.ENGINE=${kind === "n4" ? 2 : 0}`] };
const sources = [spec.tb, ...common, ...spec.extra].map((p) => join(root, p));
const out = join(dir, "p.vvp");
const comp = spawnSync("iverilog", ["-g2012", `-P${spec.top}.ADDR_W=11`, ...spec.defs, "-o", out, ...sources], { encoding: "utf8" });
if (comp.status !== 0) { console.error(comp.stderr.slice(-1200)); process.exit(1); }
const run = spawnSync("vvp", ["-n", out,
  "+nbytes=0", `+codes=${join(dir, `c${tag}.hex`)}`, `+hdr=${join(dir, `h${tag}.hex`)}`,
  `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
  `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const lines = (run.stdout ?? "").split("\n");
const frames = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/).slice(1).map(Number));
const phases = lines.filter((l) => l.startsWith("PHASE ")).map((l) => l.trim().split(/\s+/).slice(1).map(Number));
const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
const row = {
  kind, addr_w: addrW, seed,
  ok: /ok=1/.test(total),
  cycles: Number(total.match(/cycles=(-?\d+)/)?.[1]),
  eng_cycles: Number(total.match(/eng_cycles=(-?\d+)/)?.[1]),
  frames: frames.map((p) => ({
    frame: p[0], host: p[1], eng: p[2], busy: p[3], idle: p[4], handoff: p[5],
    tap_full: p[6], enc_stall: p[7], out_stall: p[8], events: p[9], sel: p[10], switched: p[11],
  })),
  phases: phases.map((p) => ({
    frame: p[0], run: p[1], sync: p[2], clr: p[3], arm: p[4], wait: p[5], use: p[6], drain: p[7], reof: p[8],
  })),
};
console.log(`${kind} A${addrW} cycles ${row.cycles} eng ${row.eng_cycles} frames ${row.frames.length} ok ${row.ok}`);
const dest = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);
if (dest) writeFileSync(dest, JSON.stringify(row));
if (!row.ok) process.exit(1);
