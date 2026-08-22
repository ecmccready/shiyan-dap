export interface OutcomeRecord {
  id: string;
  domain: string;
  pi_inv: number;
  ell: number;
  clusterId?: string;
  timestamp: string;
  modelProvider?: string;
}

// In-memory store of outcomes
let outcomes: OutcomeRecord[] = [];

/**
 * Record a new outcome from the agent loop
 */
export function recordOutcome(record: Omit<OutcomeRecord, "id" | "timestamp">) {
  const entry: OutcomeRecord = {
    id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...record,
  };
  outcomes.push(entry);
  return entry;
}

/**
 * Basic self-improvement metrics
 */
export function getSelfImprovementMetrics(domain?: string) {
  const filtered = domain
    ? outcomes.filter((o) => o.domain === domain)
    : outcomes;

  if (filtered.length === 0) {
    return {
      count: 0,
      avg_pi_inv: null,
      avg_ell: null,
      latest_pi_inv: null,
      trend: "insufficient_data",
      domains: {},
    };
  }

  const avg_pi_inv =
    filtered.reduce((sum, o) => sum + o.pi_inv, 0) / filtered.length;
  const avg_ell =
    filtered.reduce((sum, o) => sum + o.ell, 0) / filtered.length;
  const latest_pi_inv = filtered[filtered.length - 1].pi_inv;

  // Simple trend: compare last 3 vs previous 3 if possible
  let trend: "improving" | "declining" | "stable" | "insufficient_data" =
    "insufficient_data";

  if (filtered.length >= 6) {
    const recent = filtered.slice(-3);
    const previous = filtered.slice(-6, -3);
    const recentAvg =
      recent.reduce((s, o) => s + o.pi_inv, 0) / recent.length;
    const previousAvg =
      previous.reduce((s, o) => s + o.pi_inv, 0) / previous.length;

    if (recentAvg > previousAvg + 0.01) trend = "improving";
    else if (recentAvg < previousAvg - 0.01) trend = "declining";
    else trend = "stable";
  }

  // Per-domain breakdown
  const domains: Record<string, { count: number; avg_pi_inv: number }> = {};
  for (const o of outcomes) {
    if (!domains[o.domain]) {
      domains[o.domain] = { count: 0, avg_pi_inv: 0 };
    }
    domains[o.domain].count += 1;
    domains[o.domain].avg_pi_inv += o.pi_inv;
  }
  for (const d of Object.keys(domains)) {
    domains[d].avg_pi_inv = Number(
      (domains[d].avg_pi_inv / domains[d].count).toFixed(3)
    );
  }

  return {
    count: filtered.length,
    avg_pi_inv: Number(avg_pi_inv.toFixed(3)),
    avg_ell: Number(avg_ell.toFixed(3)),
    latest_pi_inv: Number(latest_pi_inv.toFixed(3)),
    trend,
    domains,
  };
}

export function getAllOutcomes() {
  return [...outcomes];
}