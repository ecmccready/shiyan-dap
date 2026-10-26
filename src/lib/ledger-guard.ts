import { ledgerRedis } from '@/lib/ledger-commit';

/** Per-IP write budget for the public ledger endpoints (per hour). */
export const LEDGER_WRITES_PER_HOUR = 20;
const g = globalThis as unknown as { __ledgerRl?: Map<string, number> };

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}

/** Returns true if this write is allowed. Uses Redis when configured, else per-instance memory. */
export async function allowLedgerWrite(req: Request, scope = 'rl'): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const key = `ledger:${scope}:${clientIp(req)}:${bucket}`;
  try {
    const r = ledgerRedis();
    if (r) {
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, 3700);
      return n <= LEDGER_WRITES_PER_HOUR;
    }
  } catch {
    return true; // never block on a limiter outage
  }
  const m = (g.__ledgerRl ??= new Map());
  const n = (m.get(key) ?? 0) + 1;
  m.set(key, n);
  return n <= LEDGER_WRITES_PER_HOUR;
}
