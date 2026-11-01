"use client";

import { useEffect, useRef, useState } from "react";
import { clearMedicareViewSession, medicareResetViewToast, MEDICARE_RESET_VIEW_KEYS, MEDICARE_RESET_VIEW_EVENT } from "@/lib/medicare/investigation";
import { medicareViewSnapshotJson, medicareCopyViewToast, medicareCopyViewShouldPulse, medicareCopyViewPulse, MEDICARE_COPY_VIEW_PULSE_MS } from "@/lib/medicare/investigation";
import EvidencePacksChip from "@/components/EvidencePacksChip";
import { medicareDispositionsChip, medicareDispositionsChipShouldPulse, medicareDispositionsChipPulse, medicareDispositionsChipCopiedOk, MEDICARE_DISPOSITIONS_CHIP_PULSE_MS, MEDICARE_DISPOSITIONS_COPIED_EVENT, MEDICARE_HANDOFF_COPIED_EVENT, medicareHandoffChipCopiedOk, medicareHandoffChip, medicareHandoffChipShouldPulse, medicareHandoffChipPulse, MEDICARE_HANDOFF_CHIP_PULSE_MS, MEDICARE_COPY_ROW_TOAST_EVENT, medicareCopyRowChipPulse, medicareCopyRowChipShouldPulse, MEDICARE_COPY_ROW_CHIP_PULSE_MS, MEDICARE_COPY_ROW_PULSE_EVENT } from "@/lib/medicare/investigation";
import { lastDownChipChanged, firstUpChipChanged, firstUpPulse, firstUpShouldPulse, FIRST_UP_PULSE_MS, MEDICARE_FIRST_UP_PULSE_EVENT } from "@/lib/medicare/investigation";
import { blankNoteStickyChip, blankNoteStickyChanged, blankNoteStickyPulse, BLANK_NOTE_STICKY_PULSE_MS } from "@/lib/medicare/investigation";
import { needsReviewStickyChip, needsReviewStickyChanged, needsReviewStickyPulse, NEEDS_REVIEW_STICKY_PULSE_MS, needsReviewStickyToast, clearedStickyChip, clearedStickyChanged, clearedStickyPulse, clearedStickyToast, CLEARED_STICKY_PULSE_MS, MEDICARE_STICKY_JUMP_TOAST_EVENT, unreviewedStickyChip, unreviewedStickyChanged, unreviewedStickyPulse, unreviewedStickyToast, UNREVIEWED_STICKY_PULSE_MS } from "@/lib/medicare/investigation";
import { topCandidateStickyChip, topCandidateStickyChanged, topCandidateStickyPulse, topCandidateStickyToast, TOP_CANDIDATE_STICKY_PULSE_MS } from "@/lib/medicare/investigation";
import { lastRowPulse, lastRowShouldPulse, LAST_ROW_PULSE_MS, MEDICARE_LAST_ROW_PULSE_EVENT } from "@/lib/medicare/investigation";
import { unreviewedFilterPulse, unreviewedFilterShouldPulse, UNREVIEWED_FILTER_PULSE_MS, MEDICARE_UNREVIEWED_FILTER_PULSE_EVENT, unreviewedFilterChip, clearedChip, clearedPulse, clearedShouldPulse, CLEARED_PULSE_MS, MEDICARE_CLEARED_PULSE_EVENT, needsReviewPulse, needsReviewShouldPulse, NEEDS_REVIEW_PULSE_MS, MEDICARE_NEEDS_REVIEW_PULSE_EVENT, needsReviewChip, filterAllChip, filterAllPulse, filterAllShouldPulse, FILTER_ALL_PULSE_MS, MEDICARE_FILTER_ALL_PULSE_EVENT } from "@/lib/medicare/investigation";
import { medicareCopyAllRowsChip, medicareCopyNotesChip, medicareCopyStatusesChip, medicareCopyProgressChip, medicareProgressElapsedMs, nextReviewTimer, MEDICARE_PROGRESS_EVENT, MEDICARE_TIMER_EVENT, type ReviewTimer } from "@/lib/medicare/investigation";
import { medicareInvestigationChip, medicareInvestigationChipCopiedOk, medicareInvestigationChipShouldPulse, medicareInvestigationChipPulse, MEDICARE_INVESTIGATION_CHIP_PULSE_MS } from "@/lib/medicare/investigation";
import { medicareEvidenceChip, medicareEvidenceChipCopiedOk, medicareEvidenceChipShouldPulse, medicareEvidenceChipPulse, MEDICARE_EVIDENCE_CHIP_PULSE_MS } from "@/lib/medicare/investigation";
import { medicareDqChip, medicareDqChipCopiedOk, medicareDqChipShouldPulse, medicareDqChipPulse, MEDICARE_DQ_CHIP_PULSE_MS } from "@/lib/medicare/investigation";
import { medicareBaselinesChip, medicareBaselinesChipCopiedOk, medicareBaselinesChipShouldPulse, medicareBaselinesChipPulse, MEDICARE_BASELINES_CHIP_PULSE_MS, medicareProvenanceChip, medicareProvenanceChipCopiedOk, medicareProvenanceChipShouldPulse, medicareProvenanceChipPulse, MEDICARE_PROVENANCE_CHIP_PULSE_MS } from "@/lib/medicare/investigation";
import { medicareBriefChipShouldPulse, medicareBriefChipPulse, MEDICARE_BRIEF_CHIP_PULSE_MS } from "@/lib/medicare/investigation";
import { medicareBriefChip, medicareBriefChipCopiedOk, MEDICARE_BRIEF_COPIED_EVENT, MEDICARE_PACK_COPIED_EVENT } from "@/lib/medicare/investigation";
import { medicarePacksChip, medicarePacksToggle, medicarePacksPulse, MEDICARE_PACKS_PULSE_MS } from "@/lib/medicare/investigation";
import { readMedicareStripState, writeMedicareStripState } from "@/lib/medicare/investigation";
import { medicareJumpsChip, medicareJumpsToggle, medicareJumpsPulse, MEDICARE_JUMPS_PULSE_MS } from "@/lib/medicare/investigation";
import { reviewDoneFilterPulse, reviewDoneFilterShouldPulse, REVIEW_DONE_FILTER_PULSE_MS, MEDICARE_REVIEW_DONE_PULSE_EVENT, medicareCopyRecentPulse, MEDICARE_COPY_RECENT_PULSE_MS, MEDICARE_RECENT_COPY_EVENT, MEDICARE_RECENT_COPIED_EVENT, medicareCopyRecentChip, TOAST_PILL_COPIED_MS, MEDICARE_RECENT_STATE_EVENT, MEDICARE_RECENT_CLEAR_EVENT, medicareRecentChip, MEDICARE_TOASTS_STATE_EVENT, MEDICARE_TOASTS_CLEAR_EVENT, medicareToastsChip, MEDICARE_FILTER_EVENT, MEDICARE_REPORT_EVENT, DISPOSITION_STATUSES, statusChips, notesCount, notesCoverage, unreviewedLeftChip, filterShownChip, MEDICARE_PROGRESS_JUMP_EVENT, statusMix, notesNudge, firstRowWithoutNote, handoffReadyAnnotated, handoffReadyChipPulse, HANDOFF_READY_PULSE_MS, notesChipPulse, NOTES_CHIP_PULSE_MS, MEDICARE_HANDOFF_FOCUS_EVENT, toggleStatusFilter, toggleRowFilter, cycleRowFilter, rowFilterLabelChip, keyTargetChip, MEDICARE_TARGET_EVENT, MEDICARE_TARGET_JUMP_EVENT, undoDepthChip, MEDICARE_UNDO_DEPTH_EVENT, MEDICARE_UNDO_REQUEST_EVENT, redoDepthChip, MEDICARE_REDO_DEPTH_EVENT, MEDICARE_REDO_REQUEST_EVENT, cheatsheetOpenChip, MEDICARE_STRIP_STATE_EVENT, MEDICARE_STRIP_COLLAPSE_EVENT, medicareEscToast, MEDICARE_HELP_STATE_EVENT, MEDICARE_HELP_CLOSE_EVENT, rowMatchesFilter, reviewDoneNotesChip, withoutNotesChip, withoutNotesPulse, withoutNotesShouldPulse, WITHOUT_NOTES_PULSE_MS, unreviewedLeftPulse, unreviewedLeftShouldPulse, UNREVIEWED_LEFT_PULSE_MS, MEDICARE_UNREVIEWED_PULSE_EVENT, reviewCompletion, reviewProgress, firstRowChip, lastRowChip, firstUpRowChip, medicareCopyFirstRowChip, medicareCopyLastRowChip, medicareCopySecondRowChip, medicareCopyThirdRowChip, medicareCopyTargetRowChip, firstRowPulse, firstRowShouldPulse, FIRST_ROW_PULSE_MS, secondRowChip, secondRowPulse, secondRowShouldPulse, SECOND_ROW_PULSE_MS, thirdRowChip, thirdRowPulse, thirdRowShouldPulse, THIRD_ROW_PULSE_MS, type RowFilter, type DispositionStatus, type InvestigationReport } from "@/lib/medicare/investigation";

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
  const progTimerRef = useRef<ReviewTimer>({ started_at: null, frozen_at: null });
  const progFrozenRef = useRef<{ elapsed_ms: number | null; frozen: boolean } | null>(null);
  useEffect(() => {
    const onP = (ev: Event) => { const d = (ev as CustomEvent<{ reviewed: number; items: number }>).detail; progTimerRef.current = nextReviewTimer(progTimerRef.current, d, Date.now()); };
    const onT = (ev: Event) => { const d = (ev as CustomEvent<{ elapsed_ms: number | null; frozen: boolean }>).detail; if (d) progFrozenRef.current = d; };
    window.addEventListener(MEDICARE_PROGRESS_EVENT, onP); window.addEventListener(MEDICARE_TIMER_EVENT, onT);
    return () => { window.removeEventListener(MEDICARE_PROGRESS_EVENT, onP); window.removeEventListener(MEDICARE_TIMER_EVENT, onT); };
  }, []);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);
  const packsEverRef = useRef(false);
  const packsPulseFirstRef = useRef(false);
  const [packsPulseAt, setPacksPulseAt] = useState<number | null>(null);
  const [packsPulseNow, setPacksPulseNow] = useState(0);
  useEffect(() => { if (packsPulseAt == null) return; const id = window.setInterval(() => setPacksPulseNow(Date.now()), 100); const t = window.setTimeout(() => { window.clearInterval(id); setPacksPulseAt(null); }, MEDICARE_PACKS_PULSE_MS + 50); return () => { window.clearInterval(id); window.clearTimeout(t); }; }, [packsPulseAt]);
  const [jumpsOpen, setJumpsOpen] = useState(false);
  const jumpsEverRef = useRef(false);
  const jumpsPulseFirstRef = useRef(false);
  const [jumpsPulseAt, setJumpsPulseAt] = useState<number | null>(null);
  const [jumpsPulseNow, setJumpsPulseNow] = useState(0);
  useEffect(() => { if (jumpsPulseAt == null) return; const id = window.setInterval(() => setJumpsPulseNow(Date.now()), 100); const t = window.setTimeout(() => { window.clearInterval(id); setJumpsPulseAt(null); }, MEDICARE_JUMPS_PULSE_MS + 50); return () => { window.clearInterval(id); window.clearTimeout(t); }; }, [jumpsPulseAt]);
  const stripHydratedRef = useRef(false);
  useEffect(() => { let st: Storage | null = null; try { st = window.sessionStorage; } catch {} const v = readMedicareStripState(st); if (v.packs) { packsEverRef.current = true; setPacksOpen(true); } if (v.jumps) { jumpsEverRef.current = true; setJumpsOpen(true); } stripHydratedRef.current = true; }, []);
  useEffect(() => { if (!stripHydratedRef.current) return; let st: Storage | null = null; try { st = window.sessionStorage; } catch {} writeMedicareStripState(st, "packs", packsOpen); writeMedicareStripState(st, "jumps", jumpsOpen); }, [packsOpen, jumpsOpen]);
  useEffect(() => { window.dispatchEvent(new CustomEvent(MEDICARE_STRIP_STATE_EVENT, { detail: { packs: packsOpen, jumps: jumpsOpen } })); }, [packsOpen, jumpsOpen]);
  useEffect(() => { const on = (ev: Event) => { const t = (ev as CustomEvent<unknown>).detail; if (t === "packs") setPacksOpen(false); else if (t === "jumps") setJumpsOpen(false); else return; const txt = medicareEscToast(t); if (txt) window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: txt })); }; window.addEventListener(MEDICARE_STRIP_COLLAPSE_EVENT, on); return () => window.removeEventListener(MEDICARE_STRIP_COLLAPSE_EVENT, on); }, []);
  const [rowCopied, setRowCopied] = useState<{ txt: string; at: number } | null>(null);
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
  const cvPulsedRef = useRef(false);
  const [cvPulseAt, setCvPulseAt] = useState<number | null>(null);
  const [cvPulseNow, setCvPulseNow] = useState(0);
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
  const cpPulsedRef = useRef({ first: false, last: false, target: false, second: false, third: false, all_rows: false, notes: false, statuses: false, progress: false }); const [cpPulseAt, setCpPulseAt] = useState<{ first: number | null; last: number | null; target: number | null; second: number | null; third: number | null; all_rows: number | null; notes: number | null; statuses: number | null; progress: number | null }>({ first: null, last: null, target: null, second: null, third: null, all_rows: null, notes: null, statuses: null, progress: null }); const [cpPulseNow, setCpPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<{ which?: unknown; json?: unknown }>).detail; const w = d?.which === "last" ? "last" : d?.which === "first" ? "first" : d?.which === "target" ? "target" : d?.which === "second" ? "second" : d?.which === "third" ? "third" : d?.which === "all_rows" ? "all_rows" : d?.which === "notes" ? "notes" : d?.which === "statuses" ? "statuses" : d?.which === "progress" ? "progress" : null; if (!w || !medicareCopyRowChipShouldPulse(cpPulsedRef.current[w], d?.json)) return; cpPulsedRef.current[w] = true; const t = Date.now(); setCpPulseAt((p) => ({ ...p, [w]: t })); setCpPulseNow(t); window.setTimeout(() => setCpPulseNow(Date.now()), MEDICARE_COPY_ROW_CHIP_PULSE_MS); }; window.addEventListener(MEDICARE_COPY_ROW_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_COPY_ROW_PULSE_EVENT, on); }, []);
  const hoPulsedRef = useRef(false); const [hoPulseAt, setHoPulseAt] = useState<number | null>(null); const [hoPulseNow, setHoPulseNow] = useState(0);
  const hoPendingRef = useRef<number | null>(null);
  useEffect(() => { const on = () => { const now = Date.now(); if (!medicareHandoffChipCopiedOk(hoPendingRef.current, now)) return; hoPendingRef.current = null; window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "handoff", json: "1" } })); if (medicareHandoffChipShouldPulse(hoPulsedRef.current, true)) { hoPulsedRef.current = true; setHoPulseAt(now); setHoPulseNow(now); window.setTimeout(() => setHoPulseNow(Date.now()), MEDICARE_HANDOFF_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_HANDOFF_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_HANDOFF_COPIED_EVENT, on); }, []);
  const ivPendingRef = useRef<number | null>(null); const [ivCopied, setIvCopied] = useState(false); const ivPulsedRef = useRef(false); const [ivPulseAt, setIvPulseAt] = useState<number | null>(null); const [ivPulseNow, setIvPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const now = Date.now(); if (!medicareInvestigationChipCopiedOk(ivPendingRef.current, now, (ev as CustomEvent<unknown>).detail)) return; ivPendingRef.current = null; setIvCopied(true); window.setTimeout(() => setIvCopied(false), 1200); if (medicareInvestigationChipShouldPulse(ivPulsedRef.current, true)) { ivPulsedRef.current = true; setIvPulseAt(now); setIvPulseNow(now); window.setTimeout(() => setIvPulseNow(Date.now()), MEDICARE_INVESTIGATION_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_PACK_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_PACK_COPIED_EVENT, on); }, []);
  const evPendingRef = useRef<number | null>(null); const [evCopied, setEvCopied] = useState(false); const evPulsedRef = useRef(false); const [evPulseAt, setEvPulseAt] = useState<number | null>(null); const [evPulseNow, setEvPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const now = Date.now(); if (!medicareEvidenceChipCopiedOk(evPendingRef.current, now, (ev as CustomEvent<unknown>).detail)) return; evPendingRef.current = null; setEvCopied(true); window.setTimeout(() => setEvCopied(false), 1200); if (medicareEvidenceChipShouldPulse(evPulsedRef.current, true)) { evPulsedRef.current = true; setEvPulseAt(now); setEvPulseNow(now); window.setTimeout(() => setEvPulseNow(Date.now()), MEDICARE_EVIDENCE_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_PACK_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_PACK_COPIED_EVENT, on); }, []);
  const pvPendingRef = useRef<number | null>(null); const [pvCopied, setPvCopied] = useState(false); const pvPulsedRef = useRef(false); const [pvPulseAt, setPvPulseAt] = useState<number | null>(null); const [pvPulseNow, setPvPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const now = Date.now(); if (!medicareProvenanceChipCopiedOk(pvPendingRef.current, now, (ev as CustomEvent<unknown>).detail)) return; pvPendingRef.current = null; setPvCopied(true); window.setTimeout(() => setPvCopied(false), 1200); if (medicareProvenanceChipShouldPulse(pvPulsedRef.current, true)) { pvPulsedRef.current = true; setPvPulseAt(now); setPvPulseNow(now); window.setTimeout(() => setPvPulseNow(Date.now()), MEDICARE_PROVENANCE_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_PACK_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_PACK_COPIED_EVENT, on); }, []);
  const blPendingRef = useRef<number | null>(null); const [blCopied, setBlCopied] = useState(false); const blPulsedRef = useRef(false); const [blPulseAt, setBlPulseAt] = useState<number | null>(null); const [blPulseNow, setBlPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const now = Date.now(); if (!medicareBaselinesChipCopiedOk(blPendingRef.current, now, (ev as CustomEvent<unknown>).detail)) return; blPendingRef.current = null; setBlCopied(true); window.setTimeout(() => setBlCopied(false), 1200); if (medicareBaselinesChipShouldPulse(blPulsedRef.current, true)) { blPulsedRef.current = true; setBlPulseAt(now); setBlPulseNow(now); window.setTimeout(() => setBlPulseNow(Date.now()), MEDICARE_BASELINES_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_PACK_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_PACK_COPIED_EVENT, on); }, []);
  const dqPendingRef = useRef<number | null>(null); const [dqCopied, setDqCopied] = useState(false); const dqPulsedRef = useRef(false); const [dqPulseAt, setDqPulseAt] = useState<number | null>(null); const [dqPulseNow, setDqPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const now = Date.now(); if (!medicareDqChipCopiedOk(dqPendingRef.current, now, (ev as CustomEvent<unknown>).detail)) return; dqPendingRef.current = null; setDqCopied(true); window.setTimeout(() => setDqCopied(false), 1200); if (medicareDqChipShouldPulse(dqPulsedRef.current, true)) { dqPulsedRef.current = true; setDqPulseAt(now); setDqPulseNow(now); window.setTimeout(() => setDqPulseNow(Date.now()), MEDICARE_DQ_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_PACK_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_PACK_COPIED_EVENT, on); }, []);
  const cbPendingRef = useRef<number | null>(null); const [cbCopied, setCbCopied] = useState(false); const cbPulsedRef = useRef(false); const [cbPulseAt, setCbPulseAt] = useState<number | null>(null); const [cbPulseNow, setCbPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { const d = (ev as CustomEvent<{ trusted?: boolean }>).detail; if (d?.trusted) return; const now = Date.now(); if (!medicareBriefChipCopiedOk(cbPendingRef.current, now)) return; cbPendingRef.current = null; window.dispatchEvent(new CustomEvent(MEDICARE_PACK_COPIED_EVENT, { detail: "brief" })); setCbCopied(true); window.setTimeout(() => setCbCopied(false), 1200); if (medicareBriefChipShouldPulse(cbPulsedRef.current, true)) { cbPulsedRef.current = true; setCbPulseAt(now); setCbPulseNow(now); window.setTimeout(() => setCbPulseNow(Date.now()), MEDICARE_BRIEF_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_BRIEF_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_BRIEF_COPIED_EVENT, on); }, []);
  const dsPulsedRef = useRef(false); const dsPendingRef = useRef<number | null>(null); const [dsPulseAt, setDsPulseAt] = useState<number | null>(null); const [dsPulseNow, setDsPulseNow] = useState(0);
  useEffect(() => { const on = () => { const now = Date.now(); if (!medicareDispositionsChipCopiedOk(dsPendingRef.current, now)) return; dsPendingRef.current = null; window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "dispositions", json: "1" } })); if (medicareDispositionsChipShouldPulse(dsPulsedRef.current, true)) { dsPulsedRef.current = true; setDsPulseAt(now); setDsPulseNow(now); window.setTimeout(() => setDsPulseNow(Date.now()), MEDICARE_DISPOSITIONS_CHIP_PULSE_MS); } }; window.addEventListener(MEDICARE_DISPOSITIONS_COPIED_EVENT, on); return () => window.removeEventListener(MEDICARE_DISPOSITIONS_COPIED_EVENT, on); }, []);
  const fuPulsedRef = useRef(false); const [fuPulseAt, setFuPulseAt] = useState<number | null>(null); const [fuPulseNow, setFuPulseNow] = useState(0);
  useEffect(() => { const on = (ev: Event) => { if (!firstUpShouldPulse(fuPulsedRef.current, (ev as CustomEvent<unknown>).detail)) return; fuPulsedRef.current = true; const t = Date.now(); setFuPulseAt(t); setFuPulseNow(t); window.setTimeout(() => setFuPulseNow(Date.now()), FIRST_UP_PULSE_MS); }; window.addEventListener(MEDICARE_FIRST_UP_PULSE_EVENT, on); return () => window.removeEventListener(MEDICARE_FIRST_UP_PULSE_EVENT, on); }, []);
  const nrsLastRef = useRef<string | null>(null); const [nrsPulseAt, setNrsPulseAt] = useState<number | null>(null); const [nrsPulseNow, setNrsPulseNow] = useState(0);
  const tcsLastRef = useRef<string | null>(null); const [tcsPulseAt, setTcsPulseAt] = useState<number | null>(null); const [tcsPulseNow, setTcsPulseNow] = useState(0);
  const ursLastRef = useRef<string | null>(null); const [ursPulseAt, setUrsPulseAt] = useState<number | null>(null); const [ursPulseNow, setUrsPulseNow] = useState(0);
  const clsLastRef = useRef<string | null>(null); const [clsPulseAt, setClsPulseAt] = useState<number | null>(null); const [clsPulseNow, setClsPulseNow] = useState(0);
  const bnLastRef = useRef<string | null>(null); const [bnPulseAt, setBnPulseAt] = useState<number | null>(null); const [bnPulseNow, setBnPulseNow] = useState(0);
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
        {(() => { const c = firstUpRowChip(r.entries); return c.show ? (
          <button type="button" data-medicare-first-up-chip={c.jump ?? ""} data-medicare-first-up-pulsing={firstUpPulse(fuPulseAt, fuPulseNow) ? "1" : undefined} onClick={() => { if (firstUpChipChanged(c.jump, { filter, target: keyTarget })) window.dispatchEvent(new CustomEvent(MEDICARE_FIRST_UP_PULSE_EVENT, { detail: c.jump })); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the first disposition row — same as key g (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${firstUpPulse(fuPulseAt, fuPulseNow) ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = lastRowChip(r.entries); return c.show ? (
          <button type="button" data-medicare-last-row-chip={c.jump ?? ""} data-medicare-last-row-pulsing={lastRowPulse(lrPulseAt, lrPulseNow) ? "1" : undefined} onClick={() => { if (lastDownChipChanged(c.jump, { filter, target: keyTarget })) window.dispatchEvent(new CustomEvent(MEDICARE_LAST_ROW_PULSE_EVENT, { detail: c.jump })); window.dispatchEvent(new CustomEvent(MEDICARE_TARGET_JUMP_EVENT, { detail: c.jump })); }} title="Target and scroll to the last disposition row — same as key z (filter resets to All)"
            className={`rounded-full border border-sky-500 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${lastRowPulse(lrPulseAt, lrPulseNow) ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const jc = medicareJumpsChip(jumpsOpen); const on = medicareJumpsPulse(jumpsPulseAt, jumpsPulseNow); return <button type="button" data-medicare-jumps-toggle={jc.open ? "open" : "closed"} data-medicare-jumps-pulsing={on ? "1" : undefined} aria-expanded={jc.open} title={jc.title} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const t = medicareJumpsToggle(jumpsOpen, jumpsEverRef.current); jumpsEverRef.current = t.everOpened; setJumpsOpen(t.next); if (jumpsPulseFirstRef.current !== true) { jumpsPulseFirstRef.current = true; setJumpsPulseAt(Date.now()); } if (t.toast) window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: t.toast })); }} className={`rounded-full border border-zinc-500 px-3 py-1 text-xs font-mono text-zinc-200 hover:border-white${on ? " animate-pulse ring-2 ring-sky-300/60" : ""}`}>{jc.label}</button>; })()}
        {jumpsOpen && (() => { const c = blankNoteStickyChip(r); const on = blankNoteStickyPulse(bnPulseAt, bnPulseNow); return c.show ? (
          <button type="button" data-medicare-blank-note-sticky={c.target ?? ""} data-medicare-blank-note-sticky-pulsing={on ? "1" : undefined} title="Jump to the first reviewed row without a note and focus its note field — same as key w / N without notes ↓"
            onClick={() => { const id = c.target; if (!id) return; if (blankNoteStickyChanged(id, bnLastRef.current)) { bnLastRef.current = id; const t = Date.now(); setBnPulseAt(t); setBnPulseNow(t); window.setTimeout(() => setBnPulseNow(Date.now()), BLANK_NOTE_STICKY_PULSE_MS); } const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }}
            className={`rounded-full border border-sky-400 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {jumpsOpen && (() => { const c = needsReviewStickyChip(r); const on = needsReviewStickyPulse(nrsPulseAt, nrsPulseNow); return c.show ? (
          <button type="button" data-medicare-needs-review-sticky={c.target ?? ""} data-medicare-needs-review-sticky-pulsing={on ? "1" : undefined} title="Jump to the first needs-review row: sets filter to needs review, scrolls there and focuses its note (the N needs review chip / key b only toggle the filter; key i jumps to first unreviewed)"
            onClick={() => { const id = c.target; if (!id) return; if (needsReviewStickyChanged(id, { target: nrsLastRef.current, filter })) { nrsLastRef.current = id; const t = Date.now(); setNrsPulseAt(t); setNrsPulseNow(t); window.setTimeout(() => setNrsPulseNow(Date.now()), NEEDS_REVIEW_STICKY_PULSE_MS); window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: needsReviewStickyToast(id) })); } if (filter !== "needs_human_review") { setFilter("needs_human_review"); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: "needs_human_review" })); } window.setTimeout(() => { const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }, 50); }}
            className={`rounded-full border border-amber-400 px-3 py-1 text-xs font-mono text-amber-100 hover:border-white${on ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {jumpsOpen && (() => { const c = topCandidateStickyChip(r); const on = topCandidateStickyPulse(tcsPulseAt, tcsPulseNow); return c.show ? (
          <button type="button" data-medicare-top-candidate-sticky={c.target ?? ""} data-medicare-top-candidate-sticky-pulsing={on ? "1" : undefined} title="Jump to the rank-1 investigation entry (top anomaly): resets filter to All, scrolls there and focuses its note. First ↑ / #1 ↓ only move the key target; ○ unreviewed ↓ goes to the first unreviewed row"
            onClick={() => { const id = c.target; if (!id) return; if (topCandidateStickyChanged(id, { target: tcsLastRef.current, filter })) { tcsLastRef.current = id; const t = Date.now(); setTcsPulseAt(t); setTcsPulseNow(t); window.setTimeout(() => setTcsPulseNow(Date.now()), TOP_CANDIDATE_STICKY_PULSE_MS); window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: topCandidateStickyToast(id) })); } if (filter !== null) { setFilter(null); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: null })); } window.setTimeout(() => { const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }, 50); }}
            className={`rounded-full border border-fuchsia-400 px-3 py-1 text-xs font-mono text-fuchsia-100 hover:border-white${on ? " ring-4 ring-fuchsia-300 shadow-[0_0_16px_rgba(240,171,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {jumpsOpen && (() => { const c = unreviewedStickyChip(r); const on = unreviewedStickyPulse(ursPulseAt, ursPulseNow); return c.show ? (
          <button type="button" data-medicare-unreviewed-sticky={c.target ?? ""} data-medicare-unreviewed-sticky-pulsing={on ? "1" : undefined} title="Jump to the first unreviewed row (same target as key i): sets filter to unreviewed, scrolls there and focuses its note (the N unreviewed chip / key l only toggle the filter; key i clears the filter to All)"
            onClick={() => { const id = c.target; if (!id) return; if (unreviewedStickyChanged(id, { target: ursLastRef.current, filter })) { ursLastRef.current = id; const t = Date.now(); setUrsPulseAt(t); setUrsPulseNow(t); window.setTimeout(() => setUrsPulseNow(Date.now()), UNREVIEWED_STICKY_PULSE_MS); window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: unreviewedStickyToast(id) })); } if (filter !== "unreviewed") { setFilter("unreviewed"); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: "unreviewed" })); } window.setTimeout(() => { const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }, 50); }}
            className={`rounded-full border border-sky-400 px-3 py-1 text-xs font-mono text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {jumpsOpen && (() => { const c = clearedStickyChip(r); const on = clearedStickyPulse(clsPulseAt, clsPulseNow); return c.show ? (
          <button type="button" data-medicare-cleared-sticky={c.target ?? ""} data-medicare-cleared-sticky-pulsing={on ? "1" : undefined} title="Jump to the first cleared row: sets filter to cleared, scrolls there and focuses its note (the N cleared chip / key c only toggle the filter)"
            onClick={() => { const id = c.target; if (!id) return; if (clearedStickyChanged(id, { target: clsLastRef.current, filter })) { clsLastRef.current = id; const t = Date.now(); setClsPulseAt(t); setClsPulseNow(t); window.setTimeout(() => setClsPulseNow(Date.now()), CLEARED_STICKY_PULSE_MS); window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: clearedStickyToast(id) })); } if (filter !== "cleared_pattern_only") { setFilter("cleared_pattern_only"); window.dispatchEvent(new CustomEvent(MEDICARE_FILTER_EVENT, { detail: "cleared_pattern_only" })); } window.setTimeout(() => { const inp = document.querySelector<HTMLInputElement>(`[data-medicare-note="${CSS.escape(id)}"]`); if (!inp) { document.getElementById("medicare-disposition-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } inp.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 400); }, 50); }}
            className={`rounded-full border border-emerald-400 px-3 py-1 text-xs font-mono text-emerald-100 hover:border-white${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = medicareDispositionsChip(r); const on = medicareDispositionsChipPulse(dsPulseAt, dsPulseNow); return c.show ? (
          <button type="button" data-medicare-dispositions-chip="" data-medicare-dispositions-chip-pulsing={on ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>("[data-copy-medicare-dispositions]"); if (!b || b.disabled) return; dsPendingRef.current = Date.now(); b.click(); }}
            title="Copy current dispositions JSON — same as key y / the dispositions copy button (toast only after clipboard success)"
            className={`rounded-full border-2 border-sky-300 bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-100 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {(() => { const c = medicareInvestigationChip(r); const ivOn = medicareInvestigationChipPulse(ivPulseAt, ivPulseNow); return c.show ? (
          <button type="button" data-medicare-investigation-chip="" data-medicare-investigation-chip-pulsing={ivOn ? "1" : undefined} data-medicare-investigation-chip-copied={ivCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>('[data-copy-medicare-json="investigation"]'); if (!b || b.disabled) return; ivPendingRef.current = Date.now(); b.click(); }}
            title="Copy the full investigation JSON — same as key m / Copy investigation JSON button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${ivCopied ? "border-green-400 bg-green-500 text-black" : "border-amber-300 bg-amber-500/20 text-amber-100"}${ivOn ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.8)] motion-safe:animate-pulse" : ""}`}>{ivCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {(() => { const c = medicareEvidenceChip(r); const evOn = medicareEvidenceChipPulse(evPulseAt, evPulseNow); return c.show ? (
          <button type="button" data-medicare-evidence-chip="" data-medicare-evidence-chip-pulsing={evOn ? "1" : undefined} data-medicare-evidence-chip-copied={evCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>('[data-copy-medicare-json="evidence"]'); if (!b || b.disabled) return; evPendingRef.current = Date.now(); b.click(); }}
            title="Copy the evidence pack JSON — same as key q / Copy evidence pack JSON button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${evCopied ? "border-green-400 bg-green-500 text-black" : "border-violet-300 bg-violet-500/20 text-violet-100"}${evOn ? " ring-4 ring-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.8)] motion-safe:animate-pulse" : ""}`}>{evCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {(() => { const on = medicareCopyViewPulse(cvPulseAt, cvPulseNow); const vi = { rowFilter: filter, packsOpen, jumpsOpen, keyTarget, entries: r.entries }; return <button type="button" data-medicare-copy-view="1" data-medicare-copy-view-pulsing={on ? "1" : undefined} title="Copy compact view JSON (rowFilter, packsOpen, jumpsOpen, keyTarget item_id/index) — not raw sessionStorage" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const json = medicareViewSnapshotJson(vi); const toast = medicareCopyViewToast(vi); void navigator.clipboard?.writeText(json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: toast })); if (medicareCopyViewShouldPulse(cvPulsedRef.current)) { cvPulsedRef.current = true; const t = Date.now(); setCvPulseAt(t); setCvPulseNow(t); window.setTimeout(() => setCvPulseNow(Date.now()), MEDICARE_COPY_VIEW_PULSE_MS); } }).catch(() => {}); }} className={`rounded-full border border-zinc-500 px-3 py-1 text-xs font-mono text-zinc-200 hover:border-white${on ? " ring-4 ring-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`}>⧉ View</button>; })()}
        <button type="button" data-medicare-reset-view="1" title={`Reset view: filter All, Packs/Jumps closed, key target cleared — clears sessionStorage ${MEDICARE_RESET_VIEW_KEYS.join(", ")}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const clr = () => { let st: Storage | null = null; try { st = window.sessionStorage; } catch {} return clearMedicareViewSession(st).length; }; clr(); setPacksOpen(false); setJumpsOpen(false); window.dispatchEvent(new CustomEvent(MEDICARE_RESET_VIEW_EVENT)); window.setTimeout(() => { const n = clr(); window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: medicareResetViewToast(n) })); }, 0); }} className="rounded-full border border-zinc-500 px-3 py-1 text-xs font-mono text-zinc-200 hover:border-white">↺ Reset view</button>
        {(() => { const pc = medicarePacksChip(packsOpen); const on = medicarePacksPulse(packsPulseAt, packsPulseNow); return <button type="button" data-medicare-packs-toggle={pc.open ? "open" : "closed"} data-medicare-packs-pulsing={on ? "1" : undefined} aria-expanded={pc.open} title={pc.title} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const t = medicarePacksToggle(packsOpen, packsEverRef.current); packsEverRef.current = t.everOpened; setPacksOpen(t.next); if (packsPulseFirstRef.current !== true) { packsPulseFirstRef.current = true; setPacksPulseAt(Date.now()); } if (t.toast) window.dispatchEvent(new CustomEvent(MEDICARE_STICKY_JUMP_TOAST_EVENT, { detail: t.toast })); }} className={`rounded-full border border-zinc-500 px-3 py-1 text-xs font-mono text-zinc-200 hover:border-white${on ? " animate-pulse ring-2 ring-sky-300/60" : ""}`}>{pc.label}</button>; })()}
        {packsOpen && (() => { const c = medicareProvenanceChip(r); const pvOn = medicareProvenanceChipPulse(pvPulseAt, pvPulseNow); return c.show ? (
          <button type="button" data-medicare-provenance-chip="" data-medicare-provenance-chip-pulsing={pvOn ? "1" : undefined} data-medicare-provenance-chip-copied={pvCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>('[data-copy-medicare-json="provenance"]'); if (!b || b.disabled) return; pvPendingRef.current = Date.now(); b.click(); }}
            title="Copy the Know-stage provenance record JSON — same as key . / Copy provenance JSON button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${pvCopied ? "border-green-400 bg-green-500 text-black" : "border-emerald-300 bg-emerald-500/20 text-emerald-100"}${pvOn ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{pvCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {packsOpen && (() => { const c = medicareBaselinesChip(r); const blOn = medicareBaselinesChipPulse(blPulseAt, blPulseNow); return c.show ? (
          <button type="button" data-medicare-baselines-chip="" data-medicare-baselines-chip-pulsing={blOn ? "1" : undefined} data-medicare-baselines-chip-copied={blCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>('[data-copy-medicare-json="baselines"]'); if (!b || b.disabled) return; blPendingRef.current = Date.now(); b.click(); }}
            title="Copy the Know How baselines / rules JSON — same as key , / Copy baselines JSON button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${blCopied ? "border-green-400 bg-green-500 text-black" : "border-emerald-300 bg-emerald-500/20 text-emerald-100"}${blOn ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{blCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {packsOpen && (() => { const c = medicareDqChip(r); const dqOn = medicareDqChipPulse(dqPulseAt, dqPulseNow); return c.show ? (
          <button type="button" data-medicare-dq-chip="" data-medicare-dq-chip-pulsing={dqOn ? "1" : undefined} data-medicare-dq-chip-copied={dqCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>('[data-copy-medicare-json="dq"]'); if (!b || b.disabled) return; dqPendingRef.current = Date.now(); b.click(); }}
            title="Copy the Know-stage data-quality checks JSON — same as key / / Copy DQ JSON button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${dqCopied ? "border-green-400 bg-green-500 text-black" : "border-emerald-300 bg-emerald-500/20 text-emerald-100"}${dqOn ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{dqCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {(() => { const c = medicareBriefChip(r); const cbOn = medicareBriefChipPulse(cbPulseAt, cbPulseNow); return c.show ? (
          <button type="button" data-medicare-brief-chip="" data-medicare-brief-chip-pulsing={cbOn ? "1" : undefined} data-medicare-brief-chip-copied={cbCopied ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>("[data-copy-medicare-reviewed-brief]"); if (!b || b.disabled) return; cbPendingRef.current = Date.now(); b.click(); }}
            title="Copy the reviewed case brief — key o / same as the Copy (reviewed) case brief button (toast only after clipboard success)"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold hover:border-white ${cbCopied ? "border-green-400 bg-green-500 text-black" : "border-violet-300 bg-violet-500/20 text-violet-100"}${cbOn ? " ring-4 ring-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.8)] motion-safe:animate-pulse" : ""}`}>{cbCopied ? "Copied ✓" : c.label}</button>
        ) : null; })()}
        {(() => { const c = medicareHandoffChip(r); const on = medicareHandoffChipPulse(hoPulseAt, hoPulseNow); return c.show ? (
          <button type="button" data-medicare-handoff-chip="" data-medicare-handoff-chip-pulsing={on ? "1" : undefined} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); const b = document.querySelector<HTMLButtonElement>("[data-copy-medicare-handoff]"); if (!b || b.disabled) return; hoPendingRef.current = Date.now(); b.click(); window.dispatchEvent(new CustomEvent(MEDICARE_HANDOFF_FOCUS_EVENT, { detail: Date.now() })); }}
            title="Copy the 📦 hand-off pack — same as key h / the 📦 button (Hand-off ready: complete + ≥1 note)"
            className={`rounded-full border-2 border-emerald-300 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-100 hover:border-white${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{c.label}</button>
        ) : null; })()}
        {([medicareCopyFirstRowChip(r.entries), medicareCopyLastRowChip(r.entries)] as const).map((c, i) => c.show ? (
          <button key={i ? "copy-last" : "copy-first"} type="button" {...{ [i ? "data-medicare-copy-last-row-chip" : "data-medicare-copy-first-row-chip"]: "" }} data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={medicareCopyRowChipPulse(i ? cpPulseAt.last : cpPulseAt.first, cpPulseNow) ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: i ? "last" : "first", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: i ? "last" : "first", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title={i ? "Copy the last disposition row JSON (report.entries[last]) — same as key ; (focus/filter unchanged)" : "Copy the #1 disposition row JSON (report.entries[0]) — same as key x (focus/filter unchanged)"}
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${medicareCopyRowChipPulse(i ? cpPulseAt.last : cpPulseAt.first, cpPulseNow) ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ) : null)}
        {packsOpen && (() => { const c = medicareCopyAllRowsChip(r); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.all_rows, cpPulseNow); return (
          <button type="button" data-medicare-copy-all-rows-chip={r.entries.length} data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "all_rows", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "all_rows", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy every disposition row as one JSON pack ({kind:'all_rows', count, report_hash, rows[]}) — rows only, unlike y / m which copy the whole hashed report envelope; target/filter unchanged"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        {packsOpen && (() => { const c = medicareCopyNotesChip(r); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.notes, cpPulseNow); return (
          <button type="button" data-medicare-copy-notes-chip="" data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "notes", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "notes", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy reviewer notes only as one JSON pack ({kind:'notes', count, of, report_hash, notes[{rank,item_id,status,reviewer,note}]}) — rows with a non-empty note; unlike 📦 Hand-off (full pack + case brief) or ⧉ Dispositions / y (whole report envelope); target/filter unchanged"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        {packsOpen && (() => { const c = medicareCopyStatusesChip(r); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.statuses, cpPulseNow); return (
          <button type="button" data-medicare-copy-statuses-chip="" data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "statuses", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "statuses", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy a compact status-mix pack ({kind:'statuses', count, report_hash, counts, rows[{rank,item_id,status}]}) — no notes/evidence; unlike ⧉ Notes, ⧉ All rows or ⧉ Dispositions / y; target/filter unchanged"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        {packsOpen && (() => { const c = medicareCopyProgressChip(r); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.progress, cpPulseNow); return (
          <button type="button" data-medicare-copy-progress-chip="" data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); const live = medicareCopyProgressChip(r, medicareProgressElapsedMs(progTimerRef.current, Date.now(), progFrozenRef.current)); const json = live.json || c.json; void navigator.clipboard?.writeText(json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "progress", json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "progress", json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy a compact review-progress pack ({kind:'progress', reviewed, total, percent, complete, notes, handoff_ready, counts, elapsed_ms, report_hash}) — no rows; smaller than ⧉ Statuses; unlike 📦 Hand-off (full pack) or the Win strip (display only); target/filter unchanged"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        <span data-medicare-evidence-packs-sticky="" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}><EvidencePacksChip scope="medicare" /></span>
        {(() => { const c = medicareCopySecondRowChip(r.entries); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.second, cpPulseNow); return (
          <button type="button" data-medicare-copy-second-row-chip="" data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "second", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "second", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy the #2 disposition row JSON (report.entries[1]) — same as key ' (target/filter unchanged; #2 ↓ jumps instead)"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        {(() => { const c = medicareCopyThirdRowChip(r.entries); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.third, cpPulseNow); return (
          <button type="button" data-medicare-copy-third-row-chip="" data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "third", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "third", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy the #3 disposition row JSON (report.entries[2]) — same as key &quot; (target/filter unchanged; #3 ↓ jumps instead)"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
        {(() => { const c = medicareCopyTargetRowChip(r.entries, keyTarget); if (!c.show) return null; const on = medicareCopyRowChipPulse(cpPulseAt.target, cpPulseNow); return (
          <button type="button" data-medicare-copy-target-row-chip={keyTarget ?? ""} data-medicare-row-copied={rowCopied?.txt === c.toast ? "1" : undefined} data-medicare-copy-row-pulsing={on ? "1" : undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(c.json).then(() => { window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_PULSE_EVENT, { detail: { which: "target", json: c.json } })); window.dispatchEvent(new CustomEvent(MEDICARE_COPY_ROW_TOAST_EVENT, { detail: { which: "target", json: c.json } })); const at = Date.now(); setRowCopied({ txt: c.toast, at }); window.setTimeout(() => setRowCopied((x) => (x && x.at === at ? null : x)), TOAST_PILL_COPIED_MS); }, () => {}); }}
            title="Copy the targeted (j/k / clicked) row JSON — same as key s (focus/filter unchanged)"
            className={`rounded-full border px-3 py-1 text-xs font-mono hover:border-white ${rowCopied?.txt === c.toast ? "border-green-400 bg-green-500 text-black" : "border-sky-500 text-sky-100"}${on ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>{rowCopied?.txt === c.toast ? c.toast : c.label}</button>
        ); })()}
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
