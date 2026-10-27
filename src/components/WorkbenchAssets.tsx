'use client';

import { useEffect, useState } from 'react';

type Asset = {
  assetId: string;
  domain: string;
  createdDomain: string;
  domains: string[];
  title: string | null;
  latestAuditStatus: string | null;
  eventCount: number;
  timeline: { first: { timestamp: number }; last: { timestamp: number } };
  signatureStatus: string;
  settlementRail: string;
};
type Assets = { assetCount: number; assets: Asset[]; store: string };

const stamp = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const span = (t: Asset['timeline']) => (t.first.timestamp === t.last.timestamp ? stamp(t.first.timestamp) : `${stamp(t.first.timestamp)} → ${stamp(t.last.timestamp)}`);

/** Small "Assets" block for the Plugins section. Reads GET /api/v1/ledger/assets once; read-only. */
export default function WorkbenchAssets() {
  const [d, setD] = useState<Assets | null>(null);
  const [failed, setFailed] = useState(false);
  const [domainF, setDomainF] = useState('');
  const [sigF, setSigF] = useState('');

  useEffect(() => {
    let live = true;
    fetch('/api/v1/ledger/assets?limit=100', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((x: Assets) => live && setD(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div data-workbench-assets className="mt-4 border-t border-zinc-800 pt-4">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Assets</p>
      {failed ? (
        <p className="mt-2 text-xs text-zinc-600">Assets unavailable.</p>
      ) : !d ? (
        <p className="mt-2 text-xs text-zinc-600">Loading assets…</p>
      ) : d.assets.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No assets in the ledger yet.</p>
      ) : (
        <AssetList d={d} domainF={domainF} setDomainF={setDomainF} sigF={sigF} setSigF={setSigF} />
      )}
    </div>
  );
}

const SHOWN = 8;

function AssetList({ d, domainF, setDomainF, sigF, setSigF }: { d: Assets; domainF: string; setDomainF: (v: string) => void; sigF: string; setSigF: (v: string) => void }) {
  const domains = [...new Set(d.assets.flatMap((a) => a.domains))];
  const sigs = [...new Set(d.assets.map((a) => a.signatureStatus))];
  const match = d.assets.filter((a) => (!domainF || a.domains.includes(domainF)) && (!sigF || a.signatureStatus === sigF));
  const sel = 'rounded-full border border-zinc-700 bg-transparent px-2 py-1 text-zinc-400';
  return (
    <>
      <p className="mt-2 text-xs text-zinc-500">
        {d.assetCount} asset{d.assetCount === 1 ? '' : 's'} · {match.length} {match.length === 1 ? 'match' : 'matches'} · showing {Math.min(SHOWN, match.length)} ·{' '}
        <a className="underline" href="/api/v1/ledger/assets" download="ledger-assets.json">Download JSON</a>
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <select value={domainF} onChange={(e) => setDomainF(e.target.value)} aria-label="Filter assets by domain" data-assets-filter-domain className={sel}>
          <option value="">All domains</option>
          {domains.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={sigF} onChange={(e) => setSigF(e.target.value)} aria-label="Filter assets by signature status" data-assets-filter-signature className={sel}>
          <option value="">All signature statuses</option>
          {sigs.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-400">
        {match.slice(0, SHOWN).map((a) => (
          <li key={a.assetId} className="break-all">
            {a.assetId} · {a.createdDomain}{a.domain !== a.createdDomain ? ` → ${a.domain}` : ''} · {a.title ?? 'untitled'}{a.latestAuditStatus ? ` (${a.latestAuditStatus})` : ''} · {span(a.timeline)} · {a.signatureStatus} · {a.settlementRail} · {a.eventCount} event{a.eventCount === 1 ? '' : 's'}
          </li>
        ))}
        {match.length === 0 ? <li className="text-zinc-600">No assets match this filter.</li> : null}
      </ul>
    </>
  );
}
