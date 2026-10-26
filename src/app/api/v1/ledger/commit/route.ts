import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import type { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';
import { commitLedgerEvent, readLedger } from '@/lib/ledger-commit';

export const dynamic = 'force-dynamic';

/** Micro-ledger commit endpoint. Storage, chaining and locking live in src/lib/ledger-commit.ts. */
function fail(message: string, status = 400) {
  const body: LedgerRecordResponse = { txHash: '', status: 'FAILED', settlementRail: 'INTERNAL_MICRO' };
  return NextResponse.json({ ...body, error: message }, { status });
}

export async function POST(req: Request) {
  if (!(await allowLedgerWrite(req))) {
    return NextResponse.json({ error: 'rate limit: too many ledger writes from this address, try later' }, { status: 429 });
  }
  let p: Partial<LedgerEventPayload>;
  try {
    p = (await req.json()) as Partial<LedgerEventPayload>;
  } catch {
    return fail('invalid JSON body');
  }
  const res = await commitLedgerEvent(p);
  if (!res.ok) return fail(res.error, res.status);
  return NextResponse.json(res.response, {
    headers: { 'x-ledger-store': res.store, 'x-ledger-anchor': 'off-chain' },
  });
}

/** Read-only: total committed events and the latest few (default 5, max 50). */
export async function GET(req: Request) {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 5));
  try {
    return NextResponse.json(await readLedger(limit));
  } catch {
    return fail('ledger storage unavailable', 502);
  }
}
