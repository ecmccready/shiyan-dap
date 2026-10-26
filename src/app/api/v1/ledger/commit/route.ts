import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import type { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';
import { commitLedgerEvent, hiddenAssets, readLedger, setAssetHidden } from '@/lib/ledger-commit';
import { safeEqual, signingSecretMode } from '@/lib/ledger-signing';

export const dynamic = 'force-dynamic';

/**
 * Micro-ledger commit endpoint. Storage, chaining, signatures, settlement and locking live in
 * src/lib/ledger-commit.ts. See docs/ledger-api.md for usage.
 */
function fail(message: string, status = 400) {
  const body: LedgerRecordResponse = { txHash: '', status: 'FAILED', settlementRail: 'INTERNAL_MICRO' };
  return NextResponse.json({ ...body, error: message }, { status });
}

/** Admin gate: header `x-admin-secret` must equal LEDGER_ADMIN_SECRET. Disabled (503) when the env var is unset. */
async function adminGate(req: Request): Promise<NextResponse | null> {
  const secret = process.env.LEDGER_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: 'admin disabled: LEDGER_ADMIN_SECRET is not set' }, { status: 503 });
  if (!(await allowLedgerWrite(req, 'admin'))) return NextResponse.json({ error: 'rate limit' }, { status: 429 });
  const given = req.headers.get('x-admin-secret') ?? '';
  if (!safeEqual(given, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  if (!(await allowLedgerWrite(req))) {
    return NextResponse.json({ error: 'rate limit: too many ledger writes from this address, try later' }, { status: 429 });
  }
  let p: Partial<LedgerEventPayload> & { settlementRail?: string };
  try {
    p = (await req.json()) as typeof p;
  } catch {
    return fail('invalid JSON body');
  }
  const { settlementRail, ...event } = p ?? {};
  const res = await commitLedgerEvent(event, { settlementRail });
  if (!res.ok) return fail(res.error, res.status);
  return NextResponse.json(res.response, {
    headers: { 'x-ledger-store': res.store, 'x-ledger-anchor': 'off-chain' },
  });
}

/**
 * Read-only: visible event count and the latest few (default 5, max 50). With `?includeHidden=1` and a
 * valid admin header, soft-deleted assets are included and flagged `hidden`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 5));
  let includeHidden = false;
  if (url.searchParams.get('includeHidden') === '1') {
    const denied = await adminGate(req);
    if (denied) return denied;
    includeHidden = true;
  }
  try {
    return NextResponse.json({ ...(await readLedger(limit, includeHidden)), signing: signingSecretMode() });
  } catch {
    return fail('ledger storage unavailable', 502);
  }
}

/**
 * Admin soft delete: `DELETE ?assetId=<id>` hides every event of the asset from reads (they stay in
 * storage); add `&restore=1` to unhide. Requires header `x-admin-secret: $LEDGER_ADMIN_SECRET`.
 */
export async function DELETE(req: Request) {
  const denied = await adminGate(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const assetId = url.searchParams.get('assetId');
  if (!assetId) return NextResponse.json({ error: 'assetId query param is required' }, { status: 400 });
  const restore = url.searchParams.get('restore') === '1';
  try {
    await setAssetHidden(assetId, restore ? false : true);
    return NextResponse.json({ ok: true, assetId, hidden: !restore, hiddenAssets: [...(await hiddenAssets())] });
  } catch {
    return fail('ledger storage unavailable', 502);
  }
}
