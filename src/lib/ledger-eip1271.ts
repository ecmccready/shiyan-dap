import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * EIP-1271 contract-wallet signature check through a JSON-RPC provider.
 *
 *   function isValidSignature(bytes32 _hash, bytes _signature) external view returns (bytes4 magicValue);
 *   selector 0x1626ba7e; a valid signature returns 0x1626ba7e (left-aligned in the 32-byte return word).
 *
 * `_hash` here is the EIP-191 personal_sign hash of the signed text (keccak256("\x19Ethereum Signed Message:\n" + len + text)),
 * which is what Safe and most contract wallets verify for personal_sign. Wallets that sign an EIP-712 wrapper of the hash
 * (for example a Safe message hash) are not covered. Limits: one `eth_call` at `latest` on the single chain the RPC URL
 * serves (ETH_RPC_URL, https only); ERC-6492 (undeployed wallets) is not handled; the result is only as trustworthy as the
 * RPC provider; no retries. The RPC URL is server configuration and is never taken from a request.
 */
export const EIP1271_MAGIC = '0x1626ba7e';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const MAX_SIG_HEX = 8192;

export type Eip1271Result =
  | { status: 'eip1271_verified'; reason: string }
  | { status: 'eip1271_failed'; reason: string }
  | { status: 'eip1271_unsupported'; reason: string };

export function personalSignHashHex(message: string): string {
  const m = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${m.length}`);
  const buf = new Uint8Array(prefix.length + m.length);
  buf.set(prefix, 0);
  buf.set(m, prefix.length);
  return bytesToHex(keccak_256(buf));
}

/** ABI-encodes isValidSignature(bytes32,bytes) calldata. */
export function encodeIsValidSignature(hashHex: string, signatureHex: string): string {
  const sig = signatureHex.replace(/^0x/, '').toLowerCase();
  const padded = sig.padEnd(Math.ceil(sig.length / 64) * 64, '0');
  const len = (sig.length / 2).toString(16).padStart(64, '0');
  return `${EIP1271_MAGIC}${hashHex.padStart(64, '0')}${'40'.padStart(64, '0')}${len}${padded}`;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`rpc_http_${res.status}`);
  const j = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(`rpc_error: ${String(j.error.message ?? 'unknown').slice(0, 120)}`);
  return j.result;
}

export function eip1271RpcUrl(): string | undefined {
  const u = (process.env.ETH_RPC_URL ?? '').trim();
  return /^https:\/\//i.test(u) ? u : undefined;
}

/** Never throws. `chainId` (from the SIWE message, if any) must equal the RPC's eth_chainId. */
export async function verifyEip1271(args: { address?: string; message: string; signature: string; chainId?: number; rpcUrl?: string }): Promise<Eip1271Result> {
  const url = args.rpcUrl ?? eip1271RpcUrl();
  if (!url) return { status: 'eip1271_unsupported', reason: 'eip1271_unsupported (no RPC configured: set ETH_RPC_URL to an https JSON-RPC endpoint to enable isValidSignature checks)' };
  if (!args.address || !ADDRESS.test(args.address)) return { status: 'eip1271_failed', reason: 'walletAddress_missing_or_invalid (the contract wallet address is required)' };
  const sig = args.signature.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]*$/.test(sig) || sig.length === 0 || sig.length % 2 !== 0) return { status: 'eip1271_failed', reason: 'signature_not_hex' };
  if (sig.length > MAX_SIG_HEX) return { status: 'eip1271_failed', reason: `signature_too_long (max ${MAX_SIG_HEX / 2} bytes)` };
  try {
    if (args.chainId !== undefined) {
      const cid = Number(BigInt(String(await rpc(url, 'eth_chainId', []))));
      if (cid !== args.chainId) return { status: 'eip1271_failed', reason: `chain_mismatch (message chain ${args.chainId}, RPC serves chain ${cid})` };
    }
    const data = encodeIsValidSignature(personalSignHashHex(args.message), sig);
    const out = String(await rpc(url, 'eth_call', [{ to: args.address, data }, 'latest']) ?? '').toLowerCase();
    if (out.startsWith(EIP1271_MAGIC)) return { status: 'eip1271_verified', reason: 'isValidSignature returned the EIP-1271 magic value' };
    if (out === '0x' || out === '') return { status: 'eip1271_failed', reason: 'empty_return (no contract code at the address, or it does not implement isValidSignature)' };
    return { status: 'eip1271_failed', reason: `isValidSignature_did_not_return_magic_value (${out.slice(0, 10)})` };
  } catch (e) {
    return { status: 'eip1271_failed', reason: e instanceof Error ? e.message.slice(0, 160) : 'rpc_failed' };
  }
}
