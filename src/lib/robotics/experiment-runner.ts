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
  const base = policy === "look-back" ? 0.023 : 0.011;
  const noise = ((seed % 7) - 3) * 0.001;
  return {
    id: `${policy}-${seed}`,
    policy,
    seed,
    delta_phi: round(base + noise),
    interventions: policy === "look-back" ? 1 + (seed % 2) : 4 + (seed % 3),
    coordination: round(0.82 - (policy === "greedy" ? 0.06 : 0) + noise),
    drift: round(0.04 + (policy === "greedy" ? 0.03 : 0) + Math.abs(noise)),
    recovery_s: round(1.2 + (policy === "greedy" ? 0.9 : 0) + Math.abs(noise) * 10, 2),
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

    const expectedIds = new Set<string>();
    for (const seed of parsed.seeds) {
      expectedIds.add(`look-back-${seed}`);
      expectedIds.add(`greedy-${seed}`);
    }
    for (const trial of parsed.trials) {
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
