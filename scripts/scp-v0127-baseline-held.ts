/** TEST ONLY. Pure K1 and N=4 full scan on the two held-out workloads.
 * Not a selector fit. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0127-baseline-held.ts
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const workloads = {
  original: { seed: 9, groups: [{ fraction: 0.01, n: 16 }, { fraction: 0.05, n: 16 }, { fraction: 0.2, n: 16 }, { fraction: 0.5, n: 16 }] },
  high: { seed: 13, groups: [
    { fraction: 0.55, n: 8 }, { fraction: 0.65, n: 8 }, { fraction: 0.75, n: 8 }, { fraction: 0.85, n: 8 }, { fraction: 0.95, n: 8 },
    { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 }, { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 },
    { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 }, { fraction: 0.05, n: 1 }, { fraction: 0.85, n: 1 },
  ] },
};
function gridsOf(addrW: number, seed: number, groups: { fraction: number; n: number }[]): number[][] {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const grids: number[][] = [];
  for (const g of groups) {
    const k = Math.max(1, Math.round(g.fraction * D));
    for (let n = 0; n < g.n; n++) {
      const idx = Array.from({ length: D }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (D - i));
        const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
      }
      const frame = grids.length;
      for (const cell of idx.slice(0, k).sort((a, b) => a - b)) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + frame + cell) % 5));
      grids.push(code.slice());
    }
  }
  return grids;
}
const dir = mkdtempSync(join(tmpdir(), "scp4d-v0127b-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_v0127_train_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_fast.v", "hw/scp4d/rtl/scp4d_fe_r_fast.v",
  "hw/scp4d/rtl/scp4d_k1_tap.v", "hw/scp4d/rtl/scp4d_ede_pipe.v", "hw/scp4d/rtl/scp4d_fsd_n.v",
].map((p) => join(root, p));
const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
const rows: { workload: string; engine: string; addr_w: number; cycles: number }[] = [];
for (const [name, spec] of Object.entries(workloads)) {
  for (const addrW of [8, 10, 12]) {
    const D = addrW >= 12 ? 2048 : 1 << addrW;
    const grids = gridsOf(addrW, spec.seed, spec.groups);
    const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2 } : addrW === 10 ? { nx: 32, ny: 32, nz: 1 } : { nx: 16, ny: 16, nz: 1 };
    const h = hostHeader({ eps: [1], times: Array.from({ length: grids.length }, (_, i) => 1000 + i * 100), meta: null } as never);
    writeFileSync(join(dir, `c${name}${addrW}.hex`), grids.flat().map(w32).join("\n") + "\n");
    const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
    writeFileSync(join(dir, `h${name}${addrW}.hex`), hdr.join("\n") + "\n");
    const args = ["+nbytes=0", `+codes=${join(dir, `c${name}${addrW}.hex`)}`, `+hdr=${join(dir, `h${name}${addrW}.hex`)}`,
      `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${shape.nx}`, `+ny=${shape.ny}`, `+nz=${shape.nz}`, "+c=1",
      `+t=${grids.length}`, "+g=1", "+pred=1", `+tmlen=${h.tm.length}`];
    for (const [eng, ename] of [["0", "k1"], ["2", "n4"]] as const) {
      const out = join(dir, `p${name}${addrW}-${ename}.vvp`);
      const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_v0127_train_tb.ADDR_W=11", `-Pscp4d_loop_v0127_train_tb.ENGINE=${eng}`, "-o", out, ...sources], { encoding: "utf8" });
      if (comp.status !== 0) { console.error(comp.stderr.slice(-600)); process.exit(1); }
      const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
      const total = (run.stdout ?? "").split("\n").find((l) => l.startsWith("TOTAL ")) ?? "";
      const cycles = Number(total.match(/cycles=(-?\d+)/)?.[1]);
      rows.push({ workload: name, engine: ename, addr_w: addrW, cycles });
      console.log(`${name} ${ename} A${addrW} ${cycles}`);
    }
  }
}
writeFileSync(join(root, "fixtures/scp/v0127-baseline-held.json"), JSON.stringify({ format: "scp4d-v0127-baseline-held", rows }, null, 2) + "\n");
console.log("BASELINE HELD DONE");
