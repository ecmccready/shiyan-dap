/** TEST ONLY. Profile the closed loop before any v0.1.24 fix.
 * Power is needs real board. No place-and-route.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0124-profile.ts
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostHeader } from "./scp-v0114-rtl-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const FRACTION: Record<string, number> = { low: 0.01, medium: 0.05, high: 0.2, very_high: 0.5 };
const NAMES = ["ede", "hybrid", "fsd"] as const;

function grids(addrW: number): { D: number; grids: number[][]; shape: { nx: number; ny: number; nz: number; channels: number } } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(9, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const out: number[][] = [];
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
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((9 + frame + cell) % 5));
      out.push(code.slice());
    }
  }
  const shape = addrW >= 12 ? { nx: 32, ny: 32, nz: 2, channels: 1 }
    : addrW === 10 ? { nx: 32, ny: 32, nz: 1, channels: 1 }
    : { nx: 16, ny: 16, nz: 1, channels: 1 };
  return { D, grids: out, shape };
}

const iverilog = spawnSync("iverilog", ["-V"], { encoding: "utf8" });
if (iverilog.status !== 0 && !(iverilog.stdout ?? "").length) {
  console.error("iverilog missing");
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), "scp4d-prof-"));
const sources = [
  "hw/scp4d/tb/scp4d_loop_profile_tb.v",
  "hw/scp4d/rtl/scp4d_tenc_q_w4l8_bram.v", "hw/scp4d/rtl/scp4d_tenc_q.v",
  "hw/scp4d/rtl/scp4d_tdec_s_w4_bram.v", "hw/scp4d/rtl/scp4d_fe_r_share.v", "hw/scp4d/rtl/scp4d_k1_tap.v",
  "hw/scp4d/rtl/scp4d_hybrid.v", "hw/scp4d/rtl/scp4d_ede.v", "hw/scp4d/rtl/scp4d_fsd.v",
].map((p) => join(root, p));

type Frame = {
  frame: number; wall: number; eng: number; busy: number; idle: number; handoff: number;
  tap_full: number; enc_stall: number; out_stall: number; events: number; sel: number; switched: number;
};
const csv: string[] = ["engine,addr_w,frame,wall,eng,busy,idle,handoff,tap_full,enc_stall,out_stall,events,sel_fsd,switched"];
const totals: { engine: string; addr_w: number; cycles: number; eng_cycles: number; evals: number; frames: number; fsd_frames: number; switches: number; busy: number; idle: number; handoff: number; tap_full: number; enc_stall: number; out_stall: number }[] = [];

const w32 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
for (const addrW of [8, 10, 12]) {
  const w = grids(addrW);
  const times = Array.from({ length: 64 }, (_, i) => 1000 + i * 100);
  const h = hostHeader({ eps: [1], times, meta: null } as never);
  writeFileSync(join(dir, `c${addrW}.hex`), w.grids.flat().map(w32).join("\n") + "\n");
  const hdr = Buffer.from(h.eps).toString("hex").match(/../g)!.concat(Buffer.from(h.tm).toString("hex").match(/../g)!);
  writeFileSync(join(dir, `h${addrW}.hex`), hdr.join("\n") + "\n");
  const args = [
    "+nbytes=0", `+codes=${join(dir, `c${addrW}.hex`)}`, `+hdr=${join(dir, `h${addrW}.hex`)}`,
    `+nhdr=${h.eps.length + h.tm.length}`, `+nx=${w.shape.nx}`, `+ny=${w.shape.ny}`, `+nz=${w.shape.nz}`, "+c=1",
    "+t=64", "+g=1", "+pred=1", `+tmlen=${h.tm.length}`,
  ];
  for (const [eng, name] of NAMES.entries()) {
    const out = join(dir, `p${addrW}-${eng}.vvp`);
    const comp = spawnSync("iverilog", ["-g2012", "-Pscp4d_loop_profile_tb.ADDR_W=11", `-Pscp4d_loop_profile_tb.ENGINE=${eng}`, "-o", out, ...sources], { encoding: "utf8" });
    if (comp.status !== 0) { console.error(comp.stderr.slice(-500)); process.exit(1); }
    const run = spawnSync("vvp", ["-n", out, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const lines = (run.stdout ?? "").split("\n");
    const frames: Frame[] = [];
    for (const line of lines) {
      if (!line.startsWith("FRAME ")) continue;
      const n = line.slice(6).split(" ").map(Number);
      frames.push({
        frame: n[0]!, wall: n[1]!, eng: n[2]!, busy: n[3]!, idle: n[4]!, handoff: n[5]!,
        tap_full: n[6]!, enc_stall: n[7]!, out_stall: n[8]!, events: n[9]!, sel: n[10]!, switched: n[11]!,
      });
      csv.push([name, addrW, ...n].join(","));
    }
    const total = lines.find((l) => l.startsWith("TOTAL "));
    const num = (k: string) => Number(total?.match(new RegExp(`${k}=(-?\\d+)`))?.[1]);
    const sum = (k: keyof Frame) => frames.reduce((a, f) => a + Number(f[k]), 0);
    totals.push({
      engine: name, addr_w: addrW, cycles: num("cycles"), eng_cycles: num("eng_cycles"), evals: num("evals"),
      frames: num("frames"), fsd_frames: frames.filter((f) => f.sel === 1).length, switches: sum("switched"),
      busy: sum("busy"), idle: sum("idle"), handoff: sum("handoff"), tap_full: sum("tap_full"),
      enc_stall: sum("enc_stall"), out_stall: sum("out_stall"),
    });
    console.log(`${name} A${addrW} wall ${num("cycles")} eng ${num("eng_cycles")} busy ${sum("busy")} idle ${sum("idle")} handoff ${sum("handoff")} tap ${sum("tap_full")} fsd_frames ${frames.filter((f) => f.sel === 1).length} ok ${num("ok")}`);
    if (num("ok") !== 1) { console.error(total); process.exit(1); }
  }
}

const outDir = join(root, "fixtures/scp");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "v0124-profile.csv"), csv.join("\n") + "\n");
writeFileSync(join(outDir, "v0124-profile.json"), JSON.stringify({
  format: "scp4d-v0124-profile",
  label: "Icarus wall-cycle buckets on the held-out grids. busy+idle+handoff is the partition of each frame. tap_full, enc_stall and out_stall overlap that partition. Power is needs real board. No place-and-route.",
  buckets: {
    busy: "engine in_ready is low: ingest, evaluate, scan, or a masked switch",
    idle: "engine is ready and the tap has no token",
    handoff: "engine accepts a token",
    tap_full: "tap room is low, so the decoder is stalled",
    enc_stall: "encoder in_valid and not in_ready",
    out_stall: "encoder has a byte and the decoder or the tap cannot take it",
  },
  totals,
}, null, 2) + "\n");
console.log("wrote fixtures/scp/v0124-profile.json");
