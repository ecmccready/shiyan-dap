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

export type SkillMemory = {
  tasks: Record<string, { n: number; meanAbsE: number; meanV: number }>;
};

const g = globalThis as unknown as {
  __shiyanExp?: Experience[];
};

function bag() {
  if (!g.__shiyanExp) g.__shiyanExp = [];
  return g.__shiyanExp;
}

export function writeExperience(e: Experience) {
  bag().unshift(e);
  g.__shiyanExp = bag().slice(0, 80);
  return g.__shiyanExp;
}

export function experiences() {
  return bag();
}

export function skills(): SkillMemory {
  const tasks: SkillMemory["tasks"] = {};
  for (const e of bag()) {
    const cur = tasks[e.task] || { n: 0, meanAbsE: 0, meanV: 0 };
    const n = cur.n + 1;
    tasks[e.task] = {
      n,
      meanAbsE: (cur.meanAbsE * cur.n + Math.abs(e.error)) / n,
      meanV: (cur.meanV * cur.n + e.value) / n,
    };
  }
  return { tasks };
}

export function weakestTask(): string {
  const s = skills().tasks;
  const keys = Object.keys(s);
  if (!keys.length) return "HOLD_AND_MEASURE";
  return keys.sort((a, b) => s[b].meanAbsE - s[a].meanAbsE)[0];
}

export function retrieveLike(state: number, k = 3): Experience[] {
  return [...bag()]
    .sort((a, b) => Math.abs(a.state - state) - Math.abs(b.state - state))
    .slice(0, k);
}

export function nextTask(state: number, z: string): string {
  const weak = weakestTask();
  const near = retrieveLike(state, 1)[0];
  if (near && !near.successful) return near.task;
  if (z.includes("e=") && !z.includes("e=0")) return weak;
  return weak;
}