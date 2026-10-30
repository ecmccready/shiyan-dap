"use client";

import { useEffect, useState } from "react";
import { MEDICARE_TIMER_EVENT, MEDICARE_PROGRESS_EVENT, formatElapsed, nextReviewTimer, reviewElapsedMs, type ReviewTimer } from "@/lib/medicare/investigation";

/** Review-session elapsed timer: starts at the first disposition, freezes at Review complete. Tab-local, display only. */
export default function MedicareReviewTimer() {
  const [t, setT] = useState<ReviewTimer>({ started_at: null, frozen_at: null });
  const [now, setNow] = useState(0);
  useEffect(() => {
    const on = (ev: Event) => { const d = (ev as CustomEvent<{ reviewed: number; items: number }>).detail; setT((x) => nextReviewTimer(x, d, Date.now())); setNow(Date.now()); };
    window.addEventListener(MEDICARE_PROGRESS_EVENT, on);
    return () => window.removeEventListener(MEDICARE_PROGRESS_EVENT, on);
  }, []);
  const running = t.started_at !== null && t.frozen_at === null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const frozenMs = t.started_at !== null && t.frozen_at !== null ? t.frozen_at - t.started_at : null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MEDICARE_TIMER_EVENT, { detail: frozenMs === null ? { elapsed_ms: null, frozen: false } : { elapsed_ms: frozenMs, frozen: true } }));
  }, [frozenMs]);
  const state = t.started_at === null ? "idle" : running ? "running" : "frozen";
  return (
    <div data-medicare-review-timer={state} className="inline-flex items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 font-mono font-semibold ${state === "frozen" ? "bg-emerald-400 text-black" : state === "running" ? "bg-sky-500/20 text-sky-100 border border-sky-400" : "border border-zinc-600 text-zinc-400"}`}>
        ⏱ {formatElapsed(reviewElapsedMs(t, now))}
      </span>
      <span className="text-zinc-400">
        {state === "idle" ? "Review timer starts at the first disposition" : state === "running" ? "Review in progress" : "Review time (stopped at Review complete)"}
      </span>
    </div>
  );
}
