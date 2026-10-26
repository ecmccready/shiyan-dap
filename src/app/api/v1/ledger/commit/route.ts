import { NextResponse } from 'next/server';
import { allowLedgerWrite } from '@/lib/ledger-guard';
import type { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';
import { commitLedgerEvent, hiddenAssets, purgeAsset, readLedger, setAssetHidden } from '@/lib/ledger-commit';
import { safeEqual, signingSecretMode } from '@/lib/ledger-signing';

/** Production domain of the live app. The default binding for SIWE messages when SIWE_ALLOWED_DOMAINS is not set. */
const DEFAULT_SIWE_DOMAINS = ['shiyan-dap.vercel.app'];

/**
 * Domains a SIWE message may name, independent of the request's Host header:
 * 1. SIWE_ALLOWED_DOMAINS (comma separated, host[:port]) when set.
 * 2. Otherwise a fixed list: shiyan-dap.vercel.app plus VERCEL_PROJECT_PRODUCTION_URL (set by the platform, not by the client).
 * Opt-ins that do read the request: SIWE_TRUST_REQUEST_HOST=1 adds the request host (the old default, for previews and custom
 * domains), and outside NODE_ENV=production the request host is added so local development works. A direct client controls
 * its own Host header, so never enable SIWE_TRUST_REQUEST_HOST where the domain is a security boundary.
 */
function siweExpectedDomains(req: Request): string[] {
  const configured = (process.env.SIWE_ALLOWED_DOMAINS ?? '').split(',').map((d) => d.trim()).filter(Boolean);
  if (configured.length) return configured;
  const fixed = [...DEFAULT_SIWE_DOMAINS, process.env.VERCEL_PROJECT_PRODUCTION_URL];
  const trustHost = process.env.SIWE_TRUST_REQUEST_HOST === '1' || process.env.NODE_ENV !== 'production';
  const fromRequest = trustHost ? [req.headers.get('x-forwarded-host')?.split(',')[0], req.headers.get('host')] : [];
  return [...new Set([...fixed, ...fromRequest].filter((h): h is string => Boolean(h)).map((h) => h.trim()))];
}

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
  let p: Partial<LedgerEventPayload> & {
    settlementRail?: string;
    settlementAmountCents?: number;
    settlementCurrency?: string;
    signatureType?: string;
    walletAddress?: string;
    walletMessage?: string;
    siweMessage?: string;
    contractWallet?: unknown;
    usageEstimate?: unknown;
  };
  try {
    p = (await req.json()) as typeof p;
  } catch {
    return fail('invalid JSON body');
  }
  const { settlementRail, settlementAmountCents, settlementCurrency, signatureType, walletAddress, walletMessage, siweMessage, contractWallet, ...event } = p ?? {};
  // usageEstimate is only accepted from server-side plugin tools, never from a client body.
  // Likewise the server-derived record fields can't be forged through the body.
  for (const k of ['usageEstimate', 'siwe', 'eip191Status', 'signatureReason', 'signatureStatus', 'signatureType', 'settlement', 'planned_transfers', 'txHash']) delete (event as Record<string, unknown>)[k];
  const res = await commitLedgerEvent(event, { settlementRail, settlementAmountCents, settlementCurrency, signatureType,
    walletAddress: typeof walletAddress === 'string' ? walletAddress.slice(0, 100) : undefined,
    walletMessage: typeof walletMessage === 'string' ? walletMessage.slice(0, 2000) : undefined,
    siweMessage: typeof siweMessage === 'string' ? siweMessage.slice(0, 2000) : undefined,
    contractWallet: contractWallet === true,
    siweExpectedDomains: siweExpectedDomains(req),
  });
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
 * Admin delete: `DELETE ?assetId=<id>` soft-hides every event of the asset (they stay in storage);
 * `&restore=1` unhides; `&purge=1` permanently removes the events (irreversible). Requires header
 * `x-admin-secret: $LEDGER_ADMIN_SECRET`.
 */
export async function DELETE(req: Request) {
  const denied = await adminGate(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get('assetId');
  // One asset, or up to 20 comma-separated assets, so test data can be cleaned in one call.
  const assetIds = [...new Set((raw ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
  if (assetIds.length === 0) return NextResponse.json({ error: 'assetId query param is required' }, { status: 400 });
  if (assetIds.length > 20) return NextResponse.json({ error: 'at most 20 assetIds per call' }, { status: 400 });
  const restore = url.searchParams.get('restore') === '1';
  const purge = url.searchParams.get('purge') === '1';
  if (purge && restore) return NextResponse.json({ error: 'purge and restore cannot be combined' }, { status: 400 });
  try {
    if (purge) {
      const results = [];
      for (const id of assetIds) results.push({ assetId: id, ...(await purgeAsset(id)) });
      const first = results[0];
      return NextResponse.json({
        ok: true,
        purged: true,
        ...(assetIds.length === 1 ? { assetId: first.assetId, removedEvents: first.removedEvents, removedQueue: first.removedQueue } : {}),
        results,
        totalRemovedEvents: results.reduce((a, r) => a + r.removedEvents, 0),
      });
    }
    for (const id of assetIds) await setAssetHidden(id, restore ? false : true);
    return NextResponse.json({ ok: true, assetIds, ...(assetIds.length === 1 ? { assetId: assetIds[0] } : {}), hidden: !restore, hiddenAssets: [...(await hiddenAssets())] });
  } catch {
    return fail('ledger storage unavailable', 502);
  }
}
