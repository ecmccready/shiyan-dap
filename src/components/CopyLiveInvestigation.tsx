"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { buildHandoffPack, formatReviewedCaseBrief } from "@/lib/medicare/case-brief";
import type { EvidencePack } from "@/lib/medicare/evidence";
import type { MedicareProvenance } from "@/lib/medicare/provenance";
import { MEDICARE_TIMER_EVENT, currentDispositionsJson, MEDICARE_REPORT_EVENT, reviewCompletion, reviewProgress, type InvestigationReport } from "@/lib/medicare/investigation";

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
  const r = report ?? heard;
  const copy = useCopy(4000, undefined, handoff ? "medicare hand-off pack" : brief ? "medicare reviewed brief" : "medicare dispositions");
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
      className={`inline-flex h-9 items-center rounded-full border px-4 text-xs ${base}${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : handoff ? (done ? "📦 Copy reviewed hand-off pack" : "📦 Copy hand-off pack (in progress)") : brief ? (done ? "✓ Copy reviewed case brief" : "Copy case brief (in progress)") : done ? "✓ Copy reviewed dispositions JSON" : "Copy current dispositions JSON"}
      {r && <span className="ml-2 font-mono opacity-70">{r.report_hash.slice(0, 8)}…</span>}
    </button>
  );
}
