/** TEST ONLY. One simulation of the v0.1.25 retimed loop. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0125-candidate.ts
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
const bare = JSON.parse(readFileSync(join(root, "fixtures/scp/v0125-baselines.json"), "utf8")) as {
  rows: { engine: string; addr_w: number; cycles: number }[];
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
  for (const t of tokens) {
    cur.push(t);
    if (t.eof) {
      changes.push(...stepEde(state, D, 0, false, [], cur).changes);
      cur = [];
    }
  }
  return changes;
}

const dir = mkdtempSync(join(tmpdir(), "scp4d-v0125c-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0125_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v", "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v",
  "hw/scp4d/rtl/scp4d_fe_r_share.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v", "hw/scp4d/rtl/scp4d_k1_tap.v",
  "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const rows: { addr_w: number; cycles: number; evals: number; bare_cycles: number; bit_exact: boolean; ok: number; fsd_frames: number }[] = [];

for (const addrW of [8, 10, 12]) {
  const w = workload(addrW);
  const times = Array.from({ length: 64 }, (_, i) => 1000 + i * 100);
  const h = hostHeader({ eps: [1], times, meta: null } as never);
  writeFileSync(join(dir, `c${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
  const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
  writeFileSync(join(dir, `h${addrW}.hex`), hdr.join("\n") + "\n");
  const out = join(dir, `p${addrW}.vvp`);
  const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0125_tb.ADDR_W=11", "-Pscp4d_loop_v0125_tb.ENGINE=2", "-o", out, ...sources], { encoding: "utf8" });
  if (comp.status !== 0) { console.error(comp.stderr.slice(-800)); process.exit(1); }
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
  const base = bare.rows.find((r) => r.engine === "k1bare" && r.addr_w === addrW)!.cycles;
  const fsdFrames = lines.filter((l) => l.startsWith("FRAME ") && l.trim().split(" ")[11] === "1").length;
  rows.push({ addr_w: addrW, cycles: num("cycles"), evals: num("evals"), bare_cycles: base, bit_exact: exact, ok: num("ok"), fsd_frames: fsdFrames });
  console.log(`fast A${addrW} cycles ${num("cycles")} bare ${base} evals ${num("evals")} exact ${exact} ok ${num("ok")} fsd_frames ${fsdFrames}`);
  if (!exact) console.error(`mismatch len ${got.length}/${want.length} total ${total}`);
}

writeFileSync(join(root, "fixtures/scp/v0125-candidate.json"), JSON.stringify({
  format: "scp4d-v0125-candidate",
  label: "Icarus of wrap_loop_k1fast. Pure pipelined K1. Power is needs real board. No place-and-route in this file.",
  rows,
  bit_exact: rows.every((r) => r.bit_exact),
  full_scan_frames: 0,
}, null, 2) + "\n");
console.log(rows.every((r) => r.bit_exact) ? "CANDIDATE BIT-EXACT" : "CANDIDATE NOT BIT-EXACT");
process.exit(rows.every((r) => r.bit_exact) ? 0 : 1);
