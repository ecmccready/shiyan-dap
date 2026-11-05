import { createHash } from "crypto";

export type Policy = "look-back" | "greedy";

export type Trial = {
  id: string;
  policy: Policy;
  seed: number;
  delta_phi: number;
  interventions: number;
  coordination: number;
  drift: number;
  recovery_s: number;
  hash: string;
};

export type Comparison = {
  lookback_avg_delta_phi: number;
  greedy_avg_delta_phi: number;
  delta_phi_advantage: number;
  lookback_avg_interventions: number;
  greedy_avg_interventions: number;
  intervention_reduction: number;
};

export type Experiment = {
  schema: "aethel.robotics.experiment.v2";
  algorithm_version: "synthetic-lookback-greedy.v2";
  robot: string;
  task: string;
  environment: string;
  starting_state: string;
  seeds: number[];
  trials: Trial[];
  comparison: Comparison;
  reproducibility_hash: string;
  pack_hash: string;
  generated_at: string;
};

const digest = (value: unknown): string =>
  "sha256:" + createHash("sha256").update(JSON.stringify(value)).digest("hex");

const round = (n: number, places = 3): number => {
  const scale = 10 ** places;
  return Math.round((n + Number.EPSILON) * scale) / scale;
};

function runTrial(policy: Policy, seed: number): Omit<Trial, "hash"> {
  const scenario = seed % 3;
  const lookbackDelta = scenario === 0 ? 0.023 : scenario === 1 ? 0.010 : 0.016;
  const greedyDelta = scenario === 0 ? 0.011 : scenario === 1 ? 0.018 : 0.016;
  const base = policy === "look-back" ? lookbackDelta : greedyDelta;
  const noise = ((seed % 7) - 3) * 0.001;
  const lookbackInterventions = scenario === 0 ? 1 + (seed % 2) : scenario === 1 ? 4 + (seed % 3) : 2 + (seed % 2);
  const greedyInterventions = scenario === 0 ? 4 + (seed % 3) : scenario === 1 ? 1 + (seed % 2) : 2 + (seed % 2);
  const interventions = policy === "look-back" ? lookbackInterventions : greedyInterventions;
  const coordinationDelta = scenario === 0 ? 0.06 : scenario === 1 ? -0.04 : 0;
  const driftDelta = scenario === 0 ? -0.03 : scenario === 1 ? 0.02 : 0;
  const recoveryDelta = scenario === 0 ? -0.9 : scenario === 1 ? 0.6 : 0;
  const direction = policy === "look-back" ? 1 : -1;
  return {
    id: `${policy}-${seed}`,
    policy,
    seed,
    delta_phi: round(base + noise),
    interventions,
    coordination: round(0.76 + (scenario === 2 ? 0 : direction * coordinationDelta) + noise),
    drift: round(0.055 + (scenario === 2 ? 0 : direction * driftDelta) + Math.abs(noise)),
    recovery_s: round(1.65 + (scenario === 2 ? 0 : direction * recoveryDelta) + Math.abs(noise) * 10, 2),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compare(trials: Trial[]): Comparison {
  const lookback = trials.filter((trial) => trial.policy === "look-back");
  const greedy = trials.filter((trial) => trial.policy === "greedy");
  if (!lookback.length || lookback.length !== greedy.length) {
    throw new Error("Evidence requires paired look-back and greedy trials.");
  }
  const lookbackPhi = round(average(lookback.map((trial) => trial.delta_phi)));
  const greedyPhi = round(average(greedy.map((trial) => trial.delta_phi)));
  const lookbackInterventions = round(average(lookback.map((trial) => trial.interventions)), 2);
  const greedyInterventions = round(average(greedy.map((trial) => trial.interventions)), 2);
  return {
    lookback_avg_delta_phi: lookbackPhi,
    greedy_avg_delta_phi: greedyPhi,
    delta_phi_advantage: round(lookbackPhi - greedyPhi),
    lookback_avg_interventions: lookbackInterventions,
    greedy_avg_interventions: greedyInterventions,
    intervention_reduction: round(greedyInterventions - lookbackInterventions, 2),
  };
}

function reproducibilityPayload(exp: Omit<Experiment, "pack_hash" | "reproducibility_hash" | "generated_at">) {
  return {
    schema: exp.schema,
    algorithm_version: exp.algorithm_version,
    robot: exp.robot,
    task: exp.task,
    environment: exp.environment,
    starting_state: exp.starting_state,
    seeds: exp.seeds,
    trials: exp.trials,
    comparison: exp.comparison,
  };
}

export function runExperiment(seeds: number[] = [42, 17, 7]): Experiment {
  if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > 100) {
    throw new Error("Provide between 1 and 100 trial seeds.");
  }
  if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0) || new Set(seeds).size !== seeds.length) {
    throw new Error("Seeds must be unique, non-negative safe integers.");
  }

  const trials: Trial[] = [];
  for (const seed of seeds) {
    for (const policy of ["look-back", "greedy"] as Policy[]) {
      const raw = runTrial(policy, seed);
      trials.push({ ...raw, hash: digest(raw) });
    }
  }

  const base = {
    schema: "aethel.robotics.experiment.v2" as const,
    algorithm_version: "synthetic-lookback-greedy.v2" as const,
    robot: "sim-humanoid-v1",
    task: "long-horizon loco-manipulation",
    environment: "warehouse-aisle-3",
    starting_state: "seeded-pose-A",
    seeds: [...seeds],
    trials,
    comparison: compare(trials),
  };
  const reproducibility_hash = digest(reproducibilityPayload(base));
  const unsigned = { ...base, reproducibility_hash, generated_at: new Date().toISOString() };
  return { ...unsigned, pack_hash: digest(unsigned) };
}

export function evidencePack(exp: Experiment): string {
  return JSON.stringify(exp, null, 2);
}

export type Verification = {
  ok: boolean;
  reason?: string;
  outcome?: "look-back-better" | "greedy-better" | "tie";
  pack_hash?: string;
};

export function verifyPack(json: string): Verification {
  try {
    const parsed = JSON.parse(json) as Experiment;
    if (parsed.schema !== "aethel.robotics.experiment.v2") return { ok: false, reason: "unsupported schema" };
    if (parsed.algorithm_version !== "synthetic-lookback-greedy.v2") return { ok: false, reason: "unsupported algorithm version" };
    if (!Array.isArray(parsed.seeds) || !Array.isArray(parsed.trials) || parsed.seeds.length < 1) {
      return { ok: false, reason: "missing paired trial data" };
    }
    if (parsed.seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0) || new Set(parsed.seeds).size !== parsed.seeds.length) {
      return { ok: false, reason: "invalid seed list" };
    }
    if (parsed.trials.length !== parsed.seeds.length * 2) return { ok: false, reason: "trial count does not match seed list" };
    if (typeof parsed.generated_at !== "string" || !Number.isFinite(Date.parse(parsed.generated_at))) {
      return { ok: false, reason: "invalid generation timestamp" };
    }
    if (typeof parsed.pack_hash !== "string" || parsed.pack_hash.length !== 71 ||
        typeof parsed.reproducibility_hash !== "string" || parsed.reproducibility_hash.length !== 71) {
      return { ok: false, reason: "missing full-length SHA-256 fingerprint" };
    }

    const expectedIds = new Set<string>();
    for (const seed of parsed.seeds) {
      expectedIds.add(`look-back-${seed}`);
      expectedIds.add(`greedy-${seed}`);
    }
    for (const trial of parsed.trials) {
      if (trial.policy !== "look-back" && trial.policy !== "greedy") return { ok: false, reason: "invalid policy label" };
      if (!parsed.seeds.includes(trial.seed) || trial.id !== `${trial.policy}-${trial.seed}`) {
        return { ok: false, reason: "trial identity does not match its declared seed and policy" };
      }
      if (![trial.delta_phi, trial.interventions, trial.coordination, trial.drift, trial.recovery_s].every(Number.isFinite)) {
        return { ok: false, reason: "trial contains non-finite measurements" };
      }
      if (typeof trial.hash !== "string" || trial.hash.length !== 71) return { ok: false, reason: "invalid trial hash format" };
      if (!expectedIds.delete(trial.id)) return { ok: false, reason: "unexpected or duplicate trial" };
      const { hash: trialHash, ...trialBody } = trial;
      if (digest(trialBody) !== trialHash) return { ok: false, reason: `trial hash mismatch: ${trial.id}` };
    }
    if (expectedIds.size) return { ok: false, reason: "missing paired trial" };

    const recomputedComparison = compare(parsed.trials);
    if (JSON.stringify(recomputedComparison) !== JSON.stringify(parsed.comparison)) {
      return { ok: false, reason: "comparison does not match trial data" };
    }

    const { pack_hash, reproducibility_hash, generated_at, ...base } = parsed;
    const expectedReproducibility = digest(reproducibilityPayload(base));
    if (expectedReproducibility !== reproducibility_hash) return { ok: false, reason: "reproducibility hash mismatch" };
    const unsigned = { ...base, reproducibility_hash, generated_at };
    if (digest(unsigned) !== pack_hash) return { ok: false, reason: "pack hash mismatch" };

    const advantage = recomputedComparison.delta_phi_advantage;
    return {
      ok: true,
      outcome: advantage > 0 ? "look-back-better" : advantage < 0 ? "greedy-better" : "tie",
      pack_hash,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "invalid evidence JSON" };
  }
}
