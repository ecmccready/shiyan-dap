"use client";

import { useEffect, useRef, useState } from "react";
import { MEDICARE_PROGRESS_EVENT, reviewProgress, reviewCompletion, reviewCompletePulse, COMPLETE_PULSE_MS, reviewProgressStartPulse, PROGRESS_START_PULSE_MS } from "@/lib/medicare/investigation";

type P = ReturnType<typeof reviewProgress>;

/** Progress bar + counts. Pass `initial`; when `live`, follows the disposition stub's tab-local event. */
export function ProgressBar({ p }: { p: P }) {
  const done = reviewCompletion(p);
  const prev = useRef<boolean | null>(null);
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (prev.current === false && done.complete) { const t = Date.now(); setPulseAt(t); setNow(t); const id = setTimeout(() => setNow(Date.now()), COMPLETE_PULSE_MS); prev.current = true; return () => clearTimeout(id); }
    prev.current = done.complete;
  }, [done.complete]);
  const pulsing = reviewCompletePulse(pulseAt, now, done.complete);
  const prevReviewed = useRef<number | null>(null);
  const startPulsedOnce = useRef(false);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [startNow, setStartNow] = useState(0);
  useEffect(() => {
    if (prevReviewed.current === 0 && p.reviewed >= 1 && !startPulsedOnce.current) {
      startPulsedOnce.current = true; prevReviewed.current = p.reviewed;
      const t = Date.now(); setStartAt(t); setStartNow(t);
      const id = setTimeout(() => setStartNow(Date.now()), PROGRESS_START_PULSE_MS); return () => clearTimeout(id);
    }
    prevReviewed.current = p.reviewed;
  }, [p.reviewed]);
  const startPulsing = reviewProgressStartPulse(startAt, startNow, p.reviewed);
  return (
    <div data-medicare-review-progress data-medicare-progress-start-pulse={startPulsing ? "on" : undefined} className={`space-y-1 rounded-lg transition-shadow ${startPulsing ? "ring-4 ring-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.5)] motion-safe:animate-pulse" : ""}`}>
      {done.complete && (
        <div role="status" data-medicare-review-complete data-pulsing={pulsing ? "1" : undefined} className={`rounded-xl border-2 border-emerald-400 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 transition-shadow ${pulsing ? "ring-4 ring-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.6)] motion-safe:animate-pulse" : ""}`}>
          <span className="mr-2 rounded-full bg-emerald-400 text-black px-2 py-0.5 text-xs font-bold">✓ Review complete</span>
          {done.message}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
        <span className="text-white font-semibold text-sm" data-medicare-progress-label>{p.label}</span>
        <span className="text-zinc-400">{p.by_status.needs_human_review} needs_human_review · {p.by_status.cleared_pattern_only} cleared_pattern_only · {p.by_status.unreviewed} unreviewed</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="Review progress">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${p.percent}%` }} />
      </div>
    </div>
  );
}

export default function MedicareReviewProgress({ initial }: { initial: P }) {
  const [p, setP] = useState<P>(initial);
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<P>).detail; if (d && typeof d.items === "number") setP(d); };
    window.addEventListener(MEDICARE_PROGRESS_EVENT, on);
    return () => window.removeEventListener(MEDICARE_PROGRESS_EVENT, on);
  }, []);
  return <ProgressBar p={p} />;
}
