export type Experience = {
  state: number;
  task: string;
  action: string;
  predicted: number;
  observed: number;
  error: number;
  utility: number;
  value: number;
  outcome: string;
  successful: boolean;
  next_state: number;
  at: string;
};

type World = { s: number; locked: boolean };

const TASKS = ["HOLD_AND_MEASURE", "EXPAND", "CONTRACT"] as const;

const g = globalThis as unknown as {
  __loop?: { B: World; E: Experience[]; lock: boolean };
};

function st() {
  if (!g.__loop) g.__loop = { B: { s: 0.5, locked: false }, E: [], lock: false };
  return g.__loop;
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

export function retrieve(state: number, k = 5): Experience[] {
  return [...st().E]
    .sort((a, b) => Math.abs(a.state - state) - Math.abs(b.state - state))
    .slice(0, k);
}

function P(state: number, action: string) {
  const near = retrieve(state).filter((e) => e.action === action);
  if (near.length) {
    return near.reduce((s, e) => s + e.observed, 0) / near.length;
  }
  if (action === "EXPAND") return 0.04;
  if (action === "CONTRACT") return -0.04;
  return 0;
}

function score(state: number, action: string) {
  const hat = P(state, action);
  const goal = 0.5;
  const predicted = state + hat;
  const goalErr = Math.abs(predicted - goal);
  const U = -goalErr;
  const cost = action === "HOLD" ? 0 : 0.01;
  return { hat, U, score: U - cost };
}

function pickY(state: number) {
  const candidates = ["HOLD", "EXPAND", "CONTRACT"].map((action) => ({
    action,
    ...score(state, action),
  }));
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function skills() {
  const tasks: Record<string, { n: number; meanAbsE: number }> = {};
  for (const e of st().E) {
    const cur = tasks[e.task] || { n: 0, meanAbsE: 0 };
    const n = cur.n + 1;
    tasks[e.task] = {
      n,
      meanAbsE: (cur.meanAbsE * cur.n + Math.abs(e.error)) / n,
    };
  }
  return tasks;
}

export function weakest() {
  const s = skills();
  const keys = Object.keys(s);
  if (!keys.length) return "HOLD_AND_MEASURE";
  return keys.sort((a, b) => s[b].meanAbsE - s[a].meanAbsE)[0];
}

export function nextTask(): string {
  const w = weakest();
  return (TASKS as readonly string[]).includes(w) ? w : "HOLD_AND_MEASURE";
}

export function snapshot() {
  return {
    B: st().B,
    lock: st().lock,
    skills: skills(),
    weakest: weakest(),
    next_task: nextTask(),
    experiences: st().E,
    claimed_self_improving_ai: false,
    claimed_weight_training: false,
    claimed_sima2: false,
  };
}

export function tick() {
  const world = st();
  if (world.lock) {
    return { ok: false, error: "execute_task lock", ...snapshot() };
  }
  world.lock = true;
  try {
    const B_t = world.B.s;
    const task = nextTask();
    const chosen = pickY(B_t);
    const y = chosen.action;
    const hat = chosen.hat;
    const noise = ((world.E.length * 17) % 7) / 100 - 0.03;
    const delta =
      y === "EXPAND" ? 0.04 + noise : y === "CONTRACT" ? -0.04 + noise : noise;
    const B_next = clamp(B_t + delta);
    const e = Math.round((delta - hat) * 1000) / 1000;
    const U = -Math.abs(e);
    const V = Math.round(e * e * 1000) / 1000;
    const z = `z s=${B_t} y=${y} e=${e} task=${task}`;
    const row: Experience = {
      state: B_t,
      task,
      action: y,
      predicted: hat,
      observed: Math.round(delta * 1000) / 1000,
      error: e,
      utility: U,
      value: V,
      outcome: z,
      successful: Math.abs(e) < 0.02,
      next_state: B_next,
      at: new Date().toISOString(),
    };
    world.B.s = B_next;
    world.E = [row, ...world.E].slice(0, 80);
    return { ok: true, latest: row, ...snapshot() };
  } finally {
    world.lock = false;
  }
}