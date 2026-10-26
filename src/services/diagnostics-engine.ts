import { recordLedgerState } from '@/lib/micro-ledger-client';
import type { LedgerRecordResponse } from '@/types/ledger';

export interface DiagnosticScanRequest {
  assetId: string;
  workspaceId: string;
  version?: string;
  title?: string;
  baseUrl?: string;
}

export interface DiagnosticAuditResult {
  assetId: string;
  workspaceId: string;
  scannedAt: number;
  /** 0-100, higher is safer. Mock: random until a real checker is connected. */
  copyrightScore: number;
  auditStatus: 'PASSED' | 'FAILED';
  ledger: LedgerRecordResponse;
}

const PASS_THRESHOLD = 70;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Mock copyright scan; auto-commits a DIAGNOSTIC_AUDIT event to the micro-ledger. */
export async function executeDiagnosticScan(
  req: DiagnosticScanRequest,
): Promise<DiagnosticAuditResult> {
  const scannedAt = Date.now();
  const copyrightScore = Math.round(Math.random() * 1000) / 10;
  const auditStatus = copyrightScore >= PASS_THRESHOLD ? 'PASSED' : 'FAILED';
  const metadataHash = await sha256Hex(
    JSON.stringify({ assetId: req.assetId, copyrightScore, auditStatus, scannedAt }),
  );
  const ledger = await recordLedgerState(
    {
      domain: 'DIAGNOSTIC_AUDIT',
      assetId: req.assetId,
      version: req.version ?? '1',
      previousHash: null,
      stateData: { title: req.title, auditStatus, metadataHash },
    },
    req.baseUrl,
  );
  return { assetId: req.assetId, workspaceId: req.workspaceId, scannedAt, copyrightScore, auditStatus, ledger };
}
