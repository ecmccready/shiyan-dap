import type { LedgerRecordResponse } from '@/types/ledger';

export interface ScanMetadata {
  title?: string;
  text?: string;
  durationSeconds?: number;
}

export interface DiagnosticScanRequest {
  assetId: string;
  assetType: 'AUDIO' | 'TEXT' | 'MODEL_PROMPT';
  contentHash: string;
  rawPayloadUrl?: string;
  metadata?: ScanMetadata;
  /** Convenience fields accepted by the scan API when metadata is omitted. */
  title?: string;
  durationSeconds?: number;
  splitRule?: { account: string; percentage: number }[];
}

export interface DiagnosticAuditResult {
  assetId: string;
  timestamp: number;
  overallStatus: 'PASSED' | 'FLAGGED' | 'REJECTED';
  checks: {
    copyrightMatchScore: number; // 0.0 to 1.0 (0 = clean)
    trainingDataRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    regulatoryCompliance: boolean;
  };
  certificateHash: string;
}

export interface DiagnosticScanResponse extends DiagnosticAuditResult {
  reasons: string[];
  scoringVersion: string;
  fingerprint: string;
  fingerprintVersion: string;
  ledger: (LedgerRecordResponse & {
    previousHash: string | null;
    signatureStatus: 'verified' | 'unverified' | 'wallet_verified' | 'wallet_unverified';
    signatureType: 'hmac' | 'wallet';
  }) | null;
}

export async function executeDiagnosticScan(
  request: DiagnosticScanRequest
): Promise<DiagnosticScanResponse> {
  const response = await fetch('/api/v1/diagnostics/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const body: DiagnosticScanResponse & { error?: string } = await response.json();
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `diagnostics scan failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}
