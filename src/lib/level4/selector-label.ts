/**
 * Display-only helper: which selector chose each step of a run.
 * Reads optional fields that ROE-driven entries carry (selector, roe_lambda, roe_mu,
 * roe_fallback). Entries without `selector` produce no rows, so default runs render nothing.
 * Pure; no server-only imports; does not affect selection, gating, measuring or recording.
 */
export type SelectorTagged = {
  run_id: string;
  iteration: number;
  y?: string;
  selector?: string;
  roe_lambda?: number;
  roe_mu?: number;
  roe_fallback?: boolean;
};

export type SelectorRow = { iteration: number; y: string; label: string };

export function selectorLabel(x: Pick<SelectorTagged, "selector" | "roe_lambda" | "roe_mu" | "roe_fallback">): string | null {
  if (x.selector !== "roe_step_aware") return null;
  const params = `λ ${x.roe_lambda ?? 0}, μ ${x.roe_mu ?? 0}`;
  return x.roe_fallback
    ? `ROE fallback → existing planner (${params})`
    : `ROE step-aware (${params})`;
}

/** Rows for one run, only for entries that carry selector data; sorted by iteration, last write wins. */
export function selectorRows(entries: SelectorTagged[], runId: string): SelectorRow[] {
  const byIter = new Map<number, SelectorRow>();
  for (const x of entries) {
    if (x.run_id !== runId) continue;
    const label = selectorLabel(x);
    if (!label) continue;
    byIter.set(x.iteration, { iteration: x.iteration, y: x.y ?? "—", label });
  }
  const rows = [...byIter.values()].sort((a, b) => a.iteration - b.iteration);
  return rows;
}
