/**
 * Domain-agnostic view of a Level 4 run ("misdiagnosis as a global systemic error").
 *
 * Additive only. These types strip domain language from the existing Level 4
 * shapes (ControllerRecord, ExperienceEntry) so the same loop, gate and store
 * can be described for any system expressible as observed variance against a
 * reference: software, logistics, clinical, or any other string.
 *
 * Nothing here changes the core engine (closed-loop.ts, Self(), measureE, W,
 * safety) or the live Level 4 flow. The mappers are pure and read-only.
 *
 *   currentError / observedVariance = e
 *   deltaError                      = Δe = e0 - e1 (reduction; higher is better)
 *   phi                             = Φ  (see verifyStep in measured.ts)
 */
import type { ControllerRecord, ControllerState } from "./controller";
import type { ExperienceEntry } from "./experience-client";

/** Domain label. Carried through the loop and the gate; never branched on. */
export type SystemDomain = "software" | "logistics" | "clinical" | (string & {});

/** Used when a stored entry carries no domain. Deliberately not a real domain. */
export const UNSPECIFIED_DOMAIN = "unspecified";

export type SystemicStatus = "ELIGIBLE_EXPERIENCE" | "MISDIAGNOSIS_REJECTED";

export type SystemicState = {
  system: SystemDomain;
  /** e: observed variance against the reference (current error). */
  observedVariance: number | null;
  /** Alias of observedVariance, kept for readability at call sites. */
  currentError: number | null;
  /** Reference (target) vector y*. Empty when the plant does not expose one. */
  referenceVector: number[];
  /** Proposal vector produced by the next action. Empty when not exposed. */
  proposalVector: number[];
  /** Δe = e0 - e. null when e0 or e is unknown. */
  deltaError: number | null;
  /** Φ vs the cold Self() baseline. null when unknown. */
  phi: number | null;
};

export type WorkbenchRun = {
  runId: string;
  system: SystemDomain;
  iteration: number;
  state: ControllerState | (string & {});
  /** e before the first action. */
  initialError: number | null;
  /** Latest systemic state of the run. */
  current: SystemicState;
  /** Applied actions, in order (domain-neutral identifiers). */
  actions: string[];
};

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const round3 = (n: number) => Number(n.toFixed(3));

function deltaOf(e0: number | null, e1: number | null): number | null {
  return e0 != null && e1 != null ? round3(e0 - e1) : null;
}

/** Map a stored experience entry to a domain-neutral SystemicState. */
export function experienceToSystemicState(
  entry: ExperienceEntry & { system?: string },
  vectors: { reference?: number[]; proposal?: number[] } = {}
): SystemicState {
  const e = finite(entry.e);
  const e0 = finite(entry.e0);
  return {
    system: typeof entry.system === "string" && entry.system ? entry.system : UNSPECIFIED_DOMAIN,
    observedVariance: e,
    currentError: e,
    referenceVector: vectors.reference ?? [],
    proposalVector: vectors.proposal ?? [],
    deltaError: finite(entry.delta_e) ?? deltaOf(e0, e),
    phi: finite(entry.phi),
  };
}

/** Map a controller record (plus run id and domain) to a domain-neutral WorkbenchRun. */
export function controllerToWorkbenchRun(
  rec: ControllerRecord,
  runId: string,
  system: SystemDomain = UNSPECIFIED_DOMAIN,
  extra: { phi?: number | null; reference?: number[]; proposal?: number[] } = {}
): WorkbenchRun {
  const e = finite(rec.last_e);
  const e0 = finite(rec.e0);
  return {
    runId,
    system,
    iteration: rec.iteration,
    state: rec.state,
    initialError: e0,
    actions: rec.actions ?? [],
    current: {
      system,
      observedVariance: e,
      currentError: e,
      referenceVector: extra.reference ?? [],
      proposalVector: extra.proposal ?? [],
      deltaError: deltaOf(e0, e),
      phi: extra.phi ?? null,
    },
  };
}
