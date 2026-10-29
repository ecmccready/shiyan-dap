/**
 * Global · misdiagnosis snapshot (pure: no network, no storage, no writes).
 *
 * Same classification as /workbench/global, from the latest recorded iteration of each run:
 *   eligible                 -> ELIGIBLE_EXPERIENCE
 *   state COMPLETE, not eligible -> MISDIAGNOSIS_REJECTED
 *   anything else            -> IN_PROGRESS
 * The snapshot is a copyable operator hand-off (local clipboard). It is not fetched by any peer, and it is not
 * attestation or a clinical diagnosis. `generatedAt` is passed in so the function stays pure.
 */
export const GLOBAL_SNAPSHOT_SCHEMA = "aethel.global.snapshot.v1" as const;
export const SNAPSHOT_NOTE =
  "Shape and status only: not attestation and not a clinical diagnosis. Misdiagnosis means a wrong next action (the run completed without reaching its goal threshold). Statuses come from this node's own recorded runs.";

export type GlobalStatus = "ELIGIBLE_EXPERIENCE" | "MISDIAGNOSIS_REJECTED" | "IN_PROGRESS";

/** Fields of an experience row the snapshot reads. Structural, so any experience entry fits. */
export type GlobalRow = {
  run_id: string;
  iteration: number;
  e?: number | null;
  delta_e?: number | null;
  phi?: number | null;
  eligible?: boolean;
  state?: string;
  verified_at?: string;
};

export type GlobalSnapshotRun = {
  run_id: string;
  status: GlobalStatus;
  final_e: number | null;
  delta_e: number | null;
  phi: number | null;
  verified_at: string | null;
};

export type GlobalSnapshot = {
  schema_version: typeof GLOBAL_SNAPSHOT_SCHEMA;
  generated_at: string;
  note: string;
  counts: { total: number; eligible: number; misdiagnosis_rejected: number; in_progress: number };
  runs: GlobalSnapshotRun[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function classifyRun(r: Pick<GlobalRow, "eligible" | "state">): GlobalStatus {
  return r.eligible === true ? "ELIGIBLE_EXPERIENCE" : r.state === "COMPLETE" ? "MISDIAGNOSIS_REJECTED" : "IN_PROGRESS";
}

/** Latest iteration per run_id (a later row wins a tie), newest verified_at first. */
export function latestPerRun<T extends GlobalRow>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.run_id !== "string" || typeof r.iteration !== "number") continue;
    const cur = latest.get(r.run_id);
    if (!cur || r.iteration >= cur.iteration) latest.set(r.run_id, r);
  }
  return [...latest.values()].sort((a, b) => ((a.verified_at ?? "") < (b.verified_at ?? "") ? 1 : -1));
}

export function buildGlobalSnapshot(rows: GlobalRow[], generatedAt: string): GlobalSnapshot {
  const runs: GlobalSnapshotRun[] = latestPerRun(rows).map((r) => ({
    run_id: r.run_id,
    status: classifyRun(r),
    final_e: num(r.e),
    delta_e: num(r.delta_e),
    phi: num(r.phi),
    verified_at: typeof r.verified_at === "string" ? r.verified_at : null,
  }));
  const count = (s: GlobalStatus) => runs.filter((r) => r.status === s).length;
  return {
    schema_version: GLOBAL_SNAPSHOT_SCHEMA,
    generated_at: generatedAt,
    note: SNAPSHOT_NOTE,
    counts: {
      total: runs.length,
      eligible: count("ELIGIBLE_EXPERIENCE"),
      misdiagnosis_rejected: count("MISDIAGNOSIS_REJECTED"),
      in_progress: count("IN_PROGRESS"),
    },
    runs,
  };
}
