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
  /** Always false: full SIWE verification is not implemented. */
  fullVerification: false;
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
