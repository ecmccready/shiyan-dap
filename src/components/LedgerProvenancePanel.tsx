'use client';

import { useCallback, useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';

type Ev = {
  eventId: string;
  domain: string;
  assetId: string;
  previousHash: string | null;
  txHash: string;
  timestamp: number;
  signatureStatus?: 'verified' | 'unverified' | 'wallet_verified' | 'wallet_unverified';
  signatureReason?: string;
  walletAddress?: string;
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
  siwe?: Siwe;
  usageEstimate?: { flops?: number; costUsd?: number; basis?: string };
  planned_transfers?: { account: string; amountCents: number; status: string; transferId?: string; transferSkipped?: string; transferError?: string }[];
};
type DryRun = { attemptId: string; status: string; anchored: boolean; root: string | null; eventCount: number; simulatedTxHash: string; simulatedBlockNumber: number; network: string; note: string };
type Siwe = { parsed: boolean; structureValid: boolean; issues: string[]; fields?: { domain: string; address: string; statement?: string; uri?: string; version?: string; chainId?: number; nonce?: string; issuedAt?: string } };
type Anchor = { root: string | null; eventCount: number; anchored: boolean; algorithm: string };
type Snapshot = { store: string; anchor: string; count: number; events: Ev[] };

const short = (h: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-4)}` : '—');

export default function LedgerProvenancePanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const hydrated = useHydrated();
  // The dry run writes an attempt record, so like the other writers it needs ?demo=1.
  const demoEnabled = hydrated && new URLSearchParams(window.location.search).get('demo') === '1';
  const [dry, setDry] = useState<DryRun | null>(null);
  const [dryBusy, setDryBusy] = useState(false);
  const [dryError, setDryError] = useState<string | null>(null);
  // Secondary by default: the ledger works in the background; expand to inspect it.
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ledger/commit?limit=20', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Snapshot);
      setError(null);
      // Anchor root is secondary: a failure here must not hide the events.
      fetch('/api/v1/ledger/anchor?limit=100', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((a: Anchor | null) => setAnchor(a))
        .catch(() => setAnchor(null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, []);

  async function runDry() {
    setDryBusy(true);
    setDryError(null);
    try {
      const res = await fetch('/api/v1/ledger/anchor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true, limit: 100 }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setDry(d as DryRun);
    } catch (e) {
      setDryError(e instanceof Error ? e.message : 'failed');
    } finally {
      setDryBusy(false);
    }
  }

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
          {anchor ? (
            <p data-ledger-anchor className="mt-1 break-all font-mono text-xs text-zinc-500">
              anchor root {anchor.root ?? 'none yet'} over the latest {anchor.eventCount} events ({anchor.algorithm}) · anchored: {String(anchor.anchored)}, on-chain submission is not live
            </p>
          ) : null}
          <div className="mt-2 text-xs">
            <button type="button" onClick={() => void runDry()} disabled={dryBusy || !demoEnabled} data-anchor-dryrun className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-400 disabled:opacity-50">
              {dryBusy ? 'Running…' : 'Dry-run anchor submission'}
            </button>
            {!demoEnabled ? <span className="ml-2 text-zinc-600">needs ?demo=1</span> : null}
            {dryError ? <span className="ml-2 text-red-400">{dryError}</span> : null}
            {dry ? (
              <p data-anchor-dryrun-result className="mt-2 break-all font-mono text-zinc-400">
                {dry.status} {dry.attemptId} · simulated tx {dry.simulatedTxHash} · simulated block {dry.simulatedBlockNumber} · root {dry.root ?? 'none'} over {dry.eventCount} events · anchored: {String(dry.anchored)}. {dry.note}
              </p>
            ) : null}
          </div>
          {events.length === 0 ? <p className="mt-3 text-zinc-500">No events yet.</p> : null}
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.txHash} className="rounded-xl border border-zinc-800 p-3 font-mono text-xs">
                <div className="flex flex-wrap gap-x-3 text-zinc-200">
                  <span>{e.assetId}</span>
                  <span className="text-emerald-400">{e.domain}</span>
                  <span className="text-zinc-500">CONFIRMED</span>
                  <span className={e.signatureStatus === 'verified' || e.signatureStatus === 'wallet_verified' ? 'text-emerald-400' : 'text-amber-400'}>
                    {e.signatureStatus === 'verified' ? 'signature verified' : e.signatureStatus === 'wallet_verified' ? `wallet signature verified${e.walletAddress ? ` (${e.walletAddress.slice(0, 8)}…)` : ''}` : e.signatureStatus === 'wallet_unverified' ? `wallet signature unverified${e.signatureReason ? `: ${e.signatureReason}` : ''}` : 'unverified'}
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
                {e.siwe ? (
                  <div className="mt-1 text-zinc-400">
                    SIWE-style message: {e.siwe.parsed && e.siwe.fields ? `${e.siwe.fields.domain} · chain ${e.siwe.fields.chainId ?? '?'} · nonce ${e.siwe.fields.nonce ?? '?'} · issued ${e.siwe.fields.issuedAt ?? '?'}` : 'not parsed'}
                    {' '}· structure {e.siwe.structureValid ? 'ok' : `issues: ${e.siwe.issues.join(', ')}`} (parsed only, not full SIWE verification)
                  </div>
                ) : null}
                {e.usageEstimate ? (
                  <div className="mt-1 text-zinc-400">
                    estimated, not metered{e.usageEstimate.flops !== undefined ? ` · ~${e.usageEstimate.flops.toExponential(2)} FLOPs` : ''}{e.usageEstimate.costUsd !== undefined ? ` · ~$${e.usageEstimate.costUsd.toFixed(4)}` : ''}{e.usageEstimate.basis ? ` (${e.usageEstimate.basis})` : ''}
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
