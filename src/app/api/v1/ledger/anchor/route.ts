import { NextResponse } from 'next/server';
import { computeLedgerAnchor } from '@/lib/ledger-anchor';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ledger/anchor?limit=100&txHash=0x...
 * Read-only Merkle root over the most recent ledger events (default 100, max 500), with `anchored: false`.
 * Optional txHash adds an inclusion proof if that event is inside the window. Nothing is submitted on-chain.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('limit');
  const limit = raw === null ? 100 : Number(raw);
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: 'limit must be a positive number (max 500)' }, { status: 400 });
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
