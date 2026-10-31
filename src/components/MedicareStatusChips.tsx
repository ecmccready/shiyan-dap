"use client";

import { useEffect, useRef, useState } from "react";
import { lastRowPulse, lastRowShouldPulse, LAST_ROW_PULSE_MS, MEDICARE_LAST_ROW_PULSE_EVENT } from "@/lib/medicare/investigation";
import { unreviewedFilterPulse, unreviewedFilterShouldPulse, UNREVIEWED_FILTER_PULSE_MS, MEDICARE_UNREVIEWED_FILTER_PULSE_EVENT, unreviewedFilterChip, clearedChip, clearedPulse, clearedShouldPulse, CLEARED_PULSE_MS, MEDICARE_CLEARED_PULSE_EVENT, needsReviewPulse, needsReviewShouldPulse, NEEDS_REVIEW_PULSE_MS, MEDICARE_NEEDS_REVIEW_PULSE_EVENT, needsReviewChip, filterAllChip, filterAllPulse, filterAllShouldPulse, FILTER_ALL_PULSE_MS, MEDICARE_FILTER_ALL_PULSE_EVENT } from "@/lib/medicare/investigation";
import { reviewDoneFilterPulse, reviewDoneFilterShouldPulse, REVIEW_DONE_FILTER_PULSE_MS, MEDICARE_REVIEW_DONE_PULSE_EVENT, medicareCopyRecentPulse, MEDICARE_COPY_RECENT_PULSE_MS, MEDICARE_RECENT_COPY_EVENT, MEDICARE_RECENT_COPIED_EVENT, medicareCopyRecentChip, TOAST_PILL_COPIED_MS, MEDICARE_RECENT_STATE_EVENT, MEDICARE_RECENT_CLEAR_EVENT, medicareRecentChip, MEDICARE_TOASTS_STATE_EVENT, MEDICARE_TOASTS_CLEAR_EVENT, medicareToastsChip, MEDICARE_FILTER_EVENT, MEDICARE_REPORT_EVENT, DISPOSITION_STATUSES, statusChips, notesCount, notesCoverage, unreviewedLeftChip, filterShownChip, MEDICARE_PROGRESS_JUMP_EVENT, statusMix, notesNudge, firstRowWithoutNote, handoffReadyAnnotated, handoffReadyChipPulse, HANDOFF_READY_PULSE_MS, notesChipPulse, NOTES_CHIP_PULSE_MS, MEDICARE_HANDOFF_FOCUS_EVENT, toggleStatusFilter, toggleRowFilter, cycleRowFilter, rowFilterLabelChip, keyTargetChip, MEDICARE_TARGET_EVENT, MEDICARE_TARGET_JUMP_EVENT, undoDepthChip, MEDICARE_UNDO_DEPTH_EVENT, MEDICARE_UNDO_REQUEST_EVENT, redoDepthChip, MEDICARE_REDO_DEPTH_EVENT, MEDICARE_REDO_REQUEST_EVENT, cheatsheetOpenChip, MEDICARE_HELP_STATE_EVENT, MEDICARE_HELP_CLOSE_EVENT, rowMatchesFilter, reviewDoneNotesChip, withoutNotesChip, withoutNotesPulse, withoutNotesShouldPulse, WITHOUT_NOTES_PULSE_MS, unreviewedLeftPulse, unreviewedLeftShouldPulse, UNREVIEWED_LEFT_PULSE_MS, MEDICARE_UNREVIEWED_PULSE_EVENT, reviewCompletion, reviewProgress, firstRowChip, lastRowChip, firstRowPulse, firstRowShouldPulse, FIRST_ROW_PULSE_MS, secondRowChip, secondRowPulse, secondRowShouldPulse, SECOND_ROW_PULSE_MS, thirdRowChip, thirdRowPulse, thirdRowShouldPulse, THIRD_ROW_PULSE_MS, type RowFilter, type DispositionStatus, type InvestigationReport } from "@/lib/medicare/investigation";

const TONE = {
  unreviewed: "border-zinc-500 text-zinc-200 bg-zinc-800",
  needs_human_review: "border-amber-400 text-black bg-amber-400",
  cleared_pattern_only: "border-emerald-400 text-black bg-emerald-400",
} as const;

/** Per-item status chips; follow the disposition stub's tab-local report event. Each links to its disposition row. */
export default function MedicareStatusChips({ initial }: { initial: InvestigationReport }) {
  const [r, setR] = useState<InvestigationReport>(initial);
  const [keyTarget, setKeyTarget] = useState<string | null>(null);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; setKeyTarget(typeof d === "string" ? d : null); }; window.addEventListener(MEDICARE_TARGET_EVENT, on); return () => window.removeEventListener(MEDICARE_TARGET_EVENT, on); }, []);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toastCount, setToastCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [copyRecentAt, setCopyRecentAt] = useState<number | null>(null);
  const copyRecentPulsedRef = useRef(false);
  const [copyRecentPulseAt, setCopyRecentPulseAt] = useState<number | null>(null);
  const [copyRecentPulseNow, setCopyRecentPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; const at = typeof d === "number" ? d : Date.now(); setCopyRecentAt(at); window.setTimeout(() => setCopyRecentAt((x) => (x === at ? null : x)), TOAST_PILL_COPIED_MS); if (!copyRecentPulsedRef.current) { copyRecentPulsedRef.current = true; const t = Date.now(); setCopyRecentPulseAt(t); setCopyRecentPulseNow(t); window.setTimeout(() => setCopyRecentPulseNow(Date.now()), MEDICARE_COPY_RECENT_PULSE_MS); } }; window.addEventListener(MEDICARE_RECENT_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_RECENT_COPIED_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; setRecentCount(typeof d === "number" ? d : 0); }; window.addEventListener(MEDICARE_RECENT_STATE_EVENT, on); return () => window.removeEventListener(MEDICARE_RECENT_STATE_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; setToastCount(typeof d === "number" ? d : 0); }; window.addEventListener(MEDICARE_TOASTS_STATE_EVENT, on); return () => window.removeEventListener(MEDICARE_TOASTS_STATE_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => setHelpOpen((ev as CustomEvent<unknown>).detail === true); window.addEventListener(MEDICARE_HELP_STATE_EVENT, on); return () => window.removeEventListener(MEDICARE_HELP_STATE_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; setRedoDepth(typeof d === "number" ? d : 0); }; window.addEventListener(MEDICARE_REDO_DEPTH_EVENT, on); return () => window.removeEventListener(MEDICARE_REDO_DEPTH_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; setUndoDepth(typeof d === "number" ? d : 0); }; window.addEventListener(MEDICARE_UNDO_DEPTH_EVENT, on); return () => window.removeEventListener(MEDICARE_UNDO_DEPTH_EVENT, on); }, []);
  const [filter, setFilter] = useState<RowFilter>(null);
  const [rdPulseAt, setRdPulseAt] = useState<number | null>(null);
  const [rdPulseNow, setRdPulseNow] = useState(0);
  const rdPulsedRef = useRef(false);
  const wnPulsedRef = useRef(false); const [wnPulseAt, setWnPulseAt] = useState<number | null>(null); const [wnPulseNow, setWnPulseNow] = useState<number | null>(null);
  const startWnPulse = () => { wnPulsedRef.current = true; const t = Date.now(); setWnPulseAt(t); setWnPulseNow(t); window.setTimeout(() => setWnPulseNow(Date.now()), WITHOUT_NOTES_PULSE_MS); };
  const ulPulsedRef = useRef(false); const [ulPulseAt, setUlPulseAt] = useState<number | null>(null); const [ulPulseNow, setUlPulseNow] = useState<number | null>(null);
  const tryUlPulse = (left: number) => { if (!unreviewedLeftShouldPulse(ulPulsedRef.current, left)) return; ulPulsedRef.current = true; const t = Date.now(); setUlPulseAt(t); setUlPulseNow(t); window.setTimeout(() => setUlPulseNow(Date.now()), UNREVIEWED_LEFT_PULSE_MS); };
  const t2PulsedRef = useRef(false); const [t2PulseAt, setT2PulseAt] = useState<number | null>(null); const [t2PulseNow, setT2PulseNow] = useState<number | null>(null);
  const tryT2Pulse = (jump: string | null) => { if (!secondRowShouldPulse(t2PulsedRef.current, jump)) return; t2PulsedRef.current = true; const t = Date.now(); setT2PulseAt(t); setT2PulseNow(t); window.setTimeout(() => setT2PulseNow(Date.now()), SECOND_ROW_PULSE_MS); };
  const t1PulsedRef = useRef(false); const [t1PulseAt, setT1PulseAt] = useState<number | null>(null); const [t1PulseNow, setT1PulseNow] = useState<number | null>(null);
  const tryT1Pulse = (jump: string | null) => { if (!firstRowShouldPulse(t1PulsedRef.current, jump)) return; t1PulsedRef.current = true; const t = Date.now(); setT1PulseAt(t); setT1PulseNow(t); window.setTimeout(() => setT1PulseNow(Date.now()), FIRST_ROW_PULSE_MS); };
  const t3PulsedRef = useRef(false); const [t3PulseAt, setT3PulseAt] = useState<number | null>(null); const [t3PulseNow, setT3PulseNow] = useState<number | null>(null);
  const tryT3Pulse = (jump: string | null) => { if (!thirdRowShouldPulse(t3PulsedRef.current, jump)) return; t3PulsedRef.current = true; const t = Date.now(); setT3PulseAt(t); setT3PulseNow(t); window.setTimeout(() => setT3PulseNow(Date.now()), THIRD_ROW_PULSE_MS); };
  const tryUlPulseRef = useRef(tryUlPulse); tryUlPulseRef.current = tryUlPulse;
  const nrPulsedRef = useRef(false); const [nrPulseAt, setNrPulseAt] = useState<number | null>(null); const [nrPulseNow, setNrPulseNow] = useState(0);
  useEffect(() => { const on = () => { if (nrPulsedRef.current) return; nrPulsedRef.current = true; const t = Date.now(); setNrPulseAt(t); setNrPulseNow(t); window.setTimeout(() => setNrPulseNow(Date.now()), NEEDS_REVIEW_PULSE_MS); }; window.addEventListener(MEDICARE_NEEDS_REVIEW_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_NEEDS_REVIEW_PULSE_EVENT, on); }, []);
  const lrPulsedRef = useRef(false); const [lrPulseAt, setLrPulseAt] = useState<number | null>(null); const [lrPulseNow, setLrPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { if (!lastRowShouldPulse(lrPulsedRef.current, (ev as CustomEvent<unknown>).detail)) return; lrPulsedRef.current = true; const t = Date.now(); setLrPulseAt(t); setLrPulseNow(t); window.setTimeout(() => setLrPulseNow(Date.now()), LAST_ROW_PULSE_MS); }; window.addEventListener(MEDICARE_LAST_ROW_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_LAST_ROW_PULSE_EVENT, on); }, []);
  const ufPulsedRef = useRef(false); const [ufPulseAt, setUfPulseAt] = useState<number | null>(null); const [ufPulseNow, setUfPulseNow] = useState(0);
  useEffect(() => { const on = () => { if (ufPulsedRef.current) return; ufPulsedRef.current = true; const t = Date.now(); setUfPulseAt(t); setUfPulseNow(t); window.setTimeout(() => setUfPulseNow(Date.now()), UNREVIEWED_FILTER_PULSE_MS); }; window.addEventListener(MEDICARE_UNREVIEWED_FILTER_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_UNREVIEWED_FILTER_PULSE_EVENT, on); }, []);
  const clPulsedRef = useRef(false); const [clPulseAt, setClPulseAt] = useState<number | null>(null); const [clPulseNow, setClPulseNow] = useState(0);
  useEffect(() => { const on = () => { if (clPulsedRef.current) return; clPulsedRef.current = true; const t = Date.now(); setClPulseAt(t); setClPulseNow(t); window.setTimeout(() => setClPulseNow(Date.now()), CLEARED_PULSE_MS); }; window.addEventListener(MEDICARE_CLEARED_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_CLEARED_PULSE_EVENT, on); }, []);
  const faPulsedRef = useRef(false); const [faPulseAt, setFaPulseAt] = useState<number | null>(null); const [faPulseNow, setFaPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { if (!filterAllShouldPulse(faPulsedRef.current, (ev as CustomEvent<unknown>).detail)) return; faPulsedRef.current = true; const t = Date.now(); setFaPulseAt(t); setFaPulseNow(t); window.setTimeout(() => setFaPulseNow(Date.now()), FILTER_ALL_PULSE_MS); }; window.addEventListener(MEDICARE_FILTER_ALL_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_FILTER_ALL_PULSE_EVENT, on); }, []);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<unknown>).detail; tryUlPulseRef.current(typeof d === "number" ? d : 0); }; window.addEventListener(MEDICARE_UNREVIEWED_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_UNREVIEWED_PULSE_EVENT, on); }, []);
  const startRdPulse = () => { if (rdPulsedRef.current) return; rdPulsedRef.current = true; const t = Date.now(); setRdPulseAt(t); setRdPulseNow(t); window.setTimeout(() => setRdPulseNow(Date.now()), REVIEW_DONE_FILTER_PULSE_MS); };
  const startRdPulseRef = useRef(startRdPulse); startRdPulseRef.current = startRdPulse;
  useEffect(() => { const on = () => startRdPulseRef.current(); window.addEventListener(MEDICARE_REVIEW_DONE_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_REVIEW_DONE_PULSE_EVENT, on); }, []);
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
        {(() => { const rd = reviewDoneNotesChip(reviewCompletion(reviewProgress(r)).complete, filter); return rd.show ? (
          <button type="button" data-medicare-review-done-filter={rd.active ? "on" : "off"} aria-pressed={rd.active} data-medicare-review-done-pulsing={reviewDoneFilterPulse(rdPulseAt, rdPulseNow) ? "1" : undefined} onClick={() => { if (reviewDoneFilterShouldPulse(rdPulsedRef.current, filter, rd.next)) startRdPulse(); pick(rd.next); }} title={rd.active ? "Review done — click to show All rows" : "Review done — click to show only rows with notes"}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${rd.active ? "border-white bg-emerald-400 text-black" : "border-emerald-300 bg-emerald-500/20 text-emerald-100"}${reviewDoneFilterPulse(rdPulseAt, rdPulseNow) ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rd.label}</button>
        ) : null; })()}
        {(() => { const wn = withoutNotesChip(r); return wn.show ? (
          <button type="button" data-medicare-without-notes={wn.count} data-medicare-without-notes-target={wn.target ?? ""} data-medicare-without-notes-pulsing={withoutNotesPulse(wnPulseAt, wnPulseNow) ? "1" : undefined} title="Jump to the first row without a note and focus its note field"
            onClick={() => { const id = wn.target; if (!id) return; if (withoutNotesShouldPulse(wnPulsedRef.current, id)) startWnPulse(); const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }}
            className={`rounded-full border-2 border-sky-300 bg-sky-500/20 text-sky-100 px-3 py-1 text-xs font-bold hover:border-white${withoutNotesPulse(wnPulseAt, wnPulseNow) ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{wn.label}</button>
        ) : null; })()}
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
          <button type="button" data-medicare-unreviewed-left={`${u.left}/${u.total}`} data-medicare-unreviewed-left-pulsing={unreviewedLeftPulse(ulPulseAt, ulPulseNow) ? "1" : undefined} onClick={() => { tryUlPulse(u.left); window.dispatchEvent(new CustomEvent(MEDICARE_PROGRESS_JUMP_EVENT)); }} title="Jump to the first unreviewed disposition row (same as clicking review progress)"
            className={`rounded-full border border-zinc-400 bg-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-100 hover:border-white${unreviewedLeftPulse(ulPulseAt, ulPulseNow) ? " ring-4 ring-zinc-200 shadow-[0_0_16px_rgba(228,228,231,0.8)] motion-safe:animate-pulse" : ""}`}>{u.label} ↓</button>
        ) : null; })()}
        {(() => { const fs = filterShownChip(r, filter); return fs.show ? (
          <button type="button" data-medicare-filter-shown={`${fs.shown}/${fs.total}`} onClick={() => pick(null)} title="Rows visible under the current filter — click to reset filter to All"
            className="rounded-full border border-amber-300 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100 hover:border-white">{fs.label} ✕</button>
        ) : null; })()}
        {(() => { const k = keyTargetChip(r.entries, keyTarget); return k.show ? (
          <button type="button" data-medicare-key-target-chip={k.id ?? "none"} onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: k.jump }))} title={k.id ? "Current j/k key target — click to scroll/focus that row (filter resets to All)" : "No key target yet — click to target the first row (same as j)"}
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${k.id ? "border-sky-400 text-sky-100" : "border-zinc-600 text-zinc-400"}`}>{k.label}</button>
        ) : null; })()}
        {(() => { const c = lastRowChip(r.entries); return c.show ? (
          <button type="button" data-medicare-last-row-chip={c.jump ?? ""} data-medicare-last-row-pulsing={lastRowPulse(lrPulseAt, lrPulseNow) ? "1" : undefined} onClick={() => { window.dispatchEvent(new CustomEvent(MEDICARE_LAST_ROW_PULSE_EVENT, { detail: c.jump })); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the last disposition row — same as key z (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${lastRowPulse(lrPulseAt, lrPulseNow) ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = firstRowChip(r.entries); const on = firstRowPulse(t1PulseAt, t1PulseNow); return c.show ? (
          <button type="button" data-medicare-first-row-chip={c.jump ?? ""} data-medicare-first-row-pulsing={on ? "1" : undefined} onClick={() => { tryT1Pulse(c.jump); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the 1st disposition row (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = secondRowChip(r.entries); const on = secondRowPulse(t2PulseAt, t2PulseNow); return c.show ? (
          <button type="button" data-medicare-second-row-chip={c.jump ?? ""} data-medicare-second-row-pulsing={on ? "1" : undefined} onClick={() => { tryT2Pulse(c.jump); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the 2nd disposition row (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = thirdRowChip(r.entries); const on = thirdRowPulse(t3PulseAt, t3PulseNow); return c.show ? (
          <button type="button" data-medicare-third-row-chip={c.jump ?? ""} data-medicare-third-row-pulsing={on ? "1" : undefined} onClick={() => { tryT3Pulse(c.jump); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the 3rd disposition row (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const u = undoDepthChip(undoDepth); return (
          <button type="button" data-medicare-undo-depth={u.depth} disabled={!u.can_undo} onClick={() => { if (u.can_undo) window.dispatchEvent(new CustomEvent(MEDICARE_UNDO_REQUEST_EVENT)); }} title={u.can_undo ? `Undo stack depth ${u.depth} — click to undo (same as u)` : "Nothing to undo"}
            className={`rounded-full border px-3 py-1 text-xs font-mono ${u.can_undo ? "border-sky-400 text-sky-100 hover:border-white" : "border-zinc-700 text-zinc-500"}`}>{u.label}</button>
        ); })()}
        {(() => { const tc = medicareToastsChip(toastCount); if (!tc.show) return null; return tc.clearable ? (
          <button type="button" data-medicare-toasts-chip={toastCount} onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_TOASTS_CLEAR_EVENT))} title="Click to Clear all top toasts (same as ✕ Clear all) · Recent toasts kept"
            className="rounded-full border border-white/60 px-3 py-1 text-xs font-mono text-white hover:border-white hover:bg-white/10">{tc.label}</button>
        ) : <span data-medicare-toasts-chip={toastCount} className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-mono text-zinc-200">{tc.label}</span>; })()}
        {(() => { const rc = medicareRecentChip(recentCount); return rc.show ? (
          <button type="button" data-medicare-recent-chip={recentCount} onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_RECENT_CLEAR_EVENT))} title="Click to Clear recent toasts (same as Recent → Clear) · on-screen toasts kept"
            className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-mono text-amber-200 hover:border-amber-300 hover:bg-white/10">{rc.label}</button>
        ) : null; })()}
        {(() => { const cr = medicareCopyRecentChip(recentCount, copyRecentAt, copyRecentAt ?? 0); return cr.show ? (
          <button type="button" data-medicare-copy-recent-chip={recentCount} data-medicare-copy-recent-copied={cr.copied ? "" : undefined} data-medicare-copy-recent-pulsing={medicareCopyRecentPulse(copyRecentPulseAt, copyRecentPulseNow) ? "1" : undefined} onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_RECENT_COPY_EVENT))} title="Copy Recent toasts JSON (same as Recent → ⧉ Copy all)"
            className={`${cr.copied ? "rounded-full border border-green-400 bg-green-500 px-3 py-1 text-xs font-mono font-semibold text-black motion-safe:animate-pulse" : "rounded-full border border-amber-400/60 px-3 py-1 text-xs font-mono text-amber-200 hover:border-amber-300 hover:bg-white/10"}${medicareCopyRecentPulse(copyRecentPulseAt, copyRecentPulseNow) ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{cr.label}</button>
        ) : null; })()}
        {(() => { const hc = cheatsheetOpenChip(helpOpen); return hc.show ? (
          <button type="button" data-medicare-cheatsheet-chip onClick={() => window.dispatchEvent(new CustomEvent(MEDICARE_HELP_CLOSE_EVENT))} title="Keyboard cheat sheet is open — click to close (same as Esc)"
            className="relative z-[60] rounded-full border border-amber-300 px-3 py-1 text-xs font-mono text-amber-100 hover:border-white">{hc.label}</button>
        ) : null; })()}
        {(() => { const rd = redoDepthChip(redoDepth); return (
          <button type="button" data-medicare-redo-depth={rd.depth} disabled={!rd.can_redo} onClick={() => { if (rd.can_redo) window.dispatchEvent(new CustomEvent(MEDICARE_REDO_REQUEST_EVENT)); }} title={rd.can_redo ? `Redo stack depth ${rd.depth} — click to redo (same as Redo)` : "Nothing to redo"}
            className={`rounded-full border px-3 py-1 text-xs font-mono ${rd.can_redo ? "border-sky-400 text-sky-100 hover:border-white" : "border-zinc-700 text-zinc-500"}`}>{rd.label}</button>
        ); })()}
        {(() => { const c = rowFilterLabelChip(filter); return (
          <button type="button" data-medicare-filter-label={c.value} data-medicare-filter-all-pulsing={filterAllPulse(faPulseAt, faPulseNow) ? "1" : undefined} onClick={() => pick(cycleRowFilter(filter))} title={`Current row filter — click to cycle (same as f); next: ${c.next}`}
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${filter ? "border-amber-300 text-amber-100" : "border-zinc-600 text-zinc-300"}${filterAllPulse(faPulseAt, faPulseNow) ? " ring-4 ring-zinc-200 shadow-[0_0_16px_rgba(228,228,231,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ); })()}
        {(() => { const fa = filterAllChip(filter); return fa.show ? (
          <button type="button" data-medicare-filter-all-chip onClick={() => { pick(null); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_ALL_PULSE_EVENT, { detail: true })); }} title="Reset row filter to All (same as a)"
            className="rounded-full border border-zinc-400 px-3 py-1 text-xs font-mono text-zinc-100 hover:border-white">{fa.label}</button>
        ) : null; })()}
        {(() => { const nr = needsReviewChip(statusMix(r).counts.needs_human_review, filter); return nr.show ? (
          <button type="button" data-medicare-needs-review-chip={nr.active ? "active" : "1"} aria-pressed={nr.active} data-medicare-needs-review-pulsing={needsReviewPulse(nrPulseAt, nrPulseNow) ? "1" : undefined} onClick={() => { if (needsReviewShouldPulse(nrPulsedRef.current, filter, nr.next)) window.dispatchEvent(new CustomEvent(MEDICARE_NEEDS_REVIEW_PULSE_EVENT)); pick(nr.next); }} title={nr.active ? "Showing needs_human_review rows — click to show all" : "Click to filter rows to needs_human_review"}
            className={`rounded-full border border-amber-400 bg-amber-400/20 px-3 py-1 text-xs font-mono font-semibold text-amber-100 hover:border-white ${nr.active ? "ring-2 ring-white" : ""}${needsReviewPulse(nrPulseAt, nrPulseNow) ? " ring-4 ring-amber-200 shadow-[0_0_16px_rgba(252,211,77,0.8)] motion-safe:animate-pulse" : ""}`}>{nr.label}</button>
        ) : null; })()}
        {(() => { const cl = clearedChip(statusMix(r).counts.cleared_pattern_only, filter); return cl.show ? (
          <button type="button" data-medicare-cleared-chip={cl.active ? "active" : "1"} aria-pressed={cl.active} data-medicare-cleared-pulsing={clearedPulse(clPulseAt, clPulseNow) ? "1" : undefined} onClick={() => { if (clearedShouldPulse(clPulsedRef.current, filter, cl.next)) window.dispatchEvent(new CustomEvent(MEDICARE_CLEARED_PULSE_EVENT)); pick(cl.next); }} title={cl.active ? "Showing cleared_pattern_only rows — click to show all (c)" : "Click to filter rows to cleared_pattern_only (c)"}
            className={`rounded-full border border-emerald-400 bg-emerald-400/20 px-3 py-1 text-xs font-mono font-semibold text-emerald-100 hover:border-white ${cl.active ? "ring-2 ring-white" : ""}${clearedPulse(clPulseAt, clPulseNow) ? " ring-4 ring-emerald-200 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{cl.label}</button>
        ) : null; })()}
        {(() => { const uf = unreviewedFilterChip(statusMix(r).counts.unreviewed, filter); return uf.show ? (
          <button type="button" data-medicare-unreviewed-filter-chip={uf.active ? "active" : "1"} aria-pressed={uf.active} data-medicare-unreviewed-filter-pulsing={unreviewedFilterPulse(ufPulseAt, ufPulseNow) ? "1" : undefined} onClick={() => { if (unreviewedFilterShouldPulse(ufPulsedRef.current, filter, uf.next)) window.dispatchEvent(new CustomEvent(MEDICARE_UNREVIEWED_FILTER_PULSE_EVENT)); pick(uf.next); }} title={uf.active ? "Showing unreviewed rows — click to show all (l)" : "Click to filter rows to unreviewed (l)"}
            className={`rounded-full border border-sky-400 bg-sky-400/20 px-3 py-1 text-xs font-mono font-semibold text-sky-100 hover:border-white ${uf.active ? "ring-2 ring-white" : ""}${unreviewedFilterPulse(ufPulseAt, ufPulseNow) ? " ring-4 ring-sky-200 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{uf.label}</button>
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
