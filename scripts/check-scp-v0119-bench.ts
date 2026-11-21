/** TEST ONLY. v0.1.19 benchmark scoring, advisor, and manifest shape.
 * Does not run place-and-route. Fmax values inside this file are selector inputs,
 * not measurements. Measured Fmax lives only in fixtures/scp/v0119-industry-benchmark.json
 * after a run wrote it.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0119-bench.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DESIGNS, READ_FILES, workloadFor } from "./ecp5-v0119-catalog.ts";
import { median, paretoIds, throughputValuesPerSec, valuesPerCycle, THROUGHPUT_FORMULA } from "./ecp5-v0119-score.ts";
import { adviseFromBenchmark, reuseDecision } from "../src/scp/evidence/benchmark-advisor.ts";
import { POWER } from "./bench-ecp5-v0119.ts";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

check("throughput formula names cycles, element_frames and fmax", /element_frames/.test(THROUGHPUT_FORMULA) && /fmax_MHz/.test(THROUGHPUT_FORMULA) && /cycles/.test(THROUGHPUT_FORMULA));
check("median of five values is the middle one", median([10, 1, 4, 8, 3]) === 4);
check("values/cycle is element_frames / cycles", valuesPerCycle(131072, 15197) === 131072 / 15197);
check("throughput refuses a non-positive fmax", (() => { try { throughputValuesPerSec(10, 2, 0); return false; } catch { return true; } })());
{
  const slow = { id: "a", fmax_mhz: 10, throughput_values_per_s: 10, values_per_s_per_lut: 1 };
  const fast = { id: "b", fmax_mhz: 20, throughput_values_per_s: 20, values_per_s_per_lut: 2 };
  const trade = { id: "c", fmax_mhz: 30, throughput_values_per_s: 5, values_per_s_per_lut: 3 };
  check("pareto drops a row that loses on clock, throughput and efficiency", JSON.stringify(paretoIds([slow, fast])) === JSON.stringify(["b"]));
  check("pareto keeps a clock/throughput tradeoff", paretoIds([fast, trade]).sort().join(",") === "b,c");
}
check("every catalog design loads a positive cycle count from a committed report", DESIGNS.every((d) => workloadFor(root, d).cycles > 0 && workloadFor(root, d).element_frames === 131072));
{
  const advice = adviseFromBenchmark({
    power: POWER,
    designs: [
      { id: "enc", kind: "encoder", milestone: "t", fmax_mhz_median: 40, throughput_values_per_s_median: 200, values_per_s_per_lut: 2, lut: 100, ff: 50, bram: 1 },
      { id: "dec-slow", kind: "decoder", milestone: "t", fmax_mhz_median: 20, throughput_values_per_s_median: 100, values_per_s_per_lut: 1, lut: 80, ff: 40, bram: 1 },
      { id: "dec-fast", kind: "decoder", milestone: "t", fmax_mhz_median: 35, throughput_values_per_s_median: 180, values_per_s_per_lut: 1.5, lut: 90, ff: 40, bram: 1 },
      { id: "loop", kind: "loop", milestone: "t", fmax_mhz_median: 19, throughput_values_per_s_median: 90, values_per_s_per_lut: 0.5, lut: 200, ff: 100, bram: 2, composed_of: ["enc", "dec-slow"] },
    ],
  });
  check("advisor names the slower constituent of the focus loop", advice.bottleneck?.design_id === "dec-slow" && advice.focus_loop_id === "loop");
  check("advisor ranks the faster measured decoder next and marks it measured", advice.ranked_next[0]?.design_id === "dec-fast" && advice.ranked_next[0]?.measured === true);
  check("advisor passes the power string through and does not invent one", advice.power === POWER && advice.hypotheses.every((h) => h.measured === false));
}
check("reuse only when source, tool, part, seed and command hash all match",
  reuseDecision({ source_sha256: "a", tool_id: "t", part: "45F", seed: 1, command_sha256: "c" }, { source_sha256: "a", tool_id: "t", part: "45F", seed: 1, command_sha256: "c" }) === "reuse"
  && reuseDecision({ source_sha256: "a", tool_id: "t", part: "45F", seed: 1, command_sha256: "c" }, { source_sha256: "b", tool_id: "t", part: "45F", seed: 1, command_sha256: "c" }) === "rerun"
  && reuseDecision(null, { source_sha256: "a", tool_id: "t", part: "45F", seed: 1, command_sha256: "c" }) === "rerun");

const manifestPath = join(root, "fixtures/scp/v0119-industry-benchmark.json");
check("manifest file exists", existsSync(manifestPath));
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  check("manifest power says it needs a real board", typeof m.power === "string" && /real board|NOT MEASURED/i.test(m.power));
  check("manifest formula matches the scoring module", m.formula === THROUGHPUT_FORMULA);
  check("manifest bound is 7200 s and 45F uses five seeds", m.bound_s === 7200 && JSON.stringify(m.seeds_45f) === "[1,2,3,4,5]");
  const filesOk = Array.isArray(m.source_files) && READ_FILES.every((p) => {
    const row = m.source_files.find((s: { path: string }) => s.path === p);
    if (!row) return false;
    const hash = createHash("sha256").update(readFileSync(join(root, p))).digest("hex");
    return row.sha256 === hash;
  });
  check("manifest source hashes match the RTL and wrappers", filesOk);
  const designs = Object.values(m.designs ?? {}) as { id: string; seeds_45f?: { status: string; fmax_mhz: number | null; report_sha256: string | null }[]; fmax_mhz: { median: number } | null }[];
  const fmaxOnlyWhenRouted = designs.every((d) => (d.seeds_45f ?? []).every((s) => (s.fmax_mhz === null) || (s.status === "routed" && !!s.report_sha256)));
  check("an Fmax is present only on a routed seed that has a report hash", fmaxOnlyWhenRouted);
  const ids = new Set(designs.map((d) => d.id));
  const adviceIds = [...(m.advice?.ranked_next ?? []).map((r: { design_id: string }) => r.design_id), m.advice?.bottleneck?.design_id, m.advice?.focus_loop_id].filter(Boolean);
  check("advisor citations are design ids in the manifest", adviceIds.every((id: string) => ids.has(id)));
}

if (failures.length) { console.log(`FAIL check-scp-v0119-bench (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
console.log(`PASS check-scp-v0119-bench (${passed} checks)`);
