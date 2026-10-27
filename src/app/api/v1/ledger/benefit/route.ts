import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import { commitLedgerEvent } from '@/lib/ledger-commit';

export const dynamic = 'force-dynamic';

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const STATEMENT = 'self-reported by the customer, not verified by the engine or the ledger';

/**
 * POST /api/v1/ledger/benefit: opt-in, append-only record of a customer's self-reported economic benefit for a run.
 * Body: { runId, amount?, unit?, note? } (an amount or a note is required). It commits one ECONOMIC_BENEFIT ledger event on
 * asset `benefit_<runId>`, deliberately unsigned so its signatureStatus is "unverified": the ledger proves the entry was recorded,
 * not that it is true. Nothing is settled and no revenue is implied. Rate limited like other ledger writes.
 */
export async function POST(req: Request) {
  if (!(await allowLedgerWrite(req))) {
    return NextResponse.json({ error: 'rate limit: too many ledger writes from this address, try later' }, { status: 429 });
  }
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const runId = str(b?.runId, 80);
  const amount = str(b?.amount, 40);
  const unit = str(b?.unit, 20);
  const note = str(b?.note, 500);
  if (!RUN_ID.test(runId)) return NextResponse.json({ error: 'a valid runId is required' }, { status: 400 });
  if (!amount && !note) return NextResponse.json({ error: 'an amount or a note is required' }, { status: 400 });
  const selfReportedBenefit = { runId, amount, unit, note, selfReported: true as const, verified: false as const, statement: STATEMENT };
  const metadataHash = createHash('sha256').update(JSON.stringify(selfReportedBenefit)).digest('hex');
  const assetId = `benefit_${runId}`;
  const res = await commitLedgerEvent(
    { domain: 'ECONOMIC_BENEFIT', assetId, stateData: { title: `Self-reported economic benefit for ${runId}`, selfReportedBenefit, metadataHash } },
    {},
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(
    {
      ok: true,
      assetId,
      domain: 'ECONOMIC_BENEFIT',
      txHash: res.response.txHash,
      previousHash: res.response.previousHash,
      signatureStatus: res.response.signatureStatus,
      selfReported: true,
      verified: false,
      note: STATEMENT,
    },
    { headers: { 'x-ledger-store': res.store, 'x-ledger-anchor': 'off-chain' } },
  );
}
