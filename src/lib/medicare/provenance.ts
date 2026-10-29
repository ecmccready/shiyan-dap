/**
 * Medicare provenance record (pure: no network, no I/O, no writes). Domain-isolated: every record carries
 * domain_label "medicare" and never "safety", so nothing here can feed Safety plant experience reuse.
 * content_hash is sha256 (hex) of the canonical JSON bytes of the data: object keys sorted recursively, no spaces.
 * A provenance record says where data came from; it is not a finding, and a detected pattern is not a verified conclusion.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const MEDICARE_PROVENANCE_SCHEMA = "aethel.medicare.provenance.v1" as const;
export const MEDICARE_DOMAIN_LABEL = "medicare" as const;
export const MEDICARE_NOTE =
  "Provenance only. A detected pattern is not a verified conclusion: nothing here claims clinical misdiagnosis, fraud or misconduct, and findings are inputs for human review.";

export type MedicareProvenance = {
  schema_version: typeof MEDICARE_PROVENANCE_SCHEMA;
  source_id: string;
  source_name: string;
  release_id: string;
  retrieved_at: string;
  content_hash: string;
  domain_label: typeof MEDICARE_DOMAIN_LABEL;
  note: string;
};

/** Canonical JSON: keys sorted at every level, arrays in order, no whitespace. Non-JSON values become null. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
  if (Array.isArray(v)) return `[${v.map((x) => canonicalJson(x)).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return "null";
}

export function contentHash(data: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(data))));
}

export function buildProvenance(input: { source_id: string; source_name: string; release_id: string; retrieved_at: string; data: unknown }): MedicareProvenance {
  return {
    schema_version: MEDICARE_PROVENANCE_SCHEMA,
    source_id: input.source_id,
    source_name: input.source_name,
    release_id: input.release_id,
    retrieved_at: input.retrieved_at,
    content_hash: contentHash(input.data),
    domain_label: MEDICARE_DOMAIN_LABEL,
    note: MEDICARE_NOTE,
  };
}
