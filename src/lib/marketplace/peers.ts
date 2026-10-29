/**
 * Static peer registry for the marketplace (pure, display only: no network, no storage, no writes).
 *
 * This is NOT a discovery protocol. It is a fixed list: this node plus clearly labelled placeholders. Nothing here
 * contacts another node, and nothing in it is verified, attested or trusted across nodes. The server never fetches
 * a peer endpoint, and the page only renders links a person can open.
 *
 * isValidPeerUrl() is the gate any future non-self entry must pass before it can be added to the list (https
 * only, no credentials, no localhost or private/link-local addresses). It is not called on a peer at request time.
 */
import { LISTINGS_SCHEMA, LICENSE_INTENT_PHI_MIN } from "@/lib/marketplace/listings";

export const PEERS_SCHEMA = "aethel.marketplace.peers.v1" as const;
export const SELF_ID = "self" as const;
export const SELF_INDEX_PATH = "/workbench/marketplace";
export const SELF_LISTINGS_PATH = "/api/marketplace/listings";
export const PLACEHOLDER_NOTE = "placeholder — not a live node; no endpoint registered";
export const PEERS_REGISTRY_NOTE =
  "Static registry for now: this node plus placeholders. No discovery protocol, no cross-node trust, nothing attested. This node never fetches peer endpoints; reuse of any listing still passes the run page's permitted-action check and replay vet.";

export const HANDOFF_PATH_TEMPLATE = "/workbench/autonomous?reuse={run_id}";
export const SELF_ATTESTATION = "none — self-reported, not third-party attested";

/** Self-description of this node (self entry only). Self-reported; it is not verified or attested by anyone. */
export type PeerCapabilities = {
  listings_schema: typeof LISTINGS_SCHEMA;
  peers_schema: typeof PEERS_SCHEMA;
  handoff_path_template: string;
  license_intent_phi_min: number;
  read_only: true;
  writes: "none";
  cross_node_trust: "none";
  attestation: string;
};

export type PeerEntry = {
  id: string;
  name: string;
  role: "self" | "placeholder";
  status: "this_node" | "placeholder";
  index_url: string | null;
  listings_url: string | null;
  note: string;
  /** Present on the self entry only; placeholders never carry it. Additive, optional. */
  capabilities?: PeerCapabilities;
};

export type PeerRegistry = {
  schema_version: typeof PEERS_SCHEMA;
  peers: PeerEntry[];
  self_id: string;
  note: string;
};

/** Normalised http(s) origin without a trailing slash, or null when it is not a plain origin. */
export function normalizeOrigin(origin: unknown): string | null {
  if (typeof origin !== "string") return null;
  const s = origin.trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || !u.hostname) return null;
  if (u.search || u.hash) return null;
  if (u.pathname !== "/" && u.pathname !== "") return null;
  return u.origin;
}

/** Registry with this node first. Absolute URLs when `origin` is a valid http(s) origin, else relative paths. */
export function buildPeerRegistry(origin?: string | null): PeerRegistry {
  const base = normalizeOrigin(origin) ?? "";
  const self: PeerEntry = {
    id: SELF_ID,
    name: "This node",
    role: "self",
    status: "this_node",
    index_url: `${base}${SELF_INDEX_PATH}`,
    listings_url: `${base}${SELF_LISTINGS_PATH}`,
    note: "This node's own index of its verified runs.",
    capabilities: {
      listings_schema: LISTINGS_SCHEMA,
      peers_schema: PEERS_SCHEMA,
      handoff_path_template: HANDOFF_PATH_TEMPLATE,
      license_intent_phi_min: LICENSE_INTENT_PHI_MIN,
      read_only: true,
      writes: "none",
      cross_node_trust: "none",
      attestation: SELF_ATTESTATION,
    },
  };
  const placeholder = (id: string, name: string): PeerEntry => ({
    id, name, role: "placeholder", status: "placeholder", index_url: null, listings_url: null, note: PLACEHOLDER_NOTE,
  });
  return {
    schema_version: PEERS_SCHEMA,
    peers: [self, placeholder("peer-example-a", "Example peer A (placeholder)"), placeholder("peer-example-b", "Example peer B (placeholder)")],
    self_id: SELF_ID,
    note: PEERS_REGISTRY_NOTE,
  };
}

/**
 * Gate for future non-self peer URLs: https only, no credentials, a public-looking DNS name. Rejects localhost,
 * single-label and local/internal names, every IPv6 literal, and IPv4 literals in loopback, private, link-local,
 * CGNAT, unspecified or otherwise non-public ranges (the URL parser has already normalised decimal/hex forms).
 */
export function isValidPeerUrl(url: unknown): boolean {
  if (typeof url !== "string" || url.length === 0 || url.length > 2048 || /\s/.test(url)) return false;
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (host.startsWith("[") || host.includes(":")) return false; // IPv6 literal
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (/^[\d.]+$/.test(host)) return false; // malformed numeric host
  if (!host.includes(".")) return false; // localhost, single-label names
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(host)) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
}