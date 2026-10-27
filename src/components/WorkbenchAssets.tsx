'use client';

import { useEffect, useState } from 'react';

type Asset = {
  assetId: string;
  domain: string;
  createdDomain: string;
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

  useEffect(() => {
    let live = true;
    fetch('/api/v1/ledger/assets?limit=8', { cache: 'no-store' })
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
        <>
          <p className="mt-2 text-xs text-zinc-500">{d.assetCount} asset{d.assetCount === 1 ? '' : 's'} · latest {d.assets.length} shown · <a className="underline" href="/api/v1/ledger/assets">JSON</a></p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-400">
            {d.assets.map((a) => (
              <li key={a.assetId} className="break-all">
                {a.assetId} · {a.createdDomain}{a.domain !== a.createdDomain ? ` → ${a.domain}` : ''} · {a.title ?? 'untitled'}{a.latestAuditStatus ? ` (${a.latestAuditStatus})` : ''} · {span(a.timeline)} · {a.signatureStatus} · {a.settlementRail} · {a.eventCount} event{a.eventCount === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
