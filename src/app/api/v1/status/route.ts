import { NextResponse } from 'next/server';
import { workbenchRegistry } from '@/plugins';
import { ledgerSummary } from '@/lib/ledger-commit';
import { computeLedgerAnchor, recentAnchorAttempts, type AnchorAttempt } from '@/lib/ledger-anchor';
import { LEDGER_WRITES_PER_HOUR } from '@/lib/ledger-guard';

export const dynamic = 'force-dynamic';

/**
 * Read-only system status: plugins, ledger summary, and which secrets are configured (booleans only,
 * never values). A few cheap Redis reads.
 */
export async function GET() {
  const plugins = workbenchRegistry.listPlugins().map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    toolCount: p.registerTools().length,
  }));
  let ledger: Awaited<ReturnType<typeof ledgerSummary>> | { error: string };
  try {
    ledger = await ledgerSummary();
  } catch {
    ledger = { error: 'ledger storage unavailable' };
  }
  let anchor: { root: string | null; eventCount: number; anchored: false; algorithm: string; note: string; lastDryRun: Pick<AnchorAttempt, 'attemptId' | 'status' | 'root' | 'simulatedTxHash' | 'simulatedBlockNumber' | 'attemptedAt'> | null } | { error: string };
  try {
    const a = await computeLedgerAnchor(100);
    const last = (await recentAnchorAttempts(1))[0];
    anchor = {
      root: a.root,
      eventCount: a.eventCount,
      anchored: a.anchored,
      algorithm: a.algorithm,
      note: 'Merkle root over the latest 100 events; on-chain submission is not live (dry-run only)',
      lastDryRun: last ? { attemptId: last.attemptId, status: last.status, root: last.root, simulatedTxHash: last.simulatedTxHash, simulatedBlockNumber: last.simulatedBlockNumber, attemptedAt: last.attemptedAt } : null,
    };
  } catch {
    anchor = { error: 'ledger storage unavailable' };
  }
  return NextResponse.json(
    {
      ok: true,
      plugins,
      pluginCount: plugins.length,
      ledger,
      anchor,
      config: {
        signingSecretConfigured: Boolean(process.env.LEDGER_SIGNING_SECRET),
        adminSecretConfigured: Boolean(process.env.LEDGER_ADMIN_SECRET),
        stripeKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        ledgerStore: process.env.UPSTASH_KV_REST_API_URL && process.env.UPSTASH_KV_REST_API_TOKEN ? 'upstash' : 'memory',
      },
      settlementRails: [
        { rail: 'INTERNAL_MICRO', note: 'settled internally' },
        { rail: 'STRIPE', note: 'PaymentIntent plus test-mode Connect transfers when configured, otherwise queued with a reason' },
        { rail: 'X_MONEY', note: 'queued only (no integration)' },
      ],
      signatureTypes: [
        { type: 'hmac', note: 'default; verified with LEDGER_SIGNING_SECRET (public dev fallback when unset)' },
        { type: 'wallet', note: 'EIP-191 personal_sign, basic check; wallet_verified or wallet_unverified with a reason; optional siweMessage adds domain, freshness, nonce checks, a siwe.cryptoVerified boolean (false makes the combined status wallet_siwe_partial) and a siwe.overallValid summary (nonces from GET /api/v1/siwe/nonce preferred) and a combined wallet_siwe_verified or wallet_siwe_partial status; contractWallet:true gives eip1271_verified, eip1271_failed or eip1271_unsupported (an eth_call isValidSignature check when ETH_RPC_URL is set; no full SIWE crypto, no ERC-6492); SIWE domain defaults to SIWE_ALLOWED_DOMAINS or the fixed production domain, not the request Host' },
      ],
      limits: { ledgerWritesPerIpPerHour: LEDGER_WRITES_PER_HOUR },
      phase: { phase1: 'complete', phase2: 'current (MCP + boundary)', phase3: 'surfaces live: asset map with per-asset domain timeline (GET /api/v1/ledger/assets) and audit summary with audit-status counts (GET /api/v1/audit/summary)' },
      looseEnds: [
        'The 8 original test events are still in the ledger. They can be purged per asset with LEDGER_ADMIN_SECRET (admin hard-purge); they have not been purged.',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
