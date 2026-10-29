/**
 * Route-content contract checker for the two public marketplace JSON routes (pure: no fetch, no I/O, no writes).
 *
 * Why it exists: GET /api/marketplace/listings once returned the peers registry (a route file was overwritten) and
 * status-code-only checks passed, because both routes answer 200. checkRouteContract() looks at the schema and shape
 * of what a route returned, and says plainly when one route's content turns up on the other.
 *
 *   "listings" -> the cross-route guard, then validatePeerListingIndex() (peer-index.ts).
 *   "peers"    -> the peers registry shape (peers.ts constants).
 *
 * A pass is a shape check only: well-formed, not verified, attested or trusted.
 *
 * URL rule for the peers registry (kept simple): placeholders must have null URLs. The self entry's URLs may be null,
 * a relative path starting with a single "/", or an http(s) URL without credentials, query or fragment (http and
 * localhost are allowed because buildPeerRegistry builds them from the request origin). Any other non-placeholder
 * entry's URL must pass isValidPeerUrl (https, public host).
 */
import { LISTINGS_SCHEMA, LICENSE_INTENT_PHI_MIN } from "@/lib/marketplace/listings";
import { validatePeerListingIndex } from "@/lib/marketplace/peer-index";
import { PEERS_SCHEMA, HANDOFF_PATH_TEMPLATE, SELF_ATTESTATION, GLOBAL_SNAPSHOT_PATH, isValidPeerUrl, type PeerCapabilities } from "@/lib/marketplace/peers";
import { GLOBAL_SNAPSHOT_SCHEMA } from "@/lib/diagnostics/global-snapshot";

export type RouteName = "peers" | "listings";
export type RouteContractResult = { ok: true; warnings: string[] } | { ok: false; errors: string[] };

export const ROUTE_CONTRACT_NOTE =
  "Shape check only: a passing route contract means well-formed and the right route's content, not verified, attested or trusted.";
export const ROUTE_CONTRACT_MAX_ERRORS = 20;
const MAX_PEERS = 100;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";

const WRONG_ON_LISTINGS = "this looks like the peers registry, not a listings index (wrong route content)";
const WRONG_ON_PEERS = "this looks like a listings index, not the peers registry (wrong route content)";

function selfUrlOk(v: string): boolean {
  if (v.startsWith("/")) return !v.startsWith("//") && !/\s/.test(v);
  let u: URL;
  try { u = new URL(v); } catch { return false; }
  return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password && !u.search && !u.hash && !!u.hostname;
}

function checkCapabilities(c: unknown, at: string, push: (m: string) => void): void {
  if (!isObj(c)) { push(`${at}: must be an object`); return; }
  const want: Obj = {
    listings_schema: LISTINGS_SCHEMA,
    peers_schema: PEERS_SCHEMA,
    handoff_path_template: HANDOFF_PATH_TEMPLATE,
    license_intent_phi_min: LICENSE_INTENT_PHI_MIN,
    read_only: true,
    writes: "none",
    cross_node_trust: "none",
    attestation: SELF_ATTESTATION,
    global_snapshot_schema: GLOBAL_SNAPSHOT_SCHEMA,
    global_snapshot_path: GLOBAL_SNAPSHOT_PATH,
  };
  for (const k of Object.keys(want)) if (c[k] !== want[k]) push(`${at}.${k}: must equal ${JSON.stringify(want[k])}`);
  for (const k of Object.keys(c)) if (!(k in want)) push(`${at}.${k}: unknown capability`);
}

function checkPeers(input: unknown): RouteContractResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const push = (m: string) => { if (errors.length < ROUTE_CONTRACT_MAX_ERRORS) errors.push(m); };
  if (!isObj(input)) return { ok: false, errors: ["peers: must be an object"] };
  if (input.schema === LISTINGS_SCHEMA || (Array.isArray(input.listings) && !Array.isArray(input.peers))) {
    return { ok: false, errors: [WRONG_ON_PEERS] };
  }
  if (input.schema_version !== PEERS_SCHEMA) push(`schema_version: must be ${PEERS_SCHEMA}`);
  if (!isStr(input.self_id) || input.self_id.length === 0) push("self_id: must be a non-empty string");
  if (!isStr(input.note)) push("note: must be a string");
  const peers = input.peers;
  if (!Array.isArray(peers) || peers.length === 0) { push("peers: must be a non-empty array"); return { ok: false, errors }; }
  if (peers.length > MAX_PEERS) { push(`peers: more than ${MAX_PEERS} entries`); return { ok: false, errors }; }
  const seen = new Set<string>();
  for (let i = 0; i < peers.length && errors.length < ROUTE_CONTRACT_MAX_ERRORS; i++) {
    const p = peers[i];
    const at = `peers[${i}]`;
    if (!isObj(p)) { push(`${at}: must be an object`); continue; }
    for (const k of ["id", "name", "role", "status", "note"] as const) if (!isStr(p[k])) push(`${at}.${k}: must be a string`);
    for (const k of ["index_url", "listings_url"] as const) if (p[k] !== null && !isStr(p[k])) push(`${at}.${k}: must be a string or null`);
    if (isStr(p.id)) { if (seen.has(p.id)) push(`${at}.id: duplicate id ${p.id}`); seen.add(p.id); }
    const isSelf = i === 0;
    if (isSelf) {
      if (p.id !== input.self_id) push(`${at}.id: the first entry must be self_id`);
      if (p.role !== "self") push(`${at}.role: the first entry must have role "self"`);
      if (p.status !== "this_node") push(`${at}.status: the first entry must have status "this_node"`);
      for (const k of ["index_url", "listings_url"] as const) {
        if (isStr(p[k]) && !selfUrlOk(p[k] as string)) push(`${at}.${k}: must be a relative path or an http(s) URL without credentials, query or fragment`);
      }
      if (p.capabilities === undefined) warnings.push("self has no capabilities object");
      else checkCapabilities(p.capabilities, `${at}.capabilities`, push);
    } else {
      if (p.id === input.self_id) push(`${at}.id: only the first entry may be self_id`);
      if (p.role === "self") push(`${at}.role: only the first entry may have role "self"`);
      if (p.capabilities !== undefined) push(`${at}.capabilities: only the self entry may carry capabilities`);
      if (p.role === "placeholder") {
        if (p.status !== "placeholder") push(`${at}.status: a placeholder must have status "placeholder"`);
        if (p.index_url !== null || p.listings_url !== null) push(`${at}: a placeholder must have null URLs`);
      } else {
        for (const k of ["index_url", "listings_url"] as const) if (isStr(p[k]) && !isValidPeerUrl(p[k])) push(`${at}.${k}: must pass the peer URL gate (https, public host)`);
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, warnings };
}

/** Check that `input` is well-formed content for the named route. Never throws; never fetches. */
export function checkRouteContract(route: RouteName, input: unknown): RouteContractResult {
  try {
    if (route === "listings") {
      if (isObj(input) && (input.schema_version === PEERS_SCHEMA || (Array.isArray(input.peers) && !Array.isArray(input.listings)))) {
        return { ok: false, errors: [WRONG_ON_LISTINGS] };
      }
      const r = validatePeerListingIndex(input);
      return r.ok ? { ok: true, warnings: r.warnings } : { ok: false, errors: r.errors };
    }
    if (route === "peers") return checkPeers(input);
    return { ok: false, errors: ['route: must be "peers" or "listings"'] };
  } catch {
    return { ok: false, errors: [`${String(route)}: could not be read safely`] };
  }
}

/** Plain-text report (pure). Exit 0 when the contract holds (warnings allowed), 1 when it does not. */
export function formatRouteContractReport(route: RouteName, result: RouteContractResult): { lines: string[]; exitCode: 0 | 1 } {
  const lines: string[] = [ROUTE_CONTRACT_NOTE];
  if (result.ok) {
    lines.push(`OK: ${route} contract holds`);
    for (const w of result.warnings) lines.push(`warning: ${w}`);
    return { lines, exitCode: 0 };
  }
  for (const e of result.errors) lines.push(`error: ${e}`);
  return { lines, exitCode: 1 };
}

export const CAPABILITIES_NOTE =
  "Shape check only: matching capabilities are self-reported by the node, not verified, attested or trusted.";

export type CapabilitiesResult = { ok: true; capabilities: PeerCapabilities; source: "capabilities" | "registry" } | { ok: false; errors: string[] };

/**
 * Check a self capabilities object against this node's exact constants (pure, never throws). Accepts either the
 * capabilities object itself or a full peers registry, in which case the entry whose id is self_id is used.
 */
export function validatePeerCapabilities(input: unknown): CapabilitiesResult {
  try {
    if (!isObj(input)) return { ok: false, errors: ["capabilities: must be an object"] };
    if (input.schema === LISTINGS_SCHEMA || Array.isArray(input.listings)) return { ok: false, errors: ["capabilities: this looks like a listings index, not capabilities or a peers registry"] };
    let caps: unknown = input;
    let source: "capabilities" | "registry" = "capabilities";
    if (Array.isArray(input.peers) || input.schema_version !== undefined) {
      source = "registry";
      if (input.schema_version !== PEERS_SCHEMA || !Array.isArray(input.peers)) return { ok: false, errors: [`registry: schema_version must be ${PEERS_SCHEMA} with a peers array`] };
      const self = input.peers.find((p) => isObj(p) && p.id === input.self_id);
      if (!isObj(self)) return { ok: false, errors: ["registry: no entry matches self_id"] };
      if (self.capabilities === undefined) return { ok: false, errors: ["registry: the self entry has no capabilities"] };
      caps = self.capabilities;
    }
    const errors: string[] = [];
    const push = (m: string) => { if (errors.length < ROUTE_CONTRACT_MAX_ERRORS) errors.push(m); };
    checkCapabilities(caps, "capabilities", push);
    if (errors.length > 0) return { ok: false, errors };
    const c = caps as PeerCapabilities;
    return {
      ok: true,
      source,
      capabilities: {
        listings_schema: c.listings_schema, peers_schema: c.peers_schema, handoff_path_template: c.handoff_path_template,
        license_intent_phi_min: c.license_intent_phi_min, read_only: true, writes: "none", cross_node_trust: "none",
        attestation: c.attestation, global_snapshot_schema: c.global_snapshot_schema, global_snapshot_path: c.global_snapshot_path,
      },
    };
  } catch {
    return { ok: false, errors: ["capabilities: could not be read safely"] };
  }
}

/** Plain-text report (pure). Exit 0 when the capabilities match, 1 when not. */
export function formatCapabilitiesReport(result: CapabilitiesResult): { lines: string[]; exitCode: 0 | 1 } {
  const lines = [CAPABILITIES_NOTE];
  if (result.ok) {
    lines.push(`OK: capabilities match (${result.source === "registry" ? "from the peers registry self entry" : "capabilities object"}; ${Object.keys(result.capabilities).length} fields)`);
    return { lines, exitCode: 0 };
  }
  for (const e of result.errors) lines.push(`error: ${e}`);
  return { lines, exitCode: 1 };
}
