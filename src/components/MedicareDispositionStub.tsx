"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/MedicareReviewProgress";
import CopyLiveInvestigation from "@/components/CopyLiveInvestigation";
import { MEDICARE_FILTER_EVENT, applyBulkDisposition, filterEmphasis, type DispositionStatus, MEDICARE_REPORT_EVENT, MEDICARE_PROGRESS_EVENT, reviewProgress, applyDisposition, buildInvestigationReport, DISPOSITION_STATUSES, type DispositionInput } from "@/lib/medicare/investigation";
import { medicareAnchorId } from "@/lib/medicare/case-brief";
import type { EvidencePack } from "@/lib/medicare/evidence";

/** Client-only disposition stub over the synthetic fixture. State lives in this tab; nothing is stored or sent. */
export default function MedicareDispositionStub({ pack, highlight }: { pack: EvidencePack; highlight?: string }) {
  const [disp, setDisp] = useState<DispositionInput>({});
  const [filter, setFilter] = useState<DispositionStatus | null>(null);
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<DispositionStatus | null>).detail; setFilter(typeof d === "string" ? d : null); };
    window.addEventListener(MEDICARE_FILTER_EVENT, on);
    return () => window.removeEventListener(MEDICARE_FILTER_EVENT, on);
  }, []);
  const report = useMemo(() => buildInvestigationReport({ pack, dispositions: disp }), [pack, disp]);
  const progress = useMemo(() => reviewProgress(report), [report]);
  useEffect(() => { window.dispatchEvent(new CustomEvent(MEDICARE_PROGRESS_EVENT, { detail: progress })); window.dispatchEvent(new CustomEvent(MEDICARE_REPORT_EVENT, { detail: report })); }, [progress, report]);
  return (
    <div data-medicare-disposition-stub className="space-y-2">
      <p className="text-emerald-400 text-xs">Reviewer disposition (stub, this tab only)</p>
      <ProgressBar p={progress} />
      {filter && (
        <p className="text-xs text-zinc-300" data-medicare-filter-note>Filtered: {filter} ({report.entries.filter((e) => e.status === filter).length}) · <button type="button" className="underline" onClick={() => { setFilter(null); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: null })); }}>Show all</button></p>
      )}
      {filter && (() => {
        const visible = report.entries.filter((e) => e.status === filter).map((e) => e.item_id);
        const bulk = (to: DispositionStatus) => {
          setDisp((d) => applyBulkDisposition(d, visible, to));
          setFilter(to); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: to }));
        };
        return visible.length > 0 ? (
          <div data-medicare-bulk className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-400">Set all {visible.length} shown:</span>
            {filter !== "needs_human_review" && <button type="button" data-medicare-bulk-set="needs_human_review" onClick={() => bulk("needs_human_review")} className="rounded-full bg-amber-400 text-black px-3 py-1 font-semibold">needs_human_review</button>}
            {filter !== "cleared_pattern_only" && <button type="button" data-medicare-bulk-set="cleared_pattern_only" onClick={() => bulk("cleared_pattern_only")} className="rounded-full bg-emerald-400 text-black px-3 py-1 font-semibold">cleared_pattern_only</button>}
            {filter !== "unreviewed" && <button type="button" data-medicare-bulk-set="unreviewed" onClick={() => bulk("unreviewed")} className="rounded-full border border-zinc-500 text-zinc-200 px-3 py-1">reset to unreviewed</button>}
          </div>
        ) : null;
      })()}
      <ul id="medicare-disposition-list" className="scroll-mt-24 space-y-1 text-xs font-mono text-zinc-300">
        {report.entries.map((e) => (
          <li key={e.item_id} id={medicareAnchorId("disposition", e.item_id)} data-medicare-filter-emphasis={filterEmphasis(e.status, filter)} className={`scroll-mt-24 flex flex-wrap items-center gap-2 transition-opacity ${filterEmphasis(e.status, filter) === "dim" ? "opacity-30" : filterEmphasis(e.status, filter) === "match" ? "rounded ring-2 ring-white/70 px-2 py-1" : ""} ${e.item_id === highlight ? "rounded bg-emerald-500/15 border-l-4 border-emerald-400 px-2 py-1" : ""}`}>
            <span>{e.item_id}</span>
            <select
              aria-label={`Disposition for ${e.item_id}`}
              data-medicare-disposition={e.item_id}
              value={e.status}
              onChange={(ev) => setDisp((d) => applyDisposition(d, e.item_id, ev.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
            >
              {DISPOSITION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <p className="text-xs font-mono text-zinc-400 break-all" data-medicare-live-report-hash>
        report sha256 {report.report_hash} · {report.counts.unreviewed} unreviewed, {report.counts.needs_human_review} needs_human_review, {report.counts.cleared_pattern_only} cleared_pattern_only
      </p>
      <div className="flex flex-wrap items-center gap-3"><CopyLiveInvestigation report={report} />
      <button type="button" onClick={() => setDisp({})} className="text-xs underline text-zinc-400">Reset</button></div>
    </div>
  );
}
