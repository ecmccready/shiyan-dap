"use client";

import { useEffect, useRef, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { buildHandoffPack, formatReviewedCaseBrief } from "@/lib/medicare/case-brief";
import type { EvidencePack } from "@/lib/medicare/evidence";
import type { MedicareProvenance } from "@/lib/medicare/provenance";
import { handoffReadyAnnotated, handoffPackReadyPulse, HANDOFF_PACK_READY_PULSE_MS, MEDICARE_HANDOFF_FOCUS_EVENT, HANDOFF_PULSE_MS, handoffPulseActive, MEDICARE_TIMER_EVENT, currentDispositionsJson, dispositionsCopyPulse, DISPOSITIONS_COPY_PULSE_MS, handoffCopyPulse, HANDOFF_COPY_PULSE_MS, MEDICARE_REPORT_EVENT, reviewCompletion, reviewProgress, type InvestigationReport } from "@/lib/medicare/investigation";

/** Copies the live investigation report (current statuses + report_hash). With `report` it is controlled; otherwise it follows the stub's tab-local event. */
export default function CopyLiveInvestigation({ report, initial, brief, handoff }: { report?: InvestigationReport; initial?: InvestigationReport; brief?: { evidence: EvidencePack; provenance: MedicareProvenance }; handoff?: boolean }) {
  const [heard, setHeard] = useState<InvestigationReport | undefined>(initial);
  useEffect(() => {
    if (report) return;
    const on = (ev: Event) => { const d = (ev as CustomEvent<InvestigationReport>).detail; if (d && typeof d.report_hash === "string") setHeard(d); };
    window.addEventListener(MEDICARE_REPORT_EVENT, on);
    return () => window.removeEventListener(MEDICARE_REPORT_EVENT, on);
  }, [report]);
  const [timer, setTimer] = useState<{ elapsed_ms: number | null; frozen: boolean }>({ elapsed_ms: null, frozen: false });
  useEffect(() => {
    if (!handoff) return;
    const on = (ev: Event) => { const d = (ev as CustomEvent<{ elapsed_ms: number | null; frozen: boolean }>).detail; if (d) setTimer(d); };
    window.addEventListener(MEDICARE_TIMER_EVENT, on);
    return () => window.removeEventListener(MEDICARE_TIMER_EVENT, on);
  }, [handoff]);
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!handoff) return;
    const on = () => { const t = Date.now(); setPulseAt(t); setTick(t); window.setTimeout(() => setTick(Date.now()), HANDOFF_PULSE_MS + 50); };
    window.addEventListener(MEDICARE_HANDOFF_FOCUS_EVENT, on);
    return () => window.removeEventListener(MEDICARE_HANDOFF_FOCUS_EVENT, on);
  }, [handoff]);
  const pulsing = handoff && handoffPulseActive(pulseAt, tick);
  const r = report ?? heard;
  const readyNow = handoff ? handoffReadyAnnotated(r).ready : false;
  const prevReady = useRef<boolean | null>(null);
  const readyPulsedOnce = useRef(false);
  const [readyPulseAt, setReadyPulseAt] = useState<number | null>(null);
  const [readyTick, setReadyTick] = useState(0);
  useEffect(() => {
    if (!handoff) return;
    if (prevReady.current === false && readyNow && !readyPulsedOnce.current) {
      readyPulsedOnce.current = true; prevReady.current = true;
      const t = Date.now(); setReadyPulseAt(t); setReadyTick(t);
      const id = setTimeout(() => setReadyTick(Date.now()), HANDOFF_PACK_READY_PULSE_MS + 50); return () => clearTimeout(id);
    }
    prevReady.current = readyNow;
  }, [handoff, readyNow]);
  const readyPulsing = handoff && handoffPackReadyPulse(readyPulseAt, readyTick, readyNow);
  const copy = useCopy(4000, undefined, handoff ? "medicare hand-off pack" : brief ? "medicare reviewed brief" : "medicare dispositions");
  const dispCopyFired = useRef(false);
  const [dispCopyAt, setDispCopyAt] = useState<number | null>(null);
  const [dispCopyTick, setDispCopyTick] = useState(0);
  useEffect(() => {
    if (handoff || brief || copy.status !== "copied" || dispCopyFired.current) return;
    dispCopyFired.current = true; const t = Date.now(); setDispCopyAt(t); setDispCopyTick(t);
    window.setTimeout(() => setDispCopyTick(Date.now()), DISPOSITIONS_COPY_PULSE_MS + 50);
  }, [handoff, brief, copy.status]);
  const dispCopyPulsing = !handoff && !brief && dispositionsCopyPulse(dispCopyAt, dispCopyTick, dispCopyFired.current);
  const hoCopyFired = useRef(false);
  const [hoCopyAt, setHoCopyAt] = useState<number | null>(null);
  const [hoCopyTick, setHoCopyTick] = useState(0);
  useEffect(() => {
    if (!handoff || copy.status !== "copied" || hoCopyFired.current) return;
    hoCopyFired.current = true; const t = Date.now(); setHoCopyAt(t); setHoCopyTick(t);
    window.setTimeout(() => setHoCopyTick(Date.now()), HANDOFF_COPY_PULSE_MS + 50);
  }, [handoff, copy.status]);
  const hoCopyPulsing = !!handoff && handoffCopyPulse(hoCopyAt, hoCopyTick, hoCopyFired.current);
  const json = handoff && brief ? buildHandoffPack(r, brief.evidence, brief.provenance, timer) : brief ? formatReviewedCaseBrief(r, brief.evidence, brief.provenance) : currentDispositionsJson(r);
  const done = reviewCompletion(reviewProgress(r)).complete;
  const base = handoff ? (done ? "bg-emerald-400 text-black font-bold border-2 border-white shadow-lg shadow-emerald-500/30 h-10 px-5 text-sm" : "border-2 border-emerald-500 text-emerald-200 font-semibold") : done
    ? "bg-emerald-400 text-black font-semibold border-emerald-300 hover:bg-emerald-300"
    : "border-zinc-600 text-zinc-200 hover:border-zinc-400";
  return (
    <button
      type="button"
      {...(handoff ? { "data-copy-medicare-handoff": true } : brief ? { "data-copy-medicare-reviewed-brief": true } : { "data-copy-medicare-dispositions": true })}
      data-review-complete={done ? "true" : "false"}
      disabled={!json}
      onClick={() => void copy.copy(json)}
      data-pulse={pulsing ? "true" : undefined}
      data-medicare-handoff-ready-pulse={readyPulsing ? "1" : undefined}
      data-medicare-handoff-copy-pulse={hoCopyPulsing ? "1" : undefined}
      data-medicare-dispositions-copy-pulse={dispCopyPulsing ? "1" : undefined}
      className={`inline-flex h-9 items-center rounded-full border px-4 text-xs ${base}${pulsing ? " ring-4 ring-amber-300 animate-pulse scale-105" : readyPulsing ? " ring-4 ring-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.7)] motion-safe:animate-pulse" : hoCopyPulsing ? " ring-4 ring-violet-300 shadow-[0_0_20px_rgba(196,181,253,0.7)] motion-safe:animate-pulse" : dispCopyPulsing ? " ring-4 ring-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.7)] motion-safe:animate-pulse" : ""} transition-transform${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : handoff ? (done ? "📦 Copy reviewed hand-off pack" : "📦 Copy hand-off pack (in progress)") : brief ? (done ? "✓ Copy reviewed case brief" : "Copy case brief (in progress)") : done ? "✓ Copy reviewed dispositions JSON" : "Copy current dispositions JSON"}
      {r && <span className="ml-2 font-mono opacity-70">{r.report_hash.slice(0, 8)}…</span>}
    </button>
  );
}
