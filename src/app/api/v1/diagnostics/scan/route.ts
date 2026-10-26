import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import { runDiagnosticChecksDetailed, type ScanMetadata } from '@/services/diagnostics-core';
import type { DiagnosticScanRequest } from '@/services/diagnostics-engine';
import { commitLedgerEvent } from '@/lib/ledger-commit';
import type { SplitRule } from '@/lib/ledger-settlement';

export const dynamic = 'force-dynamic';

const ASSET_TYPES = ['AUDIO', 'TEXT', 'MODEL_PROMPT'];

/**
 * Server-side diagnostics: runs the (mock) scan and commits a DIAGNOSTIC_AUDIT event directly to
 * the micro-ledger, with no HTTP hop. Returns the DiagnosticAuditResult plus the ledger record.
 */
export async function POST(req: Request) {
  if (!(await allowLedgerWrite(req))) {
    return NextResponse.json({ error: 'rate limit: too many ledger writes from this address, try later' }, { status: 429 });
  }
  let body: Partial<DiagnosticScanRequest> & { metadata?: ScanMetadata; splitRule?: SplitRule; title?: string; durationSeconds?: number };
  try {
    body = (await req.json()) as typeof body;
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
  const m = body.metadata;
  if (m !== undefined && (typeof m !== 'object' || m === null || Array.isArray(m))) {
    return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 });
  }
  // metadata.* wins; top-level title and durationSeconds are accepted as a convenience.
  const title = typeof m?.title === 'string' ? m.title : typeof body.title === 'string' ? body.title : undefined;
  const durationSeconds = typeof m?.durationSeconds === 'number' ? m.durationSeconds : typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined;
  const text = typeof m?.text === 'string' ? m.text.slice(0, 20000) : undefined;
  const metadata: ScanMetadata | undefined =
    title !== undefined || durationSeconds !== undefined || text !== undefined
      ? { title: title?.slice(0, 200), text, durationSeconds }
      : undefined;
  const request = body as DiagnosticScanRequest;
  const { result, reasons, scoringVersion } = runDiagnosticChecksDetailed({ ...request, metadata });
  const commit = await commitLedgerEvent({
    domain: 'DIAGNOSTIC_AUDIT',
    assetId: result.assetId,
    stateData: {
      ...(body.splitRule ? { splitRule: body.splitRule } : {}),
      auditStatus: result.overallStatus === 'PASSED' ? 'PASSED' : 'FAILED',
      metadataHash: result.certificateHash,
    },
  }, { serverSign: true });
  if (!commit.ok) {
    return NextResponse.json({ ...result, reasons, scoringVersion, ledger: null, error: commit.error }, { status: commit.status });
  }
  return NextResponse.json({ ...result, reasons, scoringVersion, ledger: commit.response });
}
