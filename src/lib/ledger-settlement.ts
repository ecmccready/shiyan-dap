import type { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';

export type SettlementRail = LedgerRecordResponse['settlementRail'];
export type SplitRule = NonNullable<LedgerEventPayload['stateData']['splitRule']>;

export interface SettlementIntent {
  rail: SettlementRail;
  /** SETTLED_INTERNAL: marked on the micro-ledger only. CREATED: a Stripe object exists. QUEUED: nothing external happened. */
  status: 'SETTLED_INTERNAL' | 'QUEUED' | 'CREATED';
  splits: SplitRule;
  createdAt: number;
  note: string;
  /** Machine-readable queue reason, e.g. stripe_key_missing. */
  reason?: string;
  /** External provider object id, e.g. a Stripe PaymentIntent id (pi_...). */
  providerId?: string;
  amountCents?: number;
  currency?: string;
  /** Per-recipient amounts in cents (sums to amountCents; rounding remainder goes to the last recipient). */
  plannedTransfers?: Array<{ account: string; amountCents: number }>;
}

export interface SettlementInput {
  rail: SettlementRail;
  splits: SplitRule;
  txHash: string;
  assetId: string;
  signatureVerified: boolean;
  amountCents?: number;
  currency?: string;
}

const MAX_CENTS = 1_000_000; // $10,000 sanity cap per commit

export function planTransfers(splits: SplitRule, amountCents: number) {
  let used = 0;
  return splits.map((s, i) => {
    const cents = i === splits.length - 1 ? amountCents - used : Math.round((amountCents * s.percentage) / 100);
    used += cents;
    return { account: s.account, amountCents: cents };
  });
}

/**
 * Settlement hook.
 * - INTERNAL_MICRO: settled internally.
 * - STRIPE: creates ONE unconfirmed PaymentIntent for the total (no charge happens; metadata carries the
 *   splits) only when STRIPE_SECRET_KEY is set, the commit's signature is verified, an amount is given,
 *   and (for sk_live keys) LEDGER_SIGNING_SECRET is set so "verified" means something. Otherwise it stays
 *   QUEUED with a reason. Money is not distributed to recipients: transfers are only planned.
 * - X_MONEY: no integration exists in this repo, so it stays QUEUED (x_money_not_integrated).
 */
export async function resolveSettlement(i: SettlementInput): Promise<SettlementIntent> {
  const base = { rail: i.rail, splits: i.splits, createdAt: Date.now() };
  if (i.rail === 'INTERNAL_MICRO') {
    return { ...base, status: 'SETTLED_INTERNAL', note: 'settled internally on the micro-ledger; no external payment' };
  }
  if (i.rail === 'X_MONEY') {
    return { ...base, status: 'QUEUED', reason: 'x_money_not_integrated', note: 'queued: no X Money integration exists in this repo yet' };
  }
  const queued = (reason: string, note: string): SettlementIntent => ({ ...base, status: 'QUEUED', reason, note, amountCents: i.amountCents, currency: i.currency });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return queued('stripe_key_missing', 'queued: STRIPE_SECRET_KEY is not set (stripe_key_missing)');
  if (!i.amountCents || !Number.isInteger(i.amountCents) || i.amountCents < 50 || i.amountCents > MAX_CENTS) {
    return queued('amount_missing_or_invalid', `queued: settlementAmountCents must be an integer from 50 to ${MAX_CENTS}`);
  }
  if (!i.signatureVerified) return queued('signature_unverified', 'queued: Stripe is only called for commits with a verified signature');
  if (key.startsWith('sk_live_') && !process.env.LEDGER_SIGNING_SECRET) {
    return queued('live_key_requires_signing_secret', 'queued: a live Stripe key needs LEDGER_SIGNING_SECRET set so signatures prove origin');
  }
  const currency = (i.currency ?? 'usd').toLowerCase();
  const plannedTransfers = planTransfers(i.splits, i.amountCents);
  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(key);
    const pi = await stripe.paymentIntents.create(
      {
        amount: i.amountCents,
        currency,
        automatic_payment_methods: { enabled: true },
        transfer_group: i.txHash,
        description: `Micro-ledger settlement for ${i.assetId}`,
        metadata: { ledger_tx: i.txHash, asset_id: i.assetId, splits: JSON.stringify(i.splits).slice(0, 480) },
      },
      { idempotencyKey: `ledger_${i.txHash}` },
    );
    return {
      ...base,
      status: 'CREATED',
      providerId: pi.id,
      amountCents: i.amountCents,
      currency,
      plannedTransfers,
      note: `Stripe PaymentIntent ${pi.id} created (${key.startsWith('sk_live_') ? 'live' : 'test'} mode, unconfirmed); transfers to recipients are planned, not executed`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return { ...queued('stripe_error', `queued: Stripe call failed (${msg.slice(0, 160)})`), plannedTransfers };
  }
}
