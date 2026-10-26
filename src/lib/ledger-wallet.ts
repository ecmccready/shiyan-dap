import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalLedgerString } from '@/lib/ledger-signing';

export type WalletCheck =
  | { ok: true; address: string; message: string }
  | { ok: false; reason: string; address?: string };

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
 */
export function verifyWalletSignature(
  parts: { assetId: string; domain: string; timestamp?: number; metadataHash: string },
  signature: string,
  opts: { walletAddress?: string; walletMessage?: string },
): WalletCheck {
  if (!HEX.test(signature)) return { ok: false, reason: 'signature_not_hex' };
  if (signature.replace(/^0x/, '').length !== 130) return { ok: false, reason: 'signature_wrong_length (expected 65 bytes, 130 hex chars)' };
  if (parts.timestamp === undefined) return { ok: false, reason: 'timestamp_required_to_bind_signature_to_event' };
  const canonical = canonicalLedgerString({ ...parts, timestamp: parts.timestamp });
  const message = opts.walletMessage ?? canonical;
  if (!message.includes(canonical)) return { ok: false, reason: 'walletMessage_must_contain_the_canonical_string' };
  let address: string;
  try {
    address = recoverPersonalSignAddress(message, signature);
  } catch (e) {
    return { ok: false, reason: e instanceof Error && /^signature_/.test(e.message) ? e.message : 'signature_recovery_failed' };
  }
  if (!opts.walletAddress) return { ok: false, reason: 'walletAddress_missing (recovered address cannot be checked)', address };
  if (!ADDRESS.test(opts.walletAddress)) return { ok: false, reason: 'walletAddress_invalid', address };
  if (address.toLowerCase() !== opts.walletAddress.toLowerCase()) return { ok: false, reason: 'address_mismatch', address };
  return { ok: true, address, message };
}
