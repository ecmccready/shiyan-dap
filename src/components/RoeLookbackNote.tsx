"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { lookbackSummaryButtonToast } from "@/lib/level4/roe-lookback";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { loadExperienceServer } from "@/lib/level4/experience-client";
import CopyLookbackPath from "@/components/CopyLookbackPath";
import { lookbackMinPhiJumpChip, lookbackMinPhiJumpChanged, lookbackMinPhiJumpPulse, LOOKBACK_MIN_PHI_JUMP_PULSE_MS, lookbackMaxGapJumpChip, lookbackMaxGapJumpChanged, lookbackMaxGapJumpPulse, LOOKBACK_MAX_GAP_JUMP_PULSE_MS, lookbackGapsJson, lookbackCopyGapsChip, lookbackVerdictJson, lookbackCopyVerdictChip, lookbackRolesJson, lookbackCopyRolesChip, lookbackAllPathsJson, lookbackAllStepsJson, lookbackCopyAllStepsChip, lookbackCopyAllPathsChip, lookbackAgreeJumpChip, lookbackAgreeJumpChanged, lookbackAgreeJumpPulse, LOOKBACK_AGREE_JUMP_PULSE_MS, lookbackWinnersJumpChip, lookbackWinnersJumpChanged, lookbackWinnersJumpPulse, LOOKBACK_WINNERS_JUMP_PULSE_MS, lookbackBeatenJumpChip, lookbackBeatenJumpChanged, lookbackBeatenJumpPulse, LOOKBACK_BEATEN_JUMP_PULSE_MS, lookbackCopySummaryChip, lookbackExpandAllChip, lookbackExpandAllKey, lookbackExpandAllShouldPulse, lookbackThirdStepsJson, lookbackCopyThirdStepsChip, lookbackCopyThirdStepsKey, lookbackRunnerUpStepsJson, lookbackCopyRunnerUpStepsChip, lookbackCopyRunnerUpStepsKey, lookbackThirdPathJson, lookbackCopyThirdKey, lookbackCopyThirdChip, lookbackRunnerUpPathJson, lookbackCopyRunnerUpKey, lookbackCopyRunnerUpChip, lookbackCopyFocusStepsKey, lookbackCopyFocusStepsChip, lookbackCopyFocusChip, lookbackCopyGreedyStepsKey, lookbackGreedyStepsJson, lookbackCopyGreedyStepsChip, lookbackCopyLastStepsKey, lookbackLastStepsJson, lookbackCopyLastStepsChip, lookbackCopyTopStepsKey, lookbackTopStepsJson, lookbackCopyTopStepsChip, lookbackKeyToastDeferred, lookbackCopyChipToast, lookbackCompareChipToast, lookbackCopyCompareChip, lookbackGreedyPathJson, lookbackCopyGreedyKey, lookbackCopyGreedyChip, lookbackCopyChipShouldPulse, lookbackCopyChipPulse, LOOKBACK_COPY_TOP_LAST_PULSE_MS, lookbackCopyTopChip, lookbackCopyLastChip, lookbackLastPathJson, lookbackCopyLastKey, lookbackTopPathJson, lookbackCopyTopKey, lookbackFirstUpPulse, lookbackFirstUpShouldPulse, lookbackFirstUpChipChanged, lookbackLastChipChanged, LOOKBACK_FIRST_UP_PULSE_MS, lookbackLastPulse, lookbackLastShouldPulse, LOOKBACK_LAST_PULSE_MS, lookbackLastChip, lookbackFirstUpChip, lookbackLastKey, lookbackLastFocusTarget, LOOKBACK_PILOT_PULSE_MS, LOOKBACK_PILOT_SEEN_KEY, lookbackPilotPulse, lookbackAgreeChip, lookbackAgreePulse, lookbackAgreeShouldPulse, LOOKBACK_AGREE_PULSE_MS, lookbackAgreeKey, lookbackWinnersChip, lookbackWinnersPulse, lookbackWinnersShouldPulse, LOOKBACK_WINNERS_PULSE_MS, lookbackWinnersKey, lookbackBeatenKey, lookbackBeatenPulse, lookbackBeatenShouldPulse, LOOKBACK_BEATEN_PULSE_MS, lookbackCopyRecentKey, lookbackClearRecentKey, lookbackClearToastsKey, lookbackShowAllChip, lookbackShowAllPulse, lookbackShowAllShouldPulse, LOOKBACK_SHOW_ALL_PULSE_MS, lookbackShowAllKey, lookbackGreedyKey, lookbackGreedyChip, lookbackGreedyChipPulse, lookbackGreedyChipShouldPulse, LOOKBACK_GREEDY_CHIP_PULSE_MS, lookbackFirstChip, lookbackSecondChip, lookbackThirdChip, lookbackThirdPulse, lookbackThirdShouldPulse, LOOKBACK_THIRD_PULSE_MS, lookbackThirdKey, lookbackThirdFocusTarget, lookbackTopKey, lookbackRunnerUpKey, lookbackRunnerUpPulse, lookbackRunnerUpShouldPulse, LOOKBACK_RUNNER_UP_PULSE_MS, lookbackVerdictKey, lookbackVerdictFilterPulse, lookbackVerdictFilterShouldPulse, LOOKBACK_VERDICT_FILTER_PULSE_MS, lookbackVerdictFilterChip, lookbackBeatenChip, lookbackCopyRecentPulse, LOOKBACK_COPY_RECENT_PULSE_MS, lookbackCopyRecentChip, lookbackRecentChip, lookbackToastsChip, lookbackCheatsheetChip, lookbackExpandedChip, lookbackFocusChip, lookbackShowChip, lookbackSortChip, lookbackShownChip, lookbackSealedPathsChip, lookbackPhiGapChip, lookbackRunnerUpLeadChip, lookbackToastClickAction, lookbackStepsDeltaTargets, LOOKBACK_DELTA_GREEDY_SCROLL_MS, lookbackGreedyFocusTarget, lookbackTopFocusTarget, lookbackTopSteps, lookbackGreedySteps, lookbackStepsDelta, lookbackHelpPulse, LOOKBACK_HELP_PULSE_MS, lookbackFocusPulse, LOOKBACK_FOCUS_PULSE_MS, lookbackExpandPulse, LOOKBACK_EXPAND_PULSE_MS, lookbackSortPulse, LOOKBACK_SORT_PULSE_MS, lookbackFilterPulse, LOOKBACK_FILTER_PULSE_MS, lookbackSummaryCopyPulse, LOOKBACK_SUMMARY_COPY_PULSE_MS, lookbackSummaryCopiedPulse, LOOKBACK_SUMMARY_COPIED_PULSE_MS, lookbackPathCopiedPulse, LOOKBACK_PATH_COPIED_PULSE_MS, lookbackStepsCopiedPulse, LOOKBACK_STEPS_COPIED_PULSE_MS, lookbackComparePulse, LOOKBACK_COMPARE_PULSE_MS, lookbackCompareCopyPulse, LOOKBACK_COMPARE_COPY_PULSE_MS, lookbackTopPulse, LOOKBACK_TOP_PULSE_MS, lookbackWinPulse, LOOKBACK_WIN_PULSE_MS, restoreLookbackToast, lookbackToastPillLabel, LOOKBACK_TOAST_PILL_COPIED_MS, lookbackCopyAllLabel, clearLookbackToastHistory, lookbackToastHistoryJson, removeLookbackToastHistoryEntry, pushLookbackToastHistory, dismissedLookbackToastHistory, type LookbackToastHistoryEntry, lookbackToastCopyText, lookbackToastDurationMs, lookbackToastExpiry, lookbackToastsAfterLeave, LOOKBACK_TOAST_LEAVE_GRACE_MS, type LookbackToastId, dismissLookbackToast, clearAllLookbackToasts, showClearAllLookbackToasts, lookbackEscTarget, lookbackToastStack, lookbackAgreeToast, lookbackWinToast, WIN_TOAST_MS, emptyFilterToast, EMPTY_FILTER_TOAST_MS, lookbackKeyChanges, lookbackToastText, LOOKBACK_TOAST_MS, LOOKBACK_KEYMAP, toggleLookbackSort, cycleRoleFilter, lookbackKey, moveLookbackFocus, toggleRoleFilter, lookbackSummaryJson, lookbackDeltaECopiesSummary, lookbackSummary, lookbackVerdictCopiesCompare, pathStepsJson, pathStepsDetail, sparklinePoints, stepGains, lookbackComparePack, filterLookbackRows, type LookbackRoleFilter, lookbackRowRole, lookbackPathJson, sortLookbackRows, type LookbackSort, fmtDeltaPhi, lookbackRowEmphasis, lookbackVerdict, rankedLookbackRows, scoreSealedPaths, type LookbackCompare } from "@/lib/level4/roe-lookback";

/** Read-only ROE look-back note. GET /api/level4/experience only; nothing is written. */
export default function RoeLookbackNote() {
  const [c, setC] = useState<LookbackCompare | null>(null);
  const copy = useCopy(4000, undefined, "roe look-back");
  const copyRef = useRef<((t: string) => unknown) | null>(null);
  copyRef.current = copy.copy;
  const keyCopyRef = useRef<{ compare: (() => Promise<unknown> | null) | null; summary: (() => Promise<unknown> | null) | null }>({ compare: null, summary: null });
  const copyCmp = useCopy(4000, undefined, "roe compare pack");
  const copySum = useCopy(3000, undefined, "roe look-back summary");
  keyCopyRef.current = { compare: () => { const pk = c ? lookbackComparePack(c) : null; return pk ? copyCmp.copy(pk) : null; }, summary: () => (c ? copySum.copy(lookbackSummaryJson(c)) : null) };
  const [sortBy, setSortBy] = useState<LookbackSort>("rank");
  const [open, setOpen] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [eaPulseAt, setEaPulseAt] = useState<number | null>(null);
  const [eaPulseNow, setEaPulseNow] = useState(0);
  const eaPulsedRef = useRef(false);
  const expandAllRef = useRef<(() => void) | null>(null);
  const openRef = useRef<string | null>(null);
  openRef.current = open;
  const allOpenRef = useRef(false);
  allOpenRef.current = allOpen;
  const [roleFilter, setRoleFilter] = useState<LookbackRoleFilter>("all");
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const focusPulsedRef = useRef(false);
  const [focusPulseAt, setFocusPulseAt] = useState<number | null>(null);
  const [focusPulseNow, setFocusPulseNow] = useState(0);
  const [help, setHelp] = useState(false);
  const [pilotMount, setPilotMount] = useState<number | null>(null);
  const [pilotSeen, setPilotSeen] = useState(true);
  const [pilotNow, setPilotNow] = useState(0);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [firstUpPulseAt, setFirstUpPulseAt] = useState<number | null>(null);
  const [firstUpPulseNow, setFirstUpPulseNow] = useState(0);
  useEffect(() => { if (firstUpPulseAt == null) return; setFirstUpPulseNow(Date.now()); const t = setTimeout(() => setFirstUpPulseNow(Date.now()), LOOKBACK_FIRST_UP_PULSE_MS + 20); return () => clearTimeout(t); }, [firstUpPulseAt]);
  const [ctPulseAt, setCtPulseAt] = useState<number | null>(null);
  const [clPulseAt, setClPulseAt] = useState<number | null>(null);
  const [cpPulseNow, setCpPulseNow] = useState(0);
  const [cgPulseAt, setCgPulseAt] = useState<number | null>(null);
  const [ctsPulseAt, setCtsPulseAt] = useState<number | null>(null);
  const [clsPulseAt, setClsPulseAt] = useState<number | null>(null);
  const [cgsPulseAt, setCgsPulseAt] = useState<number | null>(null);
  const [crusPulseAt, setCrusPulseAt] = useState<number | null>(null);
  const [cthsPulseAt, setCthsPulseAt] = useState<number | null>(null);
  const [cfPulseAt, setCfPulseAt] = useState<number | null>(null);
  const [cfsPulseAt, setCfsPulseAt] = useState<number | null>(null);
  const [cruPulseAt, setCruPulseAt] = useState<number | null>(null);
  const [cthPulseAt, setCthPulseAt] = useState<number | null>(null);
  const [capPulseAt, setCapPulseAt] = useState<number | null>(null);
  const [crlPulseAt, setCrlPulseAt] = useState<number | null>(null);
  const [cvdPulseAt, setCvdPulseAt] = useState<number | null>(null);
  const [cgpPulseAt, setCgpPulseAt] = useState<number | null>(null);
  const [casPulseAt, setCasPulseAt] = useState<number | null>(null);
  useEffect(() => { if (ctPulseAt == null && clPulseAt == null && cgPulseAt == null && ctsPulseAt == null && clsPulseAt == null && cgsPulseAt == null && cfPulseAt == null && cfsPulseAt == null && cruPulseAt == null && crusPulseAt == null && cthsPulseAt == null && capPulseAt == null && casPulseAt == null && crlPulseAt == null && cvdPulseAt == null && cgpPulseAt == null) return; setCpPulseNow(Date.now()); const t = setTimeout(() => setCpPulseNow(Date.now()), LOOKBACK_COPY_TOP_LAST_PULSE_MS + 20); return () => clearTimeout(t); }, [ctPulseAt, clPulseAt, cgPulseAt, ctsPulseAt, clsPulseAt, cgsPulseAt, cfPulseAt, cfsPulseAt, cruPulseAt, crusPulseAt, cthsPulseAt, capPulseAt, casPulseAt, crlPulseAt, cvdPulseAt, cgpPulseAt]);
  const [lastPulseNow, setLastPulseNow] = useState(0);
  useEffect(() => { if (lastPulseAt == null) return; setLastPulseNow(Date.now()); const t = setTimeout(() => setLastPulseNow(Date.now()), LOOKBACK_LAST_PULSE_MS + 20); return () => clearTimeout(t); }, [lastPulseAt]);
  useEffect(() => { let seen = false; try { seen = localStorage.getItem(LOOKBACK_PILOT_SEEN_KEY) === "1"; } catch {} setPilotSeen(seen); if (seen) return; const t0 = Date.now(); setPilotMount(t0); setPilotNow(t0); const iv = setInterval(() => setPilotNow(Date.now()), 500); const to = setTimeout(() => clearInterval(iv), LOOKBACK_PILOT_PULSE_MS + 600); return () => { clearInterval(iv); clearTimeout(to); }; }, []);
  const helpRef = useRef(false);
  helpRef.current = help;
  const helpPulsedRef = useRef(false);
  const [helpPulseAt, setHelpPulseAt] = useState<number | null>(null);
  const [helpPulseNow, setHelpPulseNow] = useState(0);
  useEffect(() => { if (help && !helpPulsedRef.current) { helpPulsedRef.current = true; const t = Date.now(); setHelpPulseAt(t); setHelpPulseNow(t); const h = setTimeout(() => setHelpPulseNow(Date.now()), LOOKBACK_HELP_PULSE_MS); return () => clearTimeout(h); } }, [help]);
  const toastCountRef = useRef(0);
  const [toast, setToast] = useState<{ txt: string; at: number } | null>(null);
  const visibleRef = useRef<string[]>([]);
  const focusRef = useRef<string | null>(null);
  const jsonRef = useRef<Record<string, string>>({});
  const stepsRef = useRef<Record<string, string>>({});
  const [keyCopied, setKeyCopied] = useState<string | null>(null);
  const pathCopiedPulsedRef = useRef(false);
  const [pathCopiedPulse, setPathCopiedPulse] = useState<{ runId: string; at: number } | null>(null);
  const [pathCopiedNow, setPathCopiedNow] = useState(0);
  const markPathCopied = (runId: string) => {
    if (pathCopiedPulsedRef.current) return; pathCopiedPulsedRef.current = true;
    const t = Date.now(); setPathCopiedPulse({ runId, at: t }); setPathCopiedNow(t);
    window.setTimeout(() => setPathCopiedNow(Date.now()), LOOKBACK_PATH_COPIED_PULSE_MS);
  };
  const markPathCopiedRef = useRef(markPathCopied); markPathCopiedRef.current = markPathCopied;
  const stepsCopiedPulsedRef = useRef(false);
  const [stepsCopiedPulse, setStepsCopiedPulse] = useState<{ runId: string; at: number } | null>(null);
  const [stepsCopiedNow, setStepsCopiedNow] = useState(0);
  const markStepsCopied = (runId: string) => {
    if (stepsCopiedPulsedRef.current) return; stepsCopiedPulsedRef.current = true;
    const t = Date.now(); setStepsCopiedPulse({ runId, at: t }); setStepsCopiedNow(t);
    window.setTimeout(() => setStepsCopiedNow(Date.now()), LOOKBACK_STEPS_COPIED_PULSE_MS);
  };
  const markStepsCopiedRef = useRef(markStepsCopied); markStepsCopiedRef.current = markStepsCopied;
  focusRef.current = focusRow;
  const ruKeyRef = useRef<{ runnerUp: string | null; focus: string | null; open: string | null }>({ runnerUp: null, focus: null, open: null });
  const thirdKeyRef = useRef<string | null>(null);
  const greedyKeyRef = useRef<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const topJsonRef = useRef<string | null>(null);
  const lastJsonRef = useRef<string | null>(null);
  const ruJsonRef = useRef<string | null>(null);
  const thJsonRef = useRef<string | null>(null);
  const greedyJsonRef = useRef<string | null>(null);
  const topStepsJsonRef = useRef<string | null>(null);
  const lastStepsJsonRef = useRef<string | null>(null);
  const greedyStepsJsonRef = useRef<string | null>(null);
  const ruStepsJsonRef = useRef<string | null>(null);
  const thStepsJsonRef = useRef<string | null>(null);
  const topKeyRef = useRef<{ top: string | null; pulse: (() => void) | null }>({ top: null, pulse: null });
  const vkRef = useRef<{ winner: unknown; filter: unknown }>({ winner: undefined, filter: "all" });
  const akRef = useRef<{ agree: unknown; pulse?: (cur: unknown, next: unknown) => void }>({ agree: 0 });
  const wkRef = useRef<{ winners: unknown; pulse?: (cur: unknown, next: unknown) => void }>({ winners: 0 });
  const bkRef = useRef<{ beaten: unknown; pulse?: (cur: unknown, next: unknown) => void }>({ beaten: 0 });
  const clearKeyRef = useRef<{ count: number; clear: (() => void) | null }>({ count: 0, clear: null });
  const clearRecentKeyRef = useRef<{ count: number; clear: (() => void) | null }>({ count: 0, clear: null });
  const copyRecentKeyRef = useRef<{ count: number; copy: ((toast: string) => void) | null }>({ count: 0, copy: null });
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      if (lookbackExpandAllKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, expandAllRef.current ? 1 : 0)) { ev.preventDefault(); expandAllRef.current?.(); return; }
      { const pk = lookbackCopyRecentKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, copyRecentKeyRef.current.count);
        if (pk) { ev.preventDefault(); if (pk.changed && pk.toast) copyRecentKeyRef.current.copy?.(pk.toast); return; } }
      { const ek = lookbackClearRecentKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, clearRecentKeyRef.current.count);
        if (ek) { ev.preventDefault(); if (ek.changed) { clearRecentKeyRef.current.clear?.(); if (ek.toast) { const at = Date.now(); const txt = ek.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const dk = lookbackClearToastsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, clearKeyRef.current.count);
        if (dk) { ev.preventDefault(); if (dk.changed) { clearKeyRef.current.clear?.(); if (dk.toast) { const at = Date.now(); const txt = dk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const ak = lookbackAgreeKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, akRef.current.agree, vkRef.current.filter);
        if (ak) { ev.preventDefault(); if (ak.changed) { akRef.current.pulse?.(vkRef.current.filter, ak.next); vkRef.current.filter = ak.next; setRoleFilter(ak.next); if (ak.toast) { const at = Date.now(); const txt = ak.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const wk = lookbackWinnersKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, wkRef.current.winners, vkRef.current.filter);
        if (wk) { ev.preventDefault(); if (wk.changed) { wkRef.current.pulse?.(vkRef.current.filter, wk.next); vkRef.current.filter = wk.next; setRoleFilter(wk.next); if (wk.toast) { const at = Date.now(); const txt = wk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const bk = lookbackBeatenKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, bkRef.current.beaten, vkRef.current.filter);
        if (bk) { ev.preventDefault(); if (bk.changed) { bkRef.current.pulse?.(vkRef.current.filter, bk.next); vkRef.current.filter = bk.next; setRoleFilter(bk.next); if (bk.toast) { const at = Date.now(); const txt = bk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const vk = lookbackVerdictKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, vkRef.current.winner, vkRef.current.filter);
        if (vk) { ev.preventDefault(); if (vk.changed) { const prevF = vkRef.current.filter; setVfPulseAt((pa) => (lookbackVerdictFilterShouldPulse(pa != null, prevF, vk.next) ? Date.now() : pa)); vkRef.current.filter = vk.next; setRoleFilter(vk.next); if (vk.toast) { const at = Date.now(); const txt = vk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const ak = lookbackShowAllKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, vkRef.current.filter);
        if (ak) { ev.preventDefault(); if (ak.changed) { setSaPulseAt((pa) => (lookbackShowAllShouldPulse(pa != null, ak.changed) ? Date.now() : pa)); vkRef.current.filter = "all"; setRoleFilter("all"); if (ak.toast) { const at = Date.now(); const txt = ak.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const gk = lookbackGreedyKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, greedyKeyRef.current, { filter: vkRef.current.filter, focus: ruKeyRef.current.focus, open: ruKeyRef.current.open });
        if (gk) { ev.preventDefault(); if (gk.changed) { const id = gk.target; setGrPulseAt((pa) => (lookbackGreedyChipShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); if (gk.toast) { const at = Date.now(); const txt = gk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const xk = lookbackCopyTopKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, topJsonRef.current);
        if (xk) { ev.preventDefault(); const kj = xk.json, kt = xk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCtPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const tk = lookbackCopyTopStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, topStepsJsonRef.current);
        if (tk) { ev.preventDefault(); const kj = tk.json, kt = tk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCtsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const lk = lookbackCopyLastStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, lastStepsJsonRef.current);
        if (lk) { ev.preventDefault(); const kj = lk.json, kt = lk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setClsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const ik = lookbackCopyFocusStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, focusRef.current, focusRef.current ? stepsRef.current[focusRef.current] : null);
        if (ik) { ev.preventDefault(); const kj = ik.json, kt = ik.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCfsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const hk = lookbackCopyThirdStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, thStepsJsonRef.current);
        if (hk) { ev.preventDefault(); const kj = hk.json, kt = hk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCthsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const uk = lookbackCopyRunnerUpStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, ruStepsJsonRef.current);
        if (uk) { ev.preventDefault(); const kj = uk.json, kt = uk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCrusPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const rk = lookbackCopyGreedyStepsKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, greedyStepsJsonRef.current);
        if (rk) { ev.preventDefault(); const kj = rk.json, kt = rk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCgsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const yk = lookbackCopyGreedyKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, greedyJsonRef.current);
        if (yk) { ev.preventDefault(); const kj = yk.json, kt = yk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCgPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const nk = lookbackCopyRunnerUpKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, ruJsonRef.current);
        if (nk) { ev.preventDefault(); const kj = nk.json, kt = nk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCruPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const hk = lookbackCopyThirdKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, thJsonRef.current);
        if (hk) { ev.preventDefault(); const kj = hk.json, kt = hk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setCthPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const sk = lookbackCopyLastKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, lastJsonRef.current);
        if (sk) { ev.preventDefault(); const kj = sk.json, kt = sk.toast; void Promise.resolve(copyRef.current?.(kj)).then((ok) => { const txt = lookbackCopyChipToast(ok, kt); if (!txt) return; setClPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, kj) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); return; } }
      { const zk = lookbackLastKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, lastKeyRef.current, { filter: vkRef.current.filter, focus: ruKeyRef.current.focus, open: ruKeyRef.current.open });
        if (zk) { ev.preventDefault(); if (zk.changed) { const id = zk.target; setLastPulseAt((pa) => (lookbackLastShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); if (zk.toast) { const at = Date.now(); const txt = zk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const hk = lookbackThirdKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, thirdKeyRef.current, { filter: vkRef.current.filter, focus: ruKeyRef.current.focus, open: ruKeyRef.current.open });
        if (hk) { ev.preventDefault(); if (hk.changed) { const id = hk.target; setThPulseAt((pa) => (lookbackThirdShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); if (hk.toast) { const at = Date.now(); const txt = hk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const tk = lookbackTopKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, topKeyRef.current.top, { filter: vkRef.current.filter, focus: ruKeyRef.current.focus, open: ruKeyRef.current.open });
        if (tk) { ev.preventDefault(); if (tk.changed) { const id = tk.target; topKeyRef.current.pulse?.(); setFirstUpPulseAt((pa) => (lookbackFirstUpShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); if (tk.toast) { const at = Date.now(); const txt = tk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      { const rk = lookbackRunnerUpKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable }, ruKeyRef.current.runnerUp, { filter: vkRef.current.filter, focus: ruKeyRef.current.focus, open: ruKeyRef.current.open });
        if (rk) { ev.preventDefault(); if (rk.changed) { const id = rk.target; setRuPulseAt((pa) => (lookbackRunnerUpShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); if (rk.toast) { const at = Date.now(); const txt = rk.toast; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } } return; } }
      const k = lookbackKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable });
      const btn = k === "compare" || k === "summary" ? document.querySelector<HTMLButtonElement>(k === "summary" ? "[data-copy-roe-summary]" : "[data-copy-roe-compare]") : null;
      const changes = lookbackKeyChanges(k, { visible: visibleRef.current, focus: focusRef.current, open: openRef.current, button_ready: !!btn && !btn.disabled });
      const showKeyToast = (txt: string | null) => { if (!txt) return; const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); };
      const deferredTxt = changes && lookbackKeyToastDeferred(k) ? lookbackToastText(k, focusRef.current) : null;
      { const txt = changes && !lookbackKeyToastDeferred(k) ? lookbackToastText(k, focusRef.current) : null; if (txt) { const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } }
      if (k === "help") { ev.preventDefault(); setHelp((x) => !x); return; }
      if (k === "close") {
        const tgt = lookbackEscTarget(helpRef.current, toastCountRef.current, openRef.current, allOpenRef.current);
        if (tgt === "help") setHelp(false);
        else if (tgt === "toasts") { setWinToast(null); setAgreeToast(null); setEmptyToast(null); }
        else if (tgt === "all") { allOpenRef.current = false; setAllOpen(false); setOpen(null); const at = Date.now(); setToast({ txt: "⊟ Collapsed all (Esc)", at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }
        else if (tgt === "row") setOpen(null);
        return;
      }
      if (k === "sort") { ev.preventDefault(); setSortBy(toggleLookbackSort); return; }
      if (k === "filter") { ev.preventDefault(); setRoleFilter(cycleRoleFilter); return; }
      if (!k || !visibleRef.current.length) return;
      if (k === "compare" || k === "summary") { const b = document.querySelector<HTMLButtonElement>(k === "summary" ? "[data-copy-roe-summary]" : "[data-copy-roe-compare]"); if (!b || b.disabled) return; ev.preventDefault(); b.scrollIntoView({ block: "nearest" }); const run = k === "summary" ? keyCopyRef.current.summary : keyCopyRef.current.compare; const pr = run ? run() : null; if (!pr) { b.click(); return; } void Promise.resolve(pr).then((ok) => showKeyToast(lookbackCopyChipToast(ok, deferredTxt)), () => {}); return; }
      if (k === "next" || k === "prev") {
        ev.preventDefault();
        const id = moveLookbackFocus(visibleRef.current, focusRef.current, k);
        setFocusRow(id);
        if (id && !focusPulsedRef.current) { focusPulsedRef.current = true; const t = Date.now(); setFocusPulseAt(t); setFocusPulseNow(t); setTimeout(() => setFocusPulseNow(Date.now()), LOOKBACK_FOCUS_PULSE_MS); }
        if (id) document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (k === "toggle" && focusRef.current) { ev.preventDefault(); const id = focusRef.current; setOpen((o) => (o === id ? null : id)); }
      else if ((k === "copy" || k === "steps") && focusRef.current) {
        const id = focusRef.current; const j = (k === "steps" ? stepsRef.current : jsonRef.current)[id]; if (!j) return;
        ev.preventDefault();
        if (k === "steps") setOpen(id);
        const label = k === "steps" ? `${id} steps` : id;
        void navigator.clipboard?.writeText(j).then(() => { showKeyToast(lookbackCopyChipToast(true, deferredTxt)); if (k === "copy") { markPathCopiedRef.current(id); setCfPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } else markStepsCopiedRef.current(id); setKeyCopied(label); window.setTimeout(() => setKeyCopied((x) => (x === label ? null : x)), 1600); }, () => {});
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const toastHoverRef = useRef(false);
  const deferredRef = useRef<Map<LookbackToastId, () => void>>(new Map());
  const expireToast = (id: LookbackToastId, clear: () => void) => { if (lookbackToastExpiry(toastHoverRef.current) === "defer") deferredRef.current.set(id, clear); else clear(); };
  const leaveStack = (showing: readonly { id: LookbackToastId }[]) => {
    toastHoverRef.current = false;
    window.setTimeout(() => { if (toastHoverRef.current) return; for (const id of lookbackToastsAfterLeave(deferredRef.current.keys(), showing)) deferredRef.current.get(id)?.(); deferredRef.current.clear(); }, LOOKBACK_TOAST_LEAVE_GRACE_MS);
  };
  const [winToast, setWinToast] = useState<string | null>(null);
  const [toastHist, setToastHist] = useState<LookbackToastHistoryEntry[]>([]);
  const [copyAllAt, setCopyAllAt] = useState<number | null>(null);
  const [copyRecentAt, setCopyRecentAt] = useState<number | null>(null);
  const [copyRecentPulseAt, setCopyRecentPulseAt] = useState<number | null>(null);
  const [copyRecentPulseNow, setCopyRecentPulseNow] = useState(0);
  const [ruPulseAt, setRuPulseAt] = useState<number | null>(null);
  const [grPulseAt, setGrPulseAt] = useState<number | null>(null);
  const [grPulseNow, setGrPulseNow] = useState(0);
  useEffect(() => { if (grPulseAt == null) return; setGrPulseNow(Date.now()); const id = setTimeout(() => setGrPulseNow(Date.now()), LOOKBACK_GREEDY_CHIP_PULSE_MS); return () => clearTimeout(id); }, [grPulseAt]);
  const [thPulseAt, setThPulseAt] = useState<number | null>(null);
  const [thPulseNow, setThPulseNow] = useState(0);
  useEffect(() => { if (thPulseAt == null) return; setThPulseNow(Date.now()); const id = setTimeout(() => setThPulseNow(Date.now()), LOOKBACK_THIRD_PULSE_MS); return () => clearTimeout(id); }, [thPulseAt]);
  const [ruPulseNow, setRuPulseNow] = useState(0);
  useEffect(() => { if (ruPulseAt == null) return; setRuPulseNow(Date.now()); const id = setTimeout(() => setRuPulseNow(Date.now()), LOOKBACK_RUNNER_UP_PULSE_MS); return () => clearTimeout(id); }, [ruPulseAt]);
  const [vfPulseAt, setVfPulseAt] = useState<number | null>(null);
  const [vfPulseNow, setVfPulseNow] = useState(0);
  const [agPulseAt, setAgPulseAt] = useState<number | null>(null);
  const [agPulseNow, setAgPulseNow] = useState(0);
  useEffect(() => { if (agPulseAt == null) return; setAgPulseNow(Date.now()); const id = setTimeout(() => setAgPulseNow(Date.now()), LOOKBACK_AGREE_PULSE_MS); return () => clearTimeout(id); }, [agPulseAt]);
  const [wnPulseAt, setWnPulseAt] = useState<number | null>(null);
  const [wnPulseNow, setWnPulseNow] = useState(0);
  useEffect(() => { if (wnPulseAt == null) return; setWnPulseNow(Date.now()); const id = setTimeout(() => setWnPulseNow(Date.now()), LOOKBACK_WINNERS_PULSE_MS); return () => clearTimeout(id); }, [wnPulseAt]);
  const [bnPulseAt, setBnPulseAt] = useState<number | null>(null);
  const [ajPulseAt, setAjPulseAt] = useState<number | null>(null);
  const [mpPulseAt, setMpPulseAt] = useState<number | null>(null);
  const [mpPulseNow, setMpPulseNow] = useState(0);
  useEffect(() => { if (mpPulseAt == null) return; setMpPulseNow(Date.now()); const id = setTimeout(() => setMpPulseNow(Date.now()), LOOKBACK_MIN_PHI_JUMP_PULSE_MS + 20); return () => clearTimeout(id); }, [mpPulseAt]);
  const [mgPulseAt, setMgPulseAt] = useState<number | null>(null);
  const [mgPulseNow, setMgPulseNow] = useState(0);
  useEffect(() => { if (mgPulseAt == null) return; setMgPulseNow(Date.now()); const id = setTimeout(() => setMgPulseNow(Date.now()), LOOKBACK_MAX_GAP_JUMP_PULSE_MS + 20); return () => clearTimeout(id); }, [mgPulseAt]);
  const [ajPulseNow, setAjPulseNow] = useState(0);
  useEffect(() => { if (ajPulseAt == null) return; setAjPulseNow(Date.now()); const id = setTimeout(() => setAjPulseNow(Date.now()), LOOKBACK_AGREE_JUMP_PULSE_MS + 20); return () => clearTimeout(id); }, [ajPulseAt]);
  const [wjPulseAt, setWjPulseAt] = useState<number | null>(null);
  const [wjPulseNow, setWjPulseNow] = useState(0);
  useEffect(() => { if (wjPulseAt == null) return; setWjPulseNow(Date.now()); const id = setTimeout(() => setWjPulseNow(Date.now()), LOOKBACK_WINNERS_JUMP_PULSE_MS + 20); return () => clearTimeout(id); }, [wjPulseAt]);
  const [bjPulseAt, setBjPulseAt] = useState<number | null>(null);
  const [bjPulseNow, setBjPulseNow] = useState(0);
  useEffect(() => { if (bjPulseAt == null) return; setBjPulseNow(Date.now()); const id = setTimeout(() => setBjPulseNow(Date.now()), LOOKBACK_BEATEN_JUMP_PULSE_MS + 20); return () => clearTimeout(id); }, [bjPulseAt]);
  const [bnPulseNow, setBnPulseNow] = useState(0);
  useEffect(() => { if (bnPulseAt == null) return; setBnPulseNow(Date.now()); const id = setTimeout(() => setBnPulseNow(Date.now()), LOOKBACK_BEATEN_PULSE_MS); return () => clearTimeout(id); }, [bnPulseAt]);
  const [saPulseAt, setSaPulseAt] = useState<number | null>(null);
  const [saPulseNow, setSaPulseNow] = useState(0);
  useEffect(() => { if (saPulseAt == null) return; setSaPulseNow(Date.now()); const id = setTimeout(() => setSaPulseNow(Date.now()), LOOKBACK_SHOW_ALL_PULSE_MS); return () => clearTimeout(id); }, [saPulseAt]);
  useEffect(() => { if (vfPulseAt == null) return; setVfPulseNow(Date.now()); const id = setTimeout(() => setVfPulseNow(Date.now()), LOOKBACK_VERDICT_FILTER_PULSE_MS); return () => clearTimeout(id); }, [vfPulseAt]);
  useEffect(() => { if (copyRecentPulseAt == null) return; setCopyRecentPulseNow(Date.now()); const id = setTimeout(() => setCopyRecentPulseNow(Date.now()), LOOKBACK_COPY_RECENT_PULSE_MS); return () => clearTimeout(id); }, [copyRecentPulseAt]);
  const [pillCopied, setPillCopied] = useState<{ key: string; at: number } | null>(null);
  const [agreeToast, setAgreeToast] = useState<string | null>(null);
  const winShownRef = useRef(false);
  useEffect(() => {
    if (!c || winShownRef.current) return;
    winShownRef.current = true;
    const txt = lookbackWinToast(c);
    if (txt) { setWinToast(txt); window.setTimeout(() => expireToast("win", () => setWinToast(null)), WIN_TOAST_MS); return; }
    const agree = lookbackAgreeToast(c);
    if (agree) { setAgreeToast(agree); window.setTimeout(() => expireToast("agree", () => setAgreeToast(null)), WIN_TOAST_MS); }
  }, [c]);
  const [emptyToast, setEmptyToast] = useState<string | null>(null);
  useEffect(() => {
    const txt = c ? emptyFilterToast(roleFilter, filterLookbackRows(rankedLookbackRows(c), roleFilter, c.winner).length, rankedLookbackRows(c).length) : null;
    setEmptyToast(txt);
    if (!txt) return;
    const id = window.setTimeout(() => expireToast("empty_filter", () => setEmptyToast(null)), EMPTY_FILTER_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [roleFilter, c]);
  const winPulsedRef = useRef(false);
  const [winPulseAt, setWinPulseAt] = useState<number | null>(null);
  const [winPulseNow, setWinPulseNow] = useState(0);
  const summaryTone = c ? lookbackSummary(c).tone : null;
  useEffect(() => {
    if (summaryTone !== "win" || winPulsedRef.current) return;
    winPulsedRef.current = true; const t = Date.now(); setWinPulseAt(t); setWinPulseNow(t);
    const id = setTimeout(() => setWinPulseNow(Date.now()), LOOKBACK_WIN_PULSE_MS); return () => clearTimeout(id);
  }, [summaryTone]);
  const cmpPulsedRef = useRef(false);
  const [cmpPulseAt, setCmpPulseAt] = useState<number | null>(null);
  const [cmpPulseNow, setCmpPulseNow] = useState(0);
  const cmpWinner = c?.winner;
  vkRef.current = { winner: cmpWinner, filter: roleFilter };
  akRef.current = { agree: c ? lookbackSummary(c).agree : 0, pulse: (cur, next) => setAgPulseAt((pa) => (lookbackAgreeShouldPulse(pa != null, cur, next) ? Date.now() : pa)) };
  wkRef.current = { winners: c ? lookbackSummary(c).winners : 0, pulse: (cur, next) => setWnPulseAt((pa) => (lookbackWinnersShouldPulse(pa != null, cur, next) ? Date.now() : pa)) };
  bkRef.current = { beaten: c ? lookbackSummary(c).beaten : 0, pulse: (cur, next) => setBnPulseAt((pa) => (lookbackBeatenShouldPulse(pa != null, cur, next) ? Date.now() : pa)) };
  ruKeyRef.current = { runnerUp: lookbackRunnerUpLeadChip(c)?.runner_up ?? null, focus: focusRow, open };
  useEffect(() => {
    if (cmpWinner !== "lookback" || cmpPulsedRef.current) return;
    cmpPulsedRef.current = true; const t = Date.now(); setCmpPulseAt(t); setCmpPulseNow(t);
    const id = setTimeout(() => setCmpPulseNow(Date.now()), LOOKBACK_COMPARE_PULSE_MS); return () => clearTimeout(id);
  }, [cmpWinner]);
  const cmpCopyPulsedRef = useRef(false);
  const [cmpCopyPulseAt, setCmpCopyPulseAt] = useState<number | null>(null);
  const [cmpCopyPulseNow, setCmpCopyPulseNow] = useState(0);
  useEffect(() => {
    if (copyCmp.status !== "copied" || cmpCopyPulsedRef.current) return;
    cmpCopyPulsedRef.current = true; const t = Date.now(); setCmpCopyPulseAt(t); setCmpCopyPulseNow(t);
    const id = setTimeout(() => setCmpCopyPulseNow(Date.now()), LOOKBACK_COMPARE_COPY_PULSE_MS); return () => clearTimeout(id);
  }, [copyCmp.status]);
  const topPulsedRef = useRef(false);
  const [topPulseAt, setTopPulseAt] = useState<number | null>(null);
  const [topPulseNow, setTopPulseNow] = useState(0);
  const rankedCount = c ? rankedLookbackRows(c).length : 0;
  thirdKeyRef.current = lookbackThirdFocusTarget(c);
  greedyKeyRef.current = lookbackGreedyFocusTarget(c);
  lastKeyRef.current = lookbackLastFocusTarget(c);
  topJsonRef.current = lookbackTopPathJson(c);
  const topStepsJson = lookbackTopStepsJson(c);
  topStepsJsonRef.current = topStepsJson;
  const lastStepsJson = lookbackLastStepsJson(c);
  lastStepsJsonRef.current = lastStepsJson;
  const greedyStepsJson = lookbackGreedyStepsJson(c);
  greedyStepsJsonRef.current = greedyStepsJson;
  const ruStepsJson = lookbackRunnerUpStepsJson(c);
  ruStepsJsonRef.current = ruStepsJson;
  const thStepsJson = lookbackThirdStepsJson(c);
  thStepsJsonRef.current = thStepsJson;
  lastJsonRef.current = lookbackLastPathJson(c);
  ruJsonRef.current = lookbackRunnerUpPathJson(c);
  thJsonRef.current = lookbackThirdPathJson(c);
  greedyJsonRef.current = lookbackGreedyPathJson(c);
  topKeyRef.current = { top: lookbackTopFocusTarget(c), pulse: () => { const t = Date.now(); setTopPulseAt(t); setTopPulseNow(t); setTimeout(() => setTopPulseNow(Date.now()), LOOKBACK_TOP_PULSE_MS); } };
  useEffect(() => {
    if (rankedCount <= 0 || topPulsedRef.current) return;
    topPulsedRef.current = true; const t = Date.now(); setTopPulseAt(t); setTopPulseNow(t);
    const id = setTimeout(() => setTopPulseNow(Date.now()), LOOKBACK_TOP_PULSE_MS); return () => clearTimeout(id);
  }, [rankedCount]);
  const sumCopiedPulsedRef = useRef(false);
  const [sumCopiedAt, setSumCopiedAt] = useState<number | null>(null);
  const [sumCopiedNow, setSumCopiedNow] = useState(0);
  useEffect(() => {
    if (copySum.status !== "copied" || sumCopiedPulsedRef.current) return;
    sumCopiedPulsedRef.current = true; const t = Date.now(); setSumCopiedAt(t); setSumCopiedNow(t);
    const id = setTimeout(() => setSumCopiedNow(Date.now()), LOOKBACK_SUMMARY_COPIED_PULSE_MS); return () => clearTimeout(id);
  }, [copySum.status]);
  const sumPulsedRef = useRef(false);
  const [sumPulseAt, setSumPulseAt] = useState<number | null>(null);
  const [sumPulseNow, setSumPulseNow] = useState(0);
  const sumHasData = !!(c && lookbackSummaryJson(c));
  useEffect(() => {
    if (!sumHasData || sumPulsedRef.current) return;
    sumPulsedRef.current = true; const t = Date.now(); setSumPulseAt(t); setSumPulseNow(t);
    const id = setTimeout(() => setSumPulseNow(Date.now()), LOOKBACK_SUMMARY_COPY_PULSE_MS); return () => clearTimeout(id);
  }, [sumHasData]);
  const filterPulsedRef = useRef(false);
  const [filterPulseAt, setFilterPulseAt] = useState<number | null>(null);
  const [filterPulseNow, setFilterPulseNow] = useState(0);
  useEffect(() => {
    if (roleFilter === "all" || filterPulsedRef.current) return;
    filterPulsedRef.current = true; const t = Date.now(); setFilterPulseAt(t); setFilterPulseNow(t);
    const id = setTimeout(() => setFilterPulseNow(Date.now()), LOOKBACK_FILTER_PULSE_MS); return () => clearTimeout(id);
  }, [roleFilter]);
  const sortPulsedRef = useRef(false);
  const [sortPulseAt, setSortPulseAt] = useState<number | null>(null);
  const [sortPulseNow, setSortPulseNow] = useState(0);
  useEffect(() => {
    if (sortBy === "rank" || sortPulsedRef.current) return;
    sortPulsedRef.current = true; const t = Date.now(); setSortPulseAt(t); setSortPulseNow(t);
    const id = setTimeout(() => setSortPulseNow(Date.now()), LOOKBACK_SORT_PULSE_MS); return () => clearTimeout(id);
  }, [sortBy]);
  const expandPulsedRef = useRef(false);
  const [expandPulseAt, setExpandPulseAt] = useState<number | null>(null);
  const [expandPulseNow, setExpandPulseNow] = useState(0);
  useEffect(() => {
    if (open === null || expandPulsedRef.current) return;
    expandPulsedRef.current = true; const t = Date.now(); setExpandPulseAt(t); setExpandPulseNow(t);
    const id = setTimeout(() => setExpandPulseNow(Date.now()), LOOKBACK_EXPAND_PULSE_MS); return () => clearTimeout(id);
  }, [open]);
  useEffect(() => { let on = true; void loadExperienceServer().then((rows) => { if (on) setC(scoreSealedPaths(rows)); }); return () => { on = false; }; }, []);
  const topStack = lookbackToastStack({ win: winToast, agree: agreeToast, empty_filter: emptyToast });
  clearKeyRef.current.count = topStack.length;
  clearKeyRef.current.clear = () => { const r = clearAllLookbackToasts(topStack); deferredRef.current.clear(); toastHoverRef.current = false; if (r.cleared.includes("win")) setWinToast(null); if (r.cleared.includes("agree")) setAgreeToast(null); if (r.cleared.includes("empty_filter")) setEmptyToast(null); };
  const topKey = topStack.map((t) => lookbackToastCopyText(t)).join("\n");
  useEffect(() => { if (topStack.length) setToastHist((h) => pushLookbackToastHistory(h, topStack)); }, [topKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pastToasts = dismissedLookbackToastHistory(toastHist, topStack);
  clearRecentKeyRef.current.count = pastToasts.length;
  copyRecentKeyRef.current.count = pastToasts.length;
  copyRecentKeyRef.current.copy = (txt: string) => { void navigator.clipboard?.writeText(lookbackToastHistoryJson(pastToasts)).then(() => { const at = Date.now(); setCopyRecentAt(at); setCopyRecentPulseAt((p) => p ?? at); window.setTimeout(() => setCopyRecentAt((x) => (x === at ? null : x)), LOOKBACK_TOAST_PILL_COPIED_MS); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); };
  clearRecentKeyRef.current.clear = () => setToastHist((h) => clearLookbackToastHistory(h, topStack));
  return (
    <section data-roe-lookback className="rounded-xl border border-zinc-800 p-4 text-sm space-y-1">
      {(() => { const stack = lookbackToastStack({ win: winToast, agree: agreeToast, empty_filter: emptyToast }); toastCountRef.current = stack.length; return stack.length ? (
        <>
        <style>{`@keyframes roe-toast-timebar{from{transform:scaleX(1)}to{transform:scaleX(0)}}.roe-toast-timebar{animation-name:roe-toast-timebar;animation-timing-function:linear;animation-fill-mode:forwards}[data-roe-lookback-toast-stack]:hover .roe-toast-timebar{animation-play-state:paused}@media (prefers-reduced-motion: reduce){.roe-toast-timebar{animation:none}}`}</style>
        <div data-roe-lookback-toast-stack className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex w-max max-w-[92vw] flex-col items-center gap-2 pointer-events-none">
          {showClearAllLookbackToasts(stack) && (
            <button type="button" data-roe-lookback-toast-clear-all title="Dismiss all top toasts (Esc) · Recent toasts kept" onMouseEnter={() => { toastHoverRef.current = true; }}
              onClick={() => { const r = clearAllLookbackToasts(stack); deferredRef.current.clear(); toastHoverRef.current = false; if (r.cleared.includes("win")) setWinToast(null); if (r.cleared.includes("agree")) setAgreeToast(null); if (r.cleared.includes("empty_filter")) setEmptyToast(null); }}
              className="pointer-events-auto self-end rounded-full border-2 border-white bg-zinc-950/90 px-3 py-1 text-xs font-bold text-white shadow-lg hover:bg-white hover:text-black">✕ Clear all {stack.length} <kbd className="ml-1 rounded border border-white/50 px-1 font-mono text-[10px]">Esc</kbd></button>
          )}
          {stack.map((t) => (
            <div key={t.id} {...{ [`data-roe-lookback-${t.id === "empty_filter" ? "empty" : t.id}-toast`]: true }} role="status" aria-live="polite" title={lookbackToastClickAction(t.id) === "reset_filter" ? "Click to reset Show to All (text copied too) · hover to keep" : "Click to copy and dismiss · hover to keep"} data-roe-lookback-toast-dismiss={t.id} data-roe-lookback-toast-action={lookbackToastClickAction(t.id)} onMouseEnter={() => { toastHoverRef.current = true; }} onMouseLeave={() => leaveStack(stack)}
              onClick={() => { const reset = lookbackToastClickAction(t.id) === "reset_filter"; if (reset) setRoleFilter("all"); const cp = lookbackToastCopyText(t); if (cp) void navigator.clipboard?.writeText(cp).then(() => { const at = Date.now(); setToast({ txt: reset ? "Show reset to All · toast text copied" : "copied toast text", at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); leaveStack(dismissLookbackToast(stack, t.id)); const keep = new Set(dismissLookbackToast(stack, t.id).map((x) => x.id)); if (!keep.has("win")) setWinToast(null); if (!keep.has("agree")) setAgreeToast(null); if (!keep.has("empty_filter")) setEmptyToast(null); }}
              className={`relative overflow-hidden pointer-events-auto cursor-pointer hover:brightness-110 rounded-2xl border-2 border-white px-6 py-3 text-base font-bold text-black shadow-2xl ${t.tone === "amber" ? "bg-amber-400 shadow-amber-500/40" : t.tone === "blue" ? "bg-sky-400 shadow-sky-500/40" : "bg-emerald-400 shadow-emerald-500/40"}`}>
              {t.tone === "amber" ? "⚠ " : ""}{t.text}<span aria-hidden className="ml-3 text-black/50">✕</span>
              <span key={t.text} aria-hidden data-roe-lookback-toast-timebar className="roe-toast-timebar absolute left-3 right-3 bottom-1 block h-1 origin-left rounded-full bg-black/40" style={{ animationDuration: `${lookbackToastDurationMs(t.id)}ms` }} />
            </div>
          ))}
        </div>
        </>
      ) : null; })()}
      {toast && (
        <div data-roe-lookback-key-toast role="status" aria-live="polite" className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-full border-2 border-amber-300 bg-zinc-950 px-5 py-2 text-sm font-semibold text-amber-200 shadow-lg shadow-amber-500/30">
          ⌨ {toast.txt}
        </div>
      )}
      {help && (
        <div data-roe-lookback-cheatsheet role="dialog" aria-label="Keyboard shortcuts" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setHelp(false)}>
          {(() => { const kc = lookbackCheatsheetChip(help); return kc.show ? <button type="button" data-roe-cheatsheet-keys-open title="Close keyboard cheat sheet (same as Esc / ?)" className="fixed top-3 right-3 z-[70] cursor-pointer rounded-full border-2 border-amber-300 bg-zinc-950 px-3 py-1 text-xs font-semibold text-amber-200 shadow-lg hover:bg-amber-500/20" onClick={(e) => { e.stopPropagation(); setHelp(false); }}>{kc.label}</button> : null; })()}
          <div data-pulsing={lookbackHelpPulse(helpPulseAt, helpPulseNow, help) ? "1" : undefined} className={`max-w-md w-full rounded-2xl border-2 border-amber-300 bg-zinc-950 p-5 shadow-2xl shadow-amber-500/20${lookbackHelpPulse(helpPulseAt, helpPulseNow, help) ? " ring-4 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`} onClick={(ev) => ev.stopPropagation()}>
            <p className="text-amber-300 text-sm font-bold uppercase tracking-widest mb-3">Keyboard · ROE look-back</p>
            <table className="w-full text-sm"><tbody>
              {LOOKBACK_KEYMAP.map((k) => (
                <tr key={k.key}><td className="pr-3 py-0.5 whitespace-nowrap"><kbd className="rounded border border-amber-300/70 bg-zinc-900 px-1.5 font-mono text-amber-100">{k.key === "Escape" ? "Esc" : k.key}</kbd></td><td className="text-zinc-200">{k.does}</td></tr>
              ))}
            </tbody></table>
            <p className="mt-3 text-xs text-zinc-500">Keys work outside text fields; Ctrl / Alt / Cmd are left to the browser. Inspect only: nothing changes the loop or any record.</p>
            <button type="button" onClick={() => setHelp(false)} className="mt-3 rounded-full border border-amber-300 px-4 py-1 text-xs text-amber-200">Close (Esc)</button>
          </div>
        </div>
      )}
      <p className="text-xs uppercase tracking-widest text-zinc-500">ROE look-back (aethel.roe.lookback.v1)</p>
      {pastToasts.length > 0 && (
        <div data-roe-lookback-toast-history className="rounded-xl border-2 border-amber-300/80 bg-zinc-950 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-amber-300 font-semibold uppercase tracking-widest">Recent toasts · last {pastToasts.length} (click to re-copy · 📌 to re-show)</p>
            <div className="flex gap-2">
            <button type="button" data-roe-lookback-toast-history-copy-all data-roe-lookback-toast-history-copy-all-copied={copyAllAt !== null ? "" : undefined} title="Copy all recent toasts as one JSON pack (this tab)" onClick={() => { void navigator.clipboard?.writeText(lookbackToastHistoryJson(pastToasts)).then(() => { const at = Date.now(); setCopyAllAt(at); window.setTimeout(() => setCopyAllAt((x) => (x === at ? null : x)), LOOKBACK_TOAST_PILL_COPIED_MS); setToast({ txt: `copied ${pastToasts.length} recent toasts JSON`, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}
              className={copyAllAt !== null ? "rounded-full border border-green-400 bg-green-500 px-3 py-0.5 font-semibold text-black motion-safe:animate-pulse" : "rounded-full border border-amber-300 px-3 py-0.5 font-semibold text-amber-200 hover:bg-amber-300 hover:text-black"}>{lookbackCopyAllLabel(copyAllAt, copyAllAt ?? 0)}</button>
            <button type="button" data-roe-lookback-toast-history-clear title="Clear recent toasts (this tab)" onClick={() => setToastHist((h) => clearLookbackToastHistory(h, topStack))}
              className="rounded-full border border-amber-300 px-3 py-0.5 font-semibold text-amber-200 hover:bg-amber-300 hover:text-black">Clear</button>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {pastToasts.map((h) => (
              <li key={lookbackToastCopyText(h)}>
                <button type="button" data-roe-lookback-toast-history-item={h.id} title="Copy this toast text again"
                  onClick={() => { const cp = lookbackToastCopyText(h); void navigator.clipboard?.writeText(cp).then(() => { const at = Date.now(); setPillCopied({ key: cp, at }); window.setTimeout(() => setPillCopied((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_PILL_COPIED_MS); setToast({ txt: "copied toast text", at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}
                  data-roe-lookback-toast-history-copied={pillCopied?.key === lookbackToastCopyText(h) ? "" : undefined}
                  className={`max-w-[28rem] truncate rounded-full border px-3 py-0.5 text-left font-semibold transition-colors ${pillCopied?.key === lookbackToastCopyText(h) ? "border-emerald-300 bg-emerald-400 text-black ring-2 ring-emerald-300 motion-safe:animate-pulse" : h.tone === "amber" ? "border-amber-400 text-amber-200" : h.tone === "blue" ? "border-sky-400 text-sky-200" : "border-emerald-400 text-emerald-200"}`}>
                  {lookbackToastPillLabel(h, pillCopied, pillCopied ? pillCopied.at : 0)}
                </button>
                <button type="button" data-roe-lookback-toast-history-restore={h.id} title="Re-show this toast at the top (this tab)" aria-label="Restore toast"
                  onClick={() => { const r = restoreLookbackToast(h, topStack); if (!r) return; const txt = r.text; if (r.id === "win") { setWinToast(txt); window.setTimeout(() => expireToast("win", () => setWinToast((x) => (x === txt ? null : x))), WIN_TOAST_MS); } else if (r.id === "agree") { setAgreeToast(txt); window.setTimeout(() => expireToast("agree", () => setAgreeToast((x) => (x === txt ? null : x))), WIN_TOAST_MS); } else { setEmptyToast(txt); window.setTimeout(() => expireToast("empty_filter", () => setEmptyToast((x) => (x === txt ? null : x))), EMPTY_FILTER_TOAST_MS); } }}
                  className="ml-1 rounded-full border border-sky-400 px-2 py-0.5 font-semibold text-sky-200 hover:bg-sky-400 hover:text-black">📌 Restore</button>
                <button type="button" data-roe-lookback-toast-history-remove={h.id} title="Remove this toast from Recent (this tab)" aria-label="Remove recent toast"
                  onClick={() => setToastHist((x) => removeLookbackToastHistoryEntry(x, h))}
                  className="ml-1 rounded-full border border-zinc-500 px-1.5 py-0.5 font-semibold text-zinc-300 hover:bg-zinc-500 hover:text-black">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!c ? <p className="text-zinc-500">Reading sealed paths…</p> : c.paths_considered === 0 ? <p className="text-zinc-400">No sealed paths yet.</p> : (
        <>
          <p className="text-zinc-300" data-roe-lookback-summary>
            {c.paths_considered} sealed paths · greedy (best single step I_t {c.greedy?.max_step_i}) {c.greedy?.run_id}: Δe {c.greedy?.cumulative_delta_e} ·
            look-back (best cumulative Δe) {c.lookback?.run_id}: Δe {c.lookback?.cumulative_delta_e}, Φ {c.lookback?.final_phi ?? "n/a"} ·
            {" "}{c.winner === "agree" ? "both pick the same path" : `look-back gains Δe ${c.delta_e_gain}`}
          </p>
          {(() => { const v = lookbackVerdict(c); return v.tone === "win" ? (
            <div role="status" data-roe-lookback-verdict="win" className="rounded-lg border-2 border-amber-400 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              <span className="mr-2 rounded-full bg-amber-400 text-black px-2 py-0.5 text-xs font-bold">{v.label}</span>{v.detail}
            </div>
          ) : v.tone === "agree" ? (
            <p data-roe-lookback-verdict="agree" className="text-xs text-zinc-400"><span className="mr-2 rounded-full border border-zinc-600 px-2 py-0.5">{v.label}</span>{v.detail}</p>
          ) : null; })()}
          <div className={`flex items-center gap-2 text-xs rounded${lookbackSortPulse(sortPulseAt, sortPulseNow, sortBy) ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-lookback-sort={sortBy} data-pulsing={lookbackSortPulse(sortPulseAt, sortPulseNow, sortBy) ? "1" : undefined}>
            <span className="text-zinc-500">Sort:</span><span className="text-zinc-600">(click a row for its actions · keys j/k move, Enter expand, Esc close, c copy path JSON, s copy steps JSON, m copy ⚖ compare pack, g copy summary JSON, f cycle Show, o toggle Sort, v verdict Show)</span><button type="button" data-roe-lookback-cheatsheet-open onClick={() => setHelp(true)} className="rounded border border-amber-400 px-1 text-amber-300 font-semibold">? all keys</button>{keyCopied ? <span data-roe-lookback-key-copied className="text-emerald-300">Copied {keyCopied} ✓</span> : null}
            {(["rank", "dphi"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)}
                className={`rounded-full border px-2 py-0.5 ${sortBy === k ? "border-emerald-400 text-emerald-200" : "border-zinc-600 text-zinc-400"}`}>
                {k === "rank" ? "Look-back rank" : "ΔΦ vs greedy ↓"}
              </button>
            ))}
          </div>
          {(() => { const m = lookbackSummary(c); return (
            <div data-roe-lookback-summary-strip={m.tone} data-pulsing={lookbackWinPulse(winPulseAt, winPulseNow, m.tone) ? "1" : undefined} className={`${lookbackWinPulse(winPulseAt, winPulseNow, m.tone) ? "ring-4 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.6)] motion-safe:animate-pulse " : ""}transition-shadow sticky top-0 z-20 -mx-4 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs backdrop-blur border-y ${m.tone === "win" ? "bg-emerald-950/90 border-emerald-400 text-emerald-100" : m.tone === "agree" ? "bg-sky-950/90 border-sky-500 text-sky-100" : "bg-zinc-950/90 border-zinc-700 text-zinc-300"}`}>
              {(() => { const on = lookbackPilotPulse(pilotSeen, pilotMount, pilotNow); return <a data-roe-lookback-pilot-chip data-roe-pilot-pulsing={on ? "1" : undefined} href="/workbench/offer#pilot-proposition" onClick={() => { try { localStorage.setItem(LOOKBACK_PILOT_SEEN_KEY, "1"); } catch {} setPilotSeen(true); }} className={`inline-flex items-center rounded-full border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 font-semibold text-emerald-300 hover:bg-emerald-900/50${on ? " ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>Pilot proposition →</a>; })()}
              {lookbackVerdictCopiesCompare(c) ? <button type="button" data-roe-summary-verdict-copy title="Click to copy ⚖ compare pack (same as m)" onClick={() => { const b = document.querySelector<HTMLButtonElement>("[data-copy-roe-compare]"); if (!b || b.disabled) return; b.scrollIntoView({ block: "nearest" }); b.click(); }} className={`cursor-pointer rounded-full px-2 py-0.5 font-bold underline decoration-dotted underline-offset-2 ${m.tone === "win" ? "bg-amber-400 text-black" : m.tone === "agree" ? "bg-sky-400 text-black" : "bg-zinc-700"}`}>{m.verdict} ⚖</button> : <span className={`rounded-full px-2 py-0.5 font-bold ${m.tone === "win" ? "bg-amber-400 text-black" : m.tone === "agree" ? "bg-sky-400 text-black" : "bg-zinc-700"}`}>{m.verdict}</span>}
              {lookbackDeltaECopiesSummary(c) ? <button type="button" data-roe-summary-delta-e-copy title="Click to copy summary JSON (same as g)" onClick={() => void copySum.copy(lookbackSummaryJson(c)).then((ok) => { const txt = lookbackSummaryButtonToast(ok, "delta_e"); if (!txt) return; const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); })} className="cursor-pointer rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-white/20">+Δe <b>{m.delta_e_gain}</b></button> : <span>+Δe <b>{m.delta_e_gain}</b></span>}
              <span>ΔΦ <b>{fmtDeltaPhi(m.delta_phi)}</b></span>
              {(() => { const cr = lookbackCopyRecentChip(pastToasts, copyRecentAt, copyRecentAt ?? 0); return cr.show ? <button type="button" data-roe-summary-copy-recent={pastToasts.length} data-roe-summary-copy-recent-copied={cr.copied ? "" : undefined} data-roe-copy-recent-pulsing={lookbackCopyRecentPulse(copyRecentPulseAt, copyRecentPulseNow) ? "1" : undefined} title="Copy Recent toasts JSON (same as Recent → ⧉ Copy all)" className={cr.copied ? "cursor-pointer rounded bg-green-500 px-1 font-semibold text-black motion-safe:animate-pulse" : "cursor-pointer rounded bg-white/10 px-1 hover:bg-white/20"+ (lookbackCopyRecentPulse(copyRecentPulseAt, copyRecentPulseNow) ? " ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)] motion-safe:animate-pulse" : "")} onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(lookbackToastHistoryJson(pastToasts)).then(() => { const at = Date.now(); setCopyRecentAt(at); setCopyRecentPulseAt((p) => p ?? at); window.setTimeout(() => setCopyRecentAt((x) => (x === at ? null : x)), LOOKBACK_TOAST_PILL_COPIED_MS); setToast({ txt: `copied ${pastToasts.length} recent toasts JSON`, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{cr.label}</button> : null; })()}
              {(() => { const rc = lookbackRecentChip(pastToasts); return rc.show ? <button type="button" data-roe-summary-recent={pastToasts.length} title="Click to Clear recent toasts (same as Recent → Clear)" className="cursor-pointer rounded bg-white/10 px-1 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setToastHist((h) => clearLookbackToastHistory(h, topStack)); }}>{rc.label}</button> : null; })()}
              {(() => { const tc = lookbackToastsChip(topStack); if (!tc.show) return null; return tc.clearable ? <button type="button" data-roe-summary-toasts title="Click to Clear all top toasts (same as ✕ Clear all)" className="cursor-pointer rounded bg-white/10 px-1 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); const r = clearAllLookbackToasts(topStack); deferredRef.current.clear(); toastHoverRef.current = false; if (r.cleared.includes("win")) setWinToast(null); if (r.cleared.includes("agree")) setAgreeToast(null); if (r.cleared.includes("empty_filter")) setEmptyToast(null); }}>{tc.label}</button> : <span data-roe-summary-toasts className="rounded bg-white/10 px-1">{tc.label}</span>; })()}
              {(() => { const kc = lookbackCheatsheetChip(help); return kc.show ? <button type="button" data-roe-summary-keys-open title="Keyboard cheat sheet is open — click to close (same as Esc / ?)" className="relative z-[60] cursor-pointer rounded bg-amber-500/20 px-1 text-amber-200 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setHelp(false); }}>{kc.label}</button> : null; })()}
              {(() => { const rows = rankedLookbackRows(c); const ea = lookbackExpandAllChip(rows, allOpen, open); const run = () => { if (!ea.show) return; if (ea.action === "expand") { setAllOpen(true); if (lookbackExpandAllShouldPulse(eaPulsedRef.current, "expand")) { eaPulsedRef.current = true; const t = Date.now(); setEaPulseAt(t); setEaPulseNow(t); window.setTimeout(() => setEaPulseNow(Date.now()), 1200); } } else { setAllOpen(false); setOpen(null); } const at = Date.now(); setToast({ txt: ea.toast, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }; expandAllRef.current = ea.show ? run : null; const pulsing = eaPulseAt != null && eaPulseNow - eaPulseAt < 1200; return ea.show ? <button type="button" data-roe-summary-expand-all={ea.action} data-roe-expand-all-first-use={pulsing ? "1" : undefined} aria-pressed={ea.action === "collapse"} title={ea.action === "expand" ? "Expand every sealed path's steps (key *)" : "Collapse every sealed path's steps (key *)"} className={`cursor-pointer rounded bg-violet-500/20 px-1 text-violet-200 hover:bg-white/20${pulsing ? " ring-2 ring-violet-300 motion-safe:animate-pulse" : ""}`} onClick={(e) => { e.stopPropagation(); run(); }}>{ea.label}</button> : null; })()}
              {(() => { const ec = lookbackExpandedChip(rankedLookbackRows(c), open); return ec.show ? <button type="button" data-roe-summary-expanded-chip={ec.id ?? ""} title={`Row ${ec.id} is expanded — click to collapse (same as Esc)`} className="cursor-pointer rounded bg-violet-500/20 px-1 text-violet-200 hover:bg-white/20" onClick={() => setOpen(null)}>{ec.label}</button> : null; })()}
              {(() => { const fc = lookbackFocusChip(rankedLookbackRows(c), focusRow); return fc.show ? <button type="button" data-roe-summary-focus-chip={fc.id ?? ""} title={fc.id ? `Focused row ${fc.id} — click to show, expand and scroll to it` : "No focused row — click to focus the first row (like j)"} className={`cursor-pointer rounded px-1 hover:bg-white/20 ${fc.id ? "bg-sky-500/20 text-sky-200" : "bg-white/10 text-zinc-300"}`} onClick={() => { const id = fc.jump; if (!id) return; setRoleFilter("all"); setFocusRow(id); setOpen(id); if (!focusPulsedRef.current) { focusPulsedRef.current = true; const t = Date.now(); setFocusPulseAt(t); setFocusPulseNow(t); setTimeout(() => setFocusPulseNow(Date.now()), LOOKBACK_FOCUS_PULSE_MS); } setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{fc.label}</button> : null; })()}
              {(() => { const vf = lookbackVerdictFilterChip(c?.winner, roleFilter); return vf.show ? <button type="button" data-roe-summary-verdict-filter={vf.target} aria-pressed={vf.active} title={vf.active ? "Showing verdict rows — click to show all" : `Click to Show only ${vf.target === "winners" ? "★ Winners" : "= Agree"} rows`} className={`cursor-pointer rounded px-1 font-semibold hover:bg-white/20 ${vf.target === "winners" ? "bg-emerald-500/25 text-emerald-100" : "bg-sky-500/25 text-sky-100"} ${vf.active ? "ring-1 ring-white/60" : ""}${lookbackVerdictFilterPulse(vfPulseAt, vfPulseNow) ? " ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-verdict-filter-pulsing={lookbackVerdictFilterPulse(vfPulseAt, vfPulseNow) ? "1" : undefined} onClick={() => { if (lookbackVerdictFilterShouldPulse(vfPulseAt != null, roleFilter, vf.next)) setVfPulseAt(Date.now()); setRoleFilter(vf.next); }}>{vf.label}</button> : null; })()}
              {(() => { const wc = lookbackWinnersChip(c ? lookbackSummary(c).winners : 0, roleFilter); return wc.show ? <button type="button" data-roe-summary-winners-filter="winners" aria-pressed={wc.active} title={wc.active ? "Showing ★ winner rows — click (or w) to show all" : "Click (or w) to Show only ★ winner rows"} className={`cursor-pointer rounded bg-emerald-500/25 px-1 font-semibold text-emerald-100 hover:bg-white/20 ${wc.active ? "ring-1 ring-white/60" : ""}${lookbackWinnersPulse(wnPulseAt, wnPulseNow) ? " ring-4 ring-emerald-200 motion-safe:animate-pulse" : ""}`} data-roe-winners-pulse={lookbackWinnersPulse(wnPulseAt, wnPulseNow) ? "1" : undefined} onClick={() => { wkRef.current.pulse?.(roleFilter, wc.next); setRoleFilter(wc.next); }}>{wc.label}</button> : null; })()}
              {(() => { const wj = lookbackWinnersJumpChip(c); if (!wj) return null; const wp = lookbackWinnersJumpPulse(wjPulseAt, wjPulseNow); return <button type="button" data-roe-summary-winners-jump={wj.target} data-roe-winners-jump-pulsing={wp ? "1" : undefined} title={`Show ★ Winners, focus, expand and scroll to the first winner-role sealed path (${wj.target}) — the N winners chip / w only toggle the filter`} className={`cursor-pointer rounded bg-emerald-500/15 px-1 text-emerald-100 hover:bg-white/20${wp ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = wj.target; if (lookbackWinnersJumpChanged(id, { filter: roleFilter, focus: focusRow, open })) { setWjPulseAt(Date.now()); const at = Date.now(); const txt = "winners ↓ → first winner path"; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } setRoleFilter("winners"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{wj.label}</button>; })()}
              {(() => { const ag = lookbackAgreeChip(c ? lookbackSummary(c).agree : 0, roleFilter); return ag.show ? <button type="button" data-roe-summary-agree-filter="agree" aria-pressed={ag.active} title={ag.active ? "Showing = agree rows — click (or =) to show all" : "Click (or =) to Show only = agree rows"} className={`cursor-pointer rounded bg-sky-500/25 px-1 font-semibold text-sky-100 hover:bg-white/20 ${ag.active ? "ring-1 ring-white/60" : ""}${lookbackAgreePulse(agPulseAt, agPulseNow) ? " ring-4 ring-sky-200 motion-safe:animate-pulse" : ""}`} data-roe-agree-pulse={lookbackAgreePulse(agPulseAt, agPulseNow) ? "1" : undefined} onClick={() => { akRef.current.pulse?.(roleFilter, ag.next); setRoleFilter(ag.next); }}>{ag.label}</button> : null; })()}
              {(() => { const aj = lookbackAgreeJumpChip(c); if (!aj) return null; const ap = lookbackAgreeJumpPulse(ajPulseAt, ajPulseNow); return <button type="button" data-roe-summary-agree-jump={aj.target} data-roe-agree-jump-pulsing={ap ? "1" : undefined} title={`Show = Agree, focus, expand and scroll to the first agree-role sealed path (${aj.target}) — the N agree chip / = only toggle the filter`} className={`cursor-pointer rounded bg-sky-500/15 px-1 text-sky-100 hover:bg-white/20${ap ? " ring-2 ring-sky-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = aj.target; if (lookbackAgreeJumpChanged(id, { filter: roleFilter, focus: focusRow, open })) { setAjPulseAt(Date.now()); const at = Date.now(); const txt = "agree ↓ → first agree path"; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } setRoleFilter("agree"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{aj.label}</button>; })()}
              {(() => { const mg = lookbackMaxGapJumpChip(c); if (!mg) return null; const mp = lookbackMaxGapJumpPulse(mgPulseAt, mgPulseNow); const d = mg.delta_phi_vs_greedy; return <button type="button" data-roe-summary-max-gap-jump={mg.target} data-roe-max-gap-jump-pulsing={mp ? "1" : undefined} title={`Focus, expand and scroll to the path with the highest ΔΦ vs greedy (${mg.target}, #${mg.rank}${d != null ? `, ΔΦ ${fmtDeltaPhi(d)}` : ""}) — Sort ΔΦ only re-orders, ⧉ Gaps only copies`} className={`cursor-pointer rounded bg-emerald-500/15 px-1 text-emerald-100 hover:bg-white/20${mp ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = mg.target; const visible = filterLookbackRows(rankedLookbackRows(c), roleFilter, c?.winner).some((r) => r.run_id === id); if (lookbackMaxGapJumpChanged(id, { visible, focus: focusRow, open })) { setMgPulseAt(Date.now()); const at = Date.now(); const txt = "ΔΦ ↓ → highest ΔΦ-vs-greedy path"; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } if (!visible) setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{mg.label}</button>; })()}
              {(() => { const lp = lookbackMinPhiJumpChip(c); if (!lp) return null; const pp = lookbackMinPhiJumpPulse(mpPulseAt, mpPulseNow); const f = lp.final_phi; return <button type="button" data-roe-summary-min-phi-jump={lp.target} data-roe-min-phi-jump-pulsing={pp ? "1" : undefined} title={`Focus, expand and scroll to the sealed path with the lowest final Φ (${lp.target}, #${lp.rank}${f != null ? `, Φ ${f}` : ""}) — TOP is rank 1, Last ↓ is the lowest rank, ΔΦ ↓ is the biggest margin vs greedy`} className={`cursor-pointer rounded bg-amber-500/15 px-1 text-amber-100 hover:bg-white/20${pp ? " ring-2 ring-amber-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = lp.target; const visible = filterLookbackRows(rankedLookbackRows(c), roleFilter, c?.winner).some((r) => r.run_id === id); if (lookbackMinPhiJumpChanged(id, { visible, focus: focusRow, open })) { setMpPulseAt(Date.now()); const at = Date.now(); const txt = "Φ ↑ → lowest final-Φ path"; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } if (!visible) setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{lp.label}</button>; })()}
              {(() => { const bc = lookbackBeatenChip(c ? lookbackSummary(c).beaten : 0, roleFilter); return bc.show ? <button type="button" data-roe-summary-beaten-filter="beaten" aria-pressed={bc.active} title={bc.active ? "Showing beaten rows — click to show all" : "Click to Show only beaten rows"} className={`cursor-pointer rounded bg-rose-500/25 px-1 font-semibold text-rose-100 hover:bg-white/20 ${bc.active ? "ring-1 ring-white/60" : ""}${lookbackBeatenPulse(bnPulseAt, bnPulseNow) ? " ring-4 ring-rose-200 motion-safe:animate-pulse" : ""}`} data-roe-beaten-pulse={lookbackBeatenPulse(bnPulseAt, bnPulseNow) ? "1" : undefined} onClick={() => { bkRef.current.pulse?.(roleFilter, bc.next); setRoleFilter(bc.next); }}>{bc.label}</button> : null; })()}
              {(() => { const bj = lookbackBeatenJumpChip(c); if (!bj) return null; const bp = lookbackBeatenJumpPulse(bjPulseAt, bjPulseNow); return <button type="button" data-roe-summary-beaten-jump={bj.target} data-roe-beaten-jump-pulsing={bp ? "1" : undefined} title={`Show Beaten, focus, expand and scroll to the first beaten sealed path (${bj.target}) — the N beaten chip / b only toggle the filter`} className={`cursor-pointer rounded bg-rose-500/15 px-1 text-rose-100 hover:bg-white/20${bp ? " ring-2 ring-rose-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = bj.target; if (lookbackBeatenJumpChanged(id, { filter: roleFilter, focus: focusRow, open })) { setBjPulseAt(Date.now()); const at = Date.now(); const txt = "beaten ↓ → first beaten path"; setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); } setRoleFilter("beaten"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{bj.label}</button>; })()}
              {(() => { const ac = lookbackShowAllChip(roleFilter); return ac.show ? <button type="button" data-roe-show-all-chip="1" title="Reset Show to All (same as a)" className={`cursor-pointer rounded bg-amber-500/20 px-1 text-amber-200 hover:bg-white/20${lookbackShowAllPulse(saPulseAt, saPulseNow) ? " ring-4 ring-zinc-200 motion-safe:animate-pulse" : ""}`} onClick={() => { setSaPulseAt((pa) => (lookbackShowAllShouldPulse(pa != null, true) ? Date.now() : pa)); vkRef.current.filter = "all"; setRoleFilter("all"); }}>{ac.label}</button> : null; })()}
              {(() => { const sh = lookbackShowChip(roleFilter); return <button type="button" data-roe-summary-show={sh.filter} data-roe-show-all-pulsing={lookbackShowAllPulse(saPulseAt, saPulseNow) ? "1" : undefined} aria-pressed={sh.filter !== "all"} title={`Current Show filter — click to cycle (same as f)`} className={`cursor-pointer rounded px-1 hover:bg-white/20 ${sh.filter === "all" ? "bg-white/10 text-zinc-300" : "bg-amber-500/20 text-amber-200"}${lookbackShowAllPulse(saPulseAt, saPulseNow) ? " ring-4 ring-zinc-200 shadow-[0_0_16px_rgba(228,228,231,0.8)] motion-safe:animate-pulse" : ""}`} onClick={() => setRoleFilter(sh.next)}>{sh.label} ⟳</button>; })()}
              {(() => { const so = lookbackSortChip(sortBy); return <button type="button" data-roe-summary-sort={so.sort} aria-pressed={so.sort === "dphi"} title={`Current sort — click to sort by ${so.next === "dphi" ? "ΔΦ" : "rank"} (same as o)`} className="cursor-pointer rounded bg-white/10 px-1 text-zinc-300 hover:bg-white/20" onClick={() => setSortBy(so.next)}>{so.label}</button>; })()}
              {(() => { const all = rankedLookbackRows(c); const sc = lookbackShownChip(roleFilter, filterLookbackRows(all, roleFilter, c.winner).length, all.length); return sc ? <button type="button" data-roe-summary-shown={sc.shown} data-roe-summary-shown-total={sc.total} title="Show filter active — click to show all" className="cursor-pointer rounded bg-amber-500/20 px-1 text-amber-200 hover:bg-amber-500/30" onClick={() => setRoleFilter("all")}>{sc.label}</button> : null; })()}
              {(() => { const sp = lookbackSealedPathsChip(m.paths); return sp ? <button type="button" data-roe-summary-sealed-paths={sp.count} title="sealed paths scored — click to set Show to All" className="cursor-pointer rounded bg-white/10 px-1 text-zinc-300 hover:bg-white/20" onClick={() => setRoleFilter("all")}>{sp.label}</button> : null; })()}
              {(() => { const ts = lookbackTopSteps(c); return ts ? <button type="button" data-roe-summary-top-steps={ts.steps} title={`top path ${ts.run_id}: ${ts.label} — click to jump to TOP row`} className="cursor-pointer underline decoration-dotted underline-offset-2" onClick={() => { const id = lookbackTopFocusTarget(c); if (!id) return; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>top <b>{ts.label}</b></button> : null; })()}
              {(() => { const gs = lookbackGreedySteps(c); return gs ? <button type="button" data-roe-summary-greedy-steps={gs.steps} title={`greedy path ${gs.run_id}: ${gs.label} — click to jump to greedy row`} className="cursor-pointer text-zinc-400 underline decoration-dotted underline-offset-2" onClick={() => { const id = lookbackGreedyFocusTarget(c); if (!id) return; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>· greedy <b>{gs.label}</b></button> : null; })()}
              {(() => { const pg = lookbackPhiGapChip(m.delta_phi, sortBy); return pg ? <button type="button" data-roe-summary-phi-gap={pg.delta} aria-pressed={sortBy === "dphi"} title={pg.changes ? "Φ gap of look-back vs greedy — click to sort by ΔΦ" : "Φ gap of look-back vs greedy — already sorted by ΔΦ; click to jump to TOP"} className={`cursor-pointer rounded px-1 hover:bg-white/20 ${pg.tone === "up" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`} onClick={() => { setRoleFilter("all"); if (pg.changes) { setSortBy(pg.nextSort); return; } const t = lookbackTopFocusTarget(c); if (!t) return; setFocusRow(t); setOpen(t); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(t)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{pg.label}</button> : null; })()}
              {(() => { const f1 = lookbackFirstChip(c); if (!f1) return null; const on = lookbackTopPulse(topPulseAt, topPulseNow, rankedCount); return <button type="button" data-roe-summary-first={f1.target} title={`Focus, expand and scroll to TOP sealed path #1 (${f1.target}) — same as key 1`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-first-pulsing={on ? "1" : undefined} onClick={() => { const id = f1.target; topKeyRef.current.pulse?.(); setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{f1.label}</button>; })()}
              {(() => { const sc2 = lookbackSecondChip(c); if (!sc2) return null; const on = lookbackRunnerUpPulse(ruPulseAt, ruPulseNow); return <button type="button" data-roe-summary-second={sc2.target} title={`Focus, expand and scroll to sealed path #2 (${sc2.target}) — same as key 2`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-second-pulsing={on ? "1" : undefined} onClick={() => { const id = sc2.target; if (lookbackRunnerUpShouldPulse(ruPulseAt != null, id)) setRuPulseAt(Date.now()); setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{sc2.label}</button>; })()}
              {(() => { const th = lookbackThirdChip(c); if (!th) return null; const on = lookbackThirdPulse(thPulseAt, thPulseNow); return <button type="button" data-roe-summary-third={th.target} title={`Focus, expand and scroll to sealed path #3 (${th.target}) — same as key 3`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-third-pulsing={on ? "1" : undefined} onClick={() => { const id = th.target; if (lookbackThirdShouldPulse(thPulseAt != null, id)) setThPulseAt(Date.now()); setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{th.label}</button>; })()}
              {(() => { const fu = lookbackFirstUpChip(c); if (!fu) return null; const on = lookbackTopPulse(topPulseAt, topPulseNow, rankedCount); const fp = lookbackFirstUpPulse(firstUpPulseAt, firstUpPulseNow); return <button type="button" data-roe-summary-first-up={fu.target} data-roe-first-up-pulsing={on ? "1" : undefined} data-roe-first-up-first-use={fp ? "1" : undefined} title={`Focus, expand and scroll to the TOP-ranked sealed path (${fu.target}) — same as key 1 / #1; pairs with Last ↓`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${fp ? " ring-2 ring-sky-300 motion-safe:animate-pulse" : on ? " ring-2 ring-amber-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = fu.target; if (lookbackFirstUpChipChanged(id, { filter: roleFilter, focus: focusRow, open })) { topKeyRef.current.pulse?.(); setFirstUpPulseAt((pa) => (lookbackFirstUpShouldPulse(pa != null, id) ? Date.now() : pa)); } setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{fu.label}</button>; })()}
              {(() => { const lc = lookbackLastChip(c); if (!lc) return null; return <button type="button" data-roe-summary-last={lc.target} data-roe-last-pulsing={lookbackLastPulse(lastPulseAt, lastPulseNow) ? "1" : undefined} title={`Focus, expand and scroll to the LAST-ranked sealed path (${lc.target}) — same as key z`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${lookbackLastPulse(lastPulseAt, lastPulseNow) ? " ring-2 ring-sky-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = lc.target; if (lookbackLastChipChanged(id, { filter: roleFilter, focus: focusRow, open })) setLastPulseAt((pa) => (lookbackLastShouldPulse(pa != null, id) ? Date.now() : pa)); vkRef.current.filter = "all"; ruKeyRef.current.focus = id; ruKeyRef.current.open = id; setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{lc.label}</button>; })()}
              {(() => { const tc = lookbackCopyTopChip(topJsonRef.current); if (!tc) return null; return <button type="button" data-roe-summary-copy-top="1" data-roe-copy-top-pulsing={lookbackCopyChipPulse(ctPulseAt, cpPulseNow) ? "1" : undefined} title="Copy the TOP-ranked sealed path JSON without moving focus — same as key x" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${lookbackCopyChipPulse(ctPulseAt, cpPulseNow) ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(tc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, tc.toast); if (!txt) return; { const j = tc.json; setCtPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{tc.label}</button>; })()}
              {(() => { const sc = lookbackCopyTopStepsChip(topStepsJson); if (!sc) return null; const on = lookbackCopyChipPulse(ctsPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-top-steps="1" data-roe-copy-top-steps-pulsing={on ? "1" : undefined} title="Copy the TOP-ranked path's steps JSON without expanding the row or moving focus — same as key t (same payload as expanding TOP and pressing s)" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(sc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, sc.toast); if (!txt) return; setCtsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, sc.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{sc.label}</button>; })()}
              {(() => { const sc = lookbackCopyLastStepsChip(lastStepsJson); if (!sc) return null; const on = lookbackCopyChipPulse(clsPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-last-steps="1" data-roe-copy-last-steps-pulsing={on ? "1" : undefined} title="Copy the LAST-ranked path's steps JSON without expanding the row or moving focus — same as key l (same payload as expanding LAST and pressing s); shown with ≥2 paths" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(sc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, sc.toast); if (!txt) return; setClsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, sc.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{sc.label}</button>; })()}
              {(() => { const sc = lookbackCopyGreedyStepsChip(greedyStepsJson); if (!sc) return null; const on = lookbackCopyChipPulse(cgsPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-greedy-steps="1" data-roe-copy-greedy-steps-pulsing={on ? "1" : undefined} title="Copy the greedy-picked path's steps JSON without expanding the row or moving focus — same as key r (same payload as expanding the greedy row and pressing s); pairs with ⧉ TOP / ⧉ Last steps" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(sc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, sc.toast); if (!txt) return; setCgsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, sc.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{sc.label}</button>; })()}
              {(() => { const sc = lookbackCopyRunnerUpStepsChip(ruStepsJson); if (!sc) return null; const on = lookbackCopyChipPulse(crusPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-runner-up-steps="1" data-roe-copy-runner-up-steps-pulsing={on ? "1" : undefined} title="Copy the runner-up (#2) path's steps JSON without expanding the row or moving focus — same as key u (same payload as expanding the #2 row and pressing s)" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(sc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, sc.toast); if (!txt) return; setCrusPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, sc.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{sc.label}</button>; })()}
              {(() => { const sc = lookbackCopyThirdStepsChip(thStepsJson); if (!sc) return null; const on = lookbackCopyChipPulse(cthsPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-third-steps="1" data-roe-copy-third-steps-pulsing={on ? "1" : undefined} title="Copy the #3-ranked path's steps JSON without expanding the row or moving focus — same as key # (same payload as expanding the #3 row and pressing s); shown with ≥3 paths" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(sc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, sc.toast); if (!txt) return; setCthsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, sc.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{sc.label}</button>; })()}
              {(() => { const fc2 = lookbackCopyFocusChip(focusRow, focusRow ? jsonRef.current[focusRow] : null); if (!fc2) return null; const on = lookbackCopyChipPulse(cfPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-focus={fc2.id} data-roe-copy-focus-pulsing={on ? "1" : undefined} title={`Copy the focused row's path JSON (${fc2.id}) without moving focus — same as key c`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { const id = fc2.id; void Promise.resolve(copyRef.current?.(fc2.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, fc2.toast); if (!txt) return; markPathCopiedRef.current(id); setCfPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, fc2.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{fc2.label}</button>; })()}
              {(() => { const fs2 = lookbackCopyFocusStepsChip(focusRow, focusRow ? stepsRef.current[focusRow] : null); if (!fs2) return null; const on = lookbackCopyChipPulse(cfsPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-focus-steps={fs2.id} data-roe-copy-focus-steps-pulsing={on ? "1" : undefined} title={`Copy the focused row's steps JSON (${fs2.id}) without expanding or moving focus — same payload as expanding the row and pressing s`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(fs2.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, fs2.toast); if (!txt) return; setCfsPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, fs2.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{fs2.label}</button>; })()}
              {(() => { const rc = lookbackCopyRunnerUpChip(ruJsonRef.current); if (!rc) return null; const on = lookbackCopyChipPulse(cruPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-runner-up="1" data-roe-copy-runner-up-pulsing={on ? "1" : undefined} title="Copy the runner-up (#2) sealed path JSON without moving focus — same as key n; shown with ≥2 paths" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(rc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, rc.toast); if (!txt) return; { const j = rc.json; setCruPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{rc.label}</button>; })()}
              {(() => { const rc = lookbackCopyThirdChip(thJsonRef.current); if (!rc) return null; const on = lookbackCopyChipPulse(cthPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-third="1" data-roe-copy-third-pulsing={on ? "1" : undefined} title="Copy the #3-ranked sealed path JSON without moving focus — same as key h; shown with ≥3 paths" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(rc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, rc.toast); if (!txt) return; { const j = rc.json; setCthPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{rc.label}</button>; })()}
              {(() => { const lc2 = lookbackCopyLastChip(lastJsonRef.current); if (!lc2) return null; return <button type="button" data-roe-summary-copy-last="1" data-roe-copy-last-pulsing={lookbackCopyChipPulse(clPulseAt, cpPulseNow) ? "1" : undefined} title="Copy the LAST-ranked sealed path JSON without moving focus — same as key ;" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${lookbackCopyChipPulse(clPulseAt, cpPulseNow) ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(lc2.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, lc2.toast); if (!txt) return; { const j = lc2.json; setClPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{lc2.label}</button>; })()}
              {(() => { const sc = lookbackCopySummaryChip(c ? lookbackSummaryJson(c) : null); if (!sc) return null; const on = lookbackSummaryCopiedPulse(sumCopiedAt, sumCopiedNow); return <button type="button" data-roe-summary-copy-summary="1" data-roe-copy-summary-pulsing={on ? "1" : undefined} title="Copy summary JSON without scrolling — presses the Copy summary JSON button (same as key g); toast only after the clipboard write succeeds" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { (document.querySelector(sc.selector) as HTMLButtonElement | null)?.click(); }}>{sc.label}</button>; })()}
              {(() => { const gc = lookbackCopyGreedyChip(greedyJsonRef.current); if (!gc) return null; const on = lookbackCopyChipPulse(cgPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-greedy="1" data-roe-copy-greedy-pulsing={on ? "1" : undefined} title="Copy the greedy-picked sealed path JSON without moving focus — same as key y" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(gc.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, gc.toast); if (!txt) return; { const j = gc.json; setCgPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, j) ? Date.now() : pa)); } const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{gc.label}</button>; })()}
              {(() => { const apj = lookbackAllPathsJson(c); const ap = lookbackCopyAllPathsChip(apj, rankedLookbackRows(c).length); if (!ap) return null; const on = lookbackCopyChipPulse(capPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-all-paths={rankedLookbackRows(c).length} data-roe-copy-all-paths-pulsing={on ? "1" : undefined} title="Copy every sealed path (rank order) as one JSON pack without moving focus or expanding rows — the full look-back evidence set (⧉ TOP / #2 / #3 / Last / Greedy copy one path)" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(ap.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, ap.toast); if (!txt) return; setCapPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, ap.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{ap.label}</button>; })()}
              {(() => { const asj = lookbackAllStepsJson(c); const as2 = lookbackCopyAllStepsChip(asj, rankedLookbackRows(c).length); if (!as2) return null; const on = lookbackCopyChipPulse(casPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-all-steps={rankedLookbackRows(c).length} data-roe-copy-all-steps-pulsing={on ? "1" : undefined} title="Copy every sealed path's steps (actions + e_series, rank order) as one JSON pack without expanding rows or moving focus — ⧉ All paths copies path payloads; ⧉ TOP / #2 / #3 / Last / Greedy / Focus steps copy one path's steps" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(as2.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, as2.toast); if (!txt) return; setCasPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, as2.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{as2.label}</button>; })()}
              {(() => { const vj = lookbackVerdictJson(c); const vd = lookbackCopyVerdictChip(vj); if (!vd) return null; const on = lookbackCopyChipPulse(cvdPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-verdict="1" data-roe-copy-verdict-pulsing={on ? "1" : undefined} title="Copy a compact verdict-only JSON (verdict label, Δe gain, ΔΦ, greedy vs look-back run ids, path counts by role) — smaller than Summary / ⚖ Compare / Roles" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(vd.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, vd.toast); if (!txt) return; setCvdPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, vd.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{vd.label}</button>; })()}
              {(() => { const gj = lookbackGapsJson(c); const gp = lookbackCopyGapsChip(gj); if (!gp) return null; const on = lookbackCopyChipPulse(cgpPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-gaps="1" data-roe-copy-gaps-pulsing={on ? "1" : undefined} title="Copy a compact ΔΦ-vs-greedy leaderboard (paths sorted by ΔΦ desc: rank, run_id, role, ΔΦ, Φ) — smaller than Roles / All paths; Verdict = one-line answer; ⚖ Compare = greedy vs look-back pair" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(gp.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, gp.toast); if (!txt) return; setCgpPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, gp.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{gp.label}</button>; })()}
              {(() => { const rj = lookbackRolesJson(c); const rl = lookbackCopyRolesChip(rj, rankedLookbackRows(c).length); if (!rl) return null; const on = lookbackCopyChipPulse(crlPulseAt, cpPulseNow); return <button type="button" data-roe-summary-copy-roles={rankedLookbackRows(c).length} data-roe-copy-roles-pulsing={on ? "1" : undefined} title="Copy a compact roles pack (rank, role winner/beaten/agree, greedy flag, Φ, ΔΦ vs greedy) for every sealed path — no steps/actions (vs ⧉ All paths = full payloads; Summary = totals; ⚖ Compare = greedy vs look-back pair)" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-emerald-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void Promise.resolve(copyRef.current?.(rl.json)).then((ok) => { const txt = lookbackCopyChipToast(ok, rl.toast); if (!txt) return; setCrlPulseAt((pa) => (lookbackCopyChipShouldPulse(pa != null, rl.json) ? Date.now() : pa)); const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }, () => {}); }}>{rl.label}</button>; })()}
              {(() => { const pk = c ? lookbackComparePack(c) : null; const cc = lookbackCopyCompareChip(pk, c?.winner, c?.delta_e_gain); if (!cc) return null; const on = lookbackCompareCopyPulse(cmpCopyPulseAt, cmpCopyPulseNow); return <button type="button" data-roe-summary-copy-compare="1" data-roe-copy-compare-pulsing={on ? "1" : undefined} title="Copy the ⚖ compare pack JSON from the sticky strip — same as key m / the bottom ⚖ button (shares its first-copy pulse)" className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-amber-300 motion-safe:animate-pulse" : ""}`} onClick={() => { void copyCmp.copy(cc.json).then((ok) => { const txt = lookbackCompareChipToast(ok, cc.toast); if (!txt) return; const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); }); }}>{copyCmp.status === "copied" ? "⚖ Copied ✓" : cc.label}</button>; })()}
              {(() => { const gr = lookbackGreedyChip(c); if (!gr) return null; const on = lookbackGreedyChipPulse(grPulseAt, grPulseNow); return <button type="button" data-roe-summary-greedy-chip={gr.target} title={`Focus, expand and scroll to the greedy-picked sealed path (${gr.target}) — same as key q`} className={`cursor-pointer rounded bg-white/10 px-1 text-zinc-200 hover:bg-white/20${on ? " ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-greedy-chip-pulsing={on ? "1" : undefined} onClick={() => { const id = gr.target; if (lookbackGreedyChipShouldPulse(grPulseAt != null, id)) setGrPulseAt(Date.now()); setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{gr.label}</button>; })()}
              {(() => { const ru = lookbackRunnerUpLeadChip(c); return ru ? <button type="button" data-roe-summary-runner-up={ru.delta} title={`TOP Δe margin over #2 (${ru.runner_up}) — click to focus, expand and scroll to #2`} className={`cursor-pointer rounded px-1 hover:bg-white/20 ${ru.tie ? "bg-white/10 text-zinc-300" : "bg-violet-500/15 text-violet-300"}${lookbackRunnerUpPulse(ruPulseAt, ruPulseNow) ? " ring-2 ring-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-runner-up-pulsing={lookbackRunnerUpPulse(ruPulseAt, ruPulseNow) ? "1" : undefined} onClick={() => { const id = ru.runner_up; if (lookbackRunnerUpShouldPulse(ruPulseAt != null, id)) setRuPulseAt(Date.now()); setRoleFilter("all"); setFocusRow(id); setOpen(id); setTimeout(() => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }}>{ru.label}</button> : null; })()}
              {(() => { const sd = lookbackStepsDelta(c); return sd ? <button type="button" data-roe-summary-steps-delta={sd.delta} title="top path steps minus greedy path steps — click to open TOP, then scroll to greedy" className="cursor-pointer rounded bg-white/10 px-1 text-zinc-300 hover:bg-white/20" onClick={() => { const t = lookbackStepsDeltaTargets(c); if (!t) return; const sc = (id: string) => document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }); setRoleFilter("all"); setFocusRow(t.top); setOpen(t.top); setTimeout(() => sc(t.top), 0); if (t.greedy) { const g = t.greedy; setTimeout(() => sc(g), LOOKBACK_DELTA_GREEDY_SCROLL_MS); } }}>{sd.label}</button> : null; })()}
              <span className="inline-flex flex-wrap items-center gap-1">
                <button type="button" data-roe-summary-role="all" aria-pressed={roleFilter === "all"} onClick={() => setRoleFilter("all")} className={`rounded px-1 ${roleFilter === "all" ? "bg-white/20" : "hover:bg-white/10"}`}>{m.paths} paths</button>·
                {([["winners", `★ ${m.winners}`], ["beaten", `beaten ${m.beaten}`], ["agree", `= ${m.agree}`]] as const).map(([k, t]) => (
                  <button key={k} type="button" data-roe-summary-role={k} aria-pressed={roleFilter === k} title={`Show only ${k} (click again for all)`} onClick={() => setRoleFilter((f) => toggleRoleFilter(f, k))}
                    className={`rounded px-1 underline decoration-dotted ${roleFilter === k ? "bg-white/25 font-bold no-underline" : "hover:bg-white/10"}`}>{t}</button>
                ))}
                {m.excluded ? <span>· {m.excluded} domain excluded</span> : null}
              </span>
              {lookbackSummaryJson(c) && (
                <button type="button" data-copy-roe-summary data-copy-pulsing={lookbackSummaryCopiedPulse(sumCopiedAt, sumCopiedNow) ? "1" : undefined} data-pulsing={lookbackSummaryCopyPulse(sumPulseAt, sumPulseNow, sumHasData) ? "1" : undefined} onClick={() => void copySum.copy(lookbackSummaryJson(c)).then((ok) => { const txt = lookbackSummaryButtonToast(ok, "button"); if (!txt) return; const at = Date.now(); setToast({ txt, at }); window.setTimeout(() => setToast((x) => (x && x.at === at ? null : x)), LOOKBACK_TOAST_MS); })}
                  className={`ml-auto rounded-full border px-2 py-0.5 font-semibold ${m.tone === "win" ? "border-amber-300 text-amber-100" : "border-sky-300 text-sky-100"} hover:bg-white/10${lookbackSummaryCopyPulse(sumPulseAt, sumPulseNow, sumHasData) ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}${lookbackSummaryCopiedPulse(sumCopiedAt, sumCopiedNow) ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.8)] motion-safe:animate-pulse" : ""}${copiedRing(copySum.status)}`}>
                  {copySum.status === "copied" ? "Copied ✓" : copySum.status === "failed" ? "Copy failed" : "Copy summary JSON"}
                </button>
              )}
            </div>
          ); })()}
          {(() => {
            const all = rankedLookbackRows(c);
            const label = { all: "All", winners: "★ Winners", beaten: "Beaten", agree: "= Agree" } as const;
            return (
              <div className={`flex flex-wrap items-center gap-2 text-xs rounded${lookbackFilterPulse(filterPulseAt, filterPulseNow, roleFilter) ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`} data-roe-lookback-role-filter={roleFilter} data-pulsing={lookbackFilterPulse(filterPulseAt, filterPulseNow, roleFilter) ? "1" : undefined}>
                <span className="text-zinc-500">Show:</span>
                {(["all", "winners", "beaten", "agree"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={roleFilter === k} data-roe-lookback-filter-pill={k} onClick={() => setRoleFilter(k)}
                    className={`rounded-full border px-2 py-0.5 ${roleFilter === k ? (k === "winners" ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : k === "beaten" ? "border-amber-400 bg-amber-500/20 text-amber-100" : k === "agree" ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-white text-white") : "border-zinc-600 text-zinc-400"}`}>
                    {label[k]} ({filterLookbackRows(all, k, c.winner).length})
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table data-roe-lookback-table className="w-full text-xs font-mono text-zinc-300">
              <thead className="text-zinc-500"><tr><th className="text-left pr-2">#</th><th className="text-left pr-2">run_id</th><th className="text-left pr-2" title="e from e0 to e_final; bars = per-step gain I_t">e path</th><th className="text-right pr-2">steps</th><th className="text-right pr-2">best I_t</th><th className="text-right pr-2">Σ Δe</th><th className="text-right pr-2">Φ</th><th className="text-right pr-2" title="final Φ minus the greedy path's final Φ">ΔΦ vs greedy</th><th className="text-left">pick</th><th className="text-left">path</th></tr></thead>
              <tbody>
                {(() => { const vis = sortLookbackRows(filterLookbackRows(rankedLookbackRows(c), roleFilter, c.winner), sortBy); visibleRef.current = vis.map((x) => x.run_id); jsonRef.current = Object.fromEntries(vis.map((x) => [x.run_id, lookbackPathJson(x, c.winner)])); stepsRef.current = Object.fromEntries(vis.map((x) => [x.run_id, pathStepsJson(x)])); return vis; })().map((r) => (
                  <Fragment key={r.run_id}>
                  <tr onClick={() => { setFocusRow(r.run_id); setOpen((o) => (o === r.run_id ? null : r.run_id)); }} data-roe-lookback-focus={focusRow === r.run_id ? "true" : undefined} data-focus-pulsing={focusRow === r.run_id && lookbackFocusPulse(focusPulseAt, focusPulseNow, focusRow) ? "1" : undefined} aria-expanded={open === r.run_id} title="Click to show the full action list" style={{ cursor: "pointer" }} data-roe-lookback-row={r.run_id} data-roe-lookback-emphasis={lookbackRowEmphasis(r.rank, c.winner)} data-roe-lookback-role={lookbackRowRole(r, c.winner)}
                    className={`${{ top_win: "bg-emerald-500/30 text-emerald-50 font-semibold outline outline-2 outline-amber-400", top_agree: "bg-emerald-500/10 text-emerald-200", plain: r.is_lookback ? "text-emerald-200" : "" }[lookbackRowEmphasis(r.rank, c.winner)]} ${{ winner_lookback: "border-l-4 border-emerald-400", agree_both: "border-l-4 border-sky-400", greedy_beaten: "border-l-4 border-amber-400 bg-amber-500/10", other: "" }[lookbackRowRole(r, c.winner)]} ${focusRow === r.run_id ? "ring-2 ring-sky-300 ring-inset" : ""}${focusRow === r.run_id && lookbackFocusPulse(focusPulseAt, focusPulseNow, focusRow) ? " ring-4 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`}>
                    <td className="pr-2 whitespace-nowrap">{r.rank === 1 && <span data-roe-lookback-top data-pulsing={lookbackTopPulse(topPulseAt, topPulseNow, rankedCount) ? "1" : undefined} className={`${lookbackTopPulse(topPulseAt, topPulseNow, rankedCount) ? "ring-4 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse " : ""}mr-1 rounded bg-amber-400 text-black px-1.5 text-[10px] font-bold`}>TOP</span>}{r.rank}</td><td className="pr-2 break-all">{r.run_id}</td><td className="pr-2" data-roe-lookback-spark={r.run_id}>{(() => {
                      const pts = sparklinePoints(r.e_series, 64, 16);
                      const g = stepGains(r.e_series); const gmax = Math.max(...g, 1e-9);
                      return pts ? (
                        <svg width="64" height="24" viewBox="0 0 64 24" aria-label={`e path ${(r.e_series ?? []).join(" → ")}`} className="overflow-visible">
                          <polyline points={pts} fill="none" stroke={r.is_lookback ? "#34d399" : r.is_greedy ? "#fbbf24" : "#a1a1aa"} strokeWidth="1.5" />
                          {g.map((x, i) => { const bw = 64 / g.length; const bh = (x / gmax) * 6; return <rect key={i} x={i * bw + 1} y={24 - bh} width={Math.max(1, bw - 2)} height={bh} fill={x === r.max_step_i ? "#fbbf24" : "#52525b"} />; })}
                        </svg>
                      ) : <span className="text-zinc-600">—</span>;
                    })()}</td><td className="text-right pr-2">{r.steps}</td>
                    <td className="text-right pr-2">{r.max_step_i}</td><td className="text-right pr-2">{r.cumulative_delta_e}</td><td className="text-right pr-2">{r.final_phi ?? "n/a"}</td>
                    <td data-roe-lookback-dphi className={`text-right pr-2 ${(r.delta_phi_vs_greedy ?? 0) > 0 ? "text-emerald-300 font-semibold" : (r.delta_phi_vs_greedy ?? 0) < 0 ? "text-amber-300" : "text-zinc-500"}`}>{r.is_greedy ? "—" : fmtDeltaPhi(r.delta_phi_vs_greedy)}</td>
                    <td className="space-x-1 whitespace-nowrap">
                      {r.is_lookback && <span className="rounded bg-emerald-500 text-black px-1.5 text-[10px] font-semibold">look-back</span>}
                      {r.is_greedy && <span className="rounded bg-amber-400 text-black px-1.5 text-[10px] font-semibold">greedy</span>}
                      {lookbackRowRole(r, c.winner) === "winner_lookback" && <span data-roe-lookback-badge="winner" className="rounded bg-emerald-300 text-black px-1.5 text-[10px] font-bold">★ WINNER +Δe {c.delta_e_gain}</span>}
                      {lookbackRowRole(r, c.winner) === "agree_both" && <span data-roe-lookback-badge="agree" className="rounded border border-sky-400 text-sky-200 px-1.5 text-[10px] font-semibold">= both agree</span>}
                      {lookbackRowRole(r, c.winner) === "greedy_beaten" && <span data-roe-lookback-badge="beaten" className="rounded border border-amber-400 text-amber-200 px-1.5 text-[10px] font-semibold">beaten by look-back</span>}
                    </td>
                    <td><span onClick={(ev) => ev.stopPropagation()}><CopyLookbackPath runId={r.run_id} json={lookbackPathJson(r, c.winner)} pulsing={lookbackPathCopiedPulse(pathCopiedPulse, r.run_id, pathCopiedNow)} onCopied={markPathCopied} /></span></td>
                  </tr>
                  {(open === r.run_id || allOpen) && (
                    <tr data-roe-lookback-detail={r.run_id} data-pulsing={lookbackExpandPulse(expandPulseAt, expandPulseNow, open) ? "1" : undefined} className={`bg-zinc-900/70${lookbackExpandPulse(expandPulseAt, expandPulseNow, open) ? " outline outline-4 outline-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}`}>
                      <td colSpan={11} className="px-2 py-2">
                        <ol className="space-y-0.5 text-[11px]">
                          {pathStepsDetail(r).map((d) => (
                            <li key={d.step} className={d.best ? "text-amber-200 font-semibold" : "text-zinc-300"}>
                              {d.step}. <span className="text-white">{d.action}</span> · e {d.e_before ?? "?"} → {d.e_after ?? "?"} · I_t {d.gain ?? "n/a"}{d.best ? " ★ best step" : ""}
                            </li>
                          ))}
                        </ol>
                        <div className="mt-1" onClick={(ev) => ev.stopPropagation()}><CopyLookbackPath kind="steps" runId={r.run_id} json={pathStepsJson(r)} pulsing={lookbackStepsCopiedPulse(stepsCopiedPulse, r.run_id, stepsCopiedNow)} onCopied={markStepsCopied} /></div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {c.excluded_domain_entries > 0 && <p className="text-xs text-zinc-500">{c.excluded_domain_entries} domain-labeled entries excluded.</p>}
        </>
      )}
      {c && lookbackComparePack(c) && (
        <button type="button" data-copy-roe-compare data-winner={c.winner} data-copy-pulsing={lookbackCompareCopyPulse(cmpCopyPulseAt, cmpCopyPulseNow) ? "1" : undefined} data-pulsing={lookbackComparePulse(cmpPulseAt, cmpPulseNow, c.winner) ? "1" : undefined} onClick={() => void copyCmp.copy(lookbackComparePack(c))}
          className={`mr-2 inline-flex h-9 items-center rounded-full px-4 text-xs font-bold ${c.winner === "lookback" ? "bg-emerald-400 text-black border-2 border-amber-300 shadow-lg shadow-emerald-500/30" : "border-2 border-sky-400 text-sky-100"}${lookbackComparePulse(cmpPulseAt, cmpPulseNow, c.winner) ? " ring-4 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" : ""}${lookbackCompareCopyPulse(cmpCopyPulseAt, cmpCopyPulseNow) ? " ring-4 ring-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.8)] motion-safe:animate-pulse" : ""}${copiedRing(copyCmp.status)}`}>
          {copyCmp.status === "copied" ? "Copied ✓" : copyCmp.status === "failed" ? "Copy failed" : c.winner === "lookback" ? `⚖ Copy compare pack · look-back +Δe ${c.delta_e_gain}` : "⚖ Copy compare pack · agree"}
        </button>
      )}
      {c && (
        <button type="button" data-copy-roe-lookback onClick={() => void copy.copy(JSON.stringify(c, null, 2))}
          className={`inline-flex h-8 items-center rounded-full border border-zinc-600 px-3 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}>
          {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : "Copy look-back JSON"}
        </button>
      )}
      <p className="text-xs text-zinc-500">{c?.note ?? "Inspect-only."}</p>
    </section>
  );
}
