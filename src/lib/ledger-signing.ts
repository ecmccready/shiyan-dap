import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal ledger signature stub: HMAC-SHA256 (hex) over the canonical string
 *   `${assetId}|${domain}|${timestamp}|${metadataHash}`
 * keyed with LEDGER_SIGNING_SECRET. If that variable is unset, a PUBLIC dev secret is used, so
 * signatures are then only a format/integrity check, not proof of origin.
 * TODO: replace with public-key or wallet signatures so clients never share a secret.
 */
const DEV_SECRET = 'shiyan-dev-ledger-signing-secret-not-for-production';

export function signingSecretMode(): 'env' | 'dev-default' {
  return process.env.LEDGER_SIGNING_SECRET ? 'env' : 'dev-default';
}

export function canonicalLedgerString(p: { assetId: string; domain: string; timestamp: number; metadataHash: string }): string {
  return `${p.assetId}|${p.domain}|${p.timestamp}|${p.metadataHash}`;
}

export function signLedger(p: Parameters<typeof canonicalLedgerString>[0]): string {
  return createHmac('sha256', process.env.LEDGER_SIGNING_SECRET || DEV_SECRET).update(canonicalLedgerString(p)).digest('hex');
}

export function verifyLedgerSignature(p: Parameters<typeof canonicalLedgerString>[0], signature: string): boolean {
  const expected = Buffer.from(signLedger(p), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time string compare for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
