/** Micro-ledger API contract. Distinct from the localStorage ledger in src/lib/ledger.ts. */

export type AssetDomain = 'STEM' | 'DIAGNOSTIC_AUDIT' | 'AGENT_COMPUTE' | 'ECONOMIC_BENEFIT';
export const LEDGER_AUDIT_STATUSES = ['PENDING', 'PASSED', 'FLAGGED', 'REJECTED', 'FAILED'] as const;
export type LedgerAuditStatus = (typeof LEDGER_AUDIT_STATUSES)[number];

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
    auditStatus?: LedgerAuditStatus;
    /** ECONOMIC_BENEFIT only: a customer's self-reported benefit for a run. Never verified; written only by POST /api/v1/ledger/benefit. */
    selfReportedBenefit?: {
      runId: string;
      amount: string;
      unit: string;
      note: string;
      selfReported: true;
      verified: false;
      statement: string;
    };
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
