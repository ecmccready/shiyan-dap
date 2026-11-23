/** TEST ONLY. Rebuild virtual-chip ledger verdicts from committed fixtures.
 * Power is needs real board.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-virtual-chip.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const manifest = read("fixtures/scp/v0119-industry-benchmark.json") as {
  designs: Record<string, { fmax_mhz?: { median?: number } }>;
};
const ledger = read("fixtures/virtual-chip/ledger.json") as { entries: Entry[] };

type Row = { addr_w?: number; workload?: string; cycles: number; bit_exact?: boolean; fsd_frames?: number };
type Entry = {
  id: string;
  verdict: "PASS" | "STOP";
  accepted: boolean;
  procedure_sha256?: string;
  prereg?: string;
  freeze?: string;
  design: string;
  cycles_file: string;
  widths: number[];
  workload?: string;
  workloads?: string[];
  require_bit_exact?: boolean;
  require_fsd_frames?: boolean;
  baselines?: { id: string; design: string; cycles: Record<string, number> }[] | {
    k1: { design: string; original: Record<string, number>; high: Record<string, number> };
    n4: { design: string; original: Record<string, number>; high: Record<string, number> };
  };
};

function median(design: string): number {
  const v = manifest.designs[design]?.fmax_mhz?.median;
  if (typeof v !== "number" || !(v > 0)) throw new Error(`${design} has no median Fmax`);
  return v;
}
function rowsOf(file: string): Row[] {
  const j = read(file) as { rows: Row[] };
  return j.rows;
}
function cyclesFor(rows: Row[], width: number, workload?: string): Row {
  const row = rows.find((r) => r.addr_w === width && (workload === undefined || r.workload === workload));
  if (!row) throw new Error(`missing cycles w=${width} ${workload ?? ""}`);
  return row;
}

let failed = 0;
let checks = 0;
function check(name: string, cond: boolean): void {
  checks++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failed++;
}

for (const e of ledger.entries) {
  if (e.prereg && e.procedure_sha256) {
    const prereg = read(e.prereg) as { selector_procedure?: { sha256?: string }; selector?: { sha256?: string } };
    const got = prereg.selector_procedure?.sha256 ?? prereg.selector?.sha256;
    check(`${e.id} prereg hash`, got === e.procedure_sha256);
  }
  if (e.freeze && e.procedure_sha256) {
    const freeze = read(e.freeze) as { procedure_sha256?: string };
    check(`${e.id} freeze hash`, freeze.procedure_sha256 === e.procedure_sha256);
  }
  const fmax = median(e.design);
  const rows = rowsOf(e.cycles_file);
  const workloads = e.workloads ?? [e.workload];
  let allUnder = true;
  let bit = true;
  let fsd = true;
  for (const workload of workloads) {
    for (const w of e.widths) {
      const row = cyclesFor(rows, w, workload);
      const wall = row.cycles / fmax;
      if (e.require_bit_exact && row.bit_exact === false) bit = false;
      if (e.require_fsd_frames && !(row.fsd_frames && row.fsd_frames > 0)) fsd = false;
      if (Array.isArray(e.baselines)) {
        for (const b of e.baselines) {
          const bw = b.cycles[String(w)]! / median(b.design);
          if (!(wall < bw)) allUnder = false;
        }
      } else if (e.baselines) {
        const key = (workload ?? "original") as "original" | "high";
        const k1 = e.baselines.k1[key][String(w)]! / median(e.baselines.k1.design);
        const n4 = e.baselines.n4[key][String(w)]! / median(e.baselines.n4.design);
        if (!(wall < k1 && wall < n4)) allUnder = false;
      }
    }
  }
  const rebuilt = allUnder && bit && fsd ? "PASS" : "STOP";
  check(`${e.id} verdict ${rebuilt}`, rebuilt === e.verdict && e.accepted === (rebuilt === "PASS"));
  console.log(`     ${e.id} fmax ${fmax} under_all ${allUnder} bit ${bit} fsd ${fsd}`);
}

if (failed) {
  console.log(`FAIL check-virtual-chip (${failed})`);
  process.exit(1);
}
console.log(`PASS check-virtual-chip (${checks} checks)`);
