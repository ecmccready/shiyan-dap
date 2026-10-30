"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { formatReviewedCaseBrief } from "@/lib/medicare/case-brief";
import type { EvidencePack } from "@/lib/medicare/evidence";
import type { MedicareProvenance } from "@/lib/medicare/provenance";
import { currentDispositionsJson, MEDICARE_REPORT_EVENT, reviewCompletion, reviewProgress, type InvestigationReport } from "@/lib/medicare/investigation";

/** Copies the live investigation report (current statuses + report_hash). With `report` it is controlled; otherwise it follows the stub's tab-local event. */
export default function CopyLiveInvestigation({ report, initial, brief }: { report?: InvestigationReport; initial?: InvestigationReport; brief?: { evidence: EvidencePack; provenance: MedicareProvenance } }) {
  const [heard, setHeard] = useState<InvestigationReport | undefined>(initial);
  useEffect(() => {
    if (report) return;
    const on = (ev: Event) => { const d = (ev as CustomEvent<InvestigationReport>).detail; if (d && typeof d.report_hash === "string") setHeard(d); };
    window.addEventListener(MEDICARE_REPORT_EVENT, on);
    return () => window.removeEventListener(MEDICARE_REPORT_EVENT, on);
  }, [report]);
  const r = report ?? heard;
  const copy = useCopy(4000, undefined, brief ? "medicare reviewed brief" : "medicare dispositions");
  const json = brief ? formatReviewedCaseBrief(r, brief.evidence, brief.provenance) : currentDispositionsJson(r);
  const done = reviewCompletion(reviewProgress(r)).complete;
  const base = done
    ? "bg-emerald-400 text-black font-semibold border-emerald-300 hover:bg-emerald-300"
    : "border-zinc-600 text-zinc-200 hover:border-zinc-400";
  return (
    <button
      type="button"
      {...(brief ? { "data-copy-medicare-reviewed-brief": true } : { "data-copy-medicare-dispositions": true })}
      data-review-complete={done ? "true" : "false"}
      disabled={!json}
      onClick={() => void copy.copy(json)}
      className={`inline-flex h-9 items-center rounded-full border px-4 text-xs ${base}${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : brief ? (done ? "✓ Copy reviewed case brief" : "Copy case brief (in progress)") : done ? "✓ Copy reviewed dispositions JSON" : "Copy current dispositions JSON"}
      {r && <span className="ml-2 font-mono opacity-70">{r.report_hash.slice(0, 8)}…</span>}
    </button>
  );
}
