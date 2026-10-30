"use client";

import { useEffect, useState } from "react";
import { MEDICARE_FILTER_EVENT, MEDICARE_REPORT_EVENT, DISPOSITION_STATUSES, statusChips, notesCount, toggleStatusFilter, type DispositionStatus, type InvestigationReport } from "@/lib/medicare/investigation";

const TONE = {
  unreviewed: "border-zinc-500 text-zinc-200 bg-zinc-800",
  needs_human_review: "border-amber-400 text-black bg-amber-400",
  cleared_pattern_only: "border-emerald-400 text-black bg-emerald-400",
} as const;

/** Per-item status chips; follow the disposition stub's tab-local report event. Each links to its disposition row. */
export default function MedicareStatusChips({ initial }: { initial: InvestigationReport }) {
  const [r, setR] = useState<InvestigationReport>(initial);
  const [filter, setFilter] = useState<DispositionStatus | null>(null);
  const pick = (next: DispositionStatus | null) => {
    setFilter(next);
    window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: next }));
    if (next) document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<InvestigationReport>).detail; if (d && Array.isArray(d.entries)) setR(d); };
    window.addEventListener(MEDICARE_REPORT_EVENT, on);
    return () => window.removeEventListener(MEDICARE_REPORT_EVENT, on);
  }, []);
  const chips = statusChips(r);
  return (
    <div data-medicare-status-chips className="space-y-2">
      <div className="flex flex-wrap gap-2" data-medicare-status-filter={filter ?? "all"}>
        {(() => { const nc = notesCount(r); return (
          <a href="#medicare-disposition-list" data-medicare-notes-count={nc.count} title="Reviewer notes on dispositioned items"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${nc.count ? "border-sky-300 bg-sky-500 text-black" : "border-zinc-600 text-zinc-400"}`}>✎ {nc.label}</a>
        ); })()}
        <button type="button" onClick={() => pick(null)} aria-pressed={filter === null}
          className={`rounded-full border px-3 py-1 text-xs ${filter === null ? "border-white text-white" : "border-zinc-600 text-zinc-400"}`}>All ({chips.length})</button>
        {DISPOSITION_STATUSES.map((s) => {
          const n = chips.filter((c) => c.status === s).length;
          return (
            <button key={s} type="button" data-medicare-filter-button={s} aria-pressed={filter === s} onClick={() => pick(toggleStatusFilter(filter, s))}
              className={`rounded-full border px-3 py-1 text-xs ${filter === s ? `${TONE[s]} ring-2 ring-white` : "border-zinc-600 text-zinc-300"}`}>{s} ({n})</button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.item_id} type="button" onClick={() => pick(toggleStatusFilter(filter, c.status))} data-medicare-status-chip={c.status} title={`${c.item_id} — click to filter by ${c.status}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[c.status]} ${filter && filter !== c.status ? "opacity-30" : ""} ${filter === c.status ? "ring-2 ring-white" : ""}`}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}
