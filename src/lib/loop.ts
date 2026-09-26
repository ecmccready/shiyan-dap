import { BQuality, Memory, Mode, StepRecord } from "./types";
import { B0_QUALITY, B0_SCALAR, W_quality, W_scalar } from "./workbench";
import { lyapunov, z_quality, z_scalar } from "./measure";
import { SelfQuality, SelfScalar, parseQualityY, parseScalarY } from "./self";

export type Plant = {
  mode: Mode;
  t: number;
  B_scalar: number;
  B_quality: BQuality;
  M: Memory;
};

export function freshPlant(mode: Mode = "scalar"): Plant {
  return {
    mode,
    t: 0,
    B_scalar: B0_SCALAR,
    B_quality: { ...B0_QUALITY },
    M: { ledger: [], last_z: null, last_err: 0, last_dominant: null },
  };
}

export function step(
  plant: Plant,
  operatorY?: string
): { plant: Plant; rec: StepRecord } {
  const t = plant.t;
  const operator_chose_action = operatorY !== undefined && operatorY !== "";

  if (plant.mode === "scalar") {
    const A = SelfScalar(plant.M, plant.B_scalar);
    const parsed = operator_chose_action ? parseScalarY(operatorY!) : null;
    const yNum = parsed ?? Number(A.y);
    const B = plant.B_scalar;
    const B_next = W_scalar(B, yNum);
    const meas = z_scalar(B_next);
    const e = meas.z_value - Math.abs(B);
    const rec: StepRecord = {
      t,
      mode: "scalar",
      y: String(yNum),
      B,
      B_next,
      z: meas.z,
      z_value: meas.z_value,
      e: Number(e.toFixed(3)),
      V: Number((e * e).toFixed(3)),
      operator_chose_action,
      locked: false,
      dominant: meas.dominant,
      confidence: A.confidence,
    };
    return commit(plant, rec, { B_scalar: B_next });
  }

  const A = SelfQuality(plant.M, plant.B_quality);
  const parsed = operator_chose_action ? parseQualityY(operatorY!) : null;
  const y = parsed ?? parseQualityY(A.y) ?? "hold";
  const locked = A.locked && y === "execute_task";
  const B = plant.B_quality;
  const B_next = locked ? B : W_quality(B, y, t);
  const e_norm = Math.abs(B_next.useful - B.useful);
  const meas = z_quality(B_next, y, e_norm);
  const rec: StepRecord = {
    t,
    mode: "quality",
    y,
    B,
    B_next,
    z: meas.z,
    z_value: meas.z_value,
    e: Number(e_norm.toFixed(3)),
    V: Number(lyapunov(B_next, e_norm).toFixed(3)),
    operator_chose_action,
    locked,
    dominant: meas.dominant,
    confidence: A.confidence,
  };
  return commit(plant, rec, { B_quality: B_next });
}

function commit(
  plant: Plant,
  rec: StepRecord,
  patch: Partial<Plant>
): { plant: Plant; rec: StepRecord } {
  const M: Memory = {
    ledger: [rec, ...plant.M.ledger].slice(0, 40),
    last_z: rec.z,
    last_err: rec.z_value,
    last_dominant: rec.dominant,
  };
  return {
    plant: { ...plant, ...patch, t: plant.t + 1, M },
    rec,
  };
}

export function exploreThenAutonomous(cycles = 12) {
  let plant = freshPlant("scalar");
  const out: StepRecord[] = [];
  const explore = [10, 5, -5, -10];
  for (const y of explore) {
    const r = step(plant, String(y));
    plant = r.plant;
    out.push(r.rec);
  }
  for (let i = 0; i < cycles; i++) {
    const r = step(plant);
    plant = r.plant;
    out.push(r.rec);
  }
  return { plant, ledger: out };
}