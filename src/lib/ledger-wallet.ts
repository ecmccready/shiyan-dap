import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalLedgerString } from '@/lib/ledger-signing';
import { parseSiweMessage, type SiweParse } from '@/lib/ledger-siwe';

export type WalletCheck =
  | { ok: true; address: string; message: string; siwe?: SiweParse }
  | { ok: false; reason: string; address?: string; siwe?: SiweParse };

const HEX = /^(0x)?[0-9a-fA-F]+$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** EIP-191 personal_sign: recovers the signer address of `message` from a 65-byte r||s||v signature. */
export function recoverPersonalSignAddress(message: string, signatureHex: string): string {
  const raw = signatureHex.replace(/^0x/, '');
  if (raw.length !== 130) throw new Error('signature_wrong_length');
  const sig = hexToBytes(raw);
  const v = sig[64] >= 27 ? sig[64] - 27 : sig[64];
  if (v !== 0 && v !== 1) throw new Error('signature_bad_recovery_id');
  const msgBytes = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const preimage = new Uint8Array(prefix.length + msgBytes.length);
  preimage.set(prefix, 0);
  preimage.set(msgBytes, prefix.length);
  const hash = keccak_256(preimage);
  const recovered = new Uint8Array(65);
  recovered[0] = v;
  recovered.set(sig.slice(0, 64), 1);
  const pub = secp256k1.recoverPublicKey(recovered, hash, { prehash: false });
  const uncompressed = secp256k1.Point.fromBytes(pub).toBytes(false);
  return `0x${bytesToHex(keccak_256(uncompressed.slice(1)).slice(-20))}`;
}

/**
 * Basic wallet signature check (EIP-191 personal_sign, not full SIWE). The signed message is the event's
 * canonical string (`assetId|domain|timestamp|metadataHash`), or a client `walletMessage` that must
 * CONTAIN that canonical string so a signature cannot be replayed onto another event. The signature is
 * hex (0x optional, 65 bytes). `walletAddress` is the address the client claims; without it nothing can be
 * verified (a recovered address alone proves nothing). Contract wallets (EIP-1271) are not supported.
 *
 * Optional `siweMessage`: a SIWE-style (EIP-4361) text. It is the signed message (it takes precedence over
 * `walletMessage`) and must still contain the canonical string, for example in its statement. It is parsed and the
 * parse (fields and structural issues) is returned as `siwe`. That parse is informational: the verification
 * outcome is still the EIP-191 recovery check over the exact text; full SIWE verification is not implemented.
 */
export function verifyWalletSignature(
  parts: { assetId: string; domain: string; timestamp?: number; metadataHash: string },
  signature: string,
  opts: { walletAddress?: string; walletMessage?: string; siweMessage?: string },
): WalletCheck {
  const siwe = opts.siweMessage !== undefined ? parseSiweMessage(opts.siweMessage, { claimedAddress: opts.walletAddress }) : undefined;
  const withSiwe = <T extends object>(r: T): T & { siwe?: SiweParse } => (siwe ? { ...r, siwe } : r);
  if (!HEX.test(signature)) return withSiwe({ ok: false as const, reason: 'signature_not_hex' });
  if (signature.replace(/^0x/, '').length !== 130) return withSiwe({ ok: false as const, reason: 'signature_wrong_length (expected 65 bytes, 130 hex chars)' });
  if (parts.timestamp === undefined) return withSiwe({ ok: false as const, reason: 'timestamp_required_to_bind_signature_to_event' });
  const canonical = canonicalLedgerString({ ...parts, timestamp: parts.timestamp });
  const message = opts.siweMessage ?? opts.walletMessage ?? canonical;
  if (!message.includes(canonical)) return withSiwe({ ok: false as const, reason: `${opts.siweMessage !== undefined ? 'siweMessage' : 'walletMessage'}_must_contain_the_canonical_string` });
  let address: string;
  try {
    address = recoverPersonalSignAddress(message, signature);
  } catch (e) {
    return withSiwe({ ok: false as const, reason: e instanceof Error && /^signature_/.test(e.message) ? e.message : 'signature_recovery_failed' });
  }
  if (!opts.walletAddress) return withSiwe({ ok: false as const, reason: 'walletAddress_missing (recovered address cannot be checked)', address });
  if (!ADDRESS.test(opts.walletAddress)) return withSiwe({ ok: false as const, reason: 'walletAddress_invalid', address });
  if (address.toLowerCase() !== opts.walletAddress.toLowerCase()) return withSiwe({ ok: false as const, reason: 'address_mismatch', address });
  return withSiwe({ ok: true as const, address, message });
}
