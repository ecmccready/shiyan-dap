'use client';

import { useCallback, useState } from 'react';

type Ev = {
  eventId: string;
  domain: string;
  assetId: string;
  previousHash: string | null;
  txHash: string;
  timestamp: number;
  stateData?: {
    auditStatus?: 'PENDING' | 'PASSED' | 'FLAGGED' | 'REJECTED' | 'FAILED';
  };
  signatureStatus?: 'verified' | 'unverified' | 'wallet_unverified';
  signatureType?: 'hmac' | 'wallet';
  settlement?: {
    rail: string;
    status: string;
    splits: { account: string; percentage: number }[];
    note: string;
    reason?: string;
    providerId?: string;
    recipients?: { account: string; percentage: number; amountCents?: number; status: string; transferId?: string; transferSkipped?: string; transferError?: string }[];
  };
  planned_transfers?: { account: string; amountCents: number; status: string; transferId?: string; transferSkipped?: string; transferError?: string }[];
};
type Snapshot = { store: string; anchor: string; count: number; events: Ev[] };

const short = (h: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-4)}` : '—');

export default function LedgerProvenancePanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Secondary by default: the ledger works in the background; expand to inspect it.
  const [open, setOpen] = useState(false);

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

  const events = data ? [...data.events].reverse() : [];
  const known = new Set(events.map((e) => e.txHash));

  return (
    <div data-ledger-provenance className="mt-6 border-t border-zinc-800 pt-3 text-sm text-zinc-300">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (!open) void load();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          data-ledger-toggle
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {open ? '▾' : '▸'} Ledger provenance <span className="text-zinc-600">(runs in the background{open ? '' : ', click to expand'})</span>
        </button>
        {open ? (
          <button type="button" onClick={() => void load()} className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
            Refresh
          </button>
        ) : null}
      </div>
      {!open ? null : (<>
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
                  {e.domain === 'DIAGNOSTIC_AUDIT' && e.stateData?.auditStatus ? (
                    <span className={e.stateData.auditStatus === 'PASSED' ? 'text-emerald-400' : 'text-amber-400'}>
                      audit {e.stateData.auditStatus}
                    </span>
                  ) : null}
                  <span className={e.signatureStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}>
                    {e.signatureStatus === 'verified' ? 'signature verified' : e.signatureStatus === 'wallet_unverified' ? 'wallet signature (unverified)' : 'unverified'}
                    {e.signatureType ? ` · ${e.signatureType}` : ''}
                  </span>
                  <span className="text-zinc-500">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-1 break-all text-zinc-400">tx {short(e.txHash)} · event {e.eventId}</div>
                {e.settlement ? (
                  <div className="mt-1 text-zinc-400">
                    settlement {e.settlement.rail} · {e.settlement.status} · {e.settlement.splits.map((x) => `${x.account} ${x.percentage}%`).join(', ')}
                    {e.settlement.providerId ? ` · ${e.settlement.providerId}` : ''}
                    {e.settlement.reason ? ` · ${e.settlement.reason}` : ''}
                    {e.settlement.recipients?.length ? (
                      <div className="text-zinc-500">
                        {e.settlement.recipients.map((r) => `${r.account}${r.amountCents !== undefined ? ` ${(r.amountCents / 100).toFixed(2)}` : ''} ${r.status}${r.transferId ? ` ${r.transferId}` : ''}${r.transferSkipped ? ` (transfer_skipped: ${r.transferSkipped})` : ''}${r.transferError ? ` (transfer_failed: ${r.transferError})` : ''}`).join(' · ')}
                      </div>
                    ) : null}
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
      </>)}
    </div>
  );
}
