/**
 * Peer-facing helpers for the marketplace (pure, display only, no writes, no network).
 *
 * The listing index is THIS node's own list of verified runs; "peer" here means anyone (a person, another model or
 * another node's operator) who reads that index and opens a hand-off link. There is no discovery of other nodes
 * and no cross-node trust yet.
 *
 * peer_ready is derived only from fields the listing already has. It means: the listing is a verified reusable
 * sequence (it already passed the reusable filter in buildListings), its permitted-action sequence is non-empty
 * and its run id can be put in a ?reuse= link. It does NOT guarantee reuse applies: the final gate is still the run
 * page's permitted-action check, the replay vet and the fallback (src/lib/level4/reuse-handoff.ts).
 */
import type { MarketplaceListing } from "@/lib/marketplace/listings";

export const PEER_STATUS_READY = "available_for_reuse" as const;
export const PEER_STATUS_NOT_READY = "not_ready" as const;
export const PEERS_NOTE =
  "This is this node's index of its own verified runs. peer_ready is a display flag, not a guarantee: reuse still passes the run page's permitted-action check and replay vet and falls back with a reason. There is no discovery of other nodes and no cross-node trust yet, and nothing here is third-party attested.";

/** Same pattern as src/lib/level4/reuse-handoff.ts. */
export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export type PeerStatus = {
  peer_ready: boolean;
  status: typeof PEER_STATUS_READY | typeof PEER_STATUS_NOT_READY;
  reason: string;
};

export function peerStatus(l: Pick<MarketplaceListing, "run_id" | "sequence" | "phi">): PeerStatus {
  const notReady = (reason: string): PeerStatus => ({ peer_ready: false, status: PEER_STATUS_NOT_READY, reason });
  if (typeof l.run_id !== "string" || !RUN_ID_RE.test(l.run_id)) return notReady("run id is not valid for a ?reuse= link");
  if (!Array.isArray(l.sequence) || l.sequence.length === 0 || l.sequence.some((y) => typeof y !== "string" || y.length === 0)) {
    return notReady("no permitted action sequence recorded");
  }
  if (!(typeof l.phi === "number" && Number.isFinite(l.phi) && l.phi > 0)) return notReady("not a verified sequence (Φ is not above 0)");
  return {
    peer_ready: true,
    status: PEER_STATUS_READY,
    reason: "verified reusable sequence with a non-empty action list; the run page still re-checks and replay-vets it",
  };
}

/** Absolute peer hand-off URL `<origin>/workbench/autonomous?reuse=<run_id>`; null when the run id is invalid. */
export function peerHandoffUrl(origin: string, runId: string): string | null {
  if (typeof runId !== "string" || !RUN_ID_RE.test(runId)) return null;
  if (typeof origin !== "string") return null;
  const base = origin.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/?#]+$/i.test(base)) return null;
  return `${base}/workbench/autonomous?reuse=${encodeURIComponent(runId)}`;
}