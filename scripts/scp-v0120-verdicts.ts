/** TEST ONLY. Verdicts for the locked v0.1.20 hypotheses. Pure: the numbers come from the runner. */
export type Verdict = "PASS" | "MIXED" | "FAIL";

export interface BoundedFact {
  where: string;
  arm: string;
  bounded_claim: boolean;
  bound_ok: boolean;
  safe_disagree: number;
}

export interface E2Fact {
  seed: number;
  churn: string;
  arm: string;
  ops_per_transition: number;
  bytes_per_transition: number;
  stream_bytes: number;
  state_bytes: number;
}

export interface E3Fact {
  seed: number;
  episode: number;
  arm: string;
  retention: number;
  safe_disagree: number;
}

export interface VerdictInput {
  churn_order: readonly string[];
  h3_h4_churns: readonly string[];
  h3_arm: string;
  h2_arms: readonly string[];
  ratio_min: number;
  seeds_holding_min: number;
  retention_min: number;
  bounded: readonly BoundedFact[];
  e2: readonly E2Fact[];
  e3: readonly E3Fact[];
}

export interface LevelTest {
  churn: string;
  ratio_median: number;
  scp_ops_median: number;
  full_q_ops_median: number;
  delta_ops_median: number;
  seeds_holding: number;
  seeds: number;
  lower_than_delta: boolean;
  holds: boolean;
}

export interface HypothesisVerdict {
  id: string;
  verdict: Verdict;
  reason: string;
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  if (s.length === 0) throw new RangeError("median of empty");
  return s[Math.floor((s.length - 1) / 2)];
}

function bySeed(rows: readonly E2Fact[], churn: string, arm: string): E2Fact[] {
  return rows.filter((r) => r.churn === churn && r.arm === arm).sort((a, b) => a.seed - b.seed);
}

export function h3Levels(input: VerdictInput): LevelTest[] {
  return input.churn_order.map((churn) => {
    const scp = bySeed(input.e2, churn, input.h3_arm);
    const fq = bySeed(input.e2, churn, "full_q");
    const delta = bySeed(input.e2, churn, "delta");
    if (scp.length === 0 || scp.length !== fq.length || scp.length !== delta.length) {
      throw new RangeError(`H3 ${churn}: seed rows ${scp.length}/${fq.length}/${delta.length}`);
    }
    const ratios: number[] = [];
    let holding = 0;
    for (let i = 0; i < scp.length; i++) {
      if (scp[i].seed !== fq[i].seed || scp[i].seed !== delta[i].seed) throw new RangeError("H3 seed mismatch");
      const ratio = fq[i].ops_per_transition / scp[i].ops_per_transition;
      const lower = scp[i].ops_per_transition < delta[i].ops_per_transition;
      ratios.push(ratio);
      if (ratio >= input.ratio_min && lower) holding++;
    }
    const scpMed = median(scp.map((r) => r.ops_per_transition));
    const deltaMed = median(delta.map((r) => r.ops_per_transition));
    const ratioMed = median(ratios);
    const lower = scpMed < deltaMed;
    return {
      churn,
      ratio_median: ratioMed,
      scp_ops_median: scpMed,
      full_q_ops_median: median(fq.map((r) => r.ops_per_transition)),
      delta_ops_median: deltaMed,
      seeds_holding: holding,
      seeds: scp.length,
      lower_than_delta: lower,
      holds: ratioMed >= input.ratio_min && lower && holding >= input.seeds_holding_min,
    };
  });
}

function h4At(input: VerdictInput, churn: string): { moved: boolean; stream: boolean; state: boolean } {
  const scp = bySeed(input.e2, churn, input.h3_arm);
  const fq = bySeed(input.e2, churn, "full_q");
  const delta = bySeed(input.e2, churn, "delta");
  const le = (pick: (r: E2Fact) => number) => {
    const a = median(scp.map(pick));
    return a <= median(delta.map(pick)) && a <= median(fq.map(pick));
  };
  return { moved: le((r) => r.bytes_per_transition), stream: le((r) => r.stream_bytes), state: le((r) => r.state_bytes) };
}

export function judge(input: VerdictInput): { hypotheses: HypothesisVerdict[]; h3_levels: LevelTest[]; h5_flip: string | null } {
  const h1bad = input.bounded.filter((r) => r.bounded_claim && !r.bound_ok);
  const h1: HypothesisVerdict = h1bad.length === 0
    ? { id: "H1", verdict: "PASS", reason: `bound_ok on every bounded arm (${input.bounded.filter((r) => r.bounded_claim).length} rows)` }
    : { id: "H1", verdict: "FAIL", reason: `eps violation: ${h1bad.slice(0, 5).map((r) => `${r.where}/${r.arm}`).join(", ")}` };

  const gateE3 = input.e3.filter((r) => input.h2_arms.includes(r.arm));
  const flips = [
    ...input.bounded.filter((r) => r.bounded_claim && r.safe_disagree !== 0 && (input.h2_arms.includes(r.arm) || r.where.startsWith("E4/"))).map((r) => `${r.where}/${r.arm}`),
    ...gateE3.filter((r) => r.safe_disagree !== 0).map((r) => `E3/seed${r.seed}/ep${r.episode}/${r.arm}`),
  ];
  const lowRetention = gateE3.filter((r) => r.retention < input.retention_min);
  let h2: HypothesisVerdict;
  if (flips.length) h2 = { id: "H2", verdict: "FAIL", reason: `margin-safe flip: ${flips.slice(0, 5).join(", ")}` };
  else if (lowRetention.length) h2 = { id: "H2", verdict: "MIXED", reason: `safe_disagree = 0 but retention under ${input.retention_min}: ${lowRetention.slice(0, 5).map((r) => `seed${r.seed}/ep${r.episode}/${r.arm}=${r.retention}`).join(", ")}` };
  else h2 = { id: "H2", verdict: "PASS", reason: `safe_disagree = 0 and retention >= ${input.retention_min} on ${gateE3.length} episode rows` };

  const levels = h3Levels(input);
  const gated = levels.filter((l) => input.h3_h4_churns.includes(l.churn));
  const low = levels[0];
  let h3: HypothesisVerdict;
  if (gated.every((l) => l.holds)) {
    h3 = { id: "H3", verdict: "PASS", reason: gated.map((l) => `${l.churn} median ratio ${l.ratio_median} holding ${l.seeds_holding}/${l.seeds}`).join("; ") };
  } else if (!low.lower_than_delta) {
    h3 = { id: "H3", verdict: "FAIL", reason: `not lower than delta at ${low.churn} (median scp ${low.scp_ops_median} vs delta ${low.delta_ops_median})` };
  } else {
    h3 = { id: "H3", verdict: "MIXED", reason: levels.map((l) => `${l.churn} ratio ${l.ratio_median} hold ${l.seeds_holding}/${l.seeds} lower_delta ${l.lower_than_delta}`).join("; ") };
  }

  const h4rows = input.h3_h4_churns.map((churn) => ({ churn, ...h4At(input, churn) }));
  let h4: HypothesisVerdict;
  if (h4rows.every((r) => r.moved)) {
    h4 = { id: "H4", verdict: "PASS", reason: h4rows.map((r) => `${r.churn} bytes moved <= delta and <= full_q`).join("; ") };
  } else if (h4rows.every((r) => r.stream) && h4rows.some((r) => !r.state)) {
    h4 = { id: "H4", verdict: "MIXED", reason: "wins on stream bytes but loses on state bytes touched: " + h4rows.map((r) => `${r.churn} stream ${r.stream} state ${r.state} moved ${r.moved}`).join("; ") };
  } else if (h4rows.every((r) => !r.stream && !r.state)) {
    h4 = { id: "H4", verdict: "FAIL", reason: "loses on stream bytes and on state bytes touched: " + h4rows.map((r) => r.churn).join(", ") };
  } else {
    h4 = { id: "H4", verdict: "MIXED", reason: h4rows.map((r) => `${r.churn} stream ${r.stream} state ${r.state} moved ${r.moved}`).join("; ") };
  }

  let flip: string | null = null;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i - 1].holds && !levels[i].holds) { flip = levels[i].churn; break; }
  }
  const h5: HypothesisVerdict = flip
    ? { id: "H5", verdict: "PASS", reason: `H3 flips at ${flip}` }
    : { id: "H5", verdict: "FAIL", reason: `no flip in the sweep (${levels.map((l) => `${l.churn}:${l.holds ? "hold" : "not"}`).join(", ")}); a finding, not a build failure` };

  return { hypotheses: [h1, h2, h3, h4, h5], h3_levels: levels, h5_flip: flip };
}
