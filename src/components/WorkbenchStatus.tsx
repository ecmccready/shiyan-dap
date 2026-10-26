'use client';

import { useEffect, useState } from 'react';

type Status = {
  pluginCount: number;
  plugins: { id: string; name: string; version: string; toolCount: number }[];
  ledger: { store?: string; count?: number; latestTxHash?: string | null; error?: string };
  config: { signingSecretConfigured: boolean; adminSecretConfigured: boolean; stripeKeyConfigured: boolean; ledgerStore: string };
  settlementRails: { rail: string }[];
  anchor?: { root?: string | null; eventCount?: number; anchored?: boolean; error?: string };
};

const flag = (on: boolean) => (on ? 'set' : 'not set');

/** Small collapsible status line for the Plugins section. Reads /api/v1/status once. */
export default function WorkbenchStatus() {
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/v1/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Status) => live && setS(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p data-workbench-status className="mt-3 text-xs text-zinc-600">Status unavailable.</p>;
  if (!s) return <p data-workbench-status className="mt-3 text-xs text-zinc-600">Loading status…</p>;
  return (
    <div data-workbench-status className="mt-3 text-xs text-zinc-500">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="hover:text-zinc-300">
        {open ? '▾' : '▸'} {s.pluginCount} plugins · {s.ledger.count ?? '?'} ledger events · signing {flag(s.config.signingSecretConfigured)} · admin {flag(s.config.adminSecretConfigured)} · Stripe {flag(s.config.stripeKeyConfigured)}
      </button>
      {open ? (
        <div className="mt-2 space-y-1 break-all font-mono text-zinc-400">
          {s.plugins.map((p) => (
            <p key={p.id}>{p.id} v{p.version} · {p.toolCount} tool{p.toolCount === 1 ? '' : 's'}</p>
          ))}
          <p>ledger store: {s.ledger.store ?? s.config.ledgerStore}{s.ledger.latestTxHash ? ` · latest tx ${s.ledger.latestTxHash}` : ''}{s.ledger.error ? ` · ${s.ledger.error}` : ''}</p>
          {s.anchor ? <p>anchor root: {s.anchor.error ?? (s.anchor.root ? `${s.anchor.root} over ${s.anchor.eventCount} events` : 'none yet')} · anchored: {String(s.anchor.anchored ?? false)} (not on-chain)</p> : null}
          <p>settlement rails: {s.settlementRails.map((r) => r.rail).join(', ')}</p>
          <p className="text-zinc-600">Config flags show only whether a value is set, never the value.</p>
        </div>
      ) : null}
    </div>
  );
}
