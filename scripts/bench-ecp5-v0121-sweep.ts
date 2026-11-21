/** v0.1.21 K1 versus full-scan sweep. One nextpnr at a time, pinned toolchain only.
 *
 *   npx tsx scripts/bench-ecp5-v0121-sweep.ts
 *   npx tsx scripts/bench-ecp5-v0121-sweep.ts --score
 *
 * Five 45F seeds per ADDR_W for ede-temporal (REL=0) and fsd. Churn does not
 * get its own place-and-route: --score reuses each width's median Fmax and the
 * median-Fmax seed's TRELLIS_COMB, and reads evals/cycles from
 * fixtures/scp/v0121-sweep-cycles.json. These widths are not catalog designs.
 * Power is needs real board. A toolchain other than OSS CAD Suite 20261118
 * exits before any number is written.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { READ_FILES } from "./ecp5-v0119-catalog.ts";

const root = resolve(join(import.meta.dirname, ".."));
const OSS = process.env.OSS_CAD_SUITE ?? "/opt/eda/oss-cad-suite";
const WORK = "fixtures/scp/v0121-work";
const PNR = "fixtures/scp/v0121-pnr";
const OUT = "fixtures/scp/v0121-sweep.json";
const CYCLES = "fixtures/scp/v0121-sweep-cycles.json";
const BOUND_S = 7200;
const SEEDS = [1, 2, 3, 4, 5] as const;
const ADDRS = [8, 10, 12] as const;
const YOSYS_SHA = "583f380c6";
const PNR_SHA = "e811ba48";

const env = { ...process.env, PATH: `${OSS}/bin:${OSS}/py3bin:${process.env.PATH ?? ""}` };
const abs = (rel: string) => join(root, rel);
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const log = (s: string) => console.log(`${new Date().toISOString()} ${s}`);

function firstLine(bin: string, args: string[]): string {
  const r = spawnSync(bin, args, { encoding: "utf8", env });
  return `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
}

function refuseOtherToolchain() {
  const version = existsSync(join(OSS, "VERSION")) ? readFileSync(join(OSS, "VERSION"), "utf8").trim() : "";
  const yosys = firstLine("yosys", ["-V"]);
  const nextpnr = firstLine("nextpnr-ecp5", ["--version"]);
  if (version !== "20261118" || !yosys.includes(YOSYS_SHA) || !nextpnr.includes(PNR_SHA)) {
    console.error(`REFUSE toolchain. Need OSS CAD Suite 20261118, Yosys ${YOSYS_SHA}, nextpnr ${PNR_SHA}.`);
    console.error(`got version=${version || "(none)"} yosys=${yosys} nextpnr=${nextpnr}`);
    process.exit(2);
  }
  return { oss_cad_suite: version, yosys, nextpnr_ecp5: nextpnr };
}

type SeedRec = {
  addr_w: number; arm: "ede" | "fsd"; seed: number;
  command: string[]; command_sha256: string;
  wall_clock_s: number; exit_code: number | null;
  status: "routed" | "does_not_fit" | "not_completed" | "failed";
  fmax_mhz: number | null;
  trellis_comb: number | null; trellis_ff: number | null; dp16kd: number | null;
  demand_lut4: number | null; demand_trellis_comb: number | null;
  error: string | null;
  report_path: string | null; report_sha256: string | null;
  netlist_sha256: string | null; log_sha256: string | null;
};

function pair(text: string, label: string): number | null {
  const m = text.match(new RegExp(`${label}:\\s+(\\d+)/\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

function parseReport(rel: string): { fmax: number | null; comb: number | null; ff: number | null; bram: number | null } {
  if (!existsSync(abs(rel))) return { fmax: null, comb: null, ff: null, bram: null };
  const j = JSON.parse(readFileSync(abs(rel), "utf8")) as {
    fmax?: Record<string, { achieved?: number }>;
    utilization?: Record<string, { used?: number }>;
  };
  const clocks = Object.values(j.fmax ?? {}).map((v) => v?.achieved).filter((n): n is number => typeof n === "number" && n > 0);
  return {
    fmax: clocks.length ? Math.min(...clocks) : null,
    comb: j.utilization?.TRELLIS_COMB?.used ?? null,
    ff: j.utilization?.TRELLIS_FF?.used ?? null,
    bram: j.utilization?.DP16KD?.used ?? null,
  };
}

function synth(id: string, top: string, sets: string): string {
  const dir = join(WORK, id);
  const stamp = join(dir, "yosys.json");
  if (existsSync(abs(stamp)) && existsSync(abs(join(dir, "n.json")))) {
    return (JSON.parse(readFileSync(abs(stamp), "utf8")) as { netlist_sha256: string }).netlist_sha256;
  }
  mkdirSync(abs(dir), { recursive: true });
  const files = READ_FILES.map((f) => abs(f)).join(" ");
  const script = `read_verilog ${files}; ${sets}hierarchy -top ${top}; synth_ecp5 -top ${top} -json n.json; tee -q -o stat.json stat -json`;
  log(`yosys ${id}`);
  const r = spawnSync("yosys", ["-q", "-l", "yosys.log", "-p", script], {
    cwd: abs(dir), encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`yosys failed ${id}: ${(r.stderr ?? "").slice(-400)}`);
  const yosysLog = readFileSync(abs(join(dir, "yosys.log")), "utf8");
  if (!yosysLog.includes(YOSYS_SHA)) throw new Error(`yosys log for ${id} is not ${YOSYS_SHA}`);
  const netHash = sha256(readFileSync(abs(join(dir, "n.json"))));
  writeFileSync(abs(stamp), JSON.stringify({ netlist_sha256: netHash, yosys_script_sha256: sha256(script) }) + "\n");
  return netHash;
}

function place(arm: "ede" | "fsd", addr: number, seed: number, netHash: string): SeedRec {
  const id = `${arm}-a${addr}`;
  const rel = join(PNR, id, `45F-route-seed${seed}.json`);
  if (existsSync(abs(rel))) {
    log(`reuse ${rel}`);
    return JSON.parse(readFileSync(abs(rel), "utf8")) as SeedRec;
  }
  const reportRel = join(PNR, id, `45F-route-seed${seed}.report.json`);
  const logRel = join(WORK, id, `45F-route-seed${seed}.log`);
  mkdirSync(abs(join(PNR, id)), { recursive: true });
  const args = ["--45k", "--package", "CABGA381", "--json", abs(join(WORK, id, "n.json")),
    "--lpf-allow-unconstrained", "--freq", "12", "--router", "router2", "--seed", String(seed),
    "--timing-allow-fail", "--report", abs(reportRel)];
  const command = ["nextpnr-ecp5", ...args];
  log(`start ${id} seed ${seed}`);
  const started = process.hrtime.bigint();
  const r = spawnSync("timeout", ["--foreground", String(BOUND_S), "nextpnr-ecp5", ...args], {
    encoding: "utf8", env, maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  writeFileSync(abs(logRel), text);
  if (!text.includes(PNR_SHA) && !text.includes("nextpnr-0.11")) {
    throw new Error(`nextpnr log for ${id} seed ${seed} is not the pinned toolchain`);
  }
  const parsed = parseReport(reportRel);
  const timedOut = r.status === 124;
  let status: SeedRec["status"] = "failed";
  if (timedOut) status = "not_completed";
  else if (r.status === 0 && parsed.fmax !== null) status = "routed";
  else if (/ERROR:/i.test(text)) status = "does_not_fit";
  const rec: SeedRec = {
    addr_w: addr, arm, seed, command, command_sha256: sha256(command.join(" ")),
    wall_clock_s: Math.round(seconds * 1e6) / 1e6, exit_code: r.status,
    status, fmax_mhz: status === "routed" ? parsed.fmax : null,
    trellis_comb: parsed.comb, trellis_ff: parsed.ff, dp16kd: parsed.bram,
    demand_lut4: pair(text, "Total LUT4s"), demand_trellis_comb: pair(text, "TRELLIS_COMB"),
    error: (text.match(/ERROR: [^\n]+/) ?? [null])[0]?.slice(0, 400) ?? null,
    report_path: existsSync(abs(reportRel)) ? reportRel : null,
    report_sha256: existsSync(abs(reportRel)) ? sha256(readFileSync(abs(reportRel))) : null,
    netlist_sha256: netHash,
    log_sha256: sha256(text),
  };
  writeFileSync(abs(rel), JSON.stringify(rec, null, 2) + "\n");
  log(`done ${id} seed ${seed} ${rec.status} ${rec.wall_clock_s}s${rec.fmax_mhz ? ` fmax ${rec.fmax_mhz}` : ""}`);
  return rec;
}

type Width = {
  addr_w: number; arm: "ede" | "fsd";
  placed: boolean; seeds: SeedRec[];
  fmax_mhz_median: number | null; median_seed: number | null; trellis_comb: number | null;
};

function widthsFrom(seeds: SeedRec[]): Width[] {
  const out: Width[] = [];
  for (const addr of ADDRS) for (const arm of ["ede", "fsd"] as const) {
    const rows = seeds.filter((s) => s.addr_w === addr && s.arm === arm).sort((a, b) => a.seed - b.seed);
    const routed = rows.filter((s) => s.status === "routed" && s.fmax_mhz !== null);
    let fmax: number | null = null;
    let medianSeed: number | null = null;
    let comb: number | null = null;
    if (routed.length === 5) {
      const sorted = [...routed].sort((a, b) => (a.fmax_mhz as number) - (b.fmax_mhz as number) || a.seed - b.seed);
      const mid = sorted[2]!;
      fmax = mid.fmax_mhz;
      medianSeed = mid.seed;
      comb = mid.trellis_comb;
    }
    out.push({ addr_w: addr, arm, placed: routed.length === 5 && comb !== null, seeds: rows, fmax_mhz_median: fmax, median_seed: medianSeed, trellis_comb: comb });
  }
  return out;
}

function score(tools: { oss_cad_suite: string; yosys: string; nextpnr_ecp5: string }, seeds: SeedRec[]) {
  const cycles = JSON.parse(readFileSync(abs(CYCLES), "utf8")) as {
    rows: { addr_w: number; churn: string; fraction: number; arm: string; cycles: number; evals: number }[];
  };
  const widths = widthsFrom(seeds);
  const placedAddrs = ADDRS.filter((a) => widths.filter((w) => w.addr_w === a).every((w) => w.placed));
  const largest = placedAddrs.length ? Math.max(...placedAddrs) : null;
  const cells: Record<string, unknown>[] = [];
  for (const row of cycles.rows.filter((r) => r.arm === "ede")) {
    const fsd = cycles.rows.find((r) => r.arm === "fsd" && r.addr_w === row.addr_w && r.churn === row.churn);
    const edeW = widths.find((w) => w.arm === "ede" && w.addr_w === row.addr_w);
    const fsdW = widths.find((w) => w.arm === "fsd" && w.addr_w === row.addr_w);
    if (!fsd || !edeW?.placed || !fsdW?.placed || edeW.fmax_mhz_median === null || fsdW.fmax_mhz_median === null || !edeW.trellis_comb || !fsdW.trellis_comb) {
      cells.push({ addr_w: row.addr_w, churn: row.churn, fraction: row.fraction, placed: false, k1_wins: false });
      continue;
    }
    const edeRate = (row.evals / row.cycles) * edeW.fmax_mhz_median * 1e6 / edeW.trellis_comb;
    const fsdRate = (fsd.evals / fsd.cycles) * fsdW.fmax_mhz_median * 1e6 / fsdW.trellis_comb;
    const ratio = edeRate / fsdRate;
    cells.push({
      addr_w: row.addr_w, churn: row.churn, fraction: row.fraction, placed: true,
      ede_evals: row.evals, ede_cycles: row.cycles, fsd_evals: fsd.evals, fsd_cycles: fsd.cycles,
      ede_fmax_mhz_median: edeW.fmax_mhz_median, ede_trellis_comb: edeW.trellis_comb, ede_median_seed: edeW.median_seed,
      fsd_fmax_mhz_median: fsdW.fmax_mhz_median, fsd_trellis_comb: fsdW.trellis_comb, fsd_median_seed: fsdW.median_seed,
      ede_decisions_per_s_per_lut: edeRate, fsd_decisions_per_s_per_lut: fsdRate, ratio, k1_wins: ratio >= 1,
    });
  }
  const wins = cells.filter((c) => c.k1_wins === true);
  const placedWins = wins.filter((c) => c.placed === true);
  const onlyLargest = largest !== null && placedWins.length > 0 && placedWins.every((c) => c.addr_w === largest);
  const under11 = placedWins.every((c) => typeof c.ratio === "number" && c.ratio < 1.1);
  let verdict: "PASS" | "MIXED" | "FAIL" = "FAIL";
  if (placedWins.length > 0 && onlyLargest && under11) verdict = "MIXED";
  else if (placedWins.length > 0) verdict = "PASS";
  const doc = {
    format: "scp4d-v0121-sweep",
    label: "K1 ede-temporal versus fsd. Churn reuses one five-seed 45F place-and-route per ADDR_W. Power is needs real board.",
    formula: "(evals / cycles) * five-seed 45F median Fmax_MHz * 1e6 / TRELLIS_COMB of the median-Fmax seed",
    churn_reuses_place_and_route: true,
    tools, bound_s: BOUND_S, seeds: [...SEEDS],
    widths: widths.map((w) => ({ addr_w: w.addr_w, arm: w.arm, placed: w.placed, fmax_mhz_median: w.fmax_mhz_median, median_seed: w.median_seed, trellis_comb: w.trellis_comb })),
    largest_placed_addr_w: largest,
    cells, verdict,
    power: "needs real board",
  };
  writeFileSync(abs(OUT), JSON.stringify(doc, null, 2) + "\n");
  log(`verdict ${verdict} wins ${placedWins.length} largest ADDR_W ${largest ?? "none"}`);
}

function main() {
  const running = spawnSync("pgrep", ["-f", "libexec/nextpnr-ecp5"], { encoding: "utf8" });
  if (!process.argv.includes("--score") && running.status === 0 && running.stdout.trim()) {
    console.error("REFUSE: a nextpnr-ecp5 is already running. The sweep stays serial.");
    process.exit(3);
  }
  const tools = refuseOtherToolchain();
  if (process.argv.includes("--score")) {
    const seeds = ADDRS.flatMap((addr) => (["ede", "fsd"] as const).flatMap((arm) => SEEDS.map((seed) => {
      const rel = join(PNR, `${arm}-a${addr}`, `45F-route-seed${seed}.json`);
      if (!existsSync(abs(rel))) throw new Error(`missing ${rel}`);
      return JSON.parse(readFileSync(abs(rel), "utf8")) as SeedRec;
    })));
    score(tools, seeds);
    return;
  }
  const all: SeedRec[] = [];
  for (const addr of ADDRS) for (const arm of ["ede", "fsd"] as const) {
    const id = `${arm}-a${addr}`;
    const top = arm === "ede" ? "wrap_ede" : "wrap_fsd";
    const sets = arm === "ede" ? `chparam -set A ${addr} -set REL 0 ${top}; ` : `chparam -set A ${addr} ${top}; `;
    const net = synth(id, top, sets);
    for (const seed of SEEDS) all.push(place(arm, addr, seed, net));
  }
  score(tools, all);
}

const invoked = process.argv[1]?.endsWith("bench-ecp5-v0121-sweep.ts");
if (invoked) main();
