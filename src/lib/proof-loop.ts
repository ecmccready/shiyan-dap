export const ACTIONS = [10, 5, -5, -10] as const;

export type Cycle = {
  cycle: number;
  state: number;
  prediction: number;
  action: number;
  result: number;
  z: number;
  next_self: string;
  autonomy: true;
};

type Store = {
  B: number;
  M: Cycle[];
  inited: boolean;
};

const g = globalThis as unknown as { __proof?: Store };

function st(): Store {
  if (!g.__proof) g.__proof = { B: 100, M: [], inited: false };
  return g.__proof;
}

export function init() {
  g.__proof = { B: 100, M: [], inited: true };
  return snapshot();
}

export function snapshot() {
  const s = st();
  const last = s.M[0];
  const z = Math.abs(s.B);
  return {
    inited: s.inited,
    A: s.M.length === 0 ? "A0" : "A" + s.M.length,
    B: s.B,
    goal: 0,
    z,
    cycles: [...s.M].reverse(),
    autonomy: s.inited && s.M.length > 0,
    recursion: s.M.length >= 2 && s.M[0].action !== s.M[1]?.action || s.M.length >= 2,
    convergence: z < 100,
    claimed_self_improving_ai: false,
    operator_chose_action: false,
  };
}

function predict(action: number) {
  const hits = st().M.filter((c) => c.action === action);
  if (!hits.length) return null;
  const mean = hits.reduce((a, c) => a + (c.result - (c.state as number)), 0) / hits.length;
  return mean;
}

function chooseY(B: number): { action: number; prediction: number } {
  const s = st();
  const untried = ACTIONS.filter((a) => !s.M.some((c) => c.action === a));
  if (untried.length) {
    return { action: untried[0], prediction: B + untried[0] };
  }
  let best = ACTIONS[0];
  let bestPred = B + (predict(best) ?? best);
  let bestAbs = Math.abs(bestPred);
  for (const a of ACTIONS) {
    const d = predict(a);
    const pred = B + (d === null ? a : d);
    const abs = Math.abs(pred);
    if (abs < bestAbs) {
      best = a;
      bestPred = pred;
      bestAbs = abs;
    }
  }
  return { action: best, prediction: bestPred };
}

export function step() {
  const s = st();
  if (!s.inited) init();
  const B0 = s.B;
  const { action, prediction } = chooseY(B0);
  const B1 = B0 + action;
  const z = Math.abs(B1);
  const cycle: Cycle = {
    cycle: s.M.length,
    state: B0,
    prediction,
    action,
    result: B1,
    z,
    next_self: "A" + (s.M.length + 1),
    autonomy: true,
  };
  s.B = B1;
  s.M = [cycle, ...s.M];
  return snapshot();
}

export function run(n = 12) {
  if (!st().inited) init();
  const cap = Math.max(1, Math.min(40, n));
  for (let i = 0; i < cap; i++) step();
  return snapshot();
}