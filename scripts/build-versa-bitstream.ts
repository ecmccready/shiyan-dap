/** Build wrap_uart_versa for the ECP5 Versa (LFE5UM-45F).
 * Five seeds, one at a time, then ecppack of the median-Fmax seed.
 * Power is needs real board. Not loaded on a board.
 *
 *   export PATH="/opt/eda/oss-cad-suite/bin:$PATH"
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/build-versa-bitstream.ts
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/build-versa-bitstream.ts --exploratory
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
const FREQ = "100";
const BOUND_S = 7200;
const exploratory = process.argv.includes("--exploratory");

type Util = { used: number; available: number; pct: number };
type PathEnd = { cell?: string; port?: string };
type SeedRec = {
  label: string;
  seed: number;
  device: string;
  package: string;
  freq_arg_mhz: number;
  fmax_mhz: number | null;
  clocks: Record<string, { achieved?: number; constraint?: number }>;
  wall_clock_s: number;
  exit_code: number | null;
  signal: string | null;
  timed_out: boolean;
  trellis_comb: Util | null;
  trellis_ff: Util | null;
  dp16kd: Util | null;
  critical_path_ns: number | null;
  critical_from: string | null;
  critical_to: string | null;
  netlist_sha256: string;
  error: string | null;
};

function utilOf(rep: { utilization?: Record<string, { used?: number; available?: number }> }, key: string): Util | null {
  const u = rep.utilization?.[key];
  if (!u || typeof u.used !== "number" || typeof u.available !== "number" || u.available === 0) return null;
  return { used: u.used, available: u.available, pct: u.used / u.available };
}

function toolVersion(bin: string, args: string[]): string {
  const r = spawnSync(bin, args, { encoding: "utf8", env });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n")[0] ?? "";
}

function synth(): string {
  mkdirSync(WORK, { recursive: true });
  const json = join(WORK, "n.json");
  const script = `read_verilog ${FILES.join(" ")}; hierarchy -top wrap_uart_versa; synth_ecp5 -top wrap_uart_versa -json n.json`;
  const t0 = Date.now();
  const r = spawnSync("yosys", ["-q", "-l", join(WORK, "yosys.log"), "-p", script], { cwd: WORK, encoding: "utf8", env });
  const wall = (Date.now() - t0) / 1000;
  writeFileSync(join(WORK, "yosys-wall.txt"), `${wall}\n`);
  if (r.status !== 0 || !existsSync(json)) {
    const log = existsSync(join(WORK, "yosys.log")) ? readFileSync(join(WORK, "yosys.log"), "utf8").slice(-800) : "";
    throw new Error(`yosys failed exit ${r.status} after ${wall}s\n${log}`);
  }
  return sha(readFileSync(json));
}

function route(seed: number, netHash: string, label: string): SeedRec {
  mkdirSync(OUT, { recursive: true });
  const report = join(WORK, `${label}-seed${seed}.report.json`);
  const textcfg = join(WORK, `${label}-seed${seed}.config`);
  const log = join(WORK, `${label}-seed${seed}.log`);
  const args = ["--um-45k", "--package", "CABGA381", "--json", join(WORK, "n.json"),
    "--lpf", LPF, "--freq", FREQ, "--router", "router2", "--seed", String(seed),
    "--timing-allow-fail", "--report", report, "--textcfg", textcfg, "--log", log];
  console.log(`${new Date().toISOString()} start ${label} seed ${seed}`);
  const t0 = Date.now();
  const r = spawnSync("nextpnr-ecp5", args, {
    cwd: WORK, encoding: "utf8", env, timeout: BOUND_S * 1000, maxBuffer: 8 * 1024 * 1024,
  });
  const wall = (Date.now() - t0) / 1000;
  const timedOut = r.error?.code === "ETIMEDOUT" || /ETIMEDOUT/.test(String(r.error ?? ""));
  let clocks: SeedRec["clocks"] = {};
  let fmax: number | null = null;
  let comb: Util | null = null;
  let ff: Util | null = null;
  let bram: Util | null = null;
  let pathNs: number | null = null;
  let from: string | null = null;
  let to: string | null = null;
  if (existsSync(report)) {
    const rep = JSON.parse(readFileSync(report, "utf8")) as {
      fmax?: Record<string, { achieved?: number; constraint?: number }>;
      utilization?: Record<string, { used?: number; available?: number }>;
      critical_paths?: { path?: { delay?: number; from?: PathEnd; to?: PathEnd }[] }[];
    };
    clocks = rep.fmax ?? {};
    const vals = Object.values(clocks).map((c) => c.achieved).filter((n): n is number => typeof n === "number" && n > 0);
    fmax = vals.length ? Math.min(...vals) : null;
    comb = utilOf(rep, "TRELLIS_COMB");
    ff = utilOf(rep, "TRELLIS_FF");
    bram = utilOf(rep, "DP16KD");
    const paths = rep.critical_paths ?? [];
    let best = -1;
    for (const p of paths) {
      const delay = (p.path ?? []).reduce((a, s) => a + (typeof s.delay === "number" ? s.delay : 0), 0);
      if (delay > best) {
        best = delay;
        const steps = p.path ?? [];
        from = steps[0]?.from?.cell ?? null;
        to = steps[steps.length - 1]?.to?.cell ?? null;
        pathNs = delay;
      }
    }
  }
  const logText = existsSync(log) ? readFileSync(log, "utf8") : `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const errLine = logText.split("\n").filter((l) => /ERROR|unconstrained/i.test(l)).slice(-5).join(" | ") || null;
  const rec: SeedRec = {
    label, seed, device: "LFE5UM-45F", package: "CABGA381", freq_arg_mhz: Number(FREQ),
    fmax_mhz: fmax, clocks, wall_clock_s: Math.round(wall * 1000) / 1000,
    exit_code: r.status, signal: r.signal, timed_out: timedOut,
    trellis_comb: comb, trellis_ff: ff, dp16kd: bram,
    critical_path_ns: pathNs, critical_from: from, critical_to: to,
    netlist_sha256: netHash, error: r.status === 0 && fmax !== null ? null : errLine,
  };
  const name = label === "exploratory" ? `exploratory-seed${seed}.json` : `seed${seed}.json`;
  writeFileSync(join(OUT, name), JSON.stringify(rec, null, 2) + "\n");
  console.log(`${new Date().toISOString()} done ${label} seed ${seed} fmax=${fmax} comb=${comb?.used ?? "?"} ${rec.wall_clock_s}s exit=${r.status}`);
  if (timedOut || r.status !== 0 || fmax === null) throw new Error(`${label} seed ${seed} did not route: ${errLine ?? r.signal ?? r.status}`);
  return rec;
}

const netHash = synth();
console.log(`yosys netlist ${netHash} ${toolVersion("yosys", ["-V"])}`);
console.log(toolVersion("nextpnr-ecp5", ["--version"]));

if (exploratory) {
  route(1, netHash, "exploratory");
  process.exit(0);
}

const seeds = [1, 2, 3, 4, 5].map((seed) => route(seed, netHash, "final"));
const sorted = [...seeds].sort((a, b) => (a.fmax_mhz ?? 0) - (b.fmax_mhz ?? 0) || a.seed - b.seed);
const chosen = sorted[2]!;
const cfg = join(WORK, `final-seed${chosen.seed}.config`);
const bit = join(OUT, `wrap_uart_versa-seed${chosen.seed}.bit`);
const svf = join(OUT, `wrap_uart_versa-seed${chosen.seed}.svf`);
const spi = join(OUT, `wrap_uart_versa-seed${chosen.seed}.spi.bit`);
const packT0 = Date.now();
for (const [file, args] of [
  [bit, ["--compress", "--bit", bit, "--svf", svf, cfg]],
  [spi, ["--compress", "--spimode", "fast-read", "--bit", spi, cfg]],
] as const) {
  const r = spawnSync("ecppack", args, { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `ecppack failed ${file}`);
}
const summary = {
  label: "final",
  device: "LFE5UM-45F",
  device_flag: "--um-45k",
  package: "CABGA381",
  router: "router2",
  freq_arg_mhz: Number(FREQ),
  chosen_seed: chosen.seed,
  fmax_mhz_median: chosen.fmax_mhz,
  logic_clock_mhz: 20,
  board_clock_mhz: 100,
  baud: 125000,
  seeds,
  bit_sha256: sha(readFileSync(bit)),
  svf_sha256: sha(readFileSync(svf)),
  spi_bit_sha256: sha(readFileSync(spi)),
  netlist_sha256: netHash,
  yosys_wall_s: Number(readFileSync(join(WORK, "yosys-wall.txt"), "utf8").trim()),
  ecppack_wall_s: Math.round((Date.now() - packT0) / 10) / 100,
  yosys: toolVersion("yosys", ["-V"]),
  nextpnr: toolVersion("nextpnr-ecp5", ["--version"]),
  power: "needs real board",
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({
  chosen_seed: summary.chosen_seed,
  fmax_mhz_median: summary.fmax_mhz_median,
  bit_sha256: summary.bit_sha256,
  svf_sha256: summary.svf_sha256,
  spi_bit_sha256: summary.spi_bit_sha256,
  ecppack_wall_s: summary.ecppack_wall_s,
}, null, 2));
