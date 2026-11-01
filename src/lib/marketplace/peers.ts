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
import { GLOBAL_SNAPSHOT_SCHEMA } from "@/lib/diagnostics/global-snapshot";

export const PEERS_SCHEMA = "aethel.marketplace.peers.v1" as const;
export const SELF_ID = "self" as const;
export const SELF_INDEX_PATH = "/workbench/marketplace";
export const SELF_LISTINGS_PATH = "/api/marketplace/listings";
export const PLACEHOLDER_NOTE = "placeholder — not a live node; no endpoint registered";
export const PEERS_REGISTRY_NOTE =
  "Static registry for now: this node plus placeholders. No discovery protocol, no cross-node trust, nothing attested. This node never fetches peer endpoints; reuse of any listing still passes the run page's permitted-action check and replay vet.";

export const HANDOFF_PATH_TEMPLATE = "/workbench/autonomous?reuse={run_id}";
export const GLOBAL_SNAPSHOT_PATH = "/api/diagnostics/global-snapshot";
/** Additive: shareable, read-only view surfaces (URL query state only; packs are clipboard-only, nothing is sent). */
export const VIEW_SURFACES = {
  lookback_view_path: "/workbench/status",
  lookback_view_param_prefix: "lb_",
  medicare_view_path: "/workbench/medicare",
  medicare_view_param_prefix: "m_",
  evidence_packs: "handoff,compare,summary,verdict,progress,statuses",
  view_surfaces_note: "Shareable view URLs restore display state only (filters, sort, panels). Packs are copied to the local clipboard; this node serves no pack API and stores nothing.",
} as const;
export const VIEW_SURFACES_SCHEMA = "aethel.view_surfaces.v1";
/** Pure: pick only the VIEW_SURFACES keys from a capabilities object (missing keys omitted). */
export function pickViewSurfaces(caps: Record<string, unknown>): { schema: string } & Partial<Record<keyof typeof VIEW_SURFACES, string>> {
  const out: { schema: string } & Partial<Record<keyof typeof VIEW_SURFACES, string>> = { schema: VIEW_SURFACES_SCHEMA };
  for (const k of Object.keys(VIEW_SURFACES) as (keyof typeof VIEW_SURFACES)[]) {
    const v = caps[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
/** Pure (check path): like pickViewSurfaces but keeps present VIEW_SURFACES keys with their raw value/type, so validateViewSurfaces hard-fails a present non-string instead of warning it as missing. */
export function pickViewSurfacesRaw(caps: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { schema: VIEW_SURFACES_SCHEMA };
  for (const k of Object.keys(VIEW_SURFACES)) if (k in caps && caps[k] !== undefined) out[k] = caps[k];
  return out;
}
/** Pure: shape check for an `aethel.view_surfaces.v1` object. Wrong schema / non-object / non-string field = error; missing field = warning. No fetch, no writes. */
export function validateViewSurfaces(json: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, errors: ["view surfaces: expected a JSON object"], warnings };
  const o = json as Record<string, unknown>;
  if (o.schema !== VIEW_SURFACES_SCHEMA) errors.push(`schema: expected "${VIEW_SURFACES_SCHEMA}"`);
  for (const k of Object.keys(VIEW_SURFACES)) {
    if (!(k in o) || o[k] === undefined) warnings.push(`${k}: missing (soft-compat)`);
    else if (typeof o[k] !== "string") errors.push(`${k}: expected string`);
  }
  // Soft-compat: present string paths/prefixes that differ from this node's expected values only warn.
  for (const k of ["lookback_view_path", "medicare_view_path"] as const) {
    const v = o[k]; if (typeof v !== "string") continue;
    const want = VIEW_SURFACES[k];
    if (v !== want && v !== `${want}/`) warnings.push(`${k}: expected "${want}" (soft-compat)`);
  }
  for (const k of ["lookback_view_param_prefix", "medicare_view_param_prefix"] as const) {
    const v = o[k]; if (typeof v === "string" && v !== VIEW_SURFACES[k]) warnings.push(`${k}: expected "${VIEW_SURFACES[k]}" (soft-compat)`);
  }
  { const v = o.evidence_packs;
    if (typeof v === "string") {
      const have = new Set(v.split(",").map((t) => t.trim()).filter(Boolean));
      if (have.size === 0) warnings.push("evidence_packs: empty (soft-compat)");
      else { const miss = VIEW_SURFACES.evidence_packs.split(",").filter((t) => !have.has(t));
        if (miss.length) warnings.push(`evidence_packs: missing ${miss.join(",")} (soft-compat)`); }
    } }
  return { ok: errors.length === 0, errors, warnings };
}
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
  /** Additive: read-only Global · misdiagnosis snapshot this node serves. */
  global_snapshot_schema: typeof GLOBAL_SNAPSHOT_SCHEMA;
  global_snapshot_path: string;
  /** Additive: shareable view surfaces (see VIEW_SURFACES). */
  lookback_view_path: string;
  lookback_view_param_prefix: string;
  medicare_view_path: string;
  medicare_view_param_prefix: string;
  evidence_packs: string;
  view_surfaces_note: string;
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
      global_snapshot_schema: GLOBAL_SNAPSHOT_SCHEMA,
      global_snapshot_path: GLOBAL_SNAPSHOT_PATH,
      ...VIEW_SURFACES,
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