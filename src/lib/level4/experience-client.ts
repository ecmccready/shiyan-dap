/** Client reader for the durable Level 4 experience store (/api/level4/experience). */
export type ExperienceEntry = {
  run_id: string;
  iteration: number;
  e: number | null;
  verified_at: string;
  eligible: boolean;
  y?: string;
  e0?: number | null;
  delta_e?: number | null;
  cold_e?: number | null;
  phi?: number | null;
  state?: string;
};

export async function loadExperienceServer(): Promise<ExperienceEntry[]> {
  try {
    const res = await fetch("/api/level4/experience", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Latest eligible (goal-met) entry; falls back to the latest entry of any kind. */
export function latestVerified(list: ExperienceEntry[]): ExperienceEntry | null {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].eligible) return list[i];
  return list.length ? list[list.length - 1] : null;
}

export function fmtE(n: number | null | undefined) {
  return typeof n === "number" ? n.toFixed(3) : "—";
}
