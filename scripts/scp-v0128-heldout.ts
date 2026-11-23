/** TEST ONLY. Held-out runs after fixtures/scp/v0128-freeze.json.
 * Seeds 9 and 13 are not regenerated. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0128-heldout.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshEde, stepEde, stepFsd, type Change, type Tok } from "./scp-v0120-ede-model";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const freeze = JSON.parse(readFileSync(join(root, "fixtures/scp/v0128-freeze.json"), "utf8")) as { percent: number };
if (freeze.percent !== 15) {
  console.error("freeze percent is not 15");
  process.exit(1);
}
const percent = freeze.percent;

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

const workloads: Record<string, { seed: number; groups: { fraction: number; n: number }[] }> = {
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

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const dir = mkdtempSync(join(tmpdir(), "scp4d-v0128h-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0128_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_hybrid_fix.v",
  "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd_n.v",
].map((p) => join(root, p));

type Row = {
  workload: string; addr_w: number; cycles: number; evals: number;
  fsd_frames: number; k1_frames: number; switches: number; bit_exact: boolean;
};

function one(name: string, addrW: number): Row {
  const spec = workloads[name]!;
  const w = build(addrW, spec.seed, spec.groups);
  const T = w.grids.length;
  const times = Array.from({ length: T }, (_, i) => 1000 + i * 100);
  const h = hostHeader({ eps: [1], times, meta: null } as never);
  const tag = `${name}${addrW}`;
  writeFileSync(join(dir, `c${tag}.hex`), w.grids.flat().map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("\n") + "\n");
  const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
  writeFileSync(join(dir, `h${tag}.hex`), hdr.join("\n") + "\n");
  const out = join(dir, `p${tag}.vvp`);
  const comp = spawnSync("iverilog", [
    "-g2012", "-Pscp4d_loop_v0128_tb.ADDR_W=11", `-Pscp4d_loop_v0128_tb.PERCENT=${percent}`,
    "-o", out, ...sources,
  ], { encoding: "utf8" });
  if (comp.status !== 0) { console.error(comp.stderr.slice(-900)); process.exit(1); }
  const run = spawnSync("vvp", ["-n", out,
    "+nbytes=0", `+codes=${join(dir, `c${tag}.hex`)}`, `+hdr=${join(dir, `h${tag}.hex`)}`,
    `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
    `+t=${T}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
  ], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  const lines = (run.stdout ?? "").split("\n");
  const total = lines.find((l) => l.startsWith("TOTAL ")) ?? "";
  const num = (k: string) => Number(total.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
  const fr = lines.filter((l) => l.startsWith("FRAME ")).map((l) => l.trim().split(/\s+/));
  const fsdFrames = fr.filter((p) => p[11] === "1").length;
  const switches = fr.reduce((a, p) => a + Number(p[12] ?? 0), 0);
  const got = lines.filter((l) => l.startsWith("CHG ")).map((l) => l.slice(4).trim().split(/\s+/).join(":"));
  const hwUse = fr.map((_, i) => i !== 0 && Number(fr[i - 1]?.[10] ?? 0) * 100 >= w.D * percent);
  const want: Change[] = [];
  const state = freshEde(w.D);
  for (const [i, frame] of framesOf(w.tokens).entries()) {
    const step = hwUse[i] ? stepFsd(state, w.D, 0, frame) : stepEde(state, w.D, 0, false, [], frame);
    for (const c of step.changes) want.push({ ...c, frame: i });
  }
  const ws = want.map((c) => `${c.frame}:${c.elem}:${c.decision}`).sort();
  const gs = got.sort();
  const selOk = fr.length === T && fr.every((p, i) => (p[11] === "1") === !!hwUse[i]);
  const exact = num("ok") === 1 && selOk && gs.length === ws.length && gs.every((k, i) => k === ws[i]);
  if (!exact) {
    const missing = ws.filter((k) => !gs.includes(k)).slice(0, 8);
    const extra = gs.filter((k) => !ws.includes(k)).slice(0, 8);
    console.error(`${name} A${addrW} NOT EXACT ok=${num("ok")} selOk=${selOk} missing ${missing.join(" ")} extra ${extra.join(" ")}`);
  }
  const row: Row = {
    workload: name, addr_w: addrW, cycles: num("cycles"), evals: num("evals"),
    fsd_frames: fsdFrames, k1_frames: fr.length - fsdFrames, switches, bit_exact: exact,
  };
  console.log(`${name} A${addrW} cycles ${row.cycles} fsd ${fsdFrames} k1 ${row.k1_frames} sw ${switches} exact ${exact}`);
  return row;
}

const jobs = Object.keys(workloads).flatMap((name) => [8, 10, 12].map((addrW) => ({ name, addrW })))
  .filter((j) => !only || only === `${j.name}${j.addrW}`);
const rows = jobs.map((j) => one(j.name, j.addrW));
const out = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);
if (out) writeFileSync(out, JSON.stringify(rows) + "\n");
if (!only) {
  const bad = rows.some((r) => !r.bit_exact);
  writeFileSync(join(root, "fixtures/scp/v0128-heldout.json"), JSON.stringify({
    format: "scp4d-v0128-heldout",
    label: "Held-out after fixtures/scp/v0128-freeze.json. Percent was not changed. Power is needs real board. Fmax is not in this file.",
    percent, rows, bit_exact: !bad,
  }, null, 2) + "\n");
  console.log(bad ? "HELD-OUT NOT BIT-EXACT" : "HELD-OUT BIT-EXACT");
  process.exit(bad ? 1 : 0);
}
process.exit(rows.every((r) => r.bit_exact) ? 0 : 1);
