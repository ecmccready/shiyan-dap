'use client';

import { useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import type { DiagnosticAuditResult } from '@/services/diagnostics-engine';

type SiweSummary = { overallValid?: boolean; overallFailures?: string[]; cryptoVerified?: boolean; structureValid?: boolean };
type Rec = {
  txHash: string;
  siwe?: SiweSummary | null;
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
  fingerprintVersion?: string;
  audioFingerprint?: string | null;
  audioFingerprintStatus?: string;
  audioFingerprintNote?: string;
  records: Rec[];
};

export default function MusicStudioPanel({ workspaceId }: { workspaceId: string }) {
  const hydrated = useHydrated();
  // Guard: the demo writes to the production ledger, so it is off unless the page URL has ?demo=1.
  const demoEnabled = hydrated && new URLSearchParams(window.location.search).get('demo') === '1';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-action form: create_music_asset through the server execute route.
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [splits, setSplits] = useState([{ account: '', percentage: '100' }]);
  const [rail, setRail] = useState('INTERNAL_MICRO');
  const [amount, setAmount] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  // Optional wallet signature for the MUSIC_TRACK event. Empty (default) = server-signed HMAC.
  const [walletAddress, setWalletAddress] = useState('');
  const [siweMessage, setSiweMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [prepared, setPrepared] = useState<{ assetId: string; timestamp: number; key: string; canonical: string } | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const walletUsed = Boolean(signature.trim() || siweMessage.trim() || walletAddress.trim());
  const splitSum = splits.reduce((a, b) => a + (Number(b.percentage) || 0), 0);
  const splitsUsed = splits.some((x) => x.account.trim());

  function formKey() {
    const splitRule = splitsUsed ? splits.filter((x) => x.account.trim()).map((x) => ({ account: x.account.trim(), percentage: Number(x.percentage) })) : undefined;
    return { splitRule, duration: Number(duration) > 0 ? Number(duration) : undefined };
  }

  // Builds the text to sign: fixes assetId and timestamp, computes the same metadataHash the server will, fetches a server nonce,
  // and fills in a SIWE message whose statement is the canonical string. The user signs it in their own wallet and pastes the signature.
  // Shared by the manual Prepare button and the browser wallet button. Returns the message and the prepared record.
  async function buildMessage(address: string) {
    if (!title.trim()) throw new Error('enter a title first');
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('enter the wallet address (0x plus 40 hex characters) first');
    const { splitRule, duration: dur } = formKey();
    const assetId = `trk_${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = Date.now();
    const data = new TextEncoder().encode(JSON.stringify({ assetId, title: title.trim(), duration: dur, splitRule }));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map((b) => b.toString(16).padStart(2, '0')).join('');
    const canonical = `${assetId}|MUSIC_TRACK|${timestamp}|${hash}`;
    const n = await fetch('/api/v1/siwe/nonce');
    const nj = await n.json();
    if (!n.ok || !nj.nonce) throw new Error(nj.error ?? 'could not get a server nonce');
    const host = window.location.host;
    const message = `${host} wants you to sign in with your Ethereum account:\n${address}\n\n${canonical}\n\nURI: ${window.location.origin}\nVersion: 1\nChain ID: 1\nNonce: ${nj.nonce}\nIssued At: ${new Date().toISOString()}`;
    setWalletAddress(address);
    setSiweMessage(message);
    setPrepared({ assetId, timestamp, canonical, key: JSON.stringify({ t: title.trim(), ...formKey() }) });
    setSignature('');
    return message;
  }

  async function prepareMessage() {
    setPrepError(null);
    try {
      await buildMessage(walletAddress.trim());
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : 'prepare failed');
    }
  }

  // One click: ask the browser wallet (window.ethereum, EIP-1193) for an account, prepare the message for it and personal_sign it.
  // Falls back with a plain message when no wallet is present or the user declines; the manual paste path is unchanged.
  async function signWithBrowserWallet() {
    setPrepError(null);
    setWalletBusy(true);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth || typeof eth.request !== 'function') throw new Error('no browser wallet detected: use Prepare and sign the text in your own wallet, then paste the signature');
      if (!title.trim()) throw new Error('enter a title first');
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const account = accounts?.[0];
      if (!account) throw new Error('the wallet returned no account');
      const message = await buildMessage(account);
      const hex = '0x' + Array.from(new TextEncoder().encode(message)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const sig = (await eth.request({ method: 'personal_sign', params: [hex, account] })) as string;
      if (typeof sig !== 'string' || !sig) throw new Error('the wallet returned no signature');
      setSignature(sig);
    } catch (e) {
      const err = e as { code?: number; message?: string };
      setPrepError(err.code === 4001 ? 'the wallet request was declined: nothing was signed' : err.message ?? 'wallet signing failed');
    } finally {
      setWalletBusy(false);
    }
  }

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
      if (walletUsed) {
        // The wallet path signs this exact track: refuse if the form changed since the message was prepared.
        if (!prepared || prepared.key !== JSON.stringify({ t: title.trim(), ...formKey() })) throw new Error('title, duration or splits changed since the message was prepared: prepare and sign again');
        if (!signature.trim()) throw new Error('paste the signature, or clear the wallet fields to stay server-signed');
        Object.assign(args, { walletAddress: walletAddress.trim(), signature: signature.trim(), assetId: prepared.assetId, timestamp: prepared.timestamp, ...(siweMessage.trim() ? { siweMessage } : {}) });
      }
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

  return (
    <div className="text-sm text-zinc-300">
      <p className="font-medium text-white">Music Studio</p>
      <p className="mt-1">Workspace: <span className="font-mono">{workspaceId}</span></p>
      <p className="mt-1 text-zinc-500">
        Creates a track, runs mock diagnostics, and records both events in the off-chain, hash-chained micro-ledger. This is not a public blockchain.
      </p>
      <div data-music-create className="mt-5 border-t border-zinc-800 pt-4">
        <p className="font-medium text-white">Create track and run diagnostics</p>
        <p className="mt-1 text-xs text-zinc-500">
          One action registers the track and its audit result as two server-signed events. Optional splits apply to settlement; they do not represent blockchain transactions.
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
        <details data-music-wallet className="mt-3 rounded border border-zinc-800 p-2 text-xs">
          <summary className="cursor-pointer text-zinc-400">Optional: sign the track with a wallet instead of the server{walletUsed ? ' (on)' : ''}</summary>
          <div className="mt-2 space-y-2">
            <p className="text-zinc-500">Default is a server-signed record. Here you can submit a wallet signature for the MUSIC_TRACK event only (the audit event stays server-signed). Enter your address, press Prepare, sign the text in your own wallet with personal_sign, paste the signature. The result shows the combined status and the SIWE overall line. A wallet record never reaches the server-signed &quot;verified&quot; status, so it never unlocks Stripe transfers.</p>
            <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Wallet address 0x…" className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1 font-mono" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={signWithBrowserWallet} disabled={walletBusy} data-music-wallet-browser className="rounded-full border border-emerald-700 px-3 py-1 text-emerald-300 disabled:opacity-50">{walletBusy ? 'Waiting for wallet…' : 'Sign with browser wallet'}</button>
              <button type="button" onClick={prepareMessage} data-music-wallet-prepare className="rounded-full border border-zinc-600 px-3 py-1 text-zinc-300">Prepare message to sign</button>
            </div>
            <p className="text-zinc-600">Sign with browser wallet connects the wallet in this browser (window.ethereum), prepares the message for its first account and asks it to personal_sign. Without a wallet, or if you decline, use Prepare and paste a signature as before.</p>
            {prepError ? <p className="text-red-400">{prepError}</p> : null}
            <textarea value={siweMessage} onChange={(e) => setSiweMessage(e.target.value)} placeholder="SIWE message to sign (filled by Prepare)" rows={7} className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1 font-mono" />
            <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Signature 0x… (65 bytes)" className="w-full rounded border border-zinc-700 bg-transparent px-2 py-1 font-mono" />
            {walletUsed ? <button type="button" onClick={() => { setWalletAddress(''); setSiweMessage(''); setSignature(''); setPrepared(null); }} className="text-zinc-500">clear wallet fields (back to server-signed)</button> : null}
          </div>
        </details>
        <button
          type="button"
          onClick={createAsset}
          disabled={busy || !demoEnabled || !title.trim() || (splitsUsed && Math.abs(splitSum - 100) > 0.001)}
          data-music-create-run
          className="mt-3 rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Create track and run diagnostics'}
        </button>
        {!demoEnabled ? <p className="mt-2 text-xs text-zinc-500">Writes are off. Add <span className="font-mono">?demo=1</span> to the URL to enable them.</p> : null}
        {created ? (
          <div data-music-create-result className="mt-4 space-y-3 break-all font-mono text-xs">
            <p><span className="text-zinc-500">asset: </span>{created.assetId} ({created.title})</p>
            <p>
              <span className="text-zinc-500">diagnostics: </span>{created.audit.overallStatus}, copyright score {created.audit.checks.copyrightMatchScore.toFixed(4)}, risk {created.audit.checks.trainingDataRisk}
              {created.reasons.length ? <span className="text-zinc-500"> ({created.reasons.join('; ')})</span> : null}
            </p>
            {created.fingerprint ? (
              <p data-music-fingerprint><span className="text-zinc-500">fingerprint (simulation{created.fingerprintVersion ? ` · ${created.fingerprintVersion}` : ''}, metadata-only SIMULATION, no audio analysed; audio fingerprint: not implemented): </span>{created.fingerprint}</p>
            ) : null}
            {created.fingerprint ? (
              <p data-music-audio-fingerprint className="text-amber-300">audio fingerprint: {created.audioFingerprint ? `${created.audioFingerprint} (` : ''}{created.audioFingerprintNote ?? 'not_implemented: no audio bytes analyzed'}{created.audioFingerprint ? ')' : ''}</p>
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
                {r.siwe ? (
                  <p data-music-siwe-overall className={r.siwe.overallValid ? 'text-emerald-400' : 'text-amber-300'}>
                    <span className="text-zinc-500">SIWE overall: </span>
                    {r.siwe.overallValid === undefined ? 'not computed' : r.siwe.overallValid ? 'valid (crypto, structure, domain, nonce, freshness, chain all pass)' : `not valid${r.siwe.overallFailures?.length ? `: ${r.siwe.overallFailures.join(', ')}` : ''}`}
                    <span className="text-zinc-500"> · informational, not full SIWE verification, never blocks the record</span>
                  </p>
                ) : (
                  <p data-music-siwe-overall className="text-zinc-500">SIWE: none on this record (server-signed event, no wallet message was submitted)</p>
                )}
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
    </div>
  );
}
