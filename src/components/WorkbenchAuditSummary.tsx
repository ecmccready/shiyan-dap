'use client';

import { useEffect, useState } from 'react';

type Summary = {
  totalEvents: number;
  assetCount: number;
  windowTruncated: boolean;
  byDomain: Record<string, number>;
  bySignatureStatus: Record<string, number>;
  bySettlementRail: Record<string, number>;
  audit: { assetsWithPassedAudit: number; assetsWithAudit: number; certificateEvents: number };
  merkle: { root: string | null; eventsInRoot: number; anchored: boolean };
};

const fmt = (m: Record<string, number>) => Object.entries(m).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';

/** Small collapsible "Audit summary" block for the Plugins section. Reads GET /api/v1/audit/summary once; read-only. */
export default function WorkbenchAuditSummary() {
  const [s, setS] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/v1/audit/summary', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((x: Summary) => live && setS(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div data-workbench-audit-summary className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
      <p className="uppercase tracking-[0.18em] text-emerald-400">Audit summary</p>
      {failed ? (
        <p className="mt-2 text-zinc-600">Audit summary unavailable.</p>
      ) : !s ? (
        <p className="mt-2 text-zinc-600">Loading audit summary…</p>
      ) : (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 hover:text-zinc-300">
            {open ? '▾' : '▸'} {s.totalEvents} events · {s.assetCount} assets · {s.audit.assetsWithPassedAudit} of {s.audit.assetsWithAudit} audited assets passed · anchored: {String(s.merkle.anchored)}
          </button>
          {open ? (
            <div className="mt-2 space-y-1 break-all font-mono text-zinc-400">
              <p>by domain: {fmt(s.byDomain)}</p>
              <p>by signature status: {fmt(s.bySignatureStatus)}</p>
              <p>by settlement rail: {fmt(s.bySettlementRail)}</p>
              <p>assets with passed audit: {s.audit.assetsWithPassedAudit} of {s.audit.assetsWithAudit} audited ({s.audit.certificateEvents} certificate events; heuristic scan, not a third-party attestation)</p>
              <p>merkle root: {s.merkle.root ?? 'none yet'} over {s.merkle.eventsInRoot} events · anchored: {String(s.merkle.anchored)} (not on-chain)</p>
              {s.windowTruncated ? <p className="text-zinc-600">Counts cover the latest 500 events only.</p> : null}
              <p>
                <a className="underline" href="/api/v1/audit/summary" download="audit-summary.json">Download JSON</a>
                {' · '}
                <button type="button" onClick={() => window.dispatchEvent(new Event('ledger-provenance-open'))} data-audit-open-dryrun className="underline hover:text-zinc-200">Open dry-run anchor in the provenance panel</button>
                {' · '}
                <a className="underline" href="/api/v1/ledger/anchor?limit=100">Anchor JSON</a>
              </p>
              <p className="text-zinc-600">The dry-run is simulated (nothing is submitted on-chain) and its button is enabled only when the page URL has ?demo=1, like the other writers.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
