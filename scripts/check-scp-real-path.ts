/** TEST ONLY. Optional scp4d codec, UART file bridge, and hardware receipt boundary.
 * No database. No board. Power is needs real board. No PHI.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ed25519 } from "@noble/curves/ed25519.js";
import { FLAG, runCompressTenant, type CompressTenantDeps } from "./compress-tenant";
import { encodeWindowScp4d } from "./scp4d-segment-codec";
import { crc16, runUartCosim } from "./scp-uart-driver";
import {
  HW_RECEIPT_INSERT, acceptHwReceipt, signReceipt, type HwReceipt, type HwReceiptWriter,
} from "../src/core/hw-receipt";
import type { StatePoint } from "../src/core/compression/types";

const root = join(import.meta.dirname, "..");
let n = 0;
function check(name: string, cond: boolean): void {
  n += 1;
  if (!cond) { console.error(`FAIL ${name}`); process.exitCode = 1; }
  else console.log(`ok   ${name}`);
}

check("CRC-16/CCITT-FALSE of 123456789 is 0x29b1",
  crc16(new TextEncoder().encode("123456789")) === 0x29b1);

const points: StatePoint[] = [0, 1].map((i) => ({
  experience_id: `p${i}`, content_sha256: "ab", t: 1_700_000_000_000 + i, predicted: i, observed: i + 0.5,
  phi: 0.1, step: i, verdict: "PASS" as const,
}));
const side = encodeWindowScp4d(points);
check("synthetic window round-trips to a 64-hex sha", /^[0-9a-f]{64}$/.test(side.sha256) && side.bytes.length > 8);

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const TENANT = "fixture-tenant";
function pgRow(i: number) {
  const id = `wb-${i.toString(16).padStart(32, "0")}`;
  const ts = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
  const record = {
    experience_id: id, tenant_id: TENANT, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "g", baseline: "b", action: "a", predicted_outcome: "1", observed_outcome: "1",
    delta_e: 0, metrics: { transformations: 1 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 1, transformation: JSON.stringify({ inputs: { predicted: 1, observed: 1, phi: 0.1, step: i }, transformations: [] }),
      expected_relation: "r", result: "PASS", converged: true },
    provenance: { source: "third-party-workbench", run_id: `run-${id}`, timestamp: ts.toISOString() },
    reuse_eligibility: false, z_next_action: "n", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: TENANT, experience_id: id, record_json, content_sha256: sha(record_json), proof_timestamp: ts, created_at: ts };
}
const rows = [pgRow(0), pgRow(1)];
const dir = mkdtempSync(join(tmpdir(), "scp-codec-"));
const urlFile = join(dir, "url");
writeFileSync(urlFile, "postgres://fixture_role:fixture_password@localhost:5432/fixture_db?sslmode=require\n");
const deps: CompressTenantDeps = {
  readTextFile: () => "postgres://fixture_role:fixture_password@localhost:5432/fixture_db?sslmode=require\n",
  connect: async () => ({
    client: { query: async (sql: string) => ({ rows: sql.includes("SELECT") ? rows : [] }) },
    close: async () => undefined,
  }),
  home: () => dir,
  now: () => Date.UTC(2026, 0, 2),
};
const argv = ["--tenant", TENANT, "--storage-file", urlFile, "--as-of", "2026-01-02T00:00:00.000Z"];
const env = { [FLAG]: "1" };
async function main(): Promise<void> {
const off = await runCompressTenant(argv, env, deps);
const on = await runCompressTenant([...argv, "--codec", "scp4d"], env, deps);
const envOn = await runCompressTenant(argv, { ...env, SCP_CODEC: "scp4d" }, deps);
rmSync(dir, { recursive: true, force: true });
check("flag-off reader passes", off.exitCode === 0);
check("flag-on keeps the flag-off lines and adds a sidecar trailer",
  on.exitCode === 0 && on.lines.slice(0, off.lines.length).join("\n") === off.lines.join("\n")
  && on.lines.at(-1) === "scp4d: segments=0 bytes=0 stored=sidecar round_trip=PASS");
check("SCP_CODEC=scp4d matches --codec scp4d", envOn.lines.join("\n") === on.lines.join("\n"));
const bad = await runCompressTenant([...argv, "--codec", "other"], env, deps);
check("an unknown codec is refused before a run", bad.exitCode === 2);

const { secretKey, publicKey } = ed25519.keygen();
const pub = Buffer.from(publicKey).toString("hex");
const good: HwReceipt = {
  workload_id: "t", commit_sha: "a".repeat(40), bitstream_sha256: "b".repeat(64),
  config: { W: 4 }, hardware_target: "icarus-uart-ff", conditions: { board: "not attached" },
  input_sha256: "c".repeat(64), output_sha256: "d".repeat(64), golden_sha256: "d".repeat(64), bit_exact: true,
};
const rowsOut: unknown[] = [];
const writer: HwReceiptWriter = { table: "shiyan.hw_receipts", insert: async (row) => { rowsOut.push(row); } };
const accepted = await acceptHwReceipt(good, signReceipt(good, secretKey), { HW_RECEIPT_PUBLIC_KEY: pub }, writer);
check("a consistent signed receipt is stored on shiyan.hw_receipts", accepted.ok === true && rowsOut.length === 1);
const lied = { ...good, bit_exact: false };
const inconsistent = await acceptHwReceipt(lied, signReceipt(lied, secretKey), { HW_RECEIPT_PUBLIC_KEY: pub }, writer);
check("bit_exact must agree with the two hashes", inconsistent.ok === false);
const extra = await acceptHwReceipt({ ...good, level4: true }, signReceipt(good, secretKey), { HW_RECEIPT_PUBLIC_KEY: pub }, writer);
check("a receipt with a Level 4 field is rejected", extra.ok === false);
const forged = await acceptHwReceipt(good, "ab".repeat(64), { HW_RECEIPT_PUBLIC_KEY: pub }, writer);
check("a bad signature is rejected", forged.ok === false && rowsOut.length === 1);

const route = readFileSync(join(root, "src/app/api/v1/hw/receipts/route.ts"), "utf8");
const core = readFileSync(join(root, "src/core/hw-receipt.ts"), "utf8");
const mig = readFileSync(join(root, "db/migrations/007_shiyan_hw_receipts.sql"), "utf8");
check("the receipt route and core do not import Level 4 or insert into experiences",
  !route.includes("level4") && !core.includes("src/lib/level4") && !/from ["'][^"']*level4/.test(route + core)
  && !/INSERT INTO shiyan\.experiences/.test(route + core));
check("the only insert names shiyan.hw_receipts",
  HW_RECEIPT_INSERT.startsWith("INSERT INTO shiyan.hw_receipts") && !core.includes("state_segments"));
check("migration 007 is marked unapplied and does not alter state_segments",
  mig.includes("UNAPPLIED") && !/ALTER TABLE\s+shiyan\.state_segments/i.test(mig));

const sim = runUartCosim();
check("Icarus UART wrapper matches a direct hybrid_ff on the same token", sim.ok);
if (!sim.ok) process.stderr.write(sim.text);

if (process.exitCode) process.exit(process.exitCode);
console.log(`PASS check-scp-real-path (${n} checks)`);
}
main();
