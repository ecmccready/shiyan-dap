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
  /** Per-recipient view: planned (Stripe intent created), settled_internal (micro-ledger) or queued (nothing external). */
  recipients: SettlementRecipient[];
}

export interface SettlementRecipient {
  account: string;
  percentage: number;
  amountCents?: number;
  status: 'planned' | 'settled_internal' | 'queued';
}

/** Event-level record of what a Stripe settlement plans to pay out. Transfers are NOT executed. */
export interface PlannedTransfer {
  account: string;
  amountCents: number;
  status: 'planned';
}

export const TRANSFERS_FUTURE_WORK = 'actual Stripe Transfer/Connect calls to recipients are future work; only the PaymentIntent and planned_transfers are recorded';

function recipientsOf(splits: SplitRule, status: SettlementRecipient['status'], amountCents?: number): SettlementRecipient[] {
  const amounts = amountCents && Number.isInteger(amountCents) && amountCents > 0 ? planTransfers(splits, amountCents) : null;
  return splits.map((x, i) => ({
    account: x.account,
    percentage: x.percentage,
    ...(amounts ? { amountCents: amounts[i].amountCents } : {}),
    status,
  }));
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
    return { ...base, status: 'SETTLED_INTERNAL', recipients: recipientsOf(i.splits, 'settled_internal', i.amountCents), amountCents: i.amountCents, note: 'settled internally on the micro-ledger; no external payment' };
  }
  if (i.rail === 'X_MONEY') {
    return { ...base, status: 'QUEUED', recipients: recipientsOf(i.splits, 'queued', i.amountCents), reason: 'x_money_not_integrated', note: 'queued: no X Money integration exists in this repo yet' };
  }
  const queued = (reason: string, note: string): SettlementIntent => ({ ...base, status: 'QUEUED', reason, note, amountCents: i.amountCents, currency: i.currency, recipients: recipientsOf(i.splits, 'queued', i.amountCents) });
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
      recipients: recipientsOf(i.splits, 'planned', i.amountCents),
      note: `Stripe PaymentIntent ${pi.id} created (${key.startsWith('sk_live_') ? 'live' : 'test'} mode, unconfirmed); ${TRANSFERS_FUTURE_WORK}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return queued('stripe_error', `queued: Stripe call failed (${msg.slice(0, 160)})`);
  }
}

/** The event-level planned_transfers array: only when a Stripe PaymentIntent exists. */
export function plannedTransfersOf(s: SettlementIntent | null): PlannedTransfer[] | undefined {
  if (!s || s.status !== 'CREATED') return undefined;
  return s.recipients.filter((r) => r.amountCents !== undefined).map((r) => ({ account: r.account, amountCents: r.amountCents as number, status: 'planned' as const }));
}
