import { NextResponse } from 'next/server';
import { runDiagnosticChecks } from '@/services/diagnostics-core';
import type { DiagnosticScanRequest } from '@/services/diagnostics-engine';
import { commitLedgerEvent } from '@/lib/ledger-commit';

export const dynamic = 'force-dynamic';

const ASSET_TYPES = ['AUDIO', 'TEXT', 'MODEL_PROMPT'];

/**
 * Server-side diagnostics: runs the (mock) scan and commits a DIAGNOSTIC_AUDIT event directly to
 * the micro-ledger, with no HTTP hop. Returns the DiagnosticAuditResult plus the ledger record.
 */
export async function POST(req: Request) {
  let body: Partial<DiagnosticScanRequest>;
  try {
    body = (await req.json()) as Partial<DiagnosticScanRequest>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body.assetId !== 'string' || !body.assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }
  if (!body.assetType || !ASSET_TYPES.includes(body.assetType)) {
    return NextResponse.json({ error: 'assetType must be AUDIO, TEXT or MODEL_PROMPT' }, { status: 400 });
  }
  if (typeof body.contentHash !== 'string' || !body.contentHash) {
    return NextResponse.json({ error: 'contentHash is required' }, { status: 400 });
  }
  const request = body as DiagnosticScanRequest;
  const result = runDiagnosticChecks(request);
  const commit = await commitLedgerEvent({
    domain: 'DIAGNOSTIC_AUDIT',
    assetId: result.assetId,
    stateData: {
      auditStatus: result.overallStatus === 'PASSED' ? 'PASSED' : 'FAILED',
      metadataHash: result.certificateHash,
    },
  });
  if (!commit.ok) {
    return NextResponse.json({ ...result, ledger: null, error: commit.error }, { status: commit.status });
  }
  return NextResponse.json({ ...result, ledger: commit.response });
}
