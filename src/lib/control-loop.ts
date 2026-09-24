export const B_KEYS = [
  "completeness",
  "contradiction",
  "missing",
  "uncertainty",
  "useful",
] as const;

export type BKey = (typeof B_KEYS)[number];
export type BVec = Record<BKey, number>;

export const ACTIONS = [
  "observe",
  "complete_field",
  "resolve_contradiction",
  "fill_missing",
  "reduce_uncertainty",
  "execute_task",
  "hold",
] as const;

export type Action = (typeof ACTIONS)[number];

export const GOAL: BVec = {
  completeness: 1,
  contradiction: 0,
  missing: 0,
  uncertainty: 0.05,
  useful: 0.85,
};

export type LoopRow = {
  t: number;
  y: Action;
  B: BVec;
  B_next: BVec;
  hat_dB: BVec;
  dB: BVec;
  e: BVec;
  e_norm: number;
  U: number;
  C: number;
  V: number;
  dV: number;
  z: string;
  dominant: string;
  confidence: number;
};

export type Memory = {
  ledger: LoopRow[];
  last_z: string | null;
  last_err_norm: number;
  last_dominant: string | null;
};

export type ControllerA = {
  confidence: number;
  y: Action;
  hat_dB: BVec;
  candidates: { action: Action; score: number; locked: boolean }[];
  locked: { execute_task: boolean };
};

const LAMBDA_U = 0.35;
const MU_C = 0.25;

const g = globalThis as unknown as {
  __shiyanLoopM?: Memory;
  __shiyanLoopB?: BVec;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clipB(B: BVec): BVec {
  return {
    completeness: clamp01(B.completeness),
    contradiction: clamp01(B.contradiction),
    missing: clamp01(B.missing),
    uncertainty: Math.max(0.01, Math.min(1, B.uncertainty)),
    useful: clamp01(B.useful),
  };
}

function zero(): BVec {
  return {
    completeness: 0,
    contradiction: 0,
    missing: 0,
    uncertainty: 0,
    useful: 0,
  };
}

function add(a: BVec, b: BVec): BVec {
  return {
    completeness: a.completeness + b.completeness,
    contradiction: a.contradiction + b.contradiction,
    missing: a.missing + b.missing,
    uncertainty: a.uncertainty + b.uncertainty,
    useful: a.useful + b.useful,
  };
}

function sub(a: BVec, b: BVec): BVec {
  return {
    completeness: a.completeness - b.completeness,
    contradiction: a.contradiction - b.contradiction,
    missing: a.missing - b.missing,
    uncertainty: a.uncertainty - b.uncertainty,
    useful: a.useful - b.useful,
  };
}

function scale(a: BVec, s: number): BVec {
  return {
    completeness: a.completeness * s,
    contradiction: a.contradiction * s,
    missing: a.missing * s,
    uncertainty: a.uncertainty * s,
    useful: a.useful * s,
  };
}

function norm(a: BVec) {
  return Math.sqrt(
    B_KEYS.reduce((s, k) => s + a[k] * a[k], 0)
  );
}

function roundB(B: BVec): BVec {
  return {
    completeness: Math.round(B.completeness * 1000) / 1000,
    contradiction: Math.round(B.contradiction * 1000) / 1000,
    missing: Math.round(B.missing * 1000) / 1000,
    uncertainty: Math.round(B.uncertainty * 1000) / 1000,
    useful: Math.round(B.useful * 1000) / 1000,
  };
}

export function utility(B: BVec) {
  return B.useful + B.completeness - (B.contradiction + B.missing + B.uncertainty);
}

export function cost(action: Action, B: BVec) {
  const base: Record<Action, number> = {
    observe: 0.02,
    complete_field: 0.08,
    resolve_contradiction: 0.1,
    fill_missing: 0.09,
    reduce_uncertainty: 0.06,
    execute_task: 0.18 + 0.35 * B.uncertainty + 0.25 * B.contradiction,
    hold: 0.01,
  };
  return base[action];
}

export function executeLocked(B: BVec) {
  return B.contradiction > 0.25 || B.missing > 0.3 || B.uncertainty > 0.35;
}

function predictedMean(action: Action, M: Memory): BVec {
  const table: Record<Action, BVec> = {
    observe: { completeness: 0.02, contradiction: 0, missing: 0, uncertainty: -0.04, useful: 0 },
    complete_field: { completeness: 0.08, contradiction: 0.01, missing: -0.02, uncertainty: -0.01, useful: 0.03 },
    resolve_contradiction: { completeness: 0.03, contradiction: -0.12, missing: 0, uncertainty: -0.02, useful: 0.02 },
    fill_missing: { completeness: 0.04, contradiction: 0, missing: -0.12, uncertainty: -0.01, useful: 0.02 },
    reduce_uncertainty: { completeness: 0.02, contradiction: 0, missing: 0, uncertainty: -0.1, useful: 0.01 },
    execute_task: { completeness: 0.05, contradiction: 0.02, missing: -0.01, uncertainty: 0.02, useful: 0.12 },
    hold: { completeness: 0, contradiction: 0, missing: 0, uncertainty: 0.01, useful: 0 },
  };
  const exp = { ...table[action] };
  if (M.last_dominant === "contradiction" && action === "resolve_contradiction") exp.contradiction -= 0.04;
  if (M.last_dominant === "missing" && action === "fill_missing") exp.missing -= 0.04;
  if (M.last_dominant === "uncertainty" && action === "reduce_uncertainty") exp.uncertainty -= 0.04;
  return exp;
}

export function P(A: { confidence: number }, M: Memory, action: Action): BVec {
  return scale(predictedMean(action, M), 0.6 + 0.4 * A.confidence);
}

export function W(B: BVec, action: Action): BVec {
  const table: Record<Action, BVec> = {
    observe: { completeness: 0.015, contradiction: 0.005, missing: 0, uncertainty: -0.035, useful: 0 },
    complete_field: { completeness: 0.07, contradiction: 0.015, missing: -0.015, uncertainty: -0.01, useful: 0.025 },
    resolve_contradiction: { completeness: 0.025, contradiction: -0.11, missing: 0.01, uncertainty: -0.015, useful: 0.015 },
    fill_missing: { completeness: 0.03, contradiction: 0.01, missing: -0.1, uncertainty: 0, useful: 0.02 },
    reduce_uncertainty: { completeness: 0.015, contradiction: 0, missing: 0, uncertainty: -0.09, useful: 0.008 },
    execute_task: { completeness: 0.04, contradiction: 0.03, missing: 0, uncertainty: 0.025, useful: 0.1 },
    hold: { completeness: 0, contradiction: 0.005, missing: 0.005, uncertainty: 0.015, useful: -0.005 },
  };
  const d = { ...table[action] };
  if (action === "execute_task") {
    d.contradiction += 0.08 * B.contradiction;
    d.uncertainty += 0.06 * B.uncertainty;
    d.useful -= 0.08 * (B.contradiction + B.uncertainty);
  }
  const noise: BVec = {
    completeness: (Math.random() - 0.5) * 0.03,
    contradiction: (Math.random() - 0.5) * 0.03,
    missing: (Math.random() - 0.5) * 0.03,
    uncertainty: (Math.random() - 0.5) * 0.03,
    useful: (Math.random() - 0.5) * 0.03,
  };
  return clipB(add(B, add(d, noise)));
}

export function phi(B: BVec, y: Action, dB: BVec, e: BVec): { text: string; dominant: string } {
  const defects: Record<string, number> = {
    completeness: Math.max(0, GOAL.completeness - B.completeness),
    contradiction: B.contradiction,
    missing: B.missing,
    uncertainty: B.uncertainty,
    useful: Math.max(0, GOAL.useful - B.useful),
  };
  const dominant = Object.entries(defects).sort((a, b) => b[1] - a[1])[0][0];
  const err = Math.round(norm(e) * 1000) / 1000;
  return {
    dominant,
    text: `z: e=${err} after ${y}; dominate=${dominant}; next=correct ${dominant}`,
  };
}

export function lyapunov(B: BVec, e: BVec) {
  return (
    norm(e) ** 2 +
    1.2 * B.contradiction +
    1.1 * B.missing +
    B.uncertainty +
    (1 - B.completeness) +
    (1 - B.useful)
  );
}

export function defaultB(): BVec {
  return {
    completeness: 0.28,
    contradiction: 0.42,
    missing: 0.51,
    uncertainty: 0.63,
    useful: 0.12,
  };
}

export function defaultM(): Memory {
  return { ledger: [], last_z: null, last_err_norm: 1, last_dominant: null };
}

export function getState() {
  if (!g.__shiyanLoopB) g.__shiyanLoopB = defaultB();
  if (!g.__shiyanLoopM) g.__shiyanLoopM = defaultM();
  return { B: g.__shiyanLoopB, M: g.__shiyanLoopM };
}

export function resetLoop() {
  g.__shiyanLoopB = defaultB();
  g.__shiyanLoopM = defaultM();
  return getState();
}

export function Self(M: Memory, B: BVec): ControllerA {
  const conf = clamp01(0.85 - 0.5 * M.last_err_norm + 0.1 * M.ledger.length / 20);
  const locked = { execute_task: executeLocked(B) };
  const proto = { confidence: Math.max(0.15, Math.min(0.92, conf)) };
  const candidates = ACTIONS.map((action) => {
    const blocked = action === "execute_task" && locked.execute_task;
    const hat = P(proto, M, action);
    const Bhat = clipB(add(B, hat));
    const goalErr = sub(Bhat, GOAL);
    const U = utility(Bhat) - utility(B);
    const C = cost(action, B);
    let score = norm(goalErr) ** 2 - LAMBDA_U * U + MU_C * C;
    if (blocked) score += 0.35;
    return { action, score: Math.round(score * 1000) / 1000, locked: blocked };
  }).sort((a, b) => a.score - b.score);

  const chosen = candidates[0].action;
  return {
    confidence: proto.confidence,
    y: chosen,
    hat_dB: P(proto, M, chosen),
    candidates,
    locked,
  };
}

export function step(action?: Action) {
  const { B, M } = getState();
  const A = Self(M, B);
  const y = action && ACTIONS.includes(action) ? action : A.y;
  if (y === "execute_task" && A.locked.execute_task) {
    return { ok: false as const, reason: "execute_task locked until defects fall", A, B, M };
  }
  const hat = P(A, M, y);
  const B2 = W(B, y);
  const dB = sub(B2, B);
  const e = sub(dB, hat);
  const z = phi(B, y, dB, e);
  const V0 = lyapunov(B, e);
  const V1 = lyapunov(B2, e);
  const row: LoopRow = {
    t: M.ledger.length,
    y,
    B: roundB(B),
    B_next: roundB(B2),
    hat_dB: roundB(hat),
    dB: roundB(dB),
    e: roundB(e),
    e_norm: Math.round(norm(e) * 1000) / 1000,
    U: Math.round((utility(B2) - utility(B)) * 1000) / 1000,
    C: Math.round(cost(y, B) * 1000) / 1000,
    V: Math.round(V1 * 1000) / 1000,
    dV: Math.round((V1 - V0) * 1000) / 1000,
    z: z.text,
    dominant: z.dominant,
    confidence: Math.round(A.confidence * 1000) / 1000,
  };
  M.ledger.push(row);
  M.last_z = z.text;
  M.last_err_norm = row.e_norm;
  M.last_dominant = z.dominant;
  g.__shiyanLoopB = B2;
  g.__shiyanLoopM = M;
  return { ok: true as const, A: { ...A, y, hat_dB: hat }, B: B2, M, row };
}

export function snapshot() {
  const { B, M } = getState();
  const A = Self(M, B);
  const last = M.ledger[M.ledger.length - 1] || null;
  return {
    ok: true,
    product: "workbench state transition",
    not: "a diagnosis",
    claimed_error_elimination: false,
    device_claim: false,
    convergence_claim: false,
    G: GOAL,
    A,
    B: roundB(B),
    V: last?.V ?? Math.round(lyapunov(B, zero()) * 1000) / 1000,
    e_norm: last?.e_norm ?? null,
    last_z: M.last_z,
    ledger: M.ledger.slice(-24),
  };
}