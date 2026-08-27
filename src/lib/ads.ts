export interface AdSignal {
  attentionScore: number;
  label: "low" | "medium" | "high";
  source: "cluster" | "token" | "user-input";
}

/**
 * Lightweight ad-based prediction signal.
 * Later this can be replaced by a trained model without changing callers.
 */
export function computeAdSignal(params: {
  pi_inv: number;
  similarity: number;
  hasUserInput?: boolean;
  domain?: string;
}): AdSignal {
  const inputBoost = params.hasUserInput ? 0.08 : 0;
  const musicBoost =
    params.domain === "music" || params.domain === "Music" ? 0.05 : 0;

  const attentionScore = Number(
    Math.min(
      0.99,
      params.pi_inv * 0.6 + params.similarity * 0.3 + inputBoost + musicBoost
    ).toFixed(3)
  );

  const label =
    attentionScore >= 0.85 ? "high" : attentionScore >= 0.75 ? "medium" : "low";

  return {
    attentionScore,
    label,
    source: params.hasUserInput ? "user-input" : "cluster",
  };
}