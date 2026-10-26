export interface DiagnosticScanRequest {
  assetId: string;
  assetType: 'AUDIO' | 'TEXT' | 'MODEL_PROMPT';
  contentHash: string;
  rawPayloadUrl?: string;
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

export async function executeDiagnosticScan(
  request: DiagnosticScanRequest
): Promise<DiagnosticAuditResult> {
  const response = await fetch('/api/v1/diagnostics/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const body = await response.json();
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `diagnostics scan failed (${response.status})`;
    throw new Error(message);
  }
  return body as DiagnosticAuditResult;
}
