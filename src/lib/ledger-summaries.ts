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
  /** Domain of the latest event (kept for compatibility); see createdDomain and domains for the full picture. */
  domain: string;
  /** Domain of the first event in the examined window (usually how the asset was created). */
  createdDomain: string;
  /** Distinct domains in order of first appearance. */
  domains: string[];
  timeline: { first: { domain: string; timestamp: number; txHash: string }; last: { domain: string; timestamp: number; txHash: string }; byDomain: Record<string, number> };
  /** Latest title seen on any event of the asset (the audit event usually carries none). */
  title: string | null;
  /** auditStatus of the latest event that has one (a heuristic scan result, not a third-party attestation). */
  latestAuditStatus: string | null;
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
  const byAsset = new Map<string, Ev[]>();
  for (const e of snap.events as Ev[]) {
    const list = byAsset.get(e.assetId);
    if (list) list.push(e);
    else byAsset.set(e.assetId, [e]);
  }
  const lastWith = <T,>(evs: Ev[], pick: (e: Ev) => T | undefined | null): T | null => {
    for (let i = evs.length - 1; i >= 0; i--) {
      const v = pick(evs[i]);
      if (v !== undefined && v !== null) return v;
    }
    return null;
  };
  const assets: AssetEntry[] = [...byAsset.values()]
    .map((evs) => {
      const first = evs[0];
      const e = evs[evs.length - 1];
      const byDomain: Record<string, number> = {};
      for (const x of evs) bump(byDomain, x.domain);
      const brief = (x: Ev) => ({ domain: x.domain, timestamp: x.timestamp, txHash: x.txHash });
      return {
        assetId: e.assetId,
        domain: e.domain,
        createdDomain: first.domain,
        domains: Object.keys(byDomain),
        timeline: { first: brief(first), last: brief(e), byDomain },
        title: lastWith(evs, (x) => x.stateData?.title),
        latestAuditStatus: lastWith(evs, (x) => x.stateData?.auditStatus),
        eventCount: evs.length,
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
      };
    })
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
  const byAuditStatus: Record<string, number> = {};
  const assets = new Set<string>();
  const latestAudit = new Map<string, string>();
  let certificates = 0;
  for (const e of snap.events as Ev[]) {
    const a = e.stateData?.auditStatus;
    if (a) {
      bump(byAuditStatus, a);
      latestAudit.set(e.assetId, a);
      if (e.domain === 'DIAGNOSTIC_AUDIT' && e.stateData?.metadataHash) certificates++;
    }
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
    audit: {
      byAuditStatus,
      certificateEvents: certificates,
      assetsWithPassedAudit: [...latestAudit.values()].filter((v) => v === 'PASSED').length,
      assetsWithAudit: latestAudit.size,
      note: 'certificateEvents counts DIAGNOSTIC_AUDIT events carrying an auditStatus (their metadataHash is the scan certificate hash). assetsWithPassedAudit counts assets whose latest audit result is PASSED. These come from the heuristic mock scan, not a third-party attestation or a reuse decision.',
    },
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
