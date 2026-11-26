/** TEST ONLY. Reference Data Ledger: schema shape and exact fixture cross-check.
 * No network, no writes. Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-reference-ledger.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EVIDENCE_LABELS, PROMOTION_RULE, REFERENCE_STATUSES, VERDICTS, type LedgerFile, type LedgerRecord } from "../src/lib/reference-ledger/types";

const root = resolve(join(import.meta.dirname, ".."));
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function check(name: string, cond: boolean): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) process.exitCode = 1;
}

const REQUIRED = [
  "id", "reference_status", "workload_identity", "input_conditions", "baseline", "experiment", "build_provenance",
  "implementation", "hardware_target", "validation", "evidence", "outcome", "audit", "numbers",
] as const;

function textOk(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as { summary?: unknown; source?: unknown };
  return typeof o.summary === "string" && o.summary.length > 0 && typeof o.source === "string" && o.source.length > 0;
}

function recordShape(r: LedgerRecord): boolean {
  if (REQUIRED.some((k) => r[k] === undefined)) return false;
  if (!textOk(r.input_conditions) || !textOk(r.baseline) || !textOk(r.experiment) || !textOk(r.build_provenance)) return false;
  if (!textOk(r.implementation) || !textOk(r.hardware_target) || !textOk(r.validation)) return false;
  if (typeof r.validation.bit_exact !== "boolean" && r.validation.bit_exact !== null) return false;
  if (!Array.isArray(r.evidence.labels) || r.evidence.labels.length === 0) return false;
  if (!r.evidence.labels.every((l) => (EVIDENCE_LABELS as readonly string[]).includes(l))) return false;
  if (new Set(r.evidence.labels).size !== r.evidence.labels.length) return false;
  if (!Array.isArray(r.evidence.sources) || r.evidence.sources.length === 0) return false;
  if (!(VERDICTS as readonly string[]).includes(r.outcome.verdict)) return false;
  if (typeof r.outcome.accepted !== "boolean" || typeof r.outcome.negative !== "boolean") return false;
  if (typeof r.outcome.summary !== "string" || r.outcome.summary.length === 0) return false;
  if (!(REFERENCE_STATUSES as readonly string[]).includes(r.reference_status)) return false;
  if (!r.audit || !Array.isArray(r.audit.pull_requests) || r.audit.pull_requests.length === 0) return false;
  if (!Array.isArray(r.audit.fixtures) || r.audit.fixtures.length === 0) return false;
  if (!r.audit.fixtures.every((f) => existsSync(join(root, f)))) return false;
  return true;
}

const schema = read("fixtures/reference-ledger/schema.json");
const file = JSON.parse(read("fixtures/reference-ledger/records.json")) as LedgerFile;
check("ledger file names 4D-SCP, needs real board, and the schema lists the three evidence labels",
  file.format === "shiyan-reference-ledger"
  && file.power === "needs real board"
  && file.naming.includes("4D-SCP")
  && schema.includes("physically_measured")
  && schema.includes("simulated")
  && schema.includes("routed"));

const ids = file.records.map((r) => r.id);
check("four records, each with the required fields and a legal verdict",
  ids.join(",") === "v0.1.31,v0.1.28,v0.1.29,v0.1.30" && file.records.every(recordShape));

check("no seeded record is labeled physically measured",
  file.records.every((r) => !r.evidence.labels.includes("physically_measured")
    && r.evidence.labels.includes("simulated")
    && r.evidence.labels.includes("routed")));

check("a STOP verdict is stored as a negative result, and PASS or RECORDED is not",
  file.records.every((r) => r.outcome.negative === (r.outcome.verdict === "STOP")));

check("verified requires a physical measurement, and no seeded record is verified",
  schema.includes(PROMOTION_RULE)
  && file.records.every((r) => r.reference_status !== "verified")
  && file.records.filter((r) => r.reference_status === "verified").every((r) => r.evidence.labels.includes("physically_measured"))
  && file.records.find((r) => r.id === "v0.1.31")?.reference_status === "reference (routed + simulated), physical verification pending");

const byId = Object.fromEntries(file.records.map((r) => [r.id, r]));
const summary = JSON.parse(read("fixtures/scp/versa-bitstream/summary.json")) as {
  fmax_mhz_median: number;
  chosen_seed: number;
  seeds: { exit_code: number; trellis_comb: { used: number; available: number }; trellis_ff: { used: number }; dp16kd: { used: number } }[];
  bit_sha256: string;
  svf_sha256: string;
  spi_bit_sha256: string;
};
const prereg = JSON.parse(read("fixtures/scp/v0131-prereg.json")) as {
  prior_profile: { fmax_mhz: number; path_ns: number; trellis_comb_used: number };
  variant: { configuration: { ADDR_W: number; CFG_D: number } };
  procedure_sha256: string;
};
const v31 = byId["v0.1.31"]!;
check("v0.1.31 numbers match the Versa summary and the frozen prereg",
  v31.numbers.fmax_mhz_median === summary.fmax_mhz_median
  && summary.fmax_mhz_median === 53.61930465698242
  && v31.numbers.routes === "5/5"
  && summary.seeds.length === 5
  && summary.seeds.every((s) => s.exit_code === 0 && s.trellis_comb.used === 2447 && s.trellis_comb.available === 43848)
  && v31.numbers.trellis_comb_used === 2447
  && v31.numbers.trellis_ff_used === summary.seeds[0]!.trellis_ff.used
  && v31.numbers.dp16kd_used === summary.seeds[0]!.dp16kd.used
  && v31.numbers.bit_sha256 === summary.bit_sha256
  && v31.numbers.svf_sha256 === summary.svf_sha256
  && v31.numbers.spi_bit_sha256 === summary.spi_bit_sha256
  && v31.numbers.addr_w === prereg.variant.configuration.ADDR_W
  && v31.numbers.cfg_d === prereg.variant.configuration.CFG_D
  && prereg.variant.configuration.ADDR_W === 8
  && prereg.variant.configuration.CFG_D === 256
  && v31.numbers.full_loop_trellis_comb === 35438
  && prereg.prior_profile.fmax_mhz === 24.44569206237793
  && prereg.prior_profile.path_ns === 40.906999967992306
  && prereg.prior_profile.trellis_comb_used === 6666
  && v31.outcome.verdict === "RECORDED"
  && v31.build_provenance.summary.includes(prereg.procedure_sha256)
  && v31.audit.hashes.bit_sha256 === summary.bit_sha256
  && v31.audit.hashes.svf_sha256 === summary.svf_sha256
  && v31.audit.hashes.spi_bit_sha256 === summary.spi_bit_sha256
  && v31.audit.hashes.procedure_sha256 === prereg.procedure_sha256
  && Number(summary.fmax_mhz_median.toFixed(2)) === 53.62);

type Held = { rows: { workload: string; addr_w: number; cycles: number; bit_exact: boolean }[]; bit_exact: boolean };
type Chip = { entries: { id: string; verdict: string; accepted: boolean }[] };
type Design = {
  fmax_mhz?: { median?: number; n?: number };
  resources_at_median_fmax_seed?: { lut?: number; bram?: number; ff?: number };
  seeds_45f?: { status: string }[];
};
const chip = JSON.parse(read("fixtures/virtual-chip/ledger.json")) as Chip;
const manifest = JSON.parse(read("fixtures/scp/v0119-industry-benchmark.json")) as { designs: Record<string, Design> };

function cyclesMatch(held: Held, got: LedgerRecord["numbers"]["cycles"]): boolean {
  if (!got) return false;
  for (const row of held.rows) {
    const side = row.workload === "original" ? got.original : row.workload === "high" ? got.high : undefined;
    if (!side || side[String(row.addr_w)] !== row.cycles || row.bit_exact !== true) return false;
  }
  return held.bit_exact === true;
}

function loopMatch(id: string, design: string, heldPath: string, fmax: number, lut: number, bram: number, ff?: number): boolean {
  const rec = byId[id]!;
  const held = JSON.parse(read(heldPath)) as Held;
  const entry = chip.entries.find((e) => e.id === id);
  const loop = manifest.designs[design];
  const seeds = loop?.seeds_45f ?? [];
  return rec.outcome.verdict === entry?.verdict
    && rec.outcome.accepted === entry?.accepted
    && rec.numbers.design === design
    && rec.numbers.fmax_mhz_median === fmax
    && loop?.fmax_mhz?.median === fmax
    && loop?.fmax_mhz?.n === 5
    && seeds.length === 5
    && seeds.every((s) => s.status === "routed")
    && rec.numbers.trellis_comb_used === lut
    && loop?.resources_at_median_fmax_seed?.lut === lut
    && rec.numbers.dp16kd_used === bram
    && loop?.resources_at_median_fmax_seed?.bram === bram
    && (ff === undefined || (rec.numbers.trellis_ff_used === ff && loop?.resources_at_median_fmax_seed?.ff === ff))
    && cyclesMatch(held, rec.numbers.cycles);
}

check("v0.1.28 STOP matches the virtual-chip ledger, held-out cycles, and the 45F median",
  loopMatch("v0.1.28", "loop-hnfix-w4l8", "fixtures/scp/v0128-heldout.json", 37.61236572265625, 34559, 51)
  && byId["v0.1.28"]!.outcome.verdict === "STOP"
  && byId["v0.1.28"]!.reference_status === "stopped (simulated + routed), not a verified reference");

check("v0.1.29 STOP matches the virtual-chip ledger, held-out cycles, and the 45F median",
  loopMatch("v0.1.29", "loop-hcoh-w4l8", "fixtures/scp/v0129-heldout.json", 36.48170471191406, 34920, 53, 10859)
  && byId["v0.1.29"]!.outcome.verdict === "STOP"
  && byId["v0.1.29"]!.reference_status === "stopped (simulated + routed), not a verified reference");

check("v0.1.30 PASS matches the virtual-chip ledger, held-out cycles, and the 45F median",
  loopMatch("v0.1.30", "loop-hff-w4l8", "fixtures/scp/v0130-heldout.json", 39.474205017089844, 35438, 59, 10992)
  && byId["v0.1.30"]!.outcome.verdict === "PASS"
  && byId["v0.1.30"]!.numbers.full_loop_trellis_comb === 35438
  && byId["v0.1.30"]!.reference_status === "pass (simulated + routed), physical verification pending");

if (process.exitCode) process.exit(1);
console.log(`PASS check-reference-ledger (${n} checks)`);
