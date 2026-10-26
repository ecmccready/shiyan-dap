import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import { issueSiweNonce } from '@/lib/ledger-commit';

export const dynamic = 'force-dynamic';

/**
 * Issues a single-use SIWE nonce. Put it in the `Nonce:` line of the siweMessage you sign, then send the message to
 * POST /api/v1/ledger/commit (signatureType wallet). The nonce is stored server-side for 10 minutes and consumed when a
 * commit with a verified signature uses it. Nonces not issued here are still accepted (legacy), but the commit's
 * combined status is then wallet_siwe_partial. Rate limited per IP (separate 'siwe-nonce' budget).
 */
export async function GET(req: Request) {
  if (!(await allowLedgerWrite(req, 'siwe-nonce'))) {
    return NextResponse.json({ error: 'rate limit: too many nonce requests from this address, try later' }, { status: 429 });
  }
  try {
    const { nonce, ttlSeconds, store } = await issueSiweNonce();
    return NextResponse.json(
      { nonce, expiresInSeconds: ttlSeconds, issuedBy: 'server', singleUse: true, store },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'nonce store unavailable' }, { status: 502 });
  }
}
