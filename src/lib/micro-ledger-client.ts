import { LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';

export async function recordLedgerState(
  payload: Omit<LedgerEventPayload, 'eventId' | 'timestamp'>
): Promise<LedgerRecordResponse> {
  const event: LedgerEventPayload = {
    ...payload,
    eventId: `evt_${crypto.randomUUID()}`,
    timestamp: Date.now(),
  };

  const response = await fetch('/api/v1/ledger/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Ledger commit failed: ${response.statusText}`);
  }

  return response.json();
}
