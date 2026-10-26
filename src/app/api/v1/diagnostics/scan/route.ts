import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import { audioBytesFromBase64, runDiagnosticChecksDetailed } from '@/services/diagnostics-core';
import type { DiagnosticScanRequest } from '@/services/diagnostics-engine';
import { commitLedgerEvent } from '@/lib/ledger-commit';

export const dynamic = 'force-dynamic';

const ASSET_TYPES = ['AUDIO', 'TEXT', 'MODEL_PROMPT'];

/**
 * Optional `audioBase64` (max 2 MB decoded) or `audioHash` (64-hex SHA-256) feed `audioFingerprint` (a content hash only, never stored).
 * Server-side diagnostics: runs the (mock) scan and commits a DIAGNOSTIC_AUDIT event directly to
 * the micro-ledger, with no HTTP hop. Returns the DiagnosticAuditResult plus the ledger record.
 */
export async function POST(req: Request) {
  if (!(await allowLedgerWrite(req))) {
    return NextResponse.json({ error: 'rate limit: too many ledger writes from this address, try later' }, { status: 429 });
  }
  let body: Partial<DiagnosticScanRequest>;
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
  const metadata =
    title !== undefined || durationSeconds !== undefined || text !== undefined
      ? { title: title?.slice(0, 200), text, durationSeconds }
      : undefined;
  const request = body as DiagnosticScanRequest;
  const { result, reasons, scoringVersion, fingerprint, fingerprintVersion, fingerprintKind, audioFingerprint, audioFingerprintStatus, audioFingerprintNote } = runDiagnosticChecksDetailed({ ...request, metadata }, {
    bytes: audioBytesFromBase64((body as { audioBase64?: unknown }).audioBase64),
    hash: typeof (body as { audioHash?: unknown }).audioHash === 'string' ? (body as { audioHash: string }).audioHash : undefined,
  });
  const commit = await commitLedgerEvent({
    domain: 'DIAGNOSTIC_AUDIT',
    assetId: result.assetId,
    stateData: {
      ...(body.splitRule ? { splitRule: body.splitRule } : {}),
      auditStatus: result.overallStatus,
      metadataHash: result.certificateHash,
    },
  }, { serverSign: true });
  if (!commit.ok) {
    return NextResponse.json({ ...result, reasons, scoringVersion, fingerprint, fingerprintVersion, fingerprintKind, audioFingerprint, audioFingerprintStatus, audioFingerprintNote, ledger: null, error: commit.error }, { status: commit.status });
  }
  return NextResponse.json({ ...result, reasons, scoringVersion, fingerprint, fingerprintVersion, fingerprintKind, audioFingerprint, audioFingerprintStatus, audioFingerprintNote, ledger: commit.response });
}
