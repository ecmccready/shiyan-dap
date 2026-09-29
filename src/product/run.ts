/**
 * Commercial boundary around the protected loop.
 * Organization → Workspace → Workbench → Run → Experience → Marketplace
 * The loop (A, B, z, e, Self) is not rewritten here. A Run only wraps it.
 */
import {
  LoopPlant,
  Namer,
  YAction,
  StepRec,
  freshPlant,
  stepLoop,
  persistPlant,
  readPersistedPlant,
  listCurrentE,
} from "@/lib/closed-loop";

export type RunStatus = "ready" | "running" | "closed";

export type OutcomeRun = {
  id: string;
  org: string;
  workspace: string;
  workbench: string;
  objective: string;
  status: RunStatus;
  started_at: string;
  closed_at: string | null;
  plant: LoopPlant;
  steps: StepRec[];
  e0: number;
  e_now: number;
  delta_e: number;
};

const RUN_KEY = "aethel-outcome-runs";
const ACTIVE_KEY = "aethel-active-run";

function uid() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function deltaE(run: OutcomeRun) {
  return Number((run.e0 - run.e_now).toFixed(3));
}

export function createRun(opts?: {
  org?: string;
  workspace?: string;
  workbench?: string;
  objective?: string;
  caseId?: string;
}): OutcomeRun {
  const plant = freshPlant(opts?.caseId);
  const run: OutcomeRun = {
    id: uid(),
    org: opts?.org || "org-local",
    workspace: opts?.workspace || "Workspace A",
    workbench: opts?.workbench || "Node",
    objective:
      opts?.objective ||
      "Reduce e against the reference gate. Evidence only. No diagnosis.",
    status: "ready",
    started_at: new Date().toISOString(),
    closed_at: null,
    plant,
    steps: [],
    e0: plant.M.last_e,
    e_now: plant.M.last_e,
    delta_e: 0,
  };
  persistPlant(plant);
  saveActive(run);
  remember(run);
  return run;
}

export function stepRun(
  run: OutcomeRun,
  opts?: { y?: YAction; namer?: Namer }
): OutcomeRun {
  const out = stepLoop(run.plant, {
    namer: opts?.namer ?? "grok_bot",
    y: opts?.y,
  });
  persistPlant(out.plant);
  const next: OutcomeRun = {
    ...run,
    status: "running",
    plant: out.plant,
    steps: [out.rec, ...run.steps].slice(0, 48),
    e_now: out.rec.e_next,
    delta_e: Number((run.e0 - out.rec.e_next).toFixed(3)),
  };
  saveActive(next);
  remember(next);
  return next;
}

export function closeRun(run: OutcomeRun): OutcomeRun {
  const next: OutcomeRun = {
    ...run,
    status: "closed",
    closed_at: new Date().toISOString(),
    delta_e: deltaE(run),
  };
  saveActive(next);
  remember(next);
  return next;
}

export function listExperience(run: OutcomeRun) {
  return listCurrentE(run.plant);
}

export function readActiveRun(): OutcomeRun | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_KEY);
  if (!raw) {
    const plant = readPersistedPlant();
    return plant
      ? {
          id: "run_attached",
          org: "org-local",
          workspace: "Workspace A",
          workbench: "Node",
          objective: "Attached to existing plant. Not a new loop.",
          status: "ready",
          started_at: new Date().toISOString(),
          closed_at: null,
          plant,
          steps: plant.M.ledger,
          e0: plant.M.last_e,
          e_now: plant.M.last_e,
          delta_e: 0,
        }
      : null;
  }
  try {
    return JSON.parse(raw) as OutcomeRun;
  } catch {
    return null;
  }
}

export function readRuns(): OutcomeRun[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(RUN_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutcomeRun[];
  } catch {
    return [];
  }
}

function saveActive(run: OutcomeRun) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(run));
}

function remember(run: OutcomeRun) {
  if (typeof window === "undefined") return;
  const rest = readRuns().filter((r) => r.id !== run.id);
  window.localStorage.setItem(
    RUN_KEY,
    JSON.stringify([run, ...rest].slice(0, 24))
  );
}