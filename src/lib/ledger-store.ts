import { kv } from "@vercel/kv";
import type { LedgerRow } from "@/lib/b-loop";
import { rows as memRows, writeRow as memWrite } from "@/lib/b-loop";

const KEY = "shiyan:ledger:rows";

function hasKv() {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

export async function loadRows(): Promise<LedgerRow[]> {
  if (!hasKv()) return memRows();
  const stored = await kv.get<LedgerRow[]>(KEY);
  return stored || [];
}

export async function appendRow(row: LedgerRow): Promise<LedgerRow[]> {
  if (!hasKv()) return memWrite(row);
  const current = (await kv.get<LedgerRow[]>(KEY)) || [];
  const next = [row, ...current].slice(0, 50);
  await kv.set(KEY, next);
  return next;
}

export function kvEnabled() {
  return hasKv();
}