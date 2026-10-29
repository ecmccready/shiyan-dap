"use client";

import { useEffect, useState } from "react";
import { MEDICARE_PROGRESS_EVENT, reviewProgress, reviewCompletion } from "@/lib/medicare/investigation";

type P = ReturnType<typeof reviewProgress>;

/** Progress bar + counts. Pass `initial`; when `live`, follows the disposition stub's tab-local event. */
export function ProgressBar({ p }: { p: P }) {
  const done = reviewCompletion(p);
  return (
    <div data-medicare-review-progress className="space-y-1">
      {done.complete && (
        <div role="status" data-medicare-review-complete className="rounded-xl border-2 border-emerald-400 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100">
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
