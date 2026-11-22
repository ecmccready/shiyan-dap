/** TEST ONLY. v0.1.24 pipelined K1 closed loop.
 * The cycle rule is fixtures/scp/v0124-prereg.json, committed before the measure.
 * Counted checks read the committed measure, profile and manifest. They do not
 * re-simulate or place-and-route. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0124.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const prereg = JSON.parse(read("fixtures/scp/v0124-prereg.json")) as {
  widths_required: string;
  cycles_PASS: string;
  fix: { ede: string; hybrid: string; loop: string };
};
check("prereg requires ADDR_W 8, 10 and 12 and a strict cycle win",
  prereg.widths_required.includes("8") && prereg.widths_required.includes("10") && prereg.widths_required.includes("12")
  && prereg.cycles_PASS.includes("strictly less")
  && prereg.fix.loop.includes("wrap_loop_k1pipe"));

const measure = JSON.parse(read("fixtures/scp/v0124-measure.json")) as {
  beats_both_baselines: boolean;
  bit_exact: boolean;
  rows: { addr_w: number; pipe_cycles: number; k1_cycles: number; fsd_cycles: number; beats: boolean; bit_exact: boolean }[];
};
const want: Record<number, [number, number, number]> = {
  8: [16253, 18643, 40767],
  10: [64527, 74342, 163151],
  12: [129723, 149496, 326734],
};
const rowsOk = [8, 10, 12].every((w) => {
  const row = measure.rows.find((r) => r.addr_w === w);
  const [pipe, k1, fsd] = want[w]!;
  return !!row && row.pipe_cycles === pipe && row.k1_cycles === k1 && row.fsd_cycles === fsd
    && row.pipe_cycles < Math.min(k1, fsd) && row.beats && row.bit_exact;
});
check("measured pipe beats both profile baselines and is bit-exact at 8, 10 and 12",
  measure.beats_both_baselines && measure.bit_exact && rowsOk);

const profile = JSON.parse(read("fixtures/scp/v0124-profile.json")) as {
  totals: { engine: string; addr_w: number; cycles: number }[];
};
const baselinesMatch = [8, 10, 12].every((w) => {
  const ede = profile.totals.find((t) => t.engine === "ede" && t.addr_w === w);
  const fsd = profile.totals.find((t) => t.engine === "fsd" && t.addr_w === w);
  const row = measure.rows.find((r) => r.addr_w === w);
  return !!ede && !!fsd && !!row && ede.cycles === row.k1_cycles && fsd.cycles === row.fsd_cycles;
});
check("measure baselines are the profile wall totals", baselinesMatch);

const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as {
  source_files: { path: string; sha256: string }[];
  designs: Record<string, {
    smallest_part?: string;
    decisions_per_s_per_lut?: number;
    fmax_mhz?: { median?: number; n?: number };
    seeds_45f?: { status: string; utilization?: { TRELLIS_COMB?: { used: number }; DP16KD?: { used: number } } }[];
  }>;
};
const pinned = (path: string) => manifest.source_files.find((s) => s.path === path)?.sha256;
check("v0.1.19, v0.1.22 and v0.1.23 sources still match the manifest",
  pinned("hw/scp4d/rtl/scp4d_ede.v") === sha(read("hw/scp4d/rtl/scp4d_ede.v"))
  && pinned("hw/scp4d/rtl/scp4d_hybrid.v") === sha(read("hw/scp4d/rtl/scp4d_hybrid.v"))
  && pinned("hw/scp4d/synth/scp4d_ede_wrap.v") === sha(read("hw/scp4d/synth/scp4d_ede_wrap.v")));

const pipe = read("hw/scp4d/rtl/scp4d_hybrid_pipe.v");
check("pipe hybrid instantiates the pipelined engine and full scan, and does not select a scan",
  pipe.includes("scp4d_ede_pipe") && pipe.includes("scp4d_fsd") && pipe.includes("1'b0 && very_high"));
const wrap = read("hw/scp4d/synth/scp4d_loop_k1pipe_wrap.v");
check("pipelined loop uses the v0.1.22 codec and scp4d_hybrid_pipe",
  wrap.includes("scp4d_tenc_q_w4l8_bram") && wrap.includes("scp4d_tdec_s_w4_bram") && wrap.includes("scp4d_hybrid_pipe"));

const placed = manifest.designs["loop-k1pipe-w4l8"];
const seeds = placed?.seeds_45f ?? [];
const comb = seeds[0]?.utilization?.TRELLIS_COMB?.used;
const dp = seeds[0]?.utilization?.DP16KD?.used;
check("loop-k1pipe-w4l8 routes five of five with 31567 TRELLIS_COMB and median 30.498031616210938 MHz",
  seeds.length === 5 && seeds.every((s) => s.status === "routed")
  && comb === 31567 && dp === 48
  && placed?.fmax_mhz?.median === 30.498031616210938 && placed?.fmax_mhz?.n === 5
  && placed?.smallest_part === "45F");
check("decisions/s per LUT is 150.30925359248772 and loses to standalone full scan",
  placed?.decisions_per_s_per_lut === 150.30925359248772
  && (placed?.decisions_per_s_per_lut ?? 0) < 71397.91807427029);

if (failures.length) {
  console.error(`FAIL check-scp-v0124 (${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0124 (${passed} checks)`);
