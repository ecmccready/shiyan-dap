/** Place-and-route for wrap_uart_ff. Serial seeds. Does not edit the v0.1.19 catalog.
 * Power is needs real board. Not run on a physical board.
 *
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-uart-ff.ts --seed=1
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-uart-ff.ts --all
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
const OSS = process.env.OSS_CAD_SUITE ?? "/opt/eda/oss-cad-suite";
const WORK = "fixtures/scp/uart-ff-work";
const OUT = "fixtures/scp/uart-ff-pnr";
const FILES = [
  "hw/scp4d/rtl/scp4d_uart_ff.v",
  "hw/scp4d/rtl/scp4d_hybrid_ff.v",
  "hw/scp4d/rtl/scp4d_ede_coh.v",
  "hw/scp4d/rtl/scp4d_fsd_n_coh.v",
];
const env = { ...process.env, PATH: `${OSS}/bin:${OSS}/py3bin:${process.env.PATH ?? ""}` };
const abs = (p: string) => join(root, p);
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function synth(): string {
  const dir = abs(WORK);
  mkdirSync(dir, { recursive: true });
  const json = join(dir, "n.json");
  if (!existsSync(json)) {
    const files = FILES.map(abs).join(" ");
    const script = `read_verilog ${files}; hierarchy -top wrap_uart_ff; synth_ecp5 -top wrap_uart_ff -json n.json`;
    const r = spawnSync("yosys", ["-q", "-p", script], { cwd: dir, encoding: "utf8", env });
    if (r.status !== 0) throw new Error(`yosys failed\n${r.stderr ?? ""}`);
  }
  return sha(readFileSync(json));
}

function route(seed: number, netHash: string): void {
  const rel = join(OUT, `45F-route-seed${seed}.json`);
  if (existsSync(abs(rel))) {
    console.log(`reuse ${rel}`);
    return;
  }
  mkdirSync(abs(OUT), { recursive: true });
  const report = abs(join(OUT, `45F-route-seed${seed}.report.json`));
  const args = ["--45k", "--package", "CABGA381", "--json", abs(join(WORK, "n.json")),
    "--lpf", abs("hw/scp4d/constraints/ecp5-versa-uart.lpf"),
    "--lpf-allow-unconstrained", "--freq", "12", "--router", "router2", "--seed", String(seed),
    "--timing-allow-fail", "--report", report];
  const started = Date.now();
  console.log(`${new Date().toISOString()} start seed ${seed}`);
  const r = spawnSync("nextpnr-ecp5", args, { encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  const wall = (Date.now() - started) / 1000;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  let fmax: number | null = null;
  let util: Record<string, { used: number; available: number }> | null = null;
  if (existsSync(report)) {
    const rep = JSON.parse(readFileSync(report, "utf8")) as {
      fmax?: Record<string, { achieved?: number }>;
      utilization?: Record<string, { used: number; available: number }>;
    };
    const clocks = Object.values(rep.fmax ?? {});
    const achieved = clocks.map((c) => c.achieved).filter((n): n is number => typeof n === "number");
    fmax = achieved.length ? Math.min(...achieved) : null;
    util = rep.utilization ?? null;
  }
  const status = r.status === 0 && fmax !== null ? "routed" : "failed";
  const rec = {
    seed, part: "45F", device: "LFE5U-45F", status, fmax_mhz: status === "routed" ? fmax : null,
    wall_clock_s: Math.round(wall * 1000) / 1000, exit_code: r.status,
    lut: util?.TRELLIS_COMB?.used ?? null, ff: util?.TRELLIS_FF?.used ?? null, bram: util?.DP16KD?.used ?? null,
    netlist_sha256: netHash, command: ["nextpnr-ecp5", ...args],
    error: (text.match(/ERROR: [^\n]+/) ?? [null])[0],
  };
  writeFileSync(abs(rel), JSON.stringify(rec, null, 2) + "\n");
  console.log(`${new Date().toISOString()} done seed ${seed} ${rec.status} ${rec.wall_clock_s}s ${rec.fmax_mhz ?? ""}`);
  if (rec.status !== "routed") process.exitCode = 1;
}

const net = synth();
const only = process.argv.find((a) => a.startsWith("--seed="));
const seeds = only ? [Number(only.slice("--seed=".length))] : [1, 2, 3, 4, 5];
for (const s of seeds) route(s, net);
