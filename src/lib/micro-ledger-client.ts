import type { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';

export type LedgerStateInput = Omit<LedgerEventPayload, 'eventId' | 'timestamp' | 'signature'> & {
  signature?: string;
};

/** Adds eventId + timestamp, then POSTs the state record to /api/v1/ledger/commit. Never throws. */
export async function recordLedgerState(
  input: LedgerStateInput,
  baseUrl = '',
): Promise<LedgerRecordResponse> {
  const payload: LedgerEventPayload = {
    ...input,
    eventId: crypto.randomUUID(),
    signature: input.signature ?? 'unsigned',
    timestamp: Date.now(),
  };
  try {
    const res = await fetch(`${baseUrl}/api/v1/ledger/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as LedgerRecordResponse;
  } catch {
    return { txHash: '', status: 'FAILED', settlementRail: 'INTERNAL_MICRO' };
  }
}
