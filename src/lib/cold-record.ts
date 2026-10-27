"use client";

/**
 * The last opt-in B1 cold comparison run in this browser (peer, compare, independent or independence page).
 * Stored only in this browser (localStorage). It was measured live over MCP on a fresh B1 case, is not tied to any Level 4 run,
 * and is not written to the ledger or the server. The exported evidence pack includes it, labelled as such.
 */
export interface ColdRecord {
  page: string;
  case_id: string;
  /** "default" is B1's original start plant; "commercial" is the constructed MCP commercial case. */
  plant: "default" | "commercial";
  start_e: number;
  cold_final_e: number;
  cold_sequence: string[];
  sealed_final_e: number;
  phi: number;
  error_win: boolean;
  recorded_at: string;
}

const KEY = "aethel-mcp-cold-last";

export function parseCold(raw: string | null): ColdRecord | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ColdRecord>;
    if (j && typeof j.page === "string" && typeof j.cold_final_e === "number" && typeof j.sealed_final_e === "number" && typeof j.recorded_at === "string") {
      return {
        page: j.page,
        case_id: String(j.case_id ?? ""),
        plant: j.plant === "commercial" ? "commercial" : "default",
        start_e: Number(j.start_e),
        cold_final_e: j.cold_final_e,
        cold_sequence: Array.isArray(j.cold_sequence) ? j.cold_sequence.map(String) : [],
        sealed_final_e: j.sealed_final_e,
        phi: Number(j.phi),
        error_win: j.sealed_final_e < j.cold_final_e,
        recorded_at: j.recorded_at,
      };
    }
  } catch {}
  return null;
}

export function loadCold(): ColdRecord | null {
  try {
    return parseCold(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Saves the result of a B1 cold run. error_win is recomputed from the two final e values (strictly lower sealed e only). */
export function saveCold(r: Omit<ColdRecord, "recorded_at" | "error_win">): void {
  const rec: ColdRecord = { ...r, error_win: r.sealed_final_e < r.cold_final_e, recorded_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {}
}
