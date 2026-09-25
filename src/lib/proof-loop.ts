export const ACTIONS = [10, 5, -5, -10] as const;

export type Cycle = {
  cycle: number;
  state: number;
  prediction: number;
  action: number;
  result: number;
  z: number;
  next_self: string;
  policy_before: number;
  policy_after: number;
  experience_changed_policy: boolean;
};

type Store = {
  B: number;
  M: Cycle[];
  inited: boolean;
  policy0: number | null;
};

const g = globalThis as unknown as { __proof?: Store };

function st(): Store {
  if (!g.__proof) {
    g.__proof = { B: 100, M: [], inited: false, policy0: null };
  }
  return g.__proof;
}

function predictDelta(action: number) {
  const hits = st().M.filter((c) => c.action === action);
  if (!hits.length) return null;
  return hits.reduce((a, c) => a + (c.result - c.state), 0) / hits.length;
}

export function policyAt(B: number) {
  const s = st();
  const untried = ACTIONS.filter((a) => !s.M.some((c) => c.action === a));
  if (untried.length) {
    return {
      action: untried[0],
      prediction: B + untried[0],
      source: "explore" as const,
    };
  }
  let best = ACTIONS[0];
  let bestPred = B + (predictDelta(best) ?? best);
  for (const a of ACTIONS) {
    const d = predictDelta(a);
    const pred = B + (d === null ? a : d);
    if (Math.abs(pred) < Math.abs(bestPred)) {
      best = a;
      bestPred = pred;
    }
  }
  return { action: best, prediction: bestPred, source: "experience" as const };
}

export function counterfactualZ(n: number, frozen: number) {
  let B = 100;
  for (let i = 0; i < n; i += 1) B = B + frozen;
  return Math.abs(B);
}

function compareFields() {
  const s = st();
  const n = s.M.length;
  const zNow = Math.abs(s.B);
  const frozen = s.policy0 ?? 10;
  const zFrozen = counterfactualZ(n, frozen);
  const now = policyAt(100);
  const different = s.policy0 !== null && now.action !== s.policy0;
  const better = n > 0 && zNow < zFrozen;
  return {
    z0: 100,
    z_now: zNow,
    z_if_policy0: zFrozen,
    different_because_E: different,
    better_because_E: better,
    milestone:
      different && better
        ? "A_t+1 different and better because of E,z"
        : "not yet both different and better",
  };
}

export function compare() {
  return compareFields();
}

export function snapshot() {
  const s = st();
  const now = policyAt(100);
  const changed =
    s.policy0 !== null &&
    now.source === "experience" &&
    now.action !== s.policy0;
  return {
    question: "Does experience change the next policy?",
    not: "Can an LLM produce an answer?",
    inited: s.inited,
    A: "A" + s.M.length,
    B: s.B,
    goal: 0,
    z: Math.abs(s.B),
    policy0: s.policy0,
    policy_now: now,
    experience_changed_policy: changed,
    operator_chose_action: false,
    claimed_llm_demo: false,
    claimed_self_improving_ai: false,
    claimed_autonomous_agi: false,
    cycles: [...s.M].reverse(),
    ...compareFields(),
  };
}

export function init() {
  g.__proof = { B: 100, M: [], inited: true, policy0: null };
  const p = policyAt(100);
  g.__proof.policy0 = p.action;
  return snapshot();
}

export function step() {
  const s = st();
  if (!s.inited) init();
  const before = policyAt(s.B);
  const B0 = s.B;
  const B1 = B0 + before.action;
  s.B = B1;
  const afterProbe = policyAt(100);
  const cycle: Cycle = {
    cycle: s.M.length,
    state: B0,
    prediction: before.prediction,
    action: before.action,
    result: B1,
    z: Math.abs(B1),
    next_self: "A" + (s.M.length + 1),
    policy_before: before.action,
    policy_after: afterProbe.action,
    experience_changed_policy:
      s.policy0 !== null && afterProbe.action !== s.policy0,
  };
  s.M = [cycle, ...s.M];
  return snapshot();
}

export function run(n = 12) {
  if (!st().inited) init();
  const cap = Math.max(1, Math.min(40, n));
  for (let i = 0; i < cap; i += 1) step();
  return snapshot();
}

export function experiment(trials = 5, n = 12) {
  const rows: Array<ReturnType<typeof compareFields> & { trial: number }> = [];
  for (let t = 0; t < trials; t += 1) {
    init();
    run(n);
    rows.push({ trial: t, ...compareFields() });
  }
  const pass = rows.filter(
    (r) => r.different_because_E && r.better_because_E
  ).length;
  return {
    question: "Is A_t+1 measurably different/better because of E_t and z_t?",
    trials,
    n,
    pass,
    rate: pass / trials,
    toward_demonstrated_autonomous_ai: pass === trials,
    claimed_autonomous_agi: false as const,
    rows,
    ...snapshot(),
  };
}