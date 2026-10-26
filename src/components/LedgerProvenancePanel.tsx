'use client';

import { useCallback, useEffect, useState } from 'react';

type Ev = {
  eventId: string;
  domain: string;
  assetId: string;
  previousHash: string | null;
  txHash: string;
  timestamp: number;
  signatureStatus?: 'verified' | 'unverified';
  settlement?: { rail: string; status: string; splits: { account: string; percentage: number }[]; note: string };
};
type Snapshot = { store: string; anchor: string; count: number; events: Ev[] };

const short = (h: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-4)}` : '—');

export default function LedgerProvenancePanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ledger/commit?limit=20', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Snapshot);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const events = data ? [...data.events].reverse() : [];
  const known = new Set(events.map((e) => e.txHash));

  return (
    <div data-ledger-provenance className="mt-6 border-t border-zinc-800 pt-4 text-sm text-zinc-300">
      <div className="flex items-center justify-between">
        <p className="font-medium text-white">Ledger provenance</p>
        <button type="button" onClick={() => void load()} className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
          Refresh
        </button>
      </div>
      {error ? <p className="mt-2 text-red-400">Ledger unavailable: {error}</p> : null}
      {data ? (
        <>
          <p className="mt-1 text-xs text-zinc-500">
            {data.count} events committed · store: {data.store} · {data.anchor} (not anchored on a blockchain). Newest first, latest {events.length}.
          </p>
          {events.length === 0 ? <p className="mt-3 text-zinc-500">No events yet.</p> : null}
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.txHash} className="rounded-xl border border-zinc-800 p-3 font-mono text-xs">
                <div className="flex flex-wrap gap-x-3 text-zinc-200">
                  <span>{e.assetId}</span>
                  <span className="text-emerald-400">{e.domain}</span>
                  <span className="text-zinc-500">CONFIRMED</span>
                  <span className={e.signatureStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}>
                    {e.signatureStatus === 'verified' ? 'signature verified' : 'unverified'}
                  </span>
                  <span className="text-zinc-500">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-1 break-all text-zinc-400">tx {short(e.txHash)} · event {e.eventId}</div>
                {e.settlement ? (
                  <div className="mt-1 text-zinc-400">
                    settlement {e.settlement.rail} · {e.settlement.status} · {e.settlement.splits.map((x) => `${x.account} ${x.percentage}%`).join(', ')}
                  </div>
                ) : null}
                <div className="mt-1 text-zinc-400">
                  prev {short(e.previousHash)}
                  {e.previousHash ? (known.has(e.previousHash) ? ' ↳ parent is the row below' : ' (parent is older than this list)') : ' (chain start)'}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
