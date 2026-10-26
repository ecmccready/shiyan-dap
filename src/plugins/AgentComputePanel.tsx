'use client';

import { useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';

type Rec = { txHash: string; status: string; previousHash?: string | null; signatureStatus?: string };
type Out = { assetId: string; summary: string; txHash: string; record: Rec | null };

export default function AgentComputePanel({ workspaceId }: { workspaceId: string }) {
  const hydrated = useHydrated();
  // Writes a real ledger event, so it is off unless the page URL has ?demo=1.
  const demoEnabled = hydrated && new URLSearchParams(window.location.search).get('demo') === '1';
  const [model, setModel] = useState('');
  const [tokens, setTokens] = useState('');
  const [seconds, setSeconds] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setBusy(true);
    setError(null);
    setOut(null);
    try {
      const args: Record<string, unknown> = { model: model.trim(), tokens: Number(tokens) };
      if (Number(seconds) > 0) args.computeSeconds = Number(seconds);
      const res = await fetch('/api/v1/plugins/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'agent-compute', toolName: 'record_compute_usage', args, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `request failed (${res.status})`);
      setOut({ ...data.result, record: data.ledgerRecords?.[0] ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Agent Compute</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-xs text-zinc-500">
        Records an agent&apos;s compute usage as an AGENT_COMPUTE event on the micro-ledger. Each click writes one real ledger event.
      </p>
      <div className="mt-3 space-y-2 text-xs">
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model or job name" maxLength={80} className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1" />
        <input value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="Tokens used" inputMode="numeric" className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1" />
        <input value={seconds} onChange={(e) => setSeconds(e.target.value)} placeholder="Compute seconds (optional)" inputMode="decimal" className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1" />
      </div>
      <button
        type="button"
        onClick={record}
        disabled={busy || !demoEnabled || !model.trim() || !(Number(tokens) > 0)}
        data-compute-run
        className="mt-3 rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
      >
        {busy ? 'Recording…' : 'Record compute usage'}
      </button>
      {!demoEnabled ? <p className="mt-2 text-xs text-zinc-500">Writes are off. Add <span className="font-mono">?demo=1</span> to the URL to enable them.</p> : null}
      {error ? <p className="mt-3 text-red-400">{error}</p> : null}
      {out ? (
        <dl data-compute-result className="mt-4 space-y-1 break-all font-mono text-xs">
          <div><dt className="inline text-zinc-500">asset: </dt><dd className="inline">{out.assetId}</dd></div>
          <div><dt className="inline text-zinc-500">usage: </dt><dd className="inline">{out.summary}</dd></div>
          <div><dt className="inline text-zinc-500">tx: </dt><dd className="inline">{out.txHash} ({out.record?.status ?? 'n/a'}, {out.record?.signatureStatus ?? 'n/a'})</dd></div>
          <div><dt className="inline text-zinc-500">previousHash: </dt><dd className="inline">{out.record?.previousHash ?? 'null (first event)'}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
