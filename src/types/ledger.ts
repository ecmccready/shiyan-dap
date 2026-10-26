/** Micro-ledger API contract. Distinct from the localStorage ledger in src/lib/ledger.ts. */

export type AssetDomain = 'MUSIC_TRACK' | 'STEM' | 'DIAGNOSTIC_AUDIT' | 'AGENT_COMPUTE';

export interface SplitRecipient {
  account: string; // Internal wallet or Stripe account ID
  percentage: number; // e.g., 85.0 for 85%
}

export interface LedgerEventPayload {
  eventId: string;
  domain: AssetDomain;
  assetId: string;
  version: string;
  previousHash: string | null;
  stateData: {
    title?: string;
    duration?: number;
    splitRule?: SplitRecipient[];
    auditStatus?: 'PENDING' | 'PASSED' | 'FLAGGED' | 'REJECTED' | 'FAILED';
    metadataHash: string;
  };
  signature: string; // HMAC signature; wallet signatures may be unverified
  timestamp: number;
}

export interface LedgerRecordResponse {
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  settlementRail: 'INTERNAL_MICRO' | 'STRIPE' | 'X_MONEY';
  blockHeight?: number;
}
