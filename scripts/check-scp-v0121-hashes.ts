/** TEST ONLY. Fails when a recorded sha256 does not match the file it names.
 * Does not run place-and-route. Netlist and nextpnr logs live under
 * fixtures/scp/v0119-work/, which is gitignored: a missing work file is skipped,
 * and a present work file whose hash differs is a failure.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0121-hashes.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

const HEX = /^[0-9a-f]{64}$/;
function sha(rel: string): string {
  return createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");
}

function mismatches(map: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const [rel, want] of Object.entries(map)) {
    if (!HEX.test(want)) { bad.push(`${rel} is not a sha256`); continue; }
    if (!existsSync(join(root, rel))) { bad.push(`${rel} missing`); continue; }
    const got = sha(rel);
    if (got !== want) bad.push(`${rel} ${got.slice(0, 12)} != ${want.slice(0, 12)}`);
  }
  return bad;
}

const manifest = JSON.parse(readFileSync(join(root, "fixtures/scp/v0119-industry-benchmark.json"), "utf8")) as {
  source_files?: { path: string; sha256: string }[];
  designs?: Record<string, { seeds_45f?: Seed[]; fit?: Record<string, { pack?: Seed; route?: Seed | null }> }>;
};
type Seed = {
  seed?: number; part?: string; mode?: string;
  report_path?: string | null; report_sha256?: string | null;
  netlist_sha256?: string | null; log_sha256?: string | null;
};

const sourceMap: Record<string, string> = {};
for (const row of manifest.source_files ?? []) sourceMap[row.path] = row.sha256;
const sourceBad = mismatches(sourceMap);
check("manifest source hashes match the files", Object.keys(sourceMap).length > 0 && sourceBad.length === 0, sourceBad.slice(0, 3).join("; "));

const reportMap: Record<string, string> = {};
const workBad: string[] = [];
let reportRows = 0;
for (const [id, design] of Object.entries(manifest.designs ?? {})) {
  const seeds: Seed[] = [...(design.seeds_45f ?? [])];
  for (const fit of Object.values(design.fit ?? {})) {
    if (fit.pack) seeds.push(fit.pack);
    if (fit.route) seeds.push(fit.route);
  }
  for (const seed of seeds) {
    if (!seed.report_path) continue;
    reportRows++;
    if (!seed.report_sha256) workBad.push(`${seed.report_path} has no hash`);
    else reportMap[seed.report_path] = seed.report_sha256;
    if (seed.netlist_sha256) {
      const net = `fixtures/scp/v0119-work/${id}/n.json`;
      if (existsSync(join(root, net)) && sha(net) !== seed.netlist_sha256) workBad.push(`${net} stale`);
    }
    if (seed.log_sha256 && seed.part && seed.mode && seed.seed) {
      const log = `fixtures/scp/v0119-work/${id}/${seed.part}-${seed.mode}-seed${seed.seed}.log`;
      if (existsSync(join(root, log)) && sha(log) !== seed.log_sha256) workBad.push(`${log} stale`);
    }
  }
}
const reportBad = mismatches(reportMap);
const sweepReports: Record<string, string> = {};
const sweepRoot = join(root, "fixtures/scp/v0121-pnr");
if (existsSync(sweepRoot)) {
  for (const id of readdirSync(sweepRoot)) {
    const dir = join(sweepRoot, id);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || name.endsWith(".report.json")) continue;
      const rec = JSON.parse(readFileSync(join(dir, name), "utf8")) as { report_path?: string | null; report_sha256?: string | null };
      if (rec.report_path && rec.report_sha256) sweepReports[rec.report_path] = rec.report_sha256;
    }
  }
}
const sweepReportBad = mismatches(sweepReports);
check("v0121 sweep report hashes match the report files", Object.keys(sweepReports).length > 0 && sweepReportBad.length === 0, sweepReportBad.slice(0, 3).join("; "));
check("manifest nextpnr report hashes match the report files", reportRows > 0 && reportBad.length === 0, reportBad.slice(0, 3).join("; "));
check("present netlist and log hashes match the manifest", workBad.length === 0, workBad.slice(0, 3).join("; "));

const k1 = JSON.parse(readFileSync(join(root, "fixtures/scp/v0120-k1-env.json"), "utf8")) as { hashes: Record<string, string> };
const k1Bad = mismatches({
  "fixtures/scp/v0120-prereg.json": k1.hashes.v0120_prereg_sha256,
  "fixtures/scp/golden-vectors-scp4d-ede.json": k1.hashes.golden_temporal_sha256,
  "fixtures/scp/golden-vectors-scp4d-ede-relations.json": k1.hashes.golden_relations_sha256,
  "hw/scp4d/rtl/scp4d_ede.v": k1.hashes.ede_rtl_sha256,
  "hw/scp4d/rtl/scp4d_fsd.v": k1.hashes.fsd_rtl_sha256,
});
check("k1 env hashes match the prereg, golden vectors and RTL", k1Bad.length === 0, k1Bad.join("; "));

const sweepPath = join(root, "fixtures/scp/v0121-sweep-cycles.json");
const sweep = existsSync(sweepPath) ? JSON.parse(readFileSync(sweepPath, "utf8")) as { hashes?: Record<string, string> } : null;
const sweepBad = sweep?.hashes ? mismatches(sweep.hashes) : ["fixtures/scp/v0121-sweep-cycles.json has no hashes"];
check("v0121 sweep cycle file hashes match the RTL it measured", !!sweep?.hashes && sweepBad.length === 0, sweepBad.slice(0, 3).join("; "));

function collectFileHashes(node: unknown, out: Record<string, string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const item of node) collectFileHashes(item, out); return; }
  const o = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(o)) {
    if (typeof value === "string" && HEX.test(value) && key.includes("/") && /\.(v|sv|ts|json)$/.test(key)) out[key] = value;
  }
  if (typeof o.file === "string" && typeof o.sha256 === "string" && HEX.test(o.sha256)) out[o.file] = o.sha256;
  if (typeof o.path === "string" && o.path.includes("/") && typeof o.sha256 === "string" && HEX.test(o.sha256)) out[o.path] = o.sha256;
  if (typeof o.testbench === "string" && typeof o.testbench_sha256 === "string" && HEX.test(o.testbench_sha256)) out[o.testbench] = o.testbench_sha256;
  for (const [key, value] of Object.entries(o)) {
    if (!key.endsWith("_sha256") || typeof value !== "string" || !HEX.test(value)) continue;
    const sibling = o[key.slice(0, -"_sha256".length)];
    if (typeof sibling === "string" && sibling.includes("/") && /\.(v|sv|ts|json)$/.test(sibling)) out[sibling] = value;
  }
  for (const value of Object.values(o)) if (value && typeof value === "object") collectFileHashes(value, out);
}

const rtlBad: string[] = [];
let rtlFiles = 0;
for (const name of readdirSync(join(root, "fixtures/scp"))) {
  if (!/^v01\d+-rtl-report\.json$/.test(name)) continue;
  const report = JSON.parse(readFileSync(join(root, "fixtures/scp", name), "utf8")) as { rtl?: Record<string, unknown> };
  const map: Record<string, string> = {};
  collectFileHashes(report, map);
  if (name === "v0113-rtl-report.json" && report.rtl) {
    if (typeof report.rtl.pnr_wrapper_sha256 === "string") map["hw/scp4d/synth/scp4d_pnr_wrap.v"] = report.rtl.pnr_wrapper_sha256;
    if (typeof report.rtl.cycle_model_sha256 === "string") map["scripts/scp-v0113-rtl-model.ts"] = report.rtl.cycle_model_sha256;
  }
  rtlFiles += Object.keys(map).length;
  for (const line of mismatches(map)) rtlBad.push(`${name} ${line}`);
}
check("rtl-report hashes match the RTL, testbenches and models they name", rtlFiles > 0 && rtlBad.length === 0, rtlBad.slice(0, 3).join("; "));

if (failures.length) {
  console.log(`FAIL check-scp-v0121-hashes (${failures.length} failed: ${failures.join("; ")})`);
  process.exit(1);
}
console.log(`PASS check-scp-v0121-hashes (${passed} checks)`);
