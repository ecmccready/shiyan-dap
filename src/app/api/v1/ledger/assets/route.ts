import { NextResponse } from 'next/server';
import { assetMap } from '@/lib/ledger-summaries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ledger/assets?limit=200
 * Read-only asset map: one row per unique assetId with its domain, latest event summary, signature status and
 * settlement rail. Newest first. Reads the latest 500 events; no writes, no secrets.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('limit');
  const limit = raw === null ? 200 : Number(raw);
  if (!Number.isFinite(limit) || limit < 1) return NextResponse.json({ error: 'limit must be a positive number (max 500)' }, { status: 400 });
  try {
    return NextResponse.json(await assetMap(Math.min(500, Math.floor(limit))), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'ledger storage unavailable' }, { status: 502 });
  }
}
