/** Hardware proof receipt. The runner signs; the server checks the signature and that
 * bit_exact agrees with the two hashes. This module does not import Level 4, does not
 * write shiyan.experiences, and does not connect unless HW_RECEIPT_DATABASE_URL is set.
 * The migration that creates shiyan.hw_receipts is unapplied. Power is needs real board.
 * No PHI. No clinical claim.
 */
import { ed25519 } from "@noble/curves/ed25519.js";

export const HW_RECEIPT_FIELDS = [
  "workload_id", "commit_sha", "bitstream_sha256", "config", "hardware_target",
  "conditions", "input_sha256", "output_sha256", "golden_sha256", "bit_exact",
] as const;

export interface HwReceipt {
  workload_id: string;
  commit_sha: string;
  bitstream_sha256: string;
  config: Record<string, string | number | boolean>;
  hardware_target: string;
  conditions: Record<string, string | number | boolean>;
  input_sha256: string;
  output_sha256: string;
  golden_sha256: string;
  bit_exact: boolean;
}

export interface StoredHwReceipt extends HwReceipt {
  signature_hex: string;
}

export interface HwReceiptWriter {
  /** The only table this writer may name. */
  readonly table: "shiyan.hw_receipts";
  insert(row: StoredHwReceipt): Promise<void>;
}

const HEX64 = /^[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;

function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
}

function isFlat(v: unknown): v is Record<string, string | number | boolean> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every(isScalar);
}

export function parseHwReceipt(body: unknown): HwReceipt | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  if (keys.join(",") !== [...HW_RECEIPT_FIELDS].sort().join(",")) return null;
  if (typeof o.workload_id !== "string" || o.workload_id.length < 1 || o.workload_id.length > 80) return null;
  if (typeof o.commit_sha !== "string" || !SHA.test(o.commit_sha)) return null;
  if (typeof o.hardware_target !== "string" || o.hardware_target.length < 1 || o.hardware_target.length > 80) return null;
  if (!HEX64.test(String(o.bitstream_sha256)) || !HEX64.test(String(o.input_sha256))) return null;
  if (!HEX64.test(String(o.output_sha256)) || !HEX64.test(String(o.golden_sha256))) return null;
  if (typeof o.bit_exact !== "boolean") return null;
  if (!isFlat(o.config) || !isFlat(o.conditions)) return null;
  return {
    workload_id: o.workload_id,
    commit_sha: o.commit_sha,
    bitstream_sha256: String(o.bitstream_sha256),
    config: o.config as HwReceipt["config"],
    hardware_target: o.hardware_target,
    conditions: o.conditions as HwReceipt["conditions"],
    input_sha256: String(o.input_sha256),
    output_sha256: String(o.output_sha256),
    golden_sha256: String(o.golden_sha256),
    bit_exact: o.bit_exact,
  };
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortValue(o[k])]));
  }
  return v;
}

export function canonicalReceipt(r: HwReceipt): string {
  return JSON.stringify(sortValue(r));
}

/** bit_exact is true only when the two hashes are the same string. */
export function hashesConsistent(r: HwReceipt): boolean {
  return r.bit_exact === (r.output_sha256 === r.golden_sha256);
}

export function publicKeyFromEnv(env: Record<string, string | undefined>): Uint8Array | null {
  const hex = env.HW_RECEIPT_PUBLIC_KEY?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function verifyReceiptSignature(r: HwReceipt, signatureHex: string, publicKey: Uint8Array): boolean {
  if (!/^[0-9a-f]{128}$/.test(signatureHex)) return false;
  const sig = Uint8Array.from(Buffer.from(signatureHex, "hex"));
  const msg = new TextEncoder().encode(canonicalReceipt(r));
  return ed25519.verify(sig, msg, publicKey);
}

export function signReceipt(r: HwReceipt, secretKey: Uint8Array): string {
  const msg = new TextEncoder().encode(canonicalReceipt(r));
  return Buffer.from(ed25519.sign(msg, secretKey)).toString("hex");
}

export type ReceiptResult =
  | { ok: true; stored: StoredHwReceipt }
  | { ok: false; status: 400 | 401 | 503; error: string };

export async function acceptHwReceipt(
  body: unknown,
  signatureHex: string,
  env: Record<string, string | undefined>,
  writer: HwReceiptWriter,
): Promise<ReceiptResult> {
  if (writer.table !== "shiyan.hw_receipts") return { ok: false, status: 400, error: "writer table is not shiyan.hw_receipts" };
  const pub = publicKeyFromEnv(env);
  if (!pub) return { ok: false, status: 503, error: "HW_RECEIPT_PUBLIC_KEY is not configured" };
  const receipt = parseHwReceipt(body);
  if (!receipt) return { ok: false, status: 400, error: "receipt fields are not the allowed set" };
  if (!hashesConsistent(receipt)) return { ok: false, status: 400, error: "bit_exact does not match the output and golden hashes" };
  if (!verifyReceiptSignature(receipt, signatureHex, pub)) return { ok: false, status: 401, error: "signature rejected" };
  const stored = { ...receipt, signature_hex: signatureHex };
  await writer.insert(stored);
  return { ok: true, stored };
}

/** SQL is only this statement. Tests do not execute it. Migration 007 is unapplied. */
export const HW_RECEIPT_INSERT =
  "INSERT INTO shiyan.hw_receipts (workload_id, commit_sha, bitstream_sha256, config_json, hardware_target, conditions_json, input_sha256, output_sha256, golden_sha256, bit_exact, signature_hex) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)";

/** Opens a connection only when insert is called. Not used by the test suite. */
export function pgReceiptWriter(databaseUrl: string): HwReceiptWriter {
  return {
    table: "shiyan.hw_receipts",
    async insert(row) {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        await client.query(HW_RECEIPT_INSERT, [
          row.workload_id, row.commit_sha, row.bitstream_sha256, JSON.stringify(row.config),
          row.hardware_target, JSON.stringify(row.conditions), row.input_sha256, row.output_sha256,
          row.golden_sha256, row.bit_exact, row.signature_hex,
        ]);
      } finally {
        await client.end();
      }
    },
  };
}
