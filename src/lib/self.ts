import {
  ACTIONS_1D,
  Action1D,
  BQuality,
  ControllerA,
  Memory,
  QUALITY_ACTIONS,
  QualityAction,
} from "./types";
import { GOAL, W_quality, W_scalar } from "./workbench";
import { defects } from "./measure";

export function executeLocked(B: BQuality) {
  return B.contradiction > 0.25 || B.missing > 0.3 || B.uncertainty > 0.35;
}

function utility(B: BQuality) {
  return (
    B.useful + B.completeness - (B.contradiction + B.missing + B.uncertainty)
  );
}

function cost(y: QualityAction, B: BQuality) {
  const base: Record<QualityAction, number> = {
    observe: 0.02,
    complete_field: 0.08,
    resolve_contradiction: 0.1,
    fill_missing: 0.09,
    reduce_uncertainty: 0.06,
    execute_task: 0.18 + 0.35 * B.uncertainty + 0.25 * B.contradiction,
    hold: 0.01,
  };
  return base[y];
}

export function SelfScalar(M: Memory, B: number): ControllerA {
  const confidence = Math.max(
    0.2,
    Math.min(0.95, 0.85 - 0.01 * M.last_err + 0.01 * M.ledger.length)
  );
  const candidates = ACTIONS_1D.map((action) => {
    const next = W_scalar(B, action);
    const score = Math.abs(next);
    return { action: String(action), score, locked: false };
  });
  candidates.sort((a, b) => a.score - b.score);
  return {
    role: "controller",
    y: candidates[0].action,
    confidence,
    candidates,
    locked: false,
  };
}

export function SelfQuality(M: Memory, B: BQuality): ControllerA {
  const confidence = Math.max(
    0.15,
    Math.min(
      0.95,
      0.85 - 0.5 * Math.min(1, M.last_err) + 0.1 * Math.min(1, M.ledger.length / 20)
    )
  );
  const lockedExec = executeLocked(B);
  const LAMBDA_U = 0.35;
  const MU_C = 0.25;

  const candidates = QUALITY_ACTIONS.map((action) => {
    const locked = action === "execute_task" && lockedExec;
    const pred = W_quality(B, action, M.ledger.length);
    const d = defects(pred);
    const goalErr = Math.sqrt(Object.values(d).reduce((s, v) => s + v * v, 0));
    const U = utility(pred) - utility(B);
    const C = cost(action, B);
    let score = goalErr * goalErr - LAMBDA_U * U + MU_C * C;
    if (locked) score += 0.35;
    return { action, score, locked };
  });

  const open = candidates.filter((c) => !c.locked);
  open.sort((a, b) => a.score - b.score);
  const y = (open[0] || candidates.find((c) => c.action === "hold")!).action;

  return {
    role: "controller",
    y,
    confidence,
    candidates: candidates.sort((a, b) => a.score - b.score),
    locked: lockedExec,
  };
}

export function parseScalarY(raw: string): Action1D | null {
  const n = Number(raw);
  return (ACTIONS_1D as readonly number[]).includes(n) ? (n as Action1D) : null;
}

export function parseQualityY(raw: string): QualityAction | null {
  return (QUALITY_ACTIONS as readonly string[]).includes(raw)
    ? (raw as QualityAction)
    : null;
}