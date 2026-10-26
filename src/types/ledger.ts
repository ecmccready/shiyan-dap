/** Micro-ledger API contract (server-side commit). Distinct from the localStorage ledger in src/lib/ledger.ts. */

export type AssetDomain =
  | "music"
  | "diagnostics"
  | "legal"
  | "art"
  | "software"
  | "other";

export interface SplitRecipient {
  /** Wallet address, handle or account id of the recipient. */
  recipientId: string;
  /** Share in basis points (10000 = 100%). */
  shareBps: number;
  role?: string;
}

export interface LedgerEventPayload {
  assetId: string;
  domain: AssetDomain;
  /** Short event name, e.g. "diagnostic.scan.completed". */
  eventType: string;
  /** Hash of the evidence or state being recorded, e.g. "sha256:...". */
  stateHash: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  splits?: SplitRecipient[];
  metadata?: Record<string, unknown>;
}

export interface LedgerRecordResponse {
  ok: boolean;
  txHash: string;
  recordedAt: string;
  /** True while the commit endpoint is a stub and nothing is anchored on-chain. */
  mock: boolean;
  error?: string;
}
