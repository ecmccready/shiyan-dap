import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
/**
 * Minimal EIP-4361 (SIWE) message parser. Structure only: it parses and sanity-checks the fields, it does NOT
 * verify the domain against this host, nonce freshness or replay, expiry enforcement, or chainId policy, and it
 * does not do EIP-1271 contract-wallet checks. Pure and client-bundle-safe.
 *
 * Expected shape (statement optional):
 *   ${domain} wants you to sign in with your Ethereum account:
 *   ${address}
 *
 *   ${statement}
 *
 *   URI: ${uri}
 *   Version: 1
 *   Chain ID: 1
 *   Nonce: ${nonce}
 *   Issued At: ${ISO 8601}
 */
export interface SiweFields {
  domain: string;
  address: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: number;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}
export interface SiweParse {
  /** True when the text had the SIWE header and address lines and fields could be read. */
  parsed: boolean;
  /** True when parsed and no structural issue was found. Informational only. */
  structureValid: boolean;
  fields?: SiweFields;
  issues: string[];
  /** Always false: full SIWE verification is not implemented (see cryptoVerified for what is checked). */
  fullVerification: false;
  /**
   * True only when a signature was cryptographically checked server-side AND the address in the message is the address that
   * signed it AND the signed bytes are exactly the siweMessage text. Does not cover domain, nonce, expiry or chain policy
   * (see structureValid and policy), so it is not full SIWE verification. Set by the commit pipeline; never client input.
   */
  cryptoVerified?: boolean;
  crypto?: SiweCrypto;
  /** Result of the host, freshness and nonce policy checks (set by applySiwePolicy and the nonce claim). */
  policy?: SiwePolicy;
}
export interface SiweCrypto {
  /** 'eip191' (recovery of an EOA signature) or 'eip1271' (a contract wallet accepted the signature via eth_call). */
  method: 'eip191' | 'eip1271';
  signatureValid: boolean;
  /** EIP-191 only: the address recovered from the signature (null for eip1271, where nothing is recoverable). */
  recoveredAddress: string | null;
  /** The address line inside the message equals the recovered address (eip191) or the claimed contract address (eip1271). */
  messageAddressMatches: boolean;
  /** The signature was checked over exactly the siweMessage bytes the server stored (the siweMessage takes precedence over walletMessage). */
  signedExactText: boolean;
  /** EIP-55 mixed-case checksum of the message address: valid, invalid, or not_checksummed (all lower or upper case). Informational. */
  addressChecksum: 'valid' | 'invalid' | 'not_checksummed';
}

export interface SiwePolicy {
  expectedDomains: string[];
  domainMatches: boolean;
  /** Seconds between issuedAt and now (negative when issuedAt is in the future); null if unparseable. */
  issuedAtAgeSeconds: number | null;
  issuedAtFresh: boolean;
  /** 'fresh' = first use in the replay window, 'replayed' = seen before, 'unchecked' = not claimed (signature not verified, bad nonce, or store unavailable). */
  nonce: 'fresh' | 'replayed' | 'unchecked';
  /** 'server_issued' = the nonce came from GET /api/v1/siwe/nonce and was consumed by this commit; 'not_issued' = unknown, expired or already used (legacy client nonce); 'unchecked' = not looked up. */
  nonceSource: 'server_issued' | 'not_issued' | 'unchecked';
  maxAgeSeconds: number;
  /** Chain policy: the message's Chain ID against the allowed list. null when the message has no usable chainId. */
  chainAllowed: boolean | null;
  allowedChainIds: number[];
  /** true only with SIWE_ENFORCE_CHAIN=1: a disallowed chain then adds the `chain_not_allowed` issue; otherwise the result is informational. */
  chainEnforced: boolean;
}

export const DEFAULT_SIWE_CHAIN_IDS = [1, 137];
export interface SiweChainPolicy { allowed: number[]; enforce: boolean }
/** SIWE_ALLOWED_CHAIN_IDS (comma separated integers, default "1,137") and SIWE_ENFORCE_CHAIN=1. */
export function siweChainPolicyFromEnv(): SiweChainPolicy {
  const ids = (process.env.SIWE_ALLOWED_CHAIN_IDS ?? '').split(',').map((x) => x.trim()).filter((x) => /^\d{1,12}$/.test(x)).map(Number);
  return { allowed: ids.length ? [...new Set(ids)] : DEFAULT_SIWE_CHAIN_IDS, enforce: process.env.SIWE_ENFORCE_CHAIN === '1' };
}

/** issuedAt must be at most this old. */
export const SIWE_MAX_AGE_SECONDS = 600;
/** Allowed clock skew for an issuedAt slightly ahead of the server clock. */
export const SIWE_FUTURE_SKEW_SECONDS = 60;
/** How long a verified nonce is remembered: the max age plus skew, rounded up, so a message cannot be replayed while still fresh. */
export const SIWE_NONCE_TTL_SECONDS = 900;

/**
 * Host, freshness and nonce-format policy on top of the structural parse. Adds issues (`domain_not_allowed`,
 * `issued_at_in_future`, `issued_at_too_old`, `not_before_in_future`) and a `policy` block. Nonce replay is
 * decided separately (it needs storage) via `withNonceResult`. Informational like the rest of the parse.
 */
export function applySiwePolicy(parse: SiweParse, opts: { expectedDomains: string[]; now?: number; chainPolicy?: SiweChainPolicy }): SiweParse {
  const now = opts.now ?? Date.now();
  const chain = opts.chainPolicy ?? siweChainPolicyFromEnv();
  const expected = opts.expectedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  const policy: SiwePolicy = {
    expectedDomains: expected,
    domainMatches: false,
    issuedAtAgeSeconds: null,
    issuedAtFresh: false,
    nonce: 'unchecked',
    nonceSource: 'unchecked',
    maxAgeSeconds: SIWE_MAX_AGE_SECONDS,
    chainAllowed: null,
    allowedChainIds: chain.allowed,
    chainEnforced: chain.enforce,
  };
  if (!parse.parsed || !parse.fields) return { ...parse, policy };
  const issues = [...parse.issues];
  const f = parse.fields;
  policy.domainMatches = expected.includes(f.domain.toLowerCase());
  if (!policy.domainMatches) issues.push(expected.length ? `domain_not_allowed (${f.domain} is not one of: ${expected.join(', ')})` : 'domain_not_allowed (no expected domain is known for this request)');
  if (typeof f.chainId === 'number' && Number.isFinite(f.chainId)) {
    policy.chainAllowed = chain.allowed.includes(f.chainId);
    if (!policy.chainAllowed && chain.enforce) issues.push(`chain_not_allowed (chain ${f.chainId} is not one of: ${chain.allowed.join(', ')})`);
  }
  const t = f.issuedAt ? Date.parse(f.issuedAt) : NaN;
  if (!Number.isNaN(t)) {
    const age = Math.round((now - t) / 1000);
    policy.issuedAtAgeSeconds = age;
    if (age < -SIWE_FUTURE_SKEW_SECONDS) issues.push(`issued_at_in_future (${-age}s ahead)`);
    else if (age > SIWE_MAX_AGE_SECONDS) issues.push(`issued_at_too_old (${age}s old, max ${SIWE_MAX_AGE_SECONDS}s)`);
    else policy.issuedAtFresh = true;
  }
  if (f.notBefore) {
    const nb = Date.parse(f.notBefore);
    if (!Number.isNaN(nb) && nb > now + SIWE_FUTURE_SKEW_SECONDS * 1000) issues.push('not_before_in_future');
  }
  return { ...parse, issues, structureValid: issues.length === 0, policy };
}

/** Records the nonce replay result. A replay adds the `nonce_replayed` issue. */
export function withNonceResult(parse: SiweParse, nonce: SiwePolicy['nonce']): SiweParse {
  if (!parse.policy) return parse;
  const issues = nonce === 'replayed' ? [...parse.issues, 'nonce_replayed (this address and nonce were already used in a verified commit within the replay window)'] : parse.issues;
  return { ...parse, issues, structureValid: issues.length === 0, policy: { ...parse.policy, nonce } };
}

const HEADER = /^(.+) wants you to sign in with your Ethereum account:$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DOMAIN = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseSiweMessage(text: string, opts: { claimedAddress?: string; now?: number } = {}): SiweParse {
  const fail = (issue: string): SiweParse => ({ parsed: false, structureValid: false, issues: [issue], fullVerification: false });
  const lines = text.split('\n');
  const h = HEADER.exec(lines[0] ?? '');
  if (!h) return fail('not_siwe_format: missing "<domain> wants you to sign in with your Ethereum account:" header');
  if (lines.length < 3 || lines[2] !== '') return fail('not_siwe_format: expected the address on line 2 followed by a blank line');
  const fields: SiweFields = { domain: h[1], address: lines[1] };
  const issues: string[] = [];
  let i = 3;
  if (lines[i] === '') {
    i += 1; // no statement
  } else if (lines[i] !== undefined && !/^URI: /.test(lines[i])) {
    fields.statement = lines[i];
    if (lines[i + 1] !== '') issues.push('missing_blank_line_after_statement');
    i += 2;
  }
  const tags = new Map<string, string>();
  const resources: string[] = [];
  let inResources = false;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (inResources && l.startsWith('- ')) {
      resources.push(l.slice(2));
      continue;
    }
    const m = /^([A-Za-z ]+):(?: (.*))?$/.exec(l);
    if (!m) {
      issues.push(`unrecognized_line: ${l.slice(0, 40)}`);
      continue;
    }
    if (m[1] === 'Resources') inResources = true;
    else tags.set(m[1], m[2] ?? '');
  }
  fields.uri = tags.get('URI');
  fields.version = tags.get('Version');
  fields.nonce = tags.get('Nonce');
  fields.issuedAt = tags.get('Issued At');
  fields.expirationTime = tags.get('Expiration Time');
  fields.notBefore = tags.get('Not Before');
  fields.requestId = tags.get('Request ID');
  if (resources.length) fields.resources = resources;
  const cid = tags.get('Chain ID');
  if (cid !== undefined) fields.chainId = /^\d{1,12}$/.test(cid) ? Number(cid) : NaN;

  if (!DOMAIN.test(fields.domain)) issues.push('domain_invalid');
  if (!ADDRESS.test(fields.address)) issues.push('address_invalid');
  else if (opts.claimedAddress && opts.claimedAddress.toLowerCase() !== fields.address.toLowerCase()) issues.push('address_differs_from_walletAddress');
  if (!fields.uri) issues.push('uri_missing');
  if (fields.version === undefined) issues.push('version_missing');
  else if (fields.version !== '1') issues.push('version_not_1');
  if (cid === undefined) issues.push('chain_id_missing');
  else if (!Number.isFinite(fields.chainId)) issues.push('chain_id_not_integer');
  if (!fields.nonce) issues.push('nonce_missing');
  else if (!/^[A-Za-z0-9]{8,}$/.test(fields.nonce)) issues.push('nonce_invalid (need 8 or more alphanumeric characters)');
  if (!fields.issuedAt) issues.push('issued_at_missing');
  else if (!ISO.test(fields.issuedAt) || Number.isNaN(Date.parse(fields.issuedAt))) issues.push('issued_at_not_iso_8601');
  if (fields.expirationTime) {
    const t = Date.parse(fields.expirationTime);
    if (Number.isNaN(t)) issues.push('expiration_time_not_iso_8601');
    else if (t < (opts.now ?? Date.now())) issues.push('expired');
  }
  return { parsed: true, structureValid: issues.length === 0, fields, issues, fullVerification: false };
}

/**
 * Records whether the nonce was issued by this server (GET /api/v1/siwe/nonce) and consumed. A not-issued nonce is
 * accepted for backward compatibility; with `requireIssued` it adds the `nonce_not_server_issued` issue.
 */
export function withNonceSource(parse: SiweParse, source: SiwePolicy['nonceSource'], requireIssued = false): SiweParse {
  if (!parse.policy) return parse;
  const issues = source === 'not_issued' && requireIssued ? [...parse.issues, 'nonce_not_server_issued (fetch a nonce from GET /api/v1/siwe/nonce)'] : parse.issues;
  return { ...parse, issues, structureValid: issues.length === 0, policy: { ...parse.policy, nonceSource: source } };
}


/** EIP-55 checksum state of a 0x address. All-lowercase and all-uppercase are 'not_checksummed' (allowed by EIP-55 but not by strict SIWE). */
export function eip55State(address: string): SiweCrypto['addressChecksum'] {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return 'invalid';
  const body = address.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return 'not_checksummed';
  const hash = bytesToHex(keccak_256(utf8ToBytes(body.toLowerCase())));
  for (let i = 0; i < 40; i++) {
    const c = body[i];
    if (/[a-f]/i.test(c) && (parseInt(hash[i], 16) >= 8) !== (c === c.toUpperCase())) return 'invalid';
  }
  return 'valid';
}

/** Adds the cryptographic result to a parse. cryptoVerified requires a valid signature, address agreement and exact text. */
export function withCrypto(parse: SiweParse, c: Omit<SiweCrypto, 'addressChecksum' | 'messageAddressMatches'> & { signerAddress: string | null }): SiweParse {
  const msgAddr = parse.fields?.address ?? '';
  const matches = parse.parsed && !!c.signerAddress && msgAddr.toLowerCase() === c.signerAddress.toLowerCase();
  const crypto: SiweCrypto = { method: c.method, signatureValid: c.signatureValid, recoveredAddress: c.recoveredAddress, messageAddressMatches: matches, signedExactText: c.signedExactText, addressChecksum: eip55State(msgAddr) };
  return { ...parse, crypto, cryptoVerified: parse.parsed && c.signatureValid && matches && c.signedExactText };
}
