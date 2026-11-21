/** TEST ONLY. Run the v0.1.20 proof path and, with --write, refresh fixtures/scp/v0120-proof-report.json.
 * Latency in the report is wall-clock on this machine and is not a gate. Energy is "needs real board".
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0120-proof-path.ts [--write]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/scp/measurement";
import { percentile } from "./scp-v01-fixture";
import { runProof, type ProofReport, type V0120Prereg } from "./scp-v0120-proof";

const root = resolve(join(import.meta.dirname, ".."));
const PREREG = "fixtures/scp/v0120-prereg.json";
const REPORT = "fixtures/scp/v0120-proof-report.json";
const WRITE = process.argv.includes("--write");

const preregBytes = readFileSync(join(root, PREREG));
const prereg = JSON.parse(preregBytes.toString("utf8")) as V0120Prereg;
const preregSha = createHash("sha256").update(preregBytes).digest("hex");
const commit = spawnSync("git", ["log", "-1", "--format=%H", "--", PREREG], { cwd: root, encoding: "utf8" });
if (commit.status !== 0) throw new Error(commit.stderr);
const preregCommit = commit.stdout.trim();

const samples: number[] = [];
const t0 = process.hrtime.bigint();
const body: ProofReport = runProof(prereg, { samplesMs: samples });
const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
const sorted = samples.slice().sort((a, b) => a - b);

const report = {
  format: "scp4d-v0120-proof-report",
  version: 1,
  label: "TEST ONLY. Verdicts are exactly as measured by scripts/scp-v0120-proof.ts. Energy is needs real board. Latency is JS wall time on one machine and is not a gate.",
  prereg_sha256: preregSha,
  prereg_commit: preregCommit,
  body: JSON.parse(canonicalJson(body)) as ProofReport,
  reported_not_asserted: {
    energy: "needs real board",
    power: "needs real board",
    latency_ms: {
      p50: sorted.length ? percentile(sorted, 0.5) : null,
      p95: sorted.length ? percentile(sorted, 0.95) : null,
      samples: sorted.length,
      wall_ms: wallMs,
      label: "JS wall time of each timed bench call on one machine. Not a gate.",
    },
  },
};

for (const h of body.hypotheses) console.log(`${h.id} ${h.verdict} — ${h.reason}`);
console.log(`wall ${wallMs.toFixed(1)} ms; latency p50 ${report.reported_not_asserted.latency_ms.p50} ms, p95 ${report.reported_not_asserted.latency_ms.p95} ms (${sorted.length} bench calls, not asserted)`);
console.log("energy: needs real board");

if (WRITE) {
  writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${REPORT}`);
} else {
  console.log("dry run (pass --write to refresh the report)");
}
