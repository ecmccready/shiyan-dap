"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressBar } from "@/components/MedicareReviewProgress";
import CopyLiveInvestigation from "@/components/CopyLiveInvestigation";
import { rowMatchesFilter, rowFilterEmphasis, type RowFilter, MEDICARE_FILTER_EVENT, commitDisposition, undoDisposition, redoDisposition, applyDispositionNote, DISPOSITION_NOTE_MAX, noteTemplates, appendNoteTemplate, dispositionShortcut, medicareToastStack, handoffReadyToast, handoffReadyAnnotated, HANDOFF_READY_TOAST_MS, emptyRowFilterToast, EMPTY_ROW_FILTER_TOAST_MS, reviewCompleteToast, COMPLETE_TOAST_MS, reviewCompletion, keyActionChanges, keyToastText, KEY_TOAST_MS, MEDICARE_KEYMAP, firstAvailableTemplate, moveDispositionTarget, cycleRowFilter, MEDICARE_HANDOFF_FOCUS_EVENT, type DispositionHistory, applyBulkDisposition, filterEmphasis, type DispositionStatus, MEDICARE_REPORT_EVENT, MEDICARE_PROGRESS_EVENT, reviewProgress, applyDisposition, buildInvestigationReport, DISPOSITION_STATUSES, type DispositionInput } from "@/lib/medicare/investigation";
import { medicareAnchorId } from "@/lib/medicare/case-brief";
import type { EvidencePack } from "@/lib/medicare/evidence";

/** Client-only disposition stub over the synthetic fixture. State lives in this tab; nothing is stored or sent. */
export default function MedicareDispositionStub({ pack, highlight }: { pack: EvidencePack; highlight?: string }) {
  const [hist, setHist] = useState<DispositionHistory>({ past: [], present: {}, last_action: null, future: [] });
  const disp = hist.present;
  const commit = (fn: (d: DispositionInput) => DispositionInput, action: string) => setHist((h) => commitDisposition(h, fn(h.present), action));
  const [focusId, setFocusId] = useState<string | null>(null);
  const target = focusId ?? highlight ?? null;
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ txt: string; at: number } | null>(null);
  const idsRef = useRef<string[]>([]);
  const histRef = useRef<DispositionHistory>({ past: [], present: {}, last_action: null, future: [] });
  const filterRef = useRef<RowFilter>(null);
  const entryRef = useRef<{ item_id: string; status: string; kind: string; note?: string | null; provider_id?: string | null } | null>(null);
  const targetRef = useRef<{ id: string | null; label: string }>({ id: null, label: "" });
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      const a = dispositionShortcut({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable });
      if (!a) return;
      const btn = a.kind === "dispositions" || a.kind === "handoff" ? document.querySelector<HTMLButtonElement>(a.kind === "handoff" ? "[data-copy-medicare-handoff]" : "[data-copy-medicare-dispositions]") : null;
      const en = entryRef.current; const hh = histRef.current;
      const changes = keyActionChanges(a, { target_id: targetRef.current.id, target_status: en?.status, target_kind: en?.kind, target_note: en?.note, can_undo: hh.past.length > 0, can_redo: (hh.future?.length ?? 0) > 0, ids: idsRef.current, button_ready: !!btn && !btn.disabled });
      { const txt = changes ? keyToastText(a, a.kind === "move" || a.kind === "filter" ? "" : targetRef.current.label) : null; if (txt) { const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), KEY_TOAST_MS); } }
      if (a.kind === "help") { ev.preventDefault(); setHelp((x) => !x); return; }
      if (a.kind === "help_close") { setHelp(false); return; }
      if (a.kind === "undo") { ev.preventDefault(); setHist(undoDisposition); return; }
      if (a.kind === "redo") { ev.preventDefault(); setHist(redoDisposition); return; }
      if (a.kind === "template") {
        const e = entryRef.current; if (!e) return;
        const tpl = firstAvailableTemplate(e.status, e.kind, e.note); if (!tpl) return;
        ev.preventDefault();
        const id = e.item_id; const next = appendNoteTemplate(e.note, tpl);
        setHist((h) => commitDisposition(h, applyDispositionNote(h.present, id, next), `${e.provider_id ?? id} note (key t)`));
        return;
      }
      if (a.kind === "filter") { ev.preventDefault(); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: cycleRowFilter(filterRef.current) })); return; }
      if (a.kind === "dispositions") { const b = document.querySelector<HTMLButtonElement>("[data-copy-medicare-dispositions]"); if (!b || b.disabled) return; ev.preventDefault(); b.scrollIntoView({ block: "nearest" }); b.click(); return; }
      if (a.kind === "handoff") { const b = document.querySelector<HTMLButtonElement>("[data-copy-medicare-handoff]"); if (!b || b.disabled) return; ev.preventDefault(); b.scrollIntoView({ block: "nearest" }); b.click(); window.dispatchEvent(new CustomEvent(MEDICARE_HANDOFF_FOCUS_EVENT)); return; }
      if (a.kind === "note") { const id = targetRef.current.id; if (!id) return; const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp || inp.disabled) return; ev.preventDefault(); inp.scrollIntoView({ block: "nearest" }); inp.focus(); return; }
      if (a.kind === "move") { const nx = moveDispositionTarget(idsRef.current, targetRef.current.id, a.dir); if (!nx) return; ev.preventDefault(); setFocusId(nx); document.getElementById(medicareAnchorId("disposition", nx))?.scrollIntoView({ block: "nearest" }); return; }
      const t = targetRef.current;
      if (!t.id) return;
      ev.preventDefault();
      const id = t.id;
      setHist((h) => commitDisposition(h, applyDisposition(h.present, id, a.status), `${t.label} → ${a.status} (key)`));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const [filter, setFilter] = useState<RowFilter>(null);
  filterRef.current = filter;
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<RowFilter>).detail; setFilter(typeof d === "string" ? d : null); };
    window.addEventListener(MEDICARE_FILTER_EVENT, on);
    return () => window.removeEventListener(MEDICARE_FILTER_EVENT, on);
  }, []);
  const report = useMemo(() => buildInvestigationReport({ pack, dispositions: disp }), [pack, disp]);
  const progress = useMemo(() => reviewProgress(report), [report]);
  const prevCompleteRef = useRef<boolean | null>(null);
  const [doneToast, setDoneToast] = useState<string | null>(null);
  useEffect(() => {
    const txt = reviewCompleteToast(prevCompleteRef.current, progress);
    prevCompleteRef.current = reviewCompletion(progress).complete;
    if (!txt) { if (!prevCompleteRef.current) setDoneToast(null); return; }
    setDoneToast(txt);
    window.setTimeout(() => setDoneToast((x) => (x === txt ? null : x)), COMPLETE_TOAST_MS);
  }, [progress]);
  const prevReadyRef = useRef<boolean | null>(null);
  const [readyToast, setReadyToast] = useState<string | null>(null);
  useEffect(() => {
    const txt = handoffReadyToast(prevReadyRef.current, report);
    prevReadyRef.current = handoffReadyAnnotated(report).ready;
    if (!prevReadyRef.current) { setReadyToast(null); return; }
    if (!txt) return;
    setReadyToast(txt);
    window.setTimeout(() => setReadyToast((x) => (x === txt ? null : x)), HANDOFF_READY_TOAST_MS);
  }, [report]);
  const [emptyToast, setEmptyToast] = useState<string | null>(null);
  const emptyTxt = emptyRowFilterToast(filter, report.entries);
  useEffect(() => {
    setEmptyToast(emptyTxt);
    if (!emptyTxt) return;
    const id = window.setTimeout(() => setEmptyToast(null), EMPTY_ROW_FILTER_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [emptyTxt]);
  useEffect(() => { window.dispatchEvent(new CustomEvent(MEDICARE_PROGRESS_EVENT, { detail: progress })); window.dispatchEvent(new CustomEvent(MEDICARE_REPORT_EVENT, { detail: report })); }, [progress, report]);
  const targetEntry = report.entries.find((e) => e.item_id === target);
  idsRef.current = report.entries.map((e) => e.item_id);
  histRef.current = hist;
  entryRef.current = targetEntry ?? null;
  targetRef.current = { id: targetEntry ? targetEntry.item_id : null, label: targetEntry ? targetEntry.provider_id ?? targetEntry.item_id : "" };
  return (
    <div data-medicare-disposition-stub className="space-y-2">
      {(() => { const stack = medicareToastStack({ complete: doneToast, empty_filter: emptyToast, handoff_ready: readyToast }); return stack.length ? (
        <div data-medicare-toast-stack className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex w-max max-w-[92vw] flex-col items-center gap-2 pointer-events-none">
          {stack.map((t) => (
            <div key={t.id} {...{ [`data-medicare-${t.id === "complete" ? "complete" : t.id === "empty_filter" ? "empty-filter" : "handoff-ready"}-toast`]: true }} role="status" aria-live="polite"
              className={`pointer-events-auto rounded-2xl border-2 border-white px-6 py-3 text-base font-bold text-black shadow-2xl ${t.tone === "amber" ? "bg-amber-400 shadow-amber-500/40" : t.id === "handoff_ready" ? "bg-emerald-500 shadow-emerald-500/40" : "bg-emerald-400 shadow-emerald-500/40"}`}>
              {t.tone === "amber" ? "⚠ " : ""}{t.text}
            </div>
          ))}
        </div>
      ) : null; })()}
      {toast && (
        <div data-medicare-key-toast role="status" aria-live="polite" className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-full border-2 border-amber-300 bg-zinc-950 px-5 py-2 text-sm font-semibold text-amber-200 shadow-lg shadow-amber-500/30">
          ⌨ {toast.txt}
        </div>
      )}
      {help && (
        <div data-medicare-cheatsheet role="dialog" aria-label="Keyboard shortcuts" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setHelp(false)}>
          <div className="max-w-md w-full rounded-2xl border-2 border-amber-300 bg-zinc-950 p-5 shadow-2xl shadow-amber-500/20" onClick={(ev) => ev.stopPropagation()}>
            <p className="text-amber-300 text-sm font-bold uppercase tracking-widest mb-3">Keyboard · Medicare review</p>
            <table className="w-full text-sm"><tbody>
              {MEDICARE_KEYMAP.map((k) => (
                <tr key={k.key}><td className="pr-3 py-0.5 whitespace-nowrap"><kbd className="rounded border border-amber-300/70 bg-zinc-900 px-1.5 font-mono text-amber-100">{k.key}</kbd></td><td className="text-zinc-200">{k.does}</td></tr>
              ))}
            </tbody></table>
            <p className="mt-3 text-xs text-zinc-500">Keys work outside text fields; Ctrl / Alt / Cmd are left to the browser. Review state only, this tab.</p>
            <button type="button" onClick={() => setHelp(false)} className="mt-3 rounded-full border border-amber-300 px-4 py-1 text-xs text-amber-200">Close (Esc)</button>
          </div>
        </div>
      )}
      <p className="text-emerald-400 text-xs">Reviewer disposition (stub, this tab only)</p>
      <p data-medicare-shortcut-hint className="text-[11px] text-zinc-500">
        Keys: <kbd className="rounded border border-zinc-600 px-1">1</kbd> needs_human_review · <kbd className="rounded border border-zinc-600 px-1">2</kbd> cleared_pattern_only · <kbd className="rounded border border-zinc-600 px-1">3</kbd> unreviewed · <kbd className="rounded border border-zinc-600 px-1">u</kbd> undo · <kbd className="rounded border border-zinc-600 px-1">r</kbd> redo · <kbd className="rounded border border-zinc-600 px-1">j</kbd>/<kbd className="rounded border border-zinc-600 px-1">k</kbd> move target · <kbd className="rounded border border-zinc-600 px-1">n</kbd> note (after a status) · <kbd className="rounded border border-zinc-600 px-1">h</kbd> copy 📦 hand-off pack · <kbd className="rounded border border-zinc-600 px-1">y</kbd> copy dispositions JSON · <kbd className="rounded border border-zinc-600 px-1">f</kbd> cycle filter · <kbd className="rounded border border-zinc-600 px-1">t</kbd> quick note · <button type="button" data-medicare-cheatsheet-open onClick={() => setHelp(true)} className="rounded border border-amber-400 px-1 text-amber-300 font-semibold">?</button> all keys{filter ? <span data-medicare-key-filter className="ml-1 text-white">({filter})</span> : null} — on {targetEntry ? <span className="text-sky-300 font-mono">{targetRef.current.label}</span> : "no row"} (click a row or press j/k to target it)
      </p>
      <ProgressBar p={progress} />
      {filter && (
        <p className="text-xs text-zinc-300" data-medicare-filter-note>Filtered: {filter === "has_note" ? "rows with notes" : filter} ({report.entries.filter((e) => rowMatchesFilter(e, filter)).length}) · <button type="button" className="underline" onClick={() => { setFilter(null); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: null })); }}>Show all</button></p>
      )}
      {filter && (() => {
        const visible = report.entries.filter((e) => rowMatchesFilter(e, filter)).map((e) => e.item_id);
        const bulk = (to: DispositionStatus) => {
          commit((d) => applyBulkDisposition(d, visible, to), `set ${visible.length} to ${to}`);
          const nf: RowFilter = filter === "has_note" && to !== "unreviewed" ? "has_note" : to; setFilter(nf); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: nf }));
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
          <li key={e.item_id} id={medicareAnchorId("disposition", e.item_id)} onClick={() => setFocusId(e.item_id)} onFocus={() => setFocusId(e.item_id)} data-medicare-key-target={e.item_id === target ? "true" : undefined} data-medicare-filter-emphasis={rowFilterEmphasis(e, filter)} className={`scroll-mt-24 flex flex-wrap items-center gap-2 transition-opacity ${rowFilterEmphasis(e, filter) === "dim" ? "opacity-30" : rowFilterEmphasis(e, filter) === "match" ? "rounded ring-2 ring-white/70 px-2 py-1" : ""} ${e.item_id === highlight ? "rounded bg-emerald-500/15 border-l-4 border-emerald-400 px-2 py-1" : ""} ${e.item_id === target ? "outline outline-1 outline-sky-400 rounded" : ""}`}>
            <span>{e.item_id}</span>
            <select
              aria-label={`Disposition for ${e.item_id}`}
              data-medicare-disposition={e.item_id}
              value={e.status}
              onChange={(ev) => { const v = ev.target.value; commit((d) => applyDisposition(d, e.item_id, v), `${e.provider_id ?? e.item_id} → ${v}`); }}
              className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
            >
              {DISPOSITION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              key={`${e.item_id}:${e.note ?? ""}`}
              type="text"
              data-medicare-note={e.item_id}
              aria-label={`Reviewer note for ${e.item_id}`}
              defaultValue={e.note ?? ""}
              maxLength={DISPOSITION_NOTE_MAX}
              disabled={e.status === "unreviewed"}
              placeholder={e.status === "unreviewed" ? "set a status to add a note" : "reviewer note (optional, Enter to save)"}
              onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
              onBlur={(ev) => { const v = ev.target.value; if ((e.note ?? "") !== v.trim()) commit((d) => applyDispositionNote(d, e.item_id, v), `${e.provider_id ?? e.item_id} note`); }}
              className={`min-w-[12rem] flex-1 bg-zinc-900 border rounded px-2 py-0.5 font-sans ${e.note ? "border-sky-500 text-sky-100" : "border-zinc-700 text-zinc-300"} disabled:opacity-40`}
            />
            {noteTemplates(e.status, e.kind).length > 0 && (
              <span data-medicare-note-templates={e.item_id} className="flex flex-wrap gap-1">
                {noteTemplates(e.status, e.kind).map((t) => (
                  <button key={t} type="button" data-medicare-note-template={t} title="Add this note"
                    onClick={(ev) => { ev.stopPropagation(); commit((d) => applyDispositionNote(d, e.item_id, appendNoteTemplate(e.note, t)), `${e.provider_id ?? e.item_id} note`); }}
                    className={`rounded-full border px-2 py-0.5 font-sans text-[11px] ${(e.note ?? "").includes(t) ? "border-sky-400 bg-sky-500 text-black" : "border-sky-700 text-sky-200 hover:bg-sky-500/20"}`}>
                    + {t}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs font-mono text-zinc-400 break-all" data-medicare-live-report-hash>
        report sha256 {report.report_hash} · {report.counts.unreviewed} unreviewed, {report.counts.needs_human_review} needs_human_review, {report.counts.cleared_pattern_only} cleared_pattern_only
      </p>
      <div className="flex flex-wrap items-center gap-3"><CopyLiveInvestigation report={report} />
      <button type="button" data-medicare-undo disabled={!hist.past.length} onClick={() => setHist(undoDisposition)}
        className={`rounded-full border px-3 py-1 text-xs ${hist.past.length ? "border-sky-400 text-sky-200 hover:bg-sky-500/10" : "border-zinc-700 text-zinc-600"}`}>
        ↶ Undo{hist.last_action ? `: ${hist.last_action}` : ""}{hist.past.length ? ` (${hist.past.length})` : ""}
      </button>
      <button type="button" data-medicare-redo disabled={!(hist.future ?? []).length} onClick={() => setHist(redoDisposition)}
        className={`rounded-full border px-3 py-1 text-xs ${(hist.future ?? []).length ? "border-sky-400 text-sky-200 hover:bg-sky-500/10" : "border-zinc-700 text-zinc-600"}`}>
        ↷ Redo{(hist.future ?? []).length ? ` (${(hist.future ?? []).length})` : ""}
      </button>
      <button type="button" onClick={() => commit(() => ({}), "reset all")} className="text-xs underline text-zinc-400">Reset</button></div>
    </div>
  );
}
