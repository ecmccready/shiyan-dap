import { createClient } from "redis";
import type { LedgerRow } from "@/lib/b-loop";
import { rows as memRows, writeRow as memWrite } from "@/lib/b-loop";

const KEY = "shiyan:ledger:rows";

function redisUrl() {
  return (
    process.env.REDIS_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ""
  );
}

export function kvEnabled() {
  return Boolean(redisUrl());
}

async function withRedis<T>(fn: (c: ReturnType<typeof createClient>) => Promise<T>) {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("no REDIS_URL");
  const client = createClient({ url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

export async function loadRows(): Promise<LedgerRow[]> {
  if (!process.env.REDIS_URL) return memRows();
  const raw = await withRedis((c) => c.get(KEY));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LedgerRow[];
  } catch {
    return [];
  }
}

export async function appendRow(row: LedgerRow): Promise<LedgerRow[]> {
  if (!process.env.REDIS_URL) return memWrite(row);
  return withRedis(async (c) => {
    const raw = await c.get(KEY);
    const current: LedgerRow[] = raw ? JSON.parse(raw) : [];
    const next = [row, ...current].slice(0, 50);
    await c.set(KEY, JSON.stringify(next));
    return next;
  });
}