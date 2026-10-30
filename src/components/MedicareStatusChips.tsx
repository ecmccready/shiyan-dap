"use client";

import { useEffect, useState } from "react";
import { MEDICARE_FILTER_EVENT, MEDICARE_REPORT_EVENT, DISPOSITION_STATUSES, statusChips, notesCount, notesNudge, handoffReadyAnnotated, toggleStatusFilter, toggleRowFilter, rowMatchesFilter, type RowFilter, type DispositionStatus, type InvestigationReport } from "@/lib/medicare/investigation";

const TONE = {
  unreviewed: "border-zinc-500 text-zinc-200 bg-zinc-800",
  needs_human_review: "border-amber-400 text-black bg-amber-400",
  cleared_pattern_only: "border-emerald-400 text-black bg-emerald-400",
} as const;

/** Per-item status chips; follow the disposition stub's tab-local report event. Each links to its disposition row. */
export default function MedicareStatusChips({ initial }: { initial: InvestigationReport }) {
  const [r, setR] = useState<InvestigationReport>(initial);
  const [filter, setFilter] = useState<RowFilter>(null);
  const pick = (next: RowFilter) => {
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
      {(() => { const h = handoffReadyAnnotated(r); return h.ready ? (
        <a href="#medicare-win" data-medicare-handoff-ready-annotated className="inline-flex items-center gap-2 rounded-full border-2 border-white bg-emerald-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/40">
          ✅ {h.label} <span className="text-xs font-semibold opacity-80">— copy the 📦 hand-off pack</span>
        </a>
      ) : null; })()}
      {(() => { const n = notesNudge(r); return n.show ? (
        <div role="status" data-medicare-notes-nudge className="rounded-xl border-2 border-sky-400 bg-sky-500/15 px-3 py-2 text-sm text-sky-100">
          <span className="mr-2 rounded-full bg-sky-400 text-black px-2 py-0.5 text-xs font-bold">✎ Add notes?</span>
          {n.message} <a href="#medicare-disposition-list" className="underline font-semibold">Go to dispositions ↓</a>
        </div>
      ) : null; })()}
      <div className="flex flex-wrap gap-2" data-medicare-status-filter={filter ?? "all"}>
        {(() => { const nc = notesCount(r); return (
          <button type="button" data-medicare-notes-count={nc.count} data-medicare-filter-button="has_note" aria-pressed={filter === "has_note"} disabled={!nc.count && filter !== "has_note"}
            onClick={() => pick(toggleRowFilter(filter, "has_note"))} title="Show only rows with a reviewer note (click again to clear)"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${nc.count ? "border-sky-300 bg-sky-500 text-black" : "border-zinc-600 text-zinc-400"} ${filter === "has_note" ? "ring-2 ring-white" : ""} disabled:cursor-default`}>✎ {nc.label}</button>
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
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[c.status]} ${filter && !rowMatchesFilter(r.entries.find((e) => e.item_id === c.item_id), filter) ? "opacity-30" : ""} ${filter && filter !== "has_note" && filter === c.status ? "ring-2 ring-white" : ""}`}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}
