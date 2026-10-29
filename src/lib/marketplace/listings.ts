/**
 * Φ Marketplace listing contract (pure, read-only).
 *
 * One listing per verified run, built from the same experience records the Adaptive Domains dropdown ranks
 * (GET /api/level4/experience). Nothing here fetches, writes, or touches the Level 4 loop.
 *
 * Definitions (same as the store and src/lib/level4/measured.ts):
 *   - A "sequence" is the ordered action list (y per iteration, 1..n contiguous) of one run_id. The store has
 *     no separate sequence ids, so the run_id is the sequence reference.
 *   - A run is listed only when it has a reusable record: isReusable() from durable-self.ts (eligible, state
 *     COMPLETE, Φ > 0, tensor distance within ε, ROE-eligible). So final e fell below the recorded cold baseline.
 *   - final_e   = e of the listed (last reusable) iteration.
 *   - baseline_e = the record's cold_e, the recorded cold Self() baseline.  Φ = baseline_e − final_e (> 0).
 *   - delta_e   = e0 − final_e, the store's recorded Δe, measured from the run's starting error e0.
 *     Δe and Φ use different baselines (start of run vs cold run); both are shown and neither is a currency amount.
 *   - Φ is each run's own value against its recorded cold baseline, not an independent cold run.
 */
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { isReusable, sequenceOf } from "@/lib/level4/durable-self";
import { errorSurfaceFor, rankKey, type ErrorSurface } from "@/lib/marketplace/error-surface";
import { peerStatus, PEERS_NOTE, type PeerStatus } from "@/lib/marketplace/peer";

export const LISTINGS_SCHEMA = "aethel.marketplace.listings.v1";
export const INTENT_SCHEMA = "aethel.marketplace.license_intent.v1";

/**
 * Φ above which "License intent" is offered. Policy placeholder, not a price: 0.01 is ten times the 0.001 display
 * precision of Φ (so rounding noise never qualifies) and sits just under the one value verified in production
 * today (Φ 0.014). Change it here only; the UI, JSON index and checks all read this constant.
 */
export const LICENSE_INTENT_PHI_MIN = 0.01;

export const NO_MONEY_NOTICE = "No money moves. Intent only.";
export const SETTLEMENT_NONE = "none — no money movement";
export const DEFAULT_DOMAIN = "level4 plant";

export type LicenseIntentGate = { allowed: boolean; threshold: number; reason: string };

export type MarketplaceListing = {
  /** The sequence reference: run_id of the verified run. */
  run_id: string;
  /** Domain label from the record's `system` field; "level4 plant" when the record has none. */
  domain: string;
  domain_source: "record" | "default";
  final_e: number;
  /** The record's cold baseline e (cold_e); null when the record did not store it. */
  baseline_e: number | null;
  /** Starting error of the run. */
  e0: number | null;
  /** e0 − final_e (the store's Δe); null when e0 is unknown. */
  delta_e: number | null;
  phi: number;
  verified_at: string;
  /** Ordered permitted actions, as recorded. Plain strings, no model-specific fields. */
  sequence: string[];
  /** Relative path; the run page still applies its replay vet and falls back with a reason. */
  reuse_href: string;
  license_intent: LicenseIntentGate;
  /** The record's tensor-check distance when stored; null otherwise. Additive field. */
  tensor_distance: number | null;
  /** Display-only multi-dimensional note (error-surface.ts). Φ remains the only ranking key. Additive field. */
  error_surface: ErrorSurface;
  /** Display-only peer flag (peer.ts). true = verified reusable sequence with a link-safe id; reuse still passes the run page's gates. Additive. */
  peer_ready: boolean;
  /** "available_for_reuse" when peer_ready, else "not_ready". Additive. */
  peer_status: PeerStatus["status"];
  /** Relative hand-off path (same as reuse_href); clients prefix their own origin. Additive. */
  peer_handoff_path: string;
};

export type ListingsIndex = {
  schema: typeof LISTINGS_SCHEMA;
  count: number;
  license_intent_phi_min: number;
  /** Listings with peer_ready true. Additive. */
  peer_ready_count: number;
  /** States that this is this node's own index only. Additive. */
  peers_note: string;
  notice: string;
  listings: MarketplaceListing[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const r3 = (n: number) => Number(n.toFixed(3));

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Parse the optional `?reuse=<run_id>` on the marketplace page (pure, read-only). Returns the run id only when it
 * is a plausibly valid id; otherwise null. Accepts a `location.search` string with or without the leading "?".
 */
export function parseReuseParam(search: string): string | null {
  const v = new URLSearchParams(search).get("reuse");
  return v !== null && RUN_ID_RE.test(v) ? v : null;
}

/** Where a `?reuse=` id points: the matching listing, or null when it is not a verified listing. */
export function findHighlighted(listings: MarketplaceListing[], reuseId: string | null): MarketplaceListing | null {
  return reuseId ? (listings.find((l) => l.run_id === reuseId) ?? null) : null;
}

export function reuseHref(runId: string): string {
  return `/workbench/autonomous?reuse=${encodeURIComponent(runId)}`;
}

export function licenseGate(phi: number, threshold: number = LICENSE_INTENT_PHI_MIN): LicenseIntentGate {
  return phi > threshold
    ? { allowed: true, threshold, reason: `Φ ${phi.toFixed(3)} exceeds the ${threshold} threshold` }
    : { allowed: false, threshold, reason: `Φ ${phi.toFixed(3)} does not exceed the ${threshold} threshold` };
}

/** Dedupe by (run_id, iteration), keeping the first, as the store does. */
function dedupe(list: ExperienceEntry[]): ExperienceEntry[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.run_id}:${x.iteration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Join and rank. One listing per run_id: its last reusable record (highest iteration) with a contiguous
 * action sequence. Ranked by Φ descending; on equal Φ the later verified_at wins, then the later record in the
 * list (the same "ties go to the later" rule as the durable feed). Pure: same input, same output.
 */
export function buildListings(
  list: ExperienceEntry[],
  threshold: number = LICENSE_INTENT_PHI_MIN
): MarketplaceListing[] {
  const entries = dedupe(list);
  const lastByRun = new Map<string, { x: ExperienceEntry; idx: number }>();
  entries.forEach((x, idx) => {
    if (!isReusable(x)) return;
    const prev = lastByRun.get(x.run_id);
    if (!prev || x.iteration >= prev.x.iteration) lastByRun.set(x.run_id, { x, idx });
  });
  const out: { l: MarketplaceListing; idx: number }[] = [];
  for (const { x, idx } of lastByRun.values()) {
    const sequence = sequenceOf(entries, x.run_id);
    if (!sequence || sequence.length !== x.iteration) continue;
    const finalE = x.e as number;
    const e0 = num(x.e0);
    const recordedDelta = num(x.delta_e);
    const hasDomain = typeof x.system === "string" && x.system.length > 0;
    const phi = x.phi as number;
    const tensorDistance = num(x.tensor_distance);
    const peer = peerStatus({ run_id: x.run_id, sequence, phi });
    out.push({
      idx,
      l: {
        run_id: x.run_id,
        domain: hasDomain ? (x.system as string) : DEFAULT_DOMAIN,
        domain_source: hasDomain ? "record" : "default",
        final_e: finalE,
        baseline_e: num(x.cold_e),
        e0,
        delta_e: recordedDelta ?? (e0 !== null ? r3(e0 - finalE) : null),
        phi,
        verified_at: x.verified_at,
        sequence,
        reuse_href: reuseHref(x.run_id),
        license_intent: licenseGate(phi, threshold),
        tensor_distance: tensorDistance,
        error_surface: errorSurfaceFor({ phi, final_e: finalE, tensor_distance: tensorDistance }),
        peer_ready: peer.peer_ready,
        peer_status: peer.status,
        peer_handoff_path: reuseHref(x.run_id),
      },
    });
  }
  out.sort((a, b) => {
    // rankKey() is the ranking hook; today it is Φ alone, so the order is unchanged by the error surface.
    if (rankKey(a.l) !== rankKey(b.l)) return rankKey(b.l) - rankKey(a.l);
    const ta = Date.parse(a.l.verified_at);
    const tb = Date.parse(b.l.verified_at);
    if (ta !== tb) return tb - ta;
    return b.idx - a.idx;
  });
  return out.map((o) => o.l);
}

export function buildIndex(list: ExperienceEntry[], threshold: number = LICENSE_INTENT_PHI_MIN): ListingsIndex {
  const listings = buildListings(list, threshold);
  return {
    schema: LISTINGS_SCHEMA,
    count: listings.length,
    license_intent_phi_min: threshold,
    peer_ready_count: listings.filter((l) => l.peer_ready).length,
    peers_note: PEERS_NOTE,
    notice: `Read-only index of verified sequences (Φ > 0). Reuse passes the run page's replay vet and falls back with a reason. ${NO_MONEY_NOTICE}`,
    listings,
  };
}

/* ───────────── settlement intent stub (intent only; nothing is sent or stored) ───────────── */

export type LicenseIntent = {
  schema: typeof INTENT_SCHEMA;
  type: "license_intent";
  sequence_ref: string;
  phi: number;
  final_e: number;
  delta_e: number | null;
  threshold: number;
  created_at: string;
  settlement: typeof SETTLEMENT_NONE;
  status: "intent_only";
};

/**
 * Build an intent record for a listing. Refuses when Φ does not exceed the threshold. `createdAt` is passed in
 * so the function stays pure. The record is generated in the browser for the user to copy; nothing is posted.
 */
export function createLicenseIntent(
  l: Pick<MarketplaceListing, "run_id" | "phi" | "final_e" | "delta_e">,
  createdAt: string,
  threshold: number = LICENSE_INTENT_PHI_MIN
): { ok: true; intent: LicenseIntent } | { ok: false; reason: string } {
  const gate = licenseGate(l.phi, threshold);
  if (!gate.allowed) return { ok: false, reason: gate.reason };
  return {
    ok: true,
    intent: {
      schema: INTENT_SCHEMA,
      type: "license_intent",
      sequence_ref: l.run_id,
      phi: l.phi,
      final_e: l.final_e,
      delta_e: l.delta_e,
      threshold,
      created_at: createdAt,
      settlement: SETTLEMENT_NONE,
      status: "intent_only",
    },
  };
}