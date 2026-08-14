export interface Outcome {
  domain: string;
  pi_inv: number;
  ell: number;
  similarity: number;
  timestamp: string;
}

// Simple in-memory store (resets when server restarts)
// Later this can be replaced with a database or file
let outcomes: Outcome[] = [];

export function recordOutcome(outcome: Outcome) {
  outcomes.push(outcome);

  // Keep only the last 50 outcomes
  if (outcomes.length > 50) {
    outcomes = outcomes.slice(-50);
  }
}

export function getRecentOutcomes(domain?: string, limit = 10): Outcome[] {
  const filtered = domain
    ? outcomes.filter((o) => o.domain === domain)
    : outcomes;

  return filtered.slice(-limit).reverse();
}

export function getAveragePiInv(domain?: string): number | null {
  const relevant = domain
    ? outcomes.filter((o) => o.domain === domain)
    : outcomes;

  if (relevant.length === 0) return null;

  const sum = relevant.reduce((acc, o) => acc + o.pi_inv, 0);
  return Number((sum / relevant.length).toFixed(3));
}