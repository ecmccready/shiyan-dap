'use client';

import { useState } from 'react';
import { recordLedgerState } from '@/lib/micro-ledger-client';
import type { DiagnosticAuditResult } from '@/services/diagnostics-engine';
import type { LedgerRecordResponse } from '@/types/ledger';

type Flow = {
  assetId: string;
  title: string;
  track: LedgerRecordResponse;
  audit: DiagnosticAuditResult & { ledger: (LedgerRecordResponse & { previousHash?: string | null }) | null };
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function MusicStudioPanel({ workspaceId }: { workspaceId: string }) {
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ assetId, assetType: 'AUDIO', contentHash }),
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
        disabled={busy}
        data-music-flow-run
        className="mt-3 rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
      >
        {busy ? 'Running…' : 'Create demo track and run diagnostics'}
      </button>
      {error ? <p className="mt-3 text-red-400">{error}</p> : null}
      {flow ? (
        <dl data-music-flow-result className="mt-4 space-y-1 break-all font-mono text-xs">
          <div><dt className="inline text-zinc-500">asset: </dt><dd className="inline">{flow.assetId}</dd></div>
          <div><dt className="inline text-zinc-500">status: </dt><dd className="inline">{flow.audit.overallStatus}</dd></div>
          <div><dt className="inline text-zinc-500">copyright score: </dt><dd className="inline">{flow.audit.checks.copyrightMatchScore.toFixed(4)}</dd></div>
          <div><dt className="inline text-zinc-500">certificate: </dt><dd className="inline">{flow.audit.certificateHash}</dd></div>
          <div><dt className="inline text-zinc-500">track tx: </dt><dd className="inline">{flow.track.txHash} ({flow.track.status})</dd></div>
          <div><dt className="inline text-zinc-500">audit tx: </dt><dd className="inline">{flow.audit.ledger?.txHash ?? 'none'} ({flow.audit.ledger?.status ?? 'n/a'})</dd></div>
          <div><dt className="inline text-zinc-500">audit previousHash: </dt><dd className="inline">{flow.audit.ledger?.previousHash ?? 'null'}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
