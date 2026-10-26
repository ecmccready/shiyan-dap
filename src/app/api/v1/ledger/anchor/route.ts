import { NextResponse } from 'next/server';
import { computeLedgerAnchor, dryRunAnchorSubmission, recentAnchorAttempts } from '@/lib/ledger-anchor';
import { allowLedgerWrite } from '@/lib/ledger-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ledger/anchor?limit=100&txHash=0x...
 * Read-only Merkle root over the most recent ledger events (default 100, max 500), with `anchored: false`.
 * Optional txHash adds an inclusion proof if that event is inside the window. Nothing is submitted on-chain.
 * `?attempts=N` instead lists the latest N recorded dry-run submissions (read-only).
 *
 * POST { dryRun: true, limit? } records a DRY-RUN submission of the current root and returns a simulated tx
 * hash and block number with status "dry-run" and anchored false. Only dryRun is supported; there is no chain.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('limit');
  const limit = raw === null ? 100 : Number(raw);
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: 'limit must be a positive number (max 500)' }, { status: 400 });
  }
  const attemptsRaw = url.searchParams.get('attempts');
  if (attemptsRaw !== null) {
    const n = Number(attemptsRaw);
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: 'attempts must be a positive number (max 50)' }, { status: 400 });
    try {
      const attempts = await recentAnchorAttempts(n);
      return NextResponse.json({ anchored: false, status: 'dry-run', attempts: attempts.reverse() }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ error: 'ledger storage unavailable' }, { status: 502 });
    }
  }
  const txHash = url.searchParams.get('txHash') ?? undefined;
  if (txHash !== undefined && !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    return NextResponse.json({ error: 'txHash must be 0x plus 64 hex characters' }, { status: 400 });
  }
  try {
    return NextResponse.json(await computeLedgerAnchor(limit, txHash), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'ledger storage unavailable' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  let body: { dryRun?: unknown; limit?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (body?.dryRun !== true) {
    return NextResponse.json(
      { error: 'only dry-run submission is supported: send {"dryRun": true}. On-chain submission is not implemented.', anchored: false },
      { status: 400 },
    );
  }
  const limit = body.limit === undefined ? 100 : Number(body.limit);
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: 'limit must be a positive number (max 500)' }, { status: 400 });
  }
  if (!(await allowLedgerWrite(req, 'anchor'))) {
    return NextResponse.json({ error: 'rate limit: too many anchor attempts from this address, try later' }, { status: 429 });
  }
  try {
    return NextResponse.json(await dryRunAnchorSubmission(limit), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'ledger storage unavailable' }, { status: 502 });
  }
}
