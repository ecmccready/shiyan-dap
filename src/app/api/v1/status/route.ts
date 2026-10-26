import { NextResponse } from 'next/server';
import { workbenchRegistry } from '@/plugins';
import { ledgerSummary } from '@/lib/ledger-commit';
import { LEDGER_WRITES_PER_HOUR } from '@/lib/ledger-guard';

export const dynamic = 'force-dynamic';

/**
 * Read-only system status: plugins, ledger summary, and which secrets are configured (booleans only,
 * never values). Two cheap Redis reads at most.
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
  return NextResponse.json(
    {
      ok: true,
      plugins,
      pluginCount: plugins.length,
      ledger,
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
        { type: 'wallet', note: 'EIP-191 personal_sign, basic check; wallet_verified or wallet_unverified with a reason' },
      ],
      limits: { ledgerWritesPerIpPerHour: LEDGER_WRITES_PER_HOUR },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
