/** Build wrap_uart_versa for the ECP5 Versa (LFE5UM-45F).
 * Five seeds, one at a time. Packs the median-Fmax seed.
 * Power is needs real board. Not loaded on a board.
 *
 *   export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/build-versa-bitstream.ts
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
const OSS = process.env.OSS_CAD_SUITE ?? "/opt/eda/oss-cad-suite";
const WORK = join(root, "fixtures/scp/versa-work");
const OUT = join(root, "fixtures/scp/versa-bitstream");
const FILES = [
  "hw/scp4d/rtl/scp4d_uart_ff.v",
  "hw/scp4d/rtl/scp4d_uart_ff_pipe.v",
  "hw/scp4d/rtl/scp4d_uart_versa.v",
  "hw/scp4d/rtl/scp4d_hybrid_ff.v",
  "hw/scp4d/rtl/scp4d_ede_coh.v",
  "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
].map((f) => join(root, f));
const LPF = join(root, "hw/scp4d/constraints/ecp5-versa-uart.lpf");
const env = { ...process.env, PATH: `${OSS}/bin:${OSS}/py3bin:${process.env.PATH ?? ""}` };
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function synth(): void {
  mkdirSync(WORK, { recursive: true });
  if (existsSync(join(WORK, "n.json"))) return;
  const script = `read_verilog ${FILES.join(" ")}; hierarchy -top wrap_uart_versa; synth_ecp5 -top wrap_uart_versa -json n.json`;
  const r = spawnSync("yosys", ["-q", "-p", script], { cwd: WORK, encoding: "utf8", env });
  if (r.status !== 0) throw new Error(r.stderr || "yosys failed");
}

function route(seed: number): { fmax: number; wall: number; lut: number | null } {
  const report = join(OUT, `seed${seed}.report.json`);
  const textcfg = join(WORK, `seed${seed}.config`);
  mkdirSync(OUT, { recursive: true });
  const meta = join(OUT, `seed${seed}.json`);
  if (existsSync(meta) && existsSync(textcfg)) {
    const j = JSON.parse(readFileSync(meta, "utf8")) as { fmax_mhz: number; wall_clock_s: number; lut: number | null };
    console.log(`reuse seed ${seed} ${j.fmax_mhz}`);
    return { fmax: j.fmax_mhz, wall: j.wall_clock_s, lut: j.lut };
  }
  const args = ["--um-45k", "--package", "CABGA381", "--json", join(WORK, "n.json"),
    "--lpf", LPF, "--freq", "20", "--router", "router2", "--seed", String(seed),
    "--timing-allow-fail", "--report", report, "--textcfg", textcfg];
  console.log(`${new Date().toISOString()} start seed ${seed}`);
  const t0 = Date.now();
  const r = spawnSync("nextpnr-ecp5", args, { cwd: WORK, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  const wall = (Date.now() - t0) / 1000;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  if (/unconstrained/i.test(text) && /ERROR/i.test(text)) throw new Error(text.slice(-800));
  let fmax = 0;
  let lut: number | null = null;
  if (existsSync(report)) {
    const rep = JSON.parse(readFileSync(report, "utf8")) as {
      fmax?: Record<string, { achieved?: number }>;
      utilization?: Record<string, { used?: number }>;
    };
    const vals = Object.values(rep.fmax ?? {}).map((c) => c.achieved).filter((n): n is number => typeof n === "number" && n > 0);
    fmax = vals.length ? Math.min(...vals) : 0;
    lut = rep.utilization?.TRELLIS_COMB?.used ?? null;
  }
  const rec = { seed, device: "LFE5UM-45F", fmax_mhz: fmax, wall_clock_s: Math.round(wall * 1000) / 1000, lut, exit_code: r.status };
  writeFileSync(meta, JSON.stringify(rec, null, 2) + "\n");
  console.log(`${new Date().toISOString()} done seed ${seed} ${fmax} ${rec.wall_clock_s}s exit ${r.status}`);
  if (r.status !== 0 || !(fmax > 0)) throw new Error(`seed ${seed} did not route`);
  return { fmax, wall: rec.wall_clock_s, lut };
}

synth();
const seeds = [1, 2, 3, 4, 5].map((seed) => ({ seed, ...route(seed) }));
const sorted = [...seeds].sort((a, b) => a.fmax - b.fmax || a.seed - b.seed);
const chosen = sorted[2]!;
const cfg = join(WORK, `seed${chosen.seed}.config`);
const bit = join(OUT, `wrap_uart_versa-seed${chosen.seed}.bit`);
const svf = join(OUT, `wrap_uart_versa-seed${chosen.seed}.svf`);
const spi = join(OUT, `wrap_uart_versa-seed${chosen.seed}.spi.bit`);
for (const [file, args] of [
  [bit, ["--compress", "--bit", bit, "--svf", svf, cfg]],
  [spi, ["--compress", "--spimode", "fast-read", "--bit", spi, cfg]],
] as const) {
  const r = spawnSync("ecppack", args, { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(r.stderr || `ecppack failed ${file}`);
}
const summary = {
  chosen_seed: chosen.seed,
  fmax_mhz_median: chosen.fmax,
  logic_clock_mhz: 20,
  board_clock_mhz: 100,
  baud: 125000,
  seeds,
  bit_sha256: sha(readFileSync(bit)),
  svf_sha256: sha(readFileSync(svf)),
  spi_bit_sha256: sha(readFileSync(spi)),
  power: "needs real board",
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
