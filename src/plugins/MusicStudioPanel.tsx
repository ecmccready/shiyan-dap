'use client';

import { useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { recordLedgerState } from '@/lib/micro-ledger-client';
import type { DiagnosticAuditResult } from '@/services/diagnostics-engine';
import type { LedgerRecordResponse } from '@/types/ledger';

type Rec = {
  txHash: string;
  status: string;
  settlementRail: string;
  previousHash?: string | null;
  signatureStatus?: string;
  settlementRef?: string | null;
  plannedTransfers?: { account: string; amountCents: number; status: string }[] | null;
  settlementNote?: string | null;
  settlement?: { status: string; note: string; recipients?: { account: string; percentage: number; amountCents?: number; status: string; transferId?: string; transferSkipped?: string; transferError?: string }[]; reason?: string; providerId?: string; splits: { account: string; percentage: number }[] } | null;
};
type Created = {
  assetId: string;
  title: string;
  splitRule: { account: string; percentage: number }[] | null;
  trackTxHash: string;
  auditTxHash: string;
  audit: DiagnosticAuditResult;
  reasons: string[];
  fingerprint?: string;
  records: Rec[];
};

type Flow = {
  assetId: string;
  title: string;
  track: LedgerRecordResponse;
  audit: DiagnosticAuditResult & { fingerprint?: string; ledger: (LedgerRecordResponse & { previousHash?: string | null }) | null };
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function MusicStudioPanel({ workspaceId }: { workspaceId: string }) {
  const hydrated = useHydrated();
  // Guard: the demo writes to the production ledger, so it is off unless the page URL has ?demo=1.
  const demoEnabled = hydrated && new URLSearchParams(window.location.search).get('demo') === '1';
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One-action form: create_music_asset through the server execute route.
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [splits, setSplits] = useState([{ account: '', percentage: '100' }]);
  const [rail, setRail] = useState('INTERNAL_MICRO');
  const [amount, setAmount] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const splitSum = splits.reduce((a, b) => a + (Number(b.percentage) || 0), 0);
  const splitsUsed = splits.some((x) => x.account.trim());

  async function createAsset() {
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const splitRule = splitsUsed ? splits.filter((x) => x.account.trim()).map((x) => ({ account: x.account.trim(), percentage: Number(x.percentage) })) : undefined;
      const args: Record<string, unknown> = { title: title.trim(), ...(splitRule ? { splitRule } : {}) };
      if (Number(duration) > 0) args.durationSeconds = Number(duration);
      if (splitRule && rail !== 'INTERNAL_MICRO') args.settlementRail = rail;
      if (splitRule && rail === 'STRIPE' && Number(amount) > 0) args.settlementAmountCents = Math.round(Number(amount) * 100);
      const res = await fetch('/api/v1/plugins/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'music-studio', toolName: 'create_music_asset', args, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `request failed (${res.status})`);
      setCreated({ ...data.result, records: data.ledgerRecords ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create failed');
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    setFlow(null);
    try {
      const assetId = `trk_${crypto.randomUUID().slice(0, 8)}`;
      const title = `Demo track ${assetId}`;
      const metadata = { title, duration: 180, workspaceId };
      const contentHash = await sha256Hex(JSON.stringify(metadata));
      // 1. Register the dummy asset on the ledger.
      const track = await recordLedgerState({
        domain: 'MUSIC_TRACK',
        assetId,
        version: '1',
        previousHash: null,
        stateData: { title, duration: 180, metadataHash: contentHash },
        signature: 'unsigned',
      });
      // 2. Run the server-side diagnostics scan; it commits its own audit event.
      const res = await fetch('/api/v1/diagnostics/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, assetType: 'AUDIO', contentHash, title, durationSeconds: 180 }),
      });
      const audit = await res.json();
      if (!res.ok) throw new Error(audit.error ?? `scan failed (${res.status})`);
      setFlow({ assetId, title, track, audit });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'flow failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Music Studio</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-zinc-500">
        Demo: creates a dummy track, scans it (mock checks), and commits both to the micro-ledger. Each click writes two real ledger events.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy || !demoEnabled}
        data-music-flow-run
        className="mt-3 rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
      >
        {busy ? 'Running…' : 'Create demo track and run diagnostics'}
      </button>
      {!demoEnabled ? (
        <p data-music-flow-locked className="mt-2 text-xs text-zinc-500">
          Demo writes are off. Add <span className="font-mono">?demo=1</span> to this page&apos;s URL to enable them.
        </p>
      ) : null}
      <div data-music-create className="mt-5 border-t border-zinc-800 pt-4">
        <p className="font-medium text-white">Create asset with splits</p>
        <p className="mt-1 text-xs text-zinc-500">
          One action: registers the track, scans it (mock), and commits the track and audit events with your splits. Writes two real ledger events.
        </p>
        <div className="mt-3 space-y-2 text-xs">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} data-music-title className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1" />
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration in seconds (optional)" inputMode="numeric" className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1" />
          {splits.map((sp, i) => (
            <div key={i} className="flex gap-2">
              <input value={sp.account} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, account: e.target.value } : x)))} placeholder="Recipient account" className="min-w-0 flex-1 rounded border border-zinc-700 bg-transparent px-2 py-1" />
              <input value={sp.percentage} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, percentage: e.target.value } : x)))} placeholder="%" inputMode="decimal" className="w-16 rounded border border-zinc-700 bg-transparent px-2 py-1" />
              {splits.length > 1 ? (
                <button type="button" onClick={() => setSplits(splits.filter((_, j) => j !== i))} className="text-zinc-500">remove</button>
              ) : null}
            </div>
          ))}
          <div className="flex items-center gap-3">
            {splits.length < 10 ? (
              <button type="button" onClick={() => setSplits([...splits, { account: '', percentage: '' }])} className="text-emerald-300">+ add recipient</button>
            ) : null}
            {splitsUsed ? <span className={Math.abs(splitSum - 100) < 0.001 ? 'text-zinc-500' : 'text-amber-400'}>total {splitSum}%</span> : <span className="text-zinc-500">no splits: track and audit only</span>}
          </div>
          {splitsUsed ? (
            <div className="flex gap-2">
              <select value={rail} onChange={(e) => setRail(e.target.value)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                <option value="INTERNAL_MICRO">INTERNAL_MICRO</option>
                <option value="STRIPE">STRIPE</option>
                <option value="X_MONEY">X_MONEY</option>
              </select>
              {rail === 'STRIPE' ? (
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in USD (needs server Stripe key)" inputMode="decimal" className="min-w-0 flex-1 rounded border border-zinc-700 bg-transparent px-2 py-1" />
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={createAsset}
          disabled={busy || !demoEnabled || !title.trim() || (splitsUsed && Math.abs(splitSum - 100) > 0.001)}
          data-music-create-run
          className="mt-3 rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Create asset and run diagnostics'}
        </button>
        {!demoEnabled ? <p className="mt-2 text-xs text-zinc-500">Writes are off. Add <span className="font-mono">?demo=1</span> to the URL to enable them.</p> : null}
        {created ? (
          <div data-music-create-result className="mt-4 space-y-3 break-all font-mono text-xs">
            <p><span className="text-zinc-500">asset: </span>{created.assetId} ({created.title})</p>
            <p>
              <span className="text-zinc-500">audit: </span>{created.audit.overallStatus}, copyright score {created.audit.checks.copyrightMatchScore.toFixed(4)}, risk {created.audit.checks.trainingDataRisk}
              {created.reasons.length ? <span className="text-zinc-500"> ({created.reasons.join('; ')})</span> : null}
            </p>
            {created.fingerprint ? (
              <p data-music-fingerprint><span className="text-zinc-500">fingerprint (simulation, not an audio fingerprint): </span>{created.fingerprint}</p>
            ) : null}
            {created.records[0]?.settlement ? (
              <p data-music-settlement-summary className="text-emerald-300">
                {(() => {
                  const st = created.records[0].settlement!;
                  const rail = created.records[0].settlementRail;
                  if (st.status === 'SETTLED_INTERNAL') return `Settlement: ${rail} settled`;
                  if (st.status === 'CREATED') return `Settlement: ${rail} PaymentIntent ${st.providerId} created (${st.recipients?.filter((r) => r.status === 'transferred').length ?? 0} of ${st.recipients?.length ?? 0} recipient transfers made)`;
                  return `Settlement: ${rail} queued: ${st.reason ?? 'pending'}`;
                })()}
              </p>
            ) : null}
            {created.records.map((r, i) => (
              <div key={r.txHash} className="rounded border border-zinc-800 p-2">
                <p className="text-white">{i === 0 ? '1. MUSIC_TRACK' : '2. DIAGNOSTIC_AUDIT'}</p>
                <p><span className="text-zinc-500">tx: </span>{r.txHash} ({r.status}, {r.signatureStatus ?? 'n/a'})</p>
                <p><span className="text-zinc-500">previousHash: </span>{r.previousHash ?? 'null (first event)'}{r.previousHash && r.previousHash === created.records[i - 1]?.txHash ? ' = the track tx above' : ''}</p>
                {r.settlement ? (
                  <p>
                    <span className="text-zinc-500">settlement: </span>{r.settlementRail} {r.settlement.status}
                    {r.settlement.providerId ? ` ${r.settlement.providerId}` : ''}{r.settlement.reason ? ` (${r.settlement.reason})` : ''}
                    {' · '}{r.settlement.splits.map((x) => `${x.account} ${x.percentage}%`).join(', ')}
                  </p>
                ) : null}
                {r.settlement?.recipients?.length ? (
                  <p className="text-zinc-400">
                    {r.settlement.recipients.map((x) => `${x.account}${x.amountCents !== undefined ? ` $${(x.amountCents / 100).toFixed(2)}` : ''}: ${x.status}${x.transferId ? ` ${x.transferId}` : ''}${x.transferSkipped ? ` (transfer_skipped: ${x.transferSkipped})` : ''}${x.transferError ? ` (transfer_failed: ${x.transferError})` : ''}`).join(' · ')}
                  </p>
                ) : null}
                {r.settlementNote ? <p className="text-zinc-500">{r.settlementNote}</p> : null}
              </div>
            ))}
            {created.records.length > 1 && created.records[1].settlement && created.records[1].settlement.status === 'SETTLED_INTERNAL' ? (
              <p className="text-zinc-500">The audit event carries the same splits but always settles internally, so a chosen external rail runs once, on the track event.</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-red-400">{error}</p> : null}
      {flow ? (
        <dl data-music-flow-result className="mt-4 space-y-1 break-all font-mono text-xs">
          <div><dt className="inline text-zinc-500">asset: </dt><dd className="inline">{flow.assetId}</dd></div>
          <div><dt className="inline text-zinc-500">status: </dt><dd className="inline">{flow.audit.overallStatus}</dd></div>
          <div><dt className="inline text-zinc-500">copyright score: </dt><dd className="inline">{flow.audit.checks.copyrightMatchScore.toFixed(4)}</dd></div>
          <div><dt className="inline text-zinc-500">certificate: </dt><dd className="inline">{flow.audit.certificateHash}</dd></div>
          {flow.audit.fingerprint ? <div data-music-fingerprint><dt className="inline text-zinc-500">fingerprint (simulation): </dt><dd className="inline">{flow.audit.fingerprint}</dd></div> : null}
          <div><dt className="inline text-zinc-500">track tx: </dt><dd className="inline">{flow.track.txHash} ({flow.track.status})</dd></div>
          <div><dt className="inline text-zinc-500">audit tx: </dt><dd className="inline">{flow.audit.ledger?.txHash ?? 'none'} ({flow.audit.ledger?.status ?? 'n/a'})</dd></div>
          <div><dt className="inline text-zinc-500">audit previousHash: </dt><dd className="inline">{flow.audit.ledger?.previousHash ?? 'null'}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
