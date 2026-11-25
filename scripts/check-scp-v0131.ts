/** TEST ONLY. Versa pin citations, multi-frame UART sim, and an in-process receipt.
 * The signing key is generated here and is not written. Power is needs real board.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0131.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ed25519 } from "@noble/curves/ed25519.js";
import { acceptHwReceipt, signReceipt, type HwReceipt, type HwReceiptWriter } from "../src/core/hw-receipt";
import { runPrefix } from "./scp-uart-driver";

const root = resolve(join(import.meta.dirname, ".."));
let n = 0;
function check(name: string, cond: boolean): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) process.exitCode = 1;
}

const prereg = JSON.parse(readFileSync(join(root, "fixtures/scp/v0131-prereg.json"), "utf8")) as {
  procedure: Record<string, unknown>;
  procedure_sha256: string;
};
check("prereg procedure hash is frozen before the measured route",
  createHash("sha256").update(JSON.stringify(prereg.procedure)).digest("hex") === prereg.procedure_sha256
  && prereg.procedure_sha256 === "3c90ab6f158e6cda1516b52b8437d5ed45fddb484f03871c1acd8a29fa7dd176");

const lpf = readFileSync(join(root, "hw/scp4d/constraints/ecp5-versa-uart.lpf"), "utf8");
const doc = readFileSync(join(root, "docs/hw/ecp5-versa-uart.md"), "utf8");
check("LPF locates the schematic UART, clock, DIP and LED balls",
  lpf.includes('SITE "A11"') && lpf.includes('SITE "C11"') && lpf.includes('SITE "P3"')
  && lpf.includes('SITE "P4"') && lpf.includes('SITE "H2"') && lpf.includes('SITE "E16"')
  && lpf.includes('SITE "D17"') && lpf.includes("FPGA-EB-02021"));
check("the pin document cites the same balls and says GSRN has no user ball",
  doc.includes("A11") && doc.includes("C11") && doc.includes("does not publish a user-IO ball"));

const low = runPrefix(9, 0.01, 2);
const high = runPrefix(13, 0.55, 2);
check("seed 9 prefix, two frames, UART matches the direct engine and the software model", low.ok && low.tokens === 6);
check("seed 13 prefix, two frames, UART matches the direct engine and the software model", high.ok && high.tokens === 282);
if (!low.ok) process.stderr.write(low.text.slice(-800));
if (!high.ok) process.stderr.write(high.text.slice(-800));

const { secretKey, publicKey } = ed25519.keygen();
const digest = createHash("sha256").update(low.text + high.text).digest("hex");
const receipt: HwReceipt = {
  workload_id: "versa-prefix-seed9-seed13",
  commit_sha: "a".repeat(40),
  bitstream_sha256: "b".repeat(64),
  config: { W: 4, frames: 2, cfg_D: 256 },
  hardware_target: "icarus-uart-ff-d",
  conditions: { board: "not attached", power: "needs real board" },
  input_sha256: digest,
  output_sha256: digest,
  golden_sha256: digest,
  bit_exact: true,
};
const rows: unknown[] = [];
const writer: HwReceiptWriter = { table: "shiyan.hw_receipts", async insert(row) { rows.push(row); } };
async function finish(): Promise<void> {
const signed = await acceptHwReceipt(receipt, signReceipt(receipt, secretKey), {
  HW_RECEIPT_PUBLIC_KEY: Buffer.from(publicKey).toString("hex"),
}, writer).then((got) => got.ok === true && rows.length === 1);
check("an in-process Ed25519 receipt verifies and is not written to disk", signed);

const summaryPath = join(root, "fixtures/scp/versa-bitstream/summary.json");
const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
  chosen_seed: number; bit_sha256: string; svf_sha256: string; fmax_mhz_median: number;
};
const bit = readFileSync(join(root, `fixtures/scp/versa-bitstream/wrap_uart_versa-seed${summary.chosen_seed}.bit`));
const svf = readFileSync(join(root, `fixtures/scp/versa-bitstream/wrap_uart_versa-seed${summary.chosen_seed}.svf`));
check("the committed bitstream and SVF match the recorded sha256",
  createHash("sha256").update(bit).digest("hex") === summary.bit_sha256
  && createHash("sha256").update(svf).digest("hex") === summary.svf_sha256
  && summary.fmax_mhz_median > 20);

if (process.exitCode) process.exit(1);
console.log(`PASS check-scp-v0131 (${n} checks)`);
}
finish();
