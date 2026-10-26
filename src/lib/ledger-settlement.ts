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
  /** planned: no transfer made (see transferSkipped). transferred: a Stripe Transfer exists. transfer_failed: Stripe rejected it. */
  status: 'planned' | 'settled_internal' | 'queued' | 'transferred' | 'transfer_failed';
  transferId?: string;
  /** Why no Transfer was attempted: not_connect_account, live_transfers_disabled, zero_amount. */
  transferSkipped?: string;
  transferError?: string;
}

/** Event-level record of a Stripe settlement's per-recipient payout. */
export interface PlannedTransfer {
  account: string;
  amountCents: number;
  status: 'planned' | 'transferred' | 'transfer_failed';
  transferId?: string;
  transferSkipped?: string;
  transferError?: string;
}

export const TRANSFERS_NOTE =
  'Stripe Transfers are made only to Connect account ids (acct_...), in test mode, with an explicit amount, drawing on the platform balance (the PaymentIntent is unconfirmed, so no payment backs them). Other recipients stay planned with transferSkipped. Live-mode transfers are off unless LEDGER_ENABLE_LIVE_TRANSFERS=1.';
export const TRANSFERS_FUTURE_WORK = TRANSFERS_NOTE;

const CONNECT_ID = /^acct_[A-Za-z0-9]{8,}$/;

async function makeStripe(key: string) {
  const { default: Stripe } = await import('stripe');
  // Test hook: STRIPE_API_BASE_URL (e.g. http://127.0.0.1:12111) points a TEST key at a local mock. Ignored for live keys.
  const base = key.startsWith('sk_test_') ? process.env.STRIPE_API_BASE_URL : undefined;
  if (base) {
    const u = new URL(base);
    return new Stripe(key, { host: u.hostname, port: u.port || '80', protocol: u.protocol.replace(':', '') as 'http' | 'https' });
  }
  return new Stripe(key);
}

async function transferToRecipients(
  stripe: Awaited<ReturnType<typeof makeStripe>>,
  recipients: SettlementRecipient[],
  ctx: { live: boolean; currency: string; txHash: string; assetId: string },
): Promise<SettlementRecipient[]> {
  const out: SettlementRecipient[] = [];
  for (let n = 0; n < recipients.length; n++) {
    const r = recipients[n];
    if (!CONNECT_ID.test(r.account)) {
      out.push({ ...r, transferSkipped: 'not_connect_account' });
    } else if (!r.amountCents || r.amountCents < 1) {
      out.push({ ...r, transferSkipped: 'zero_amount' });
    } else if (ctx.live && process.env.LEDGER_ENABLE_LIVE_TRANSFERS !== '1') {
      out.push({ ...r, transferSkipped: 'live_transfers_disabled' });
    } else {
      try {
        const t = await stripe.transfers.create(
          {
            amount: r.amountCents,
            currency: ctx.currency,
            destination: r.account,
            transfer_group: ctx.txHash,
            description: `Micro-ledger split for ${ctx.assetId}`,
            metadata: { ledger_tx: ctx.txHash, asset_id: ctx.assetId },
          },
          { idempotencyKey: `ledger_${ctx.txHash}_t${n}` },
        );
        out.push({ ...r, status: 'transferred', transferId: t.id });
      } catch (e) {
        out.push({ ...r, status: 'transfer_failed', transferError: (e instanceof Error ? e.message : 'unknown error').slice(0, 160) });
      }
    }
  }
  return out;
}

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
 *   QUEUED with a reason. After the intent, Connect recipients (acct_...) get a Stripe Transfer in test mode only.
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
    const stripe = await makeStripe(key);
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
    const live = !key.startsWith('sk_test_');
    const recipients = await transferToRecipients(stripe, recipientsOf(i.splits, 'planned', i.amountCents), { live, currency, txHash: i.txHash, assetId: i.assetId });
    const done = recipients.filter((r) => r.status === 'transferred').length;
    return {
      ...base,
      status: 'CREATED',
      providerId: pi.id,
      amountCents: i.amountCents,
      currency,
      recipients,
      note: `Stripe PaymentIntent ${pi.id} created (${live ? 'live' : 'test'} mode, unconfirmed); ${done} of ${recipients.length} recipient transfers made. ${TRANSFERS_NOTE}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return queued('stripe_error', `queued: Stripe call failed (${msg.slice(0, 160)})`);
  }
}

/** The event-level planned_transfers array: only when a Stripe PaymentIntent exists. */
export function plannedTransfersOf(s: SettlementIntent | null): PlannedTransfer[] | undefined {
  if (!s || s.status !== 'CREATED') return undefined;
  return s.recipients
    .filter((r) => r.amountCents !== undefined)
    .map((r) => ({
      account: r.account,
      amountCents: r.amountCents as number,
      status: (r.status === 'transferred' || r.status === 'transfer_failed' ? r.status : 'planned') as PlannedTransfer['status'],
      ...(r.transferId ? { transferId: r.transferId } : {}),
      ...(r.transferSkipped ? { transferSkipped: r.transferSkipped } : {}),
      ...(r.transferError ? { transferError: r.transferError } : {}),
    }));
}
