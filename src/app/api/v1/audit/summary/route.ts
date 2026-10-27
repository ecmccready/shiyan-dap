import { NextResponse } from 'next/server';
import { auditSummary } from '@/lib/ledger-summaries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/summary
 * Read-only enterprise audit summary: event counts by domain, signature status and settlement rail, plus the current
 * Merkle root and the anchored flag (always false: nothing is submitted on-chain).
 */
export async function GET() {
  try {
    return NextResponse.json(await auditSummary(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'ledger storage unavailable' }, { status: 502 });
  }
}
