/**
 * Shape validator for an incoming `aethel.marketplace.listings.v1` index (pure; no network, no storage, no writes).
 *
 * validatePeerListingIndex() takes an already-parsed value that the caller hands in. It never fetches anything and
 * is not called by any route or page. A valid result means "well-formed", NOT "verified": nothing here checks
 * that the numbers are true, that the sequence works, or that the sender is who it claims to be. Reuse of any
 * listing still passes the run page's permitted-action check and replay vet.
 *
 * It returns a sanitized copy built field by field: unknown top-level and listing fields are dropped, so future
 * additive fields do not break it and are not carried along.
 *
 * validatePeerIndexSource() is a future gate only: nothing calls it at request time.
 */
import { LISTINGS_SCHEMA, reuseHref, type ListingsIndex, type MarketplaceListing } from "@/lib/marketplace/listings";
import { ERROR_SURFACE_SCHEMA, type ErrorAxis, type ErrorSurface, type ErrorSurfaceAxis } from "@/lib/marketplace/error-surface";
import { RUN_ID_RE, PEER_STATUS_READY, PEER_STATUS_NOT_READY } from "@/lib/marketplace/peer";
import { isValidPeerUrl } from "@/lib/marketplace/peers";

export const PEER_INDEX_NOTE =
  "Shape check only: well-formed does not mean verified, attested or reusable. Reuse still passes the run page's permitted-action check and replay vet.";
export const PEER_INDEX_MAX_LISTINGS = 500;
export const PEER_INDEX_MAX_SEQUENCE = 200;
export const PEER_INDEX_MAX_ERRORS = 20;

const HANDOFF_PREFIX = "/workbench/autonomous?reuse=";
const SOURCE_LISTINGS_SUFFIX = "/api/marketplace/listings";
const AXES: readonly ErrorAxis[] = ["accuracy", "tensor_distance", "latency", "cost", "safety"];

export type PeerIndexResult =
  | { ok: true; index: ListingsIndex; warnings: string[] }
  | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const isStr = (v: unknown): v is string => typeof v === "string";

class Errors {
  list: string[] = [];
  push(msg: string): void { if (this.list.length < PEER_INDEX_MAX_ERRORS) this.list.push(msg); }
  get full(): boolean { return this.list.length >= PEER_INDEX_MAX_ERRORS; }
  get any(): boolean { return this.list.length > 0; }
}

function checkSurface(v: unknown, phi: number, at: string, errs: Errors): ErrorSurface | null {
  if (!isObj(v)) { errs.push(`${at}: must be an object`); return null; }
  const before = errs.list.length;
  if (v.schema_version !== ERROR_SURFACE_SCHEMA) errs.push(`${at}.schema_version: must be ${ERROR_SURFACE_SCHEMA}`);
  if (v.ranking_key !== "phi") errs.push(`${at}.ranking_key: must be "phi"`);
  if (!isStr(v.note)) errs.push(`${at}.note: must be a string`);
  const p = v.primary;
  if (!isObj(p) || p.axis !== "phi") errs.push(`${at}.primary.axis: must be "phi"`);
  else if (!isNum(p.value) || p.value !== phi) errs.push(`${at}.primary.value: must equal phi`);
  const axes: ErrorSurfaceAxis[] = [];
  if (!Array.isArray(v.axes)) errs.push(`${at}.axes: must be an array`);
  else if (v.axes.length > AXES.length * 2) errs.push(`${at}.axes: too many entries`);
  else {
    v.axes.forEach((a, i) => {
      const aa = `${at}.axes[${i}]`;
      if (!isObj(a)) { errs.push(`${aa}: must be an object`); return; }
      const ok = errs.list.length;
      if (!AXES.includes(a.axis as ErrorAxis)) errs.push(`${aa}.axis: unknown axis`);
      if (a.status !== "measured" && a.status !== "placeholder") errs.push(`${aa}.status: must be "measured" or "placeholder"`);
      if (!isNumOrNull(a.value)) errs.push(`${aa}.value: must be a finite number or null`);
      else if (a.status === "placeholder" && a.value !== null) errs.push(`${aa}: a placeholder axis must have value null`);
      else if (a.status === "measured" && a.value === null) errs.push(`${aa}: a measured axis must have a value`);
      if (!isStr(a.note)) errs.push(`${aa}.note: must be a string`);
      if (errs.list.length === ok) axes.push({ axis: a.axis as ErrorAxis, value: a.value as number | null, status: a.status as ErrorSurfaceAxis["status"], note: a.note as string });
    });
  }
  if (errs.list.length > before) return null;
  return {
    schema_version: ERROR_SURFACE_SCHEMA,
    primary: { axis: "phi", value: phi },
    axes,
    ranking_key: "phi",
    note: v.note as string,
  };
}

function checkListing(v: unknown, i: number, errs: Errors): MarketplaceListing | null {
  const at = `listings[${i}]`;
  if (!isObj(v)) { errs.push(`${at}: must be an object`); return null; }
  const before = errs.list.length;
  if (!isStr(v.run_id) || !RUN_ID_RE.test(v.run_id)) errs.push(`${at}.run_id: must match ${RUN_ID_RE}`);
  if (!isStr(v.domain)) errs.push(`${at}.domain: must be a string`);
  if (v.domain_source !== "record" && v.domain_source !== "default") errs.push(`${at}.domain_source: must be "record" or "default"`);
  if (!isNum(v.final_e)) errs.push(`${at}.final_e: must be a finite number`);
  for (const k of ["baseline_e", "e0", "delta_e", "tensor_distance"] as const) {
    if (!isNumOrNull(v[k])) errs.push(`${at}.${k}: must be a finite number or null`);
  }
  const phiOk = isNum(v.phi) && v.phi > 0;
  if (!phiOk) errs.push(`${at}.phi: must be a finite number above 0`);
  if (!isStr(v.verified_at) || !Number.isFinite(Date.parse(v.verified_at))) errs.push(`${at}.verified_at: must be a parseable date string`);
  let seqOk = false;
  if (!Array.isArray(v.sequence) || v.sequence.length === 0) errs.push(`${at}.sequence: must be a non-empty array`);
  else if (v.sequence.length > PEER_INDEX_MAX_SEQUENCE) errs.push(`${at}.sequence: more than ${PEER_INDEX_MAX_SEQUENCE} items`);
  else if (!v.sequence.every((y) => isStr(y) && y.length > 0)) errs.push(`${at}.sequence: items must be non-empty strings`);
  else seqOk = true;
  if (!isStr(v.reuse_href) || !v.reuse_href.startsWith(HANDOFF_PREFIX)) errs.push(`${at}.reuse_href: must be a relative path starting with ${HANDOFF_PREFIX}`);
  else if (isStr(v.run_id) && RUN_ID_RE.test(v.run_id) && v.reuse_href !== reuseHref(v.run_id)) errs.push(`${at}.reuse_href: must equal ${HANDOFF_PREFIX}<run_id>`);
  if (!isStr(v.peer_handoff_path) || v.peer_handoff_path !== v.reuse_href) errs.push(`${at}.peer_handoff_path: must equal reuse_href`);
  if (typeof v.peer_ready !== "boolean") errs.push(`${at}.peer_ready: must be a boolean`);
  else if (v.peer_status !== (v.peer_ready ? PEER_STATUS_READY : PEER_STATUS_NOT_READY)) {
    errs.push(`${at}.peer_status: must be "${PEER_STATUS_READY}" when peer_ready is true, else "${PEER_STATUS_NOT_READY}"`);
  }
  const li = v.license_intent;
  if (!isObj(li) || typeof li.allowed !== "boolean" || !isNum(li.threshold) || !isStr(li.reason)) {
    errs.push(`${at}.license_intent: must be {allowed: boolean, threshold: number, reason: string}`);
  }
  const surface = phiOk ? checkSurface(v.error_surface, v.phi as number, `${at}.error_surface`, errs) : (errs.push(`${at}.error_surface: not checked because phi is invalid`), null);
  if (errs.list.length > before || !seqOk || !surface) return null;
  const l = li as Obj;
  return {
    run_id: v.run_id as string,
    domain: v.domain as string,
    domain_source: v.domain_source as "record" | "default",
    final_e: v.final_e as number,
    baseline_e: v.baseline_e as number | null,
    e0: v.e0 as number | null,
    delta_e: v.delta_e as number | null,
    phi: v.phi as number,
    verified_at: v.verified_at as string,
    sequence: [...(v.sequence as string[])],
    reuse_href: v.reuse_href as string,
    license_intent: { allowed: l.allowed as boolean, threshold: l.threshold as number, reason: l.reason as string },
    tensor_distance: v.tensor_distance as number | null,
    error_surface: surface,
    peer_ready: v.peer_ready as boolean,
    peer_status: v.peer_status as MarketplaceListing["peer_status"],
    peer_handoff_path: v.peer_handoff_path as string,
  };
}

/**
 * Check the shape of an already-parsed listings index. Never throws, never fetches. Collects up to
 * PEER_INDEX_MAX_ERRORS errors. `ok: true` means well-formed only (see PEER_INDEX_NOTE).
 */
export function validatePeerListingIndex(input: unknown): PeerIndexResult {
  const errs = new Errors();
  try {
    if (!isObj(input)) return { ok: false, errors: ["index: must be an object"] };
    if (input.schema !== LISTINGS_SCHEMA) errs.push(`schema: must be ${LISTINGS_SCHEMA}`);
    if (!isStr(input.notice)) errs.push("notice: must be a string");
    if (!isStr(input.peers_note)) errs.push("peers_note: must be a string");
    if (!isNum(input.license_intent_phi_min)) errs.push("license_intent_phi_min: must be a finite number");
    if (!Array.isArray(input.listings)) {
      errs.push("listings: must be an array");
      return { ok: false, errors: errs.list };
    }
    const raw = input.listings;
    if (raw.length > PEER_INDEX_MAX_LISTINGS) {
      errs.push(`listings: more than ${PEER_INDEX_MAX_LISTINGS} entries`);
      return { ok: false, errors: errs.list };
    }
    if (!Number.isInteger(input.count) || (input.count as number) < 0) errs.push("count: must be an integer >= 0");
    else if (input.count !== raw.length) errs.push(`count: ${String(input.count)} does not equal listings.length ${raw.length}`);
    const listings: MarketplaceListing[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < raw.length && !errs.full; i++) {
      const l = checkListing(raw[i], i, errs);
      if (!l) continue;
      if (seen.has(l.run_id)) errs.push(`listings[${i}].run_id: duplicate run_id ${l.run_id}`);
      seen.add(l.run_id);
      listings.push(l);
    }
    const ready = raw.filter((x) => isObj(x) && x.peer_ready === true).length;
    if (!Number.isInteger(input.peer_ready_count)) errs.push("peer_ready_count: must be an integer");
    else if (input.peer_ready_count !== ready) errs.push(`peer_ready_count: ${String(input.peer_ready_count)} does not equal the ${ready} listings with peer_ready true`);
    if (errs.any) return { ok: false, errors: errs.list };
    const warnings: string[] = [];
    for (let i = 1; i < listings.length; i++) {
      if (listings[i].phi > listings[i - 1].phi) { warnings.push(`listings are not ranked by phi descending (first out of order at index ${i})`); break; }
    }
    return {
      ok: true,
      index: {
        schema: LISTINGS_SCHEMA,
        count: listings.length,
        license_intent_phi_min: input.license_intent_phi_min as number,
        peer_ready_count: input.peer_ready_count as number,
        peers_note: input.peers_note as string,
        notice: input.notice as string,
        listings,
      },
      warnings,
    };
  } catch {
    return { ok: false, errors: [...errs.list, "index: could not be read safely"].slice(0, PEER_INDEX_MAX_ERRORS) };
  }
}

/**
 * Future gate for where a peer index could be read from: whatever isValidPeerUrl() accepts (https, public host, no
 * credentials), with no query or fragment, and a path that is empty, "/" or ends with /api/marketplace/listings.
 * Nothing calls this at request time; this node never fetches a peer.
 */
export function validatePeerIndexSource(url: unknown): boolean {
  if (!isValidPeerUrl(url)) return false;
  let u: URL;
  try { u = new URL(url as string); } catch { return false; }
  if (u.search || u.hash) return false;
  return u.pathname === "" || u.pathname === "/" || u.pathname.endsWith(SOURCE_LISTINGS_SUFFIX);
}
