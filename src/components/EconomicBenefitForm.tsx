"use client";

import { useState } from "react";
import { useBenefit, saveBenefit, clearBenefit } from "@/lib/benefit-record";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Minimal, optional capture of the customer's actual economic benefit (journey step 4).
 * Self-reported and stored only in this browser; it is added to the exported evidence pack and never verified by the engine.
 * With a runId prop the form is tied to that run; without one (pilot page) it asks for a run id, prefilled from this browser session.
 */
export default function EconomicBenefitForm({ runId, tone = "dark" }: { runId?: string; tone?: "dark" | "light" }) {
  const hydrated = useHydrated();
  const [typedRun, setTypedRun] = useState<string | null>(null);
  const sessionRun = hydrated ? window.sessionStorage.getItem("aethel-active-run-id") ?? "" : "";
  const activeRun = (runId ?? typedRun ?? sessionRun).trim();
  const saved = useBenefit(activeRun || null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("USD");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const muted = tone === "dark" ? "text-zinc-500" : "text-neutral-500";
  const field = tone === "dark" ? "border-zinc-700 bg-transparent" : "border-neutral-300 bg-white";

  function save() {
    setMsg(null);
    if (!activeRun) return setMsg("Enter a run id first.");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(activeRun)) return setMsg("That does not look like a run id.");
    if (!amount.trim() && !note.trim()) return setMsg("Enter an amount or a short note.");
    setMsg(saveBenefit(activeRun, amount, unit, note) ? "Saved in this browser." : "Could not save: browser storage is unavailable.");
  }

  function valid(): boolean {
    if (!activeRun) { setMsg("Enter a run id first."); return false; }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(activeRun)) { setMsg("That does not look like a run id."); return false; }
    if (!amount.trim() && !note.trim()) { setMsg("Enter an amount or a short note."); return false; }
    return true;
  }

  async function recordOnLedger() {
    setMsg(null);
    if (!valid()) { setConfirming(false); return; }
    setPosting(true);
    try {
      const res = await fetch("/api/v1/ledger/benefit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: activeRun, amount, unit, note }) });
      const j = await res.json();
      if (!res.ok || !j.txHash) throw new Error(j.error ?? "ledger write failed");
      saveBenefit(activeRun, amount, unit, note, { txHash: j.txHash, assetId: j.assetId, recorded_at: new Date().toISOString(), amount: amount.trim(), unit: unit.trim(), note: note.trim() });
      setMsg("Recorded on the ledger (unsigned, self-reported).");
    } catch (e) {
      setMsg(`Not recorded: ${e instanceof Error ? e.message : "ledger write failed"}. Nothing was changed on the ledger.`);
    } finally {
      setPosting(false);
      setConfirming(false);
    }
  }

  return (
    <div data-economic-benefit className="space-y-2 text-xs">
      <p className="font-medium">Record actual economic benefit (optional)</p>
      <p className={muted}>
        Self-reported by you. By default it is stored only in this browser and is not written to the ledger. It is not verified by the engine. If present, it is added to the exported evidence pack and labelled self-reported. The ledger button below is opt-in.
      </p>
      {!runId && (
        <input
          value={typedRun ?? sessionRun}
          onChange={(e) => setTypedRun(e.target.value)}
          placeholder="Run id (run_…)"
          aria-label="Run id"
          className={`w-full rounded border px-2 py-1 font-mono ${field}`}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (e.g. 12000)" aria-label="Amount" className={`w-40 rounded border px-2 py-1 ${field}`} />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit (USD, hours, %)" aria-label="Unit" className={`w-36 rounded border px-2 py-1 ${field}`} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, over what period, how you measured it" aria-label="Note" rows={2} maxLength={500} className={`w-full rounded border px-2 py-1 ${field}`} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} data-benefit-save className="rounded-full bg-emerald-600 px-3 py-1 text-white">Save (self-reported)</button>
        {saved ? <button type="button" onClick={() => { clearBenefit(activeRun); setMsg("Cleared."); }} className={muted}>clear saved entry</button> : null}
        {msg ? <span role="status" className={muted}>{msg}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3" data-benefit-ledger>
        {!confirming ? (
          <button type="button" onClick={() => { if (valid()) setConfirming(true); }} disabled={posting} data-benefit-ledger-start className={`rounded-full border px-3 py-1 ${tone === "dark" ? "border-zinc-600 text-zinc-300" : "border-neutral-400 text-neutral-700"}`}>Record benefit on ledger (optional)</button>
        ) : (
          <>
            <span className={muted}>This adds a permanent, append-only ECONOMIC_BENEFIT event to the shared ledger, unsigned and marked self-reported and unverified. Only an admin can remove it.</span>
            <button type="button" onClick={recordOnLedger} disabled={posting} data-benefit-ledger-confirm className="rounded-full bg-emerald-600 px-3 py-1 text-white">{posting ? "Recording…" : "Confirm: record on ledger"}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={posting} className={muted}>cancel</button>
          </>
        )}
      </div>
      {saved ? (
        <p data-benefit-saved className={muted}>
          Saved for {saved.run_id}: {saved.amount || "no amount"} {saved.unit}{saved.note ? `, ${saved.note}` : ""} (self-reported, {saved.recorded_at}).{saved.ledger ? ` Also recorded on the ledger as an unsigned, unverified ECONOMIC_BENEFIT event (tx ${saved.ledger.txHash}).` : ""}
        </p>
      ) : null}
    </div>
  );
}
