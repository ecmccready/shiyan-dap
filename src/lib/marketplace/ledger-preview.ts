/**
 * Micro-ledger event preview for a license intent (pure; no network, no POST).
 *
 * Mirrors LedgerEventPayload (src/types/ledger.ts), the body POST /api/v1/ledger/commit accepts, so an intent
 * could later be committed unchanged by an operator. This slice never calls that route: the preview is only
 * shown and copied. Mapping, if it were ever committed:
 *   assetId            = sequence_ref (the run id)         domain   = AGENT_COMPUTE (closest existing domain)
 *   stateData.title    = "License intent · <run id>"        auditStatus = PENDING
 *   stateData.metadataHash = sha256 of the intent JSON      signature = "unsigned" (stored as unverified)
 *   no splitRule and no settlementRail: no money movement.
 * The real route also fills previousHash, version, txHash and applies its own guards, secrets and rate limit.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { LedgerEventPayload } from "@/types/ledger";
import type { LicenseIntent } from "./listings";

export type LedgerEventPreview = LedgerEventPayload & { preview: true; settlement: "none — no money movement" };

export function toLedgerEventShape(intent: LicenseIntent): LedgerEventPreview {
  const metadataHash = bytesToHex(sha256(utf8ToBytes(JSON.stringify(intent))));
  return {
    eventId: `preview_${intent.sequence_ref}`,
    domain: "AGENT_COMPUTE",
    assetId: intent.sequence_ref,
    version: "1",
    previousHash: null,
    stateData: {
      title: `License intent · ${intent.sequence_ref}`,
      auditStatus: "PENDING",
      metadataHash,
    },
    signature: "unsigned",
    timestamp: Date.parse(intent.created_at),
    preview: true,
    settlement: intent.settlement,
  };
}
