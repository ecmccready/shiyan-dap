export type WorkbenchB = {
  t: number;
  s: number;
  G: string;
};

export type MemoryM = {
  t: number;
  z: string[];
  V: number[];
};

export type ControllerA = {
  t: number;
  role: "controller";
  agents: ["planner", "executor", "evaluator"];
};

export type StepRecord = {
  t: number;
  B_t: WorkbenchB;
  B_next: WorkbenchB;
  hatDelta: number;
  y: string;
  delta: number;
  e: number;
  z: string;
  V: number;
  V_decreased: boolean | null;
  claimed_global_convergence: false;
};

const g = globalThis as unknown as {
  __shiyanSelf?: { B: WorkbenchB; M: MemoryM; lastV: number | null };
};

function store() {
  if (!g.__shiyanSelf) {
    g.__shiyanSelf = {
      B: { t: 0, s: 0.5, G: "music-launch" },
      M: { t: 0, z: [], V: [] },
      lastV: null,
    };
  }
  return g.__shiyanSelf;
}

export function self(M: MemoryM, B: WorkbenchB): ControllerA {
  return { t: M.t, role: "controller", agents: ["planner", "executor", "evaluator"] };
}

export function P(_A: ControllerA, _M: MemoryM, B: WorkbenchB) {
  return Math.round((0.5 - B.s) * 0.2 * 1000) / 1000;
}

export function pi(_A: ControllerA, hatDelta: number) {
  if (hatDelta > 0.02) return "EXPAND";
  if (hatDelta < -0.02) return "CONTRACT";
  return "HOLD";
}

export function W(B: WorkbenchB, y: string): WorkbenchB {
  const shift = y === "EXPAND" ? 0.04 : y === "CONTRACT" ? -0.04 : 0;
  const noise = ((B.t * 17) % 7) / 100 - 0.03;
  const s = Math.max(0, Math.min(1, B.s + shift + noise));
  return { t: B.t + 1, s: Math.round(s * 1000) / 1000, G: B.G };
}

export function Phi(B: WorkbenchB, y: string, e: number, G: string) {
  return `z t=${B.t} y=${y} e=${e} G=${G}`;
}

export function step(): { A: ControllerA; M: MemoryM; B: WorkbenchB; rec: StepRecord } {
  const st = store();
  const B_t = st.B;
  const M_t = st.M;
  const A_t = self(M_t, B_t);
  const hatDelta = P(A_t, M_t, B_t);
  const y = pi(A_t, hatDelta);
  const B_next = W(B_t, y);
  const delta = Math.round((B_next.s - B_t.s) * 1000) / 1000;
  const e = Math.round((delta - hatDelta) * 1000) / 1000;
  const z = Phi(B_t, y, e, B_t.G);
  const V = Math.round(e * e * 1000) / 1000;
  const V_decreased = st.lastV === null ? null : V < st.lastV;
  const M_next: MemoryM = {
    t: B_next.t,
    z: [z, ...M_t.z].slice(0, 30),
    V: [V, ...M_t.V].slice(0, 30),
  };
  st.B = B_next;
  st.M = M_next;
  st.lastV = V;
  const rec: StepRecord = {
    t: B_t.t,
    B_t,
    B_next,
    hatDelta,
    y,
    delta,
    e,
    z,
    V,
    V_decreased,
    claimed_global_convergence: false,
  };
  return { A: self(M_next, B_next), M: M_next, B: B_next, rec };
}

export function snapshotSelf() {
  const st = store();
  return {
    B: st.B,
    M: st.M,
    A: self(st.M, st.B),
    lastV: st.lastV,
    claimed_global_convergence: false as const,
  };
}