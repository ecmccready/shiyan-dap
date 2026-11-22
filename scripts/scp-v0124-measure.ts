/** TEST ONLY. One measurement of the pre-registered v0.1.24 pipe fix.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0124-measure.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const FRACTION: Record<string, number> = { low: 0.01, medium: 0.05, high: 0.2, very_high: 0.5 };
const profile = JSON.parse(readFileSync(join(root, "fixtures/scp/v0124-profile.json"), "utf8")) as {
  totals: { engine: string; addr_w: number; cycles: number }[];
};

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
      const changed: number[] = [];
      for (let e = 0; e < D; e++) if (code[e] !== before[e]) changed.push(e);
      if (changed.length === 0) tokens.push({ elem: 0, code: 0, event: false, eof: true, last: frame === 63 });
      else changed.forEach((elem, i) => tokens.push({
        elem, code: code[elem]!, event: true, eof: i === changed.length - 1, last: frame === 63 && i === changed.length - 1,
      }));
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, tokens, grids, shape };
}

function golden(D: number, tokens: readonly Tok[]): Change[] {
  const state = freshEde(D);
  const changes: Change[] = [];
  let cur: Tok[] = [];
  const flush = () => {
    const step = stepEde(state, D, 0, false, [], cur);
    changes.push(...step.changes);
    cur = [];
  };
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) flush();
  }
  return changes;
}

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0124-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_profile_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v", "hw/scp4d/rtl/scp4d_fe_r_share.v", "hw/scp4d/rtl/scp4d_k1_tap.v",
  "hw/scp4d/rtl/scp4d_hybrid_pipe.v", "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_ede.v", "hw/scp4d/rtl/scp4d_fsd.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const rows: { addr_w: number; pipe_cycles: number; pipe_evals: number; k1_cycles: number; fsd_cycles: number; best: number; beats: boolean; bit_exact: boolean }[] = [];

for (const addrW of [8, 10, 12]) {
  const w = workload(addrW);
  const times = Array.from({ length: 64 }, (_, i) => 1000 + i * 100);
  const h = hostHeader({ eps: [1], times, meta: null } as never);
  writeFileSync(join(dir, `c${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
  const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
  writeFileSync(join(dir, `h${addrW}.hex`), hdr.join("\n") + "\n");
  const out = join(dir, `p${addrW}.vvp`);
  const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_profile_tb.ADDR_W=11", "-Pscp4d_loop_profile_tb.ENGINE=3", "-o", out, ...sources], { encoding: "utf8" });
  if (comp.status !== 0) { console.error(comp.stderr.slice(-600)); process.exit(1); }
  const args = [
    "+nbytes=0", `+codes=${join(dir, `c${addrW}.hex`)}`, `+hdr=${join(dir, `h${addrW}.hex`)}`,
    `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
    "+t=64", "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
  ];
  const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const lines = (run.stdout ?? "").split("\n");
  const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
  const num = (k: string) => Number(total.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
  const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4));
  const want = golden(w.D, w.tokens).map((c) => `${c.frame} ${c.elem} ${c.decision}`);
  const set = (xs: string[]) => xs.map((s) => s.split(" ").join(":")).sort();
  const gs = set(got), ws = set(want);
  const exact = num("ok") === 1 && gs.length === ws.length && gs.every((k, i) => k === ws[i]);
  const base = (engine: string) => profile.totals.find((t) => t.engine === engine && t.addr_w === addrW)!.cycles;
  const k1 = base("ede"), fsd = base("fsd"), best = Math.min(k1, fsd);
  const beats = num("cycles") < best;
  rows.push({ addr_w: addrW, pipe_cycles: num("cycles"), pipe_evals: num("evals"), k1_cycles: k1, fsd_cycles: fsd, best, beats, bit_exact: exact });
  console.log(`A${addrW} pipe ${num("cycles")} k1 ${k1} fsd ${fsd} beats ${beats} exact ${exact} ok ${num("ok")}`);
  if (!exact) console.error(`mismatch len ${got.length}/${want.length} first ${got[0]} vs ${want[0]}`);
}

const pass = rows.every((r) => r.beats && r.bit_exact);
writeFileSync(join(root, "fixtures/scp/v0124-measure.json"), JSON.stringify({
  format: "scp4d-v0124-measure",
  label: "One Icarus run of scp4d_hybrid_pipe in the closed loop. Power is needs real board.",
  rows,
  beats_both_baselines: rows.every((r) => r.beats),
  bit_exact: rows.every((r) => r.bit_exact),
  pass,
}, null, 2) + "\n");
console.log(pass ? "MEASURE PASS" : "MEASURE does not beat both baselines");
if (!rows.every((r) => r.bit_exact)) process.exit(1);
