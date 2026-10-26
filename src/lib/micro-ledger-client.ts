import type { LedgerEventPayload, LedgerRecordResponse } from "@/types/ledger";

/** POSTs a state record to the micro-ledger commit endpoint. Never throws. */
export async function recordLedgerState(
  payload: LedgerEventPayload,
  baseUrl = "",
): Promise<LedgerRecordResponse> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/ledger/commit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as LedgerRecordResponse;
    return data;
  } catch (err) {
    return {
      ok: false,
      txHash: "",
      recordedAt: new Date().toISOString(),
      mock: true,
      error: err instanceof Error ? err.message : "ledger commit failed",
    };
  }
}
