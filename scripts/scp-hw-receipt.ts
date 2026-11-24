/** Signs one Icarus receipt. The private key is read from HW_RECEIPT_PRIVATE_KEY and is never
 * written. Default target is icarus-uart-ff, not a board. Power is needs real board.
 *
 *   HW_RECEIPT_PRIVATE_KEY=<64 hex chars> npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-hw-receipt.ts
 *   # optional, non-production only:
 *   ... scripts/scp-hw-receipt.ts --submit http://127.0.0.1:3000/api/v1/hw/receipts
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalReceipt, signReceipt, type HwReceipt } from "../src/core/hw-receipt";
import { runUartCosim } from "./scp-uart-driver";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  const v = process.argv[i + 1];
  return i >= 0 && v && !v.startsWith("--") ? v : undefined;
}

async function main(): Promise<void> {
const keyHex = process.env.HW_RECEIPT_PRIVATE_KEY?.trim().toLowerCase() ?? "";
if (!/^[0-9a-f]{64}$/.test(keyHex)) {
  console.error("REFUSED: set HW_RECEIPT_PRIVATE_KEY to a 32-byte hex seed. It is not stored in the repo.");
  process.exit(2);
}
const sim = runUartCosim();
if (!sim.ok) {
  console.error("FAIL icarus uart cosim");
  process.stderr.write(sim.text);
  process.exit(1);
}
const input = createHash("sha256").update("uart-ff-token elem=0 code=1 event eof last W=4").digest("hex");
const output = createHash("sha256").update(sim.text).digest("hex");
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
if (!/^[0-9a-f]{40}$/.test(head)) {
  console.error("REFUSED: git rev-parse HEAD did not return a commit");
  process.exit(1);
}
const receipt: HwReceipt = {
  workload_id: "uart-ff-one-token",
  commit_sha: head,
  bitstream_sha256: createHash("sha256").update("no bitstream packed").digest("hex"),
  config: { W: 4, percent: 8, hold: 1, cfg_D: 16 },
  hardware_target: "icarus-uart-ff",
  conditions: { board: "not attached", bitstream: "not packed", power: "needs real board" },
  input_sha256: input,
  output_sha256: output,
  golden_sha256: output,
  bit_exact: true,
};
const secret = Uint8Array.from(Buffer.from(keyHex, "hex"));
const signature = signReceipt(receipt, secret);
const body = canonicalReceipt(receipt);
console.log(body);
console.log(signature);
const url = arg("--submit");
if (url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hw-receipt-signature": signature },
    body,
  });
  console.log(`submit ${res.status}`);
  if (!res.ok) process.exitCode = 1;
}
void ed25519.getPublicKey(secret);
}
main();
