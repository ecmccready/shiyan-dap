import { readLedger } from '@/lib/ledger-commit';
import { computeLedgerAnchor } from '@/lib/ledger-anchor';

/** Both read-only summaries look at the latest SUMMARY_WINDOW events (hidden assets excluded) so they stay fast. */
export const SUMMARY_WINDOW = 500;

type Ev = Awaited<ReturnType<typeof readLedger>>['events'][number] & {
  signatureStatus?: string;
  settlement?: { rail?: string; status?: string } | null;
  stateData?: { title?: string; auditStatus?: string; metadataHash?: string };
};

/** Events without a stored settlement intent (no splitRule) used the default rail, INTERNAL_MICRO. */
const railOf = (e: Ev) => e.settlement?.rail ?? 'INTERNAL_MICRO';
const sigOf = (e: Ev) => e.signatureStatus ?? 'unverified';

function bump(m: Record<string, number>, k: string) {
  m[k] = (m[k] ?? 0) + 1;
}

export interface AssetEntry {
  assetId: string;
  domain: string;
  eventCount: number;
  latestEvent: {
    txHash: string;
    eventId: string;
    version: string;
    timestamp: number;
    title: string | null;
    auditStatus: string | null;
    metadataHash: string;
  };
  signatureStatus: string;
  settlementRail: string;
  settlementStatus: string | null;
}

/** Unique assets (latest event wins), newest first. */
export async function assetMap(limit = 200) {
  const snap = await readLedger(SUMMARY_WINDOW);
  const byAsset = new Map<string, { latest: Ev; n: number }>();
  for (const e of snap.events as Ev[]) {
    const cur = byAsset.get(e.assetId);
    byAsset.set(e.assetId, { latest: e, n: (cur?.n ?? 0) + 1 });
  }
  const assets: AssetEntry[] = [...byAsset.values()]
    .map(({ latest: e, n }) => ({
      assetId: e.assetId,
      domain: e.domain,
      eventCount: n,
      latestEvent: {
        txHash: e.txHash,
        eventId: e.eventId,
        version: e.version,
        timestamp: e.timestamp,
        title: e.stateData?.title ?? null,
        auditStatus: e.stateData?.auditStatus ?? null,
        metadataHash: e.stateData?.metadataHash ?? '',
      },
      signatureStatus: sigOf(e),
      settlementRail: railOf(e),
      settlementStatus: e.settlement?.status ?? null,
    }))
    .sort((a, b) => b.latestEvent.timestamp - a.latestEvent.timestamp)
    .slice(0, limit);
  return {
    ok: true as const,
    store: snap.store,
    assetCount: byAsset.size,
    returned: assets.length,
    eventsExamined: snap.events.length,
    windowTruncated: snap.count > snap.events.length,
    assets,
    notes: ['Off-chain micro-ledger; nothing is anchored on a blockchain.', 'settlementRail is the recorded rail, or INTERNAL_MICRO (the default) when the event has no settlement intent.', 'Hidden assets are excluded.'],
  };
}

export async function auditSummary() {
  const [snap, anchor] = await Promise.all([readLedger(SUMMARY_WINDOW), computeLedgerAnchor(100)]);
  const byDomain: Record<string, number> = {};
  const bySignatureStatus: Record<string, number> = {};
  const bySettlementRail: Record<string, number> = {};
  const assets = new Set<string>();
  for (const e of snap.events as Ev[]) {
    bump(byDomain, e.domain);
    bump(bySignatureStatus, sigOf(e));
    bump(bySettlementRail, railOf(e));
    assets.add(e.assetId);
  }
  return {
    ok: true as const,
    store: snap.store,
    totalEvents: snap.count,
    eventsCounted: snap.events.length,
    windowTruncated: snap.count > snap.events.length,
    assetCount: assets.size,
    byDomain,
    bySignatureStatus,
    bySettlementRail,
    merkle: {
      root: anchor.root,
      algorithm: anchor.algorithm,
      eventsInRoot: anchor.eventCount,
      anchored: anchor.anchored,
      note: anchor.note,
    },
    generatedAt: Date.now(),
    notes: ['Read-only. Counts cover the latest events (hidden assets excluded). The Merkle root covers the latest 100 events including hidden ones, matching GET /api/v1/status.', 'Events with no settlement intent count under INTERNAL_MICRO, the default rail.'],
  };
}
