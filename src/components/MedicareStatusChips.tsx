"use client";

import { useEffect, useRef, useState } from "react";
import { MEDICARE_FILTER_EVENT, MEDICARE_REPORT_EVENT, DISPOSITION_STATUSES, statusChips, notesCount, notesCoverage, unreviewedLeftChip, filterShownChip, MEDICARE_PROGRESS_JUMP_EVENT, statusMix, notesNudge, firstRowWithoutNote, handoffReadyAnnotated, handoffReadyChipPulse, HANDOFF_READY_PULSE_MS, notesChipPulse, NOTES_CHIP_PULSE_MS, MEDICARE_HANDOFF_FOCUS_EVENT, toggleStatusFilter, toggleRowFilter, cycleRowFilter, rowMatchesFilter, type RowFilter, type DispositionStatus, type InvestigationReport } from "@/lib/medicare/investigation";

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
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<RowFilter>).detail; setFilter(typeof d === "string" ? d : null); };
    window.addEventListener(MEDICARE_FILTER_EVENT, on);
    return () => window.removeEventListener(MEDICARE_FILTER_EVENT, on);
  }, []);
  const ready = handoffReadyAnnotated(r).ready;
  const prevReady = useRef<boolean | null>(null);
  const pulsedOnce = useRef(false);
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (prevReady.current === false && ready && !pulsedOnce.current) {
      pulsedOnce.current = true; prevReady.current = true;
      const t = Date.now(); setPulseAt(t); setNow(t);
      const id = setTimeout(() => setNow(Date.now()), HANDOFF_READY_PULSE_MS); return () => clearTimeout(id);
    }
    prevReady.current = ready;
  }, [ready]);
  const chipPulsing = handoffReadyChipPulse(pulseAt, now, ready);
  const noteCount = notesCount(r).count;
  const prevNotes = useRef<number | null>(null);
  const notesPulsedOnce = useRef(false);
  const [notesPulseAt, setNotesPulseAt] = useState<number | null>(null);
  const [notesNow, setNotesNow] = useState(0);
  useEffect(() => {
    if (prevNotes.current === 0 && noteCount >= 1 && !notesPulsedOnce.current) {
      notesPulsedOnce.current = true; prevNotes.current = noteCount;
      const t = Date.now(); setNotesPulseAt(t); setNotesNow(t);
      const id = setTimeout(() => setNotesNow(Date.now()), NOTES_CHIP_PULSE_MS); return () => clearTimeout(id);
    }
    prevNotes.current = noteCount;
  }, [noteCount]);
  const notesPulsing = notesChipPulse(notesPulseAt, notesNow, noteCount);
  const chips = statusChips(r);
  return (
    <div data-medicare-status-chips className="space-y-2">
      {(() => { const h = handoffReadyAnnotated(r); return h.ready ? (
        <a href="#medicare-win" data-medicare-handoff-ready-annotated data-pulsing={chipPulsing ? "1" : undefined} onClick={(ev) => {
            const btn = document.querySelector<HTMLElement>("[data-copy-medicare-handoff]");
            if (!btn) return;
            ev.preventDefault();
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
            window.dispatchEvent(new CustomEvent(MEDICARE_HANDOFF_FOCUS_EVENT, { detail: Date.now() }));
            window.setTimeout(() => btn.focus({ preventScroll: true }), 400);
          }} className={`inline-flex items-center gap-2 rounded-full border-2 border-white bg-emerald-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/40 transition-shadow ${chipPulsing ? "ring-4 ring-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.7)] motion-safe:animate-pulse" : ""}`}>
          ✅ {h.label} <span className="text-xs font-semibold opacity-80">— copy the 📦 hand-off pack</span>
        </a>
      ) : null; })()}
      {(() => { const n = notesNudge(r); return n.show ? (
        <div role="status" data-medicare-notes-nudge className="rounded-xl border-2 border-sky-400 bg-sky-500/15 px-3 py-2 text-sm text-sky-100">
          <button type="button" data-medicare-notes-nudge-jump={firstRowWithoutNote(r).item_id ?? ""} title="Jump to the first row without a note and focus its note field"
            onClick={() => { const id = firstRowWithoutNote(r).item_id; if (!id) return; const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }}
            className="mr-2 rounded-full bg-sky-400 text-black px-2 py-0.5 text-xs font-bold hover:ring-2 hover:ring-white">✎ Add notes? ↓</button>
          {n.message} <a href="#medicare-disposition-list" className="underline font-semibold">Go to dispositions ↓</a>
        </div>
      ) : null; })()}
      <div className="flex flex-wrap gap-2" data-medicare-status-filter={filter ?? "all"}>
        {(() => { const nc = notesCount(r); return (
          <button type="button" data-medicare-notes-count={nc.count} data-medicare-notes-pulse={notesPulsing ? "on" : undefined} data-medicare-filter-button="has_note" aria-pressed={filter === "has_note"} disabled={!nc.count && filter !== "has_note"}
            onClick={() => pick(toggleRowFilter(filter, "has_note"))} title="Show only rows with a reviewer note (click again to clear)"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${nc.count ? "border-sky-300 bg-sky-500 text-black" : "border-zinc-600 text-zinc-400"} ${filter === "has_note" ? "ring-2 ring-white" : ""} ${notesPulsing ? "ring-4 ring-sky-300 motion-safe:animate-pulse" : ""} disabled:cursor-default`}>✎ {nc.label}</button>
        ); })()}
        {(() => { const cv = notesCoverage(r); return cv.show ? (
          <button type="button" data-medicare-notes-coverage={`${cv.noted}/${cv.total}`} data-medicare-notes-coverage-filter={filter === "has_note" ? "on" : "off"} aria-pressed={filter === "has_note"}
            onClick={() => pick(toggleRowFilter(filter, "has_note"))} title="Items with a reviewer note — click to show only rows with notes (click again to clear)"
            className={`rounded-full border px-3 py-1 text-xs font-semibold hover:border-white ${cv.noted === cv.total ? "border-emerald-300 bg-emerald-500/20 text-emerald-100" : "border-sky-300 bg-sky-500/15 text-sky-100"} ${filter === "has_note" ? "ring-2 ring-white" : ""}`}>{cv.label}{filter === "has_note" ? " ▸ has_note" : ""}</button>
        ) : null; })()}
        {(() => { const u = unreviewedLeftChip(r); return u.show ? (
          <button type="button" data-medicare-unreviewed-left={`${u.left}/${u.total}`} onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_PROGRESS_JUMP_EVENT))} title="Jump to the first unreviewed disposition row (same as clicking review progress)"
            className="rounded-full border border-zinc-400 bg-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-100 hover:border-white">{u.label} ↓</button>
        ) : null; })()}
        {(() => { const fs = filterShownChip(r, filter); return fs.show ? (
          <button type="button" data-medicare-filter-shown={`${fs.shown}/${fs.total}`} onClick={() => pick(null)} title="Rows visible under the current filter — click to reset filter to All"
            className="rounded-full border border-amber-300 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100 hover:border-white">{fs.label} ✕</button>
        ) : null; })()}
        {(() => { const m = statusMix(r); return m.show ? (
          <button type="button" data-medicare-status-mix={`${m.counts.needs_human_review}/${m.counts.cleared_pattern_only}/${m.counts.unreviewed}`} data-medicare-status-mix-cycle={filter ?? "all"} onClick={() => pick(cycleRowFilter(filter))} title={`Items per review status — click to cycle row filter (same as f); now: ${filter ?? "all"}`}
            className={`rounded-full border border-zinc-500 bg-zinc-800 px-3 py-1 text-xs font-mono text-zinc-200 hover:border-white ${filter ? "ring-2 ring-white" : ""}`}>{m.label}{filter ? ` ▸ ${filter}` : " ▸"}</button>
        ) : null; })()}
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
