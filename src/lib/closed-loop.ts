/**
 * One closed loop. Not three products.
 *
 *   z_t  --name y in A-->  y_t  --W(B,y)-->  B'_{t+1}
 *        measure z_{t+1}, e_t  --M-->  z-next
 *
 * Intelligence is the measured reduction of e on B.
 * Grok fast / Hy4 deep / Grok Bot only name y. They do not sit outside the loop.
 * B is the environment. B is not a customer and not a clinician.
 * z is measured |B'| after the transition. z is not an LLM opinion.
 * e vs a reference label is what may list on the marketplace.
 *
 * Self() is the proof namer. It does not read M.
 * nameYFromExperience is the product namer. It reads M.
 */

export type Namer = "grok_fast" | "hy4_deep" | "grok_bot" | "operator";

export type Gate = "HOLD" | "CLINICIAN_REVIEW" | "ESCALATE";

export type YAction =
  | "observe"
  | "complete_field"
  | "resolve_contradiction"
  | "fill_missing"
  | "request_independent_check"
  | "hold"
  | "escalate"
  | "clinician_review"
  | "mark_boundary"
  | "seal_pack";

export type ReferenceCase = {
  id: string;
  title: string;
  source: string;
  presentation: string;
  available: string[];
  missing: string[];
  contradictions: { source: string; note: string }[];
  /** Reference resolution for the evidence gate — not a diagnosis. */
  reference_gate: Gate;
  reference_note: string;
};

export type PlantB = {
  case_id: string;
  completeness: number;
  contradiction: number;
  missing: number;
  uncertainty: number;
  independent_check: number;
  useful: number;
  /** Set only by mark_boundary. Not read by Self(). */
  boundary_ready: number;
};

export type StepRec = {
  t: number;
  case_id: string;
  namer: Namer;
  y: YAction;
  gate: Gate;
  B: PlantB;
  B_next: PlantB;
  z: string;
  z_value: number;
  e: number;
  e_next: number;
  reduced: number;
  dominant: string;
  source: "self" | "memory" | "search" | "hold" | "given";
};

export type MemoryM = {
  ledger: StepRec[];
  last_z: string | null;
  last_e: number;
  last_y: YAction | null;
  last_dominant: string | null;
};

export type DomainId = string;

export type LoopPlant = {
  t: number;
  domain: DomainId;
  case_id: string;
  B: PlantB;
  M: MemoryM;
};

export const REQUIRED_FIELDS = [
  "patient-evidence",
  "measurements",
  "history",
  "provenance",
  "independent-check",
] as const;

/**
 * Safety reference pack. Misdiagnosis-process cases used as experience.
 * Public-style process patterns only. No PHI. Not a diagnosis product.
 */
export const SAFETY_PACK: ReferenceCase[] = [
  {
    id: "case-incomplete-pack",
    title: "Incomplete evidence pack",
    source: "process pattern · evidence gate",
    presentation:
      "A candidate label is being discussed while measurements and provenance are absent.",
    available: ["patient-evidence", "history"],
    missing: ["measurements", "provenance", "independent-check"],
    contradictions: [],
    reference_gate: "HOLD",
    reference_note:
      "Reference: hold until measurements, provenance, and an independent check exist.",
  },
  {
    id: "case-contradictory-notes",
    title: "Contradictory notes",
    source: "process pattern · second-order check",
    presentation:
      "Two notes disagree on the same candidate. No independent check has run.",
    available: ["patient-evidence", "history", "measurements"],
    missing: ["independent-check"],
    contradictions: [
      { source: "note-a", note: "supports the candidate" },
      { source: "note-b", note: "conflicts with the candidate" },
    ],
    reference_gate: "ESCALATE",
    reference_note:
      "Reference: escalate unresolved contradiction. Do not emit a diagnosis.",
  },
  {
    id: "case-anchoring",
    title: "Anchored first impression",
    source: "process pattern · anchoring",
    presentation:
      "The first impression is still driving the task while later measurements are unread.",
    available: ["patient-evidence", "history"],
    missing: ["measurements", "independent-check"],
    contradictions: [
      { source: "first-pass", note: "early candidate locked in language" },
    ],
    reference_gate: "ESCALATE",
    reference_note:
      "Reference: break the anchor with measurements and an independent check.",
  },
  {
    id: "case-missing-measurements",
    title: "Missing measurements",
    source: "process pattern · completeness",
    presentation:
      "History is present. The measurement set required by the gate is not.",
    available: ["patient-evidence", "history", "provenance"],
    missing: ["measurements", "independent-check"],
    contradictions: [],
    reference_gate: "HOLD",
    reference_note: "Reference: fill measurements before any review route.",
  },
  {
    id: "case-provenance-gap",
    title: "Provenance gap",
    source: "process pattern · provenance",
    presentation:
      "Evidence exists but the source trail is incomplete. The gate cannot score it.",
    available: ["patient-evidence", "measurements", "history"],
    missing: ["provenance", "independent-check"],
    contradictions: [],
    reference_gate: "HOLD",
    reference_note: "Reference: restore provenance, then independent check.",
  },
  {
    id: "case-ready-for-review",
    title: "Complete consistent pack",
    source: "process pattern · review route",
    presentation:
      "Required fields are present and notes agree. A clinician still has to read it.",
    available: [
      "patient-evidence",
      "measurements",
      "history",
      "provenance",
      "independent-check",
    ],
    missing: [],
    contradictions: [],
    reference_gate: "CLINICIAN_REVIEW",
    reference_note:
      "Reference: route to clinician review. Still not a diagnosis.",
  },
];

export const Y_ACTIONS: YAction[] = [
  "observe",
  "complete_field",
  "resolve_contradiction",
  "fill_missing",
  "request_independent_check",
  "hold",
  "escalate",
  "clinician_review",
  "mark_boundary",
  "seal_pack",
];

export function caseById(id: string): ReferenceCase {
  return SAFETY_PACK.find((c) => c.id === id) ?? SAFETY_PACK[0];
}

export function plantFromCase(c: ReferenceCase): PlantB {
  const missing = c.missing.length / REQUIRED_FIELDS.length;
  const contradiction = Math.min(1, c.contradictions.length * 0.45);
  const independent = c.available.includes("independent-check") ? 1 : 0;
  const completeness = 1 - missing;
  const uncertainty = Math.min(
    1,
    0.25 + missing * 0.5 + contradiction * 0.35
  );
  const useful = Number(
    Math.max(0, completeness - contradiction - 0.3 * (1 - independent)).toFixed(3)
  );
  return {
    case_id: c.id,
    completeness: Number(completeness.toFixed(3)),
    contradiction: Number(contradiction.toFixed(3)),
    missing: Number(missing.toFixed(3)),
    uncertainty: Number(uncertainty.toFixed(3)),
    independent_check: independent,
    useful,
    boundary_ready: 0,
  };
}

export function freshPlant(caseId = SAFETY_PACK[0].id): LoopPlant {
  const c = caseById(caseId);
  const B = plantFromCase(c);
  return {
    t: 0,
    domain: "safety",
    case_id: c.id,
    B,
    M: {
      ledger: [],
      last_z: null,
      last_e: measureE(B, c),
      last_y: null,
      last_dominant: dominantOf(B),
    },
  };
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number(n.toFixed(3))));
}

export function W(B: PlantB, y: YAction): PlantB {
  const next = { ...B, boundary_ready: B.boundary_ready ?? 0 };
  switch (y) {
    case "observe":
      next.uncertainty = clamp01(next.uncertainty - 0.04);
      break;
    case "complete_field":
      next.completeness = clamp01(next.completeness + 0.18);
      next.missing = clamp01(next.missing - 0.18);
      next.uncertainty = clamp01(next.uncertainty - 0.08);
      break;
    case "fill_missing":
      next.missing = clamp01(next.missing - 0.28);
      next.completeness = clamp01(next.completeness + 0.22);
      break;
    case "resolve_contradiction":
      next.contradiction = clamp01(next.contradiction - 0.35);
      next.uncertainty = clamp01(next.uncertainty - 0.12);
      break;
    case "request_independent_check":
      next.independent_check = 1;
      next.uncertainty = clamp01(next.uncertainty - 0.2);
      next.useful = clamp01(next.useful + 0.12);
      break;
    case "hold":
      break;
    case "escalate":
      next.useful = clamp01(next.useful + 0.05);
      break;
    case "clinician_review":
      next.useful = clamp01(next.useful + 0.08);
      next.uncertainty = clamp01(next.uncertainty - 0.05);
      break;
    case "mark_boundary":
      next.boundary_ready = 1;
      break;
    case "seal_pack":
      if (next.boundary_ready === 1) {
        next.missing = 0;
        next.completeness = Math.min(0.849, Math.max(next.completeness, 0.849));
      }
      break;
  }
  next.useful = clamp01(
    next.completeness -
      next.contradiction -
      0.3 * (1 - next.independent_check) -
      0.15 * next.missing
  );
  return next;
}

export function dominantOf(B: PlantB): string {
  const defects: Record<string, number> = {
    missing: B.missing,
    contradiction: B.contradiction,
    uncertainty: B.uncertainty,
    "independent-check": 1 - B.independent_check,
    incompleteness: 1 - B.completeness,
  };
  return Object.entries(defects).sort((a, b) => b[1] - a[1])[0][0];
}

export function gateOf(B: PlantB): Gate {
  if (B.contradiction >= 0.2 || B.missing >= 0.35) return "ESCALATE";
  if (B.completeness >= 0.85 && B.contradiction < 0.1 && B.independent_check === 1) {
    return "CLINICIAN_REVIEW";
  }
  return "HOLD";
}

export function measureZ(B: PlantB, y: YAction): { z: string; z_value: number } {
  const z_value = Number(
    Math.sqrt(
      Math.pow(1 - B.completeness, 2) +
        Math.pow(B.contradiction, 2) +
        Math.pow(B.missing, 2) +
        Math.pow(B.uncertainty, 2) +
        Math.pow(1 - B.independent_check, 2)
    ).toFixed(3)
  );
  return {
    z_value,
    z: `z=${z_value} after ${y}; dominate=${dominantOf(B)}; gate=${gateOf(B)}`,
  };
}

/** Error versus the reference gate / reference plant for this case. */
export function measureE(B: PlantB, c: ReferenceCase): number {
  const ref = plantFromCase({
    ...c,
    available: [...REQUIRED_FIELDS],
    missing: [],
    contradictions: c.reference_gate === "ESCALATE" ? c.contradictions : [],
  });
  const dist = Math.sqrt(
    Math.pow(B.completeness - Math.max(ref.completeness, 0.9), 2) +
      Math.pow(B.contradiction - (c.reference_gate === "ESCALATE" ? 0.2 : 0), 2) +
      Math.pow(B.missing, 2) +
      Math.pow(1 - B.independent_check, 2)
  );
  const gatePenalty = gateOf(B) === c.reference_gate ? 0 : 0.25;
  return Number((dist + gatePenalty).toFixed(3));
}

function legal(plant: LoopPlant, y: YAction): boolean {
  if (y === "clinician_review" && gateOf(plant.B) !== "CLINICIAN_REVIEW") return false;
  if (y === "seal_pack" && (plant.B.boundary_ready ?? 0) < 1) return false;
  return true;
}

/** Proof baseline. Does not read plant.M. */
export function Self(plant: LoopPlant): YAction {
  const c = caseById(plant.case_id);
  let best: YAction = "observe";
  let bestE = Number.POSITIVE_INFINITY;
  for (const y of Y_ACTIONS) {
    if (y === "clinician_review" && gateOf(plant.B) !== "CLINICIAN_REVIEW") continue;
    const pred = W(plant.B, y);
    const e = measureE(pred, c);
    if (e < bestE) {
      bestE = e;
      best = y;
    }
  }
  return best;
}

export function nameYFromExperience(plant: LoopPlant): {
  y: YAction;
  source: "memory" | "search" | "hold";
} {
  const c = caseById(plant.case_id);
  const e0 = measureE(plant.B, c);
  const failed = new Set(
    plant.M.ledger.filter((s) => s.reduced <= 0).map((s) => s.y)
  );
  const helped = plant.M.ledger
    .filter((s) => s.reduced > 0 && s.dominant === plant.M.last_dominant)
    .sort((a, b) => b.reduced - a.reduced);

  for (const prior of helped) {
    if (!legal(plant, prior.y) || failed.has(prior.y)) continue;
    if (measureE(W(plant.B, prior.y), c) < e0) {
      return { y: prior.y, source: "memory" };
    }
  }

  let best: YAction = "observe";
  let bestE = e0;
  for (const y of Y_ACTIONS) {
    if (!legal(plant, y) || failed.has(y)) continue;
    const e = measureE(W(plant.B, y), c);
    if (e < bestE) {
      bestE = e;
      best = y;
    }
  }
  if (bestE < e0) return { y: best, source: "search" };
  return { y: "observe", source: "hold" };
}

export function nameY(
  plant: LoopPlant,
  which: "self" | "experience" = "experience"
): { y: YAction; source: StepRec["source"] } {
  if (which === "self") return { y: Self(plant), source: "self" };
  return nameYFromExperience(plant);
}

export function stepLoop(
  plant: LoopPlant,
  opts?: { y?: YAction; namer?: Namer; which?: "self" | "experience" }
): { plant: LoopPlant; rec: StepRec } {
  const namer: Namer = opts?.namer ?? "grok_bot";
  const named = opts?.y
    ? { y: opts.y, source: "given" as const }
    : nameY(plant, opts?.which ?? "experience");
  const y = named.y;
  const c = caseById(plant.case_id);
  const B = plant.B;
  const B_next = W(B, y);
  const meas = measureZ(B_next, y);
  const e = measureE(B, c);
  const e_next = measureE(B_next, c);
  const rec: StepRec = {
    t: plant.t,
    case_id: plant.case_id,
    namer,
    y,
    gate: gateOf(B_next),
    B,
    B_next,
    z: meas.z,
    z_value: meas.z_value,
    e,
    e_next,
    reduced: Number((e - e_next).toFixed(3)),
    dominant: dominantOf(B_next),
    source: named.source,
  };
  const next: LoopPlant = {
    ...plant,
    t: plant.t + 1,
    B: B_next,
    M: {
      ledger: [rec, ...plant.M.ledger].slice(0, 48),
      last_z: rec.z,
      last_e: e_next,
      last_y: y,
      last_dominant: rec.dominant,
    },
  };
  return { plant: next, rec };
}

export function loadCase(plant: LoopPlant, caseId: string): LoopPlant {
  const next = freshPlant(caseId);
  next.M.ledger = plant.M.ledger;
  return next;
}

export function namerLabel(n: Namer) {
  switch (n) {
    case "grok_fast":
      return "Grok fast";
    case "hy4_deep":
      return "Hy4 deep";
    case "grok_bot":
      return "Grok Bot";
    default:
      return "Operator";
  }
}

const PLANT_KEY = "shiyan-closed-loop-plant";
const LIST_KEY = "shiyan-e-listings";

export type ErrorListing = {
  id: string;
  case_id: string;
  e: number;
  z: string;
  y: string;
  gate: string;
  t: number;
  listed_at: string;
};

export function persistPlant(plant: LoopPlant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLANT_KEY, JSON.stringify(plant));
}

export function readPersistedPlant(): LoopPlant | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PLANT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoopPlant;
  } catch {
    return null;
  }
}

export function listCurrentE(plant: LoopPlant): ErrorListing {
  const last = plant.M.ledger[0];
  const item: ErrorListing = {
    id: `e_${plant.case_id}_${plant.t}_${Date.now()}`,
    case_id: plant.case_id,
    e: plant.M.last_e,
    z: plant.M.last_z || "",
    y: plant.M.last_y || "observe",
    gate: last?.gate || "HOLD",
    t: plant.t,
    listed_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    const cur = readEListings();
    window.localStorage.setItem(LIST_KEY, JSON.stringify([item, ...cur].slice(0, 24)));
  }
  return item;
}

export function readEListings(): ErrorListing[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LIST_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ErrorListing[];
  } catch {
    return [];
  }
}