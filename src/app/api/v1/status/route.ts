import { NextResponse } from 'next/server';
import { workbenchRegistry } from '@/plugins';
import { ledgerSummary, readLedger } from '@/lib/ledger-commit';
import { computeLedgerAnchor, recentAnchorAttempts, type AnchorAttempt } from '@/lib/ledger-anchor';
import { LEDGER_WRITES_PER_HOUR } from '@/lib/ledger-guard';
import { JOURNEY_STEPS, JOURNEY_BASE, AGENT_ROLES_DOC_URL } from '@/lib/journey';

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
  // Purge readiness (read-only): every assetId currently stored, hidden ones included, ready to copy into an admin purge.
  let purgeReadiness: { eventCount: number; assetIds: string[]; assetIdsCsv: string; note: string } | { error: string };
  try {
    const snap = await readLedger(500, true);
    const assetIds = [...new Set(snap.events.map((e) => e.assetId))];
    purgeReadiness = {
      eventCount: snap.count,
      assetIds,
      assetIdsCsv: assetIds.join(','),
      note: 'Nothing has been purged. To purge, an admin calls DELETE /api/v1/ledger/commit?assetId=<comma-separated ids, max 20>&purge=1 with the x-admin-secret header (LEDGER_ADMIN_SECRET). Irreversible. Lists the latest 500 events only.',
    };
  } catch {
    purgeReadiness = { error: 'ledger storage unavailable' };
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
      phaseLine: 'Phase 1 complete; Phase 2 (MCP + boundary) current; Phase 3 asset map and audit summary live.',
      phase: { phase1: 'complete', phase2: 'current (MCP + boundary)', phase3: 'surfaces live: asset map with per-asset domain timeline (GET /api/v1/ledger/assets) and audit summary with audit-status counts (GET /api/v1/audit/summary)' },
      purgeReadiness,
      journeySteps: JOURNEY_STEPS.map((j) => ({ ...j, primaryUrl: JOURNEY_BASE + j.primary, alsoUrls: j.also.map((a) => JOURNEY_BASE + a) })),
      agentRolesDoc: AGENT_ROLES_DOC_URL,
      economicBenefit: {
        capture: 'optional form on /workbench/pilot and on /workbench/result',
        storage: 'browser localStorage by default, keyed by run id; not sent to the server unless the customer presses the opt-in "Record benefit on ledger" button',
        ledgerOptIn: 'POST /api/v1/ledger/benefit commits one unsigned ECONOMIC_BENEFIT event on asset benefit_<runId> (signatureStatus unverified, selfReported true, verified false); append-only, only an admin can purge it; the generic commit endpoint rejects this domain',
        trust: 'self-reported by the customer; not verified by the engine',
        evidencePack: 'included as self_reported_economic_benefit in the exported evidence pack when present, with its ledger tx hash if the customer also recorded it on the ledger',
      },
      journeyIndicator: 'compact four-step indicator on /workbench/result (step 1 no run, 2 goal not met, 3 eligible run, 4 self-reported benefit saved in this browser), and the same indicator on /workbench/pilot',
      demoHints: [
        { label: 'Workspace (asset map and audit summary blocks; add ?demo=1 for the anchor dry-run)', url: 'https://shiyan-dap.vercel.app/workbench/workspace' },
        { label: 'Asset map (JSON)', url: 'https://shiyan-dap.vercel.app/api/v1/ledger/assets' },
        { label: 'Audit summary (JSON)', url: 'https://shiyan-dap.vercel.app/api/v1/audit/summary' },
      ],
      looseEnds: [
        'The 8 original test events are still in the ledger. They can be purged per asset with LEDGER_ADMIN_SECRET (admin hard-purge); they have not been purged. The exact assetIds are listed in purgeReadiness.',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
