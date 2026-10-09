/**
 * Actor network as context. Not a controller. Not a measurement.
 * An observed relationship is not causation.
 */
export const NETWORK = {
  id: "N-safety-evidence",
  version: "2026-10-09",
  plant: "Safety",
  not: "Not a diagnosis. No PHI. No clinical decision.",
  actors: [
    { id: "operator", kind: "human", role: "Names the pack. Does not settle e." },
    { id: "grok_bot", kind: "technical", role: "Names y. Does not measure z." },
    { id: "reference", kind: "evidence", role: "HOLD until provenance and an independent check exist." },
    { id: "pack", kind: "evidence", role: "The case. Missing fields are distance, not a label." },
  ],
  relations: [
    { from: "operator", to: "pack", kind: "handoff", documented: true },
    { from: "grok_bot", to: "pack", kind: "names y", documented: true },
    { from: "pack", to: "reference", kind: "scored against", documented: true },
    { from: "pack", to: "independent-check", kind: "handoff", documented: false },
  ],
} as const;

export function missingHandoffs() {
  return NETWORK.relations.filter((r) => !r.documented);
}