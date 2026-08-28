import { runModelAdapter, ModelResponse } from "./model-adapter";

export type RoutePath = "fast" | "deep";

export interface RoutedResult {
  path: RoutePath;
  primary: ModelResponse;
  secondary?: ModelResponse;
  disagreement: number;
  mergedConfidence: number;
}

function scoreDisagreement(a: ModelResponse, b: ModelResponse): number {
  const confGap = Math.abs((a.confidence || 0) - (b.confidence || 0));
  const textGap = a.cleanedText === b.cleanedText ? 0 : 0.25;
  return Number(Math.min(1, confGap + textGap).toFixed(3));
}

/**
 * Grok Bot routing layer
 * Fast path: Grok only (user is waiting)
 * Deep path: Grok + Hy4 in parallel (background refinement)
 */
export async function routeModels(
  input: string,
  path: RoutePath = "fast"
): Promise<RoutedResult> {
  if (path === "fast") {
    const primary = await runModelAdapter(input, { provider: "grok" });
    return {
      path: "fast",
      primary,
      disagreement: 0,
      mergedConfidence: primary.confidence,
    };
  }

  const [primary, secondary] = await Promise.all([
    runModelAdapter(input, { provider: "grok" }),
    runModelAdapter(input, { provider: "hy4" }),
  ]);

  const disagreement = scoreDisagreement(primary, secondary);
  const mergedConfidence = Number(
    (
      primary.confidence * 0.6 +
      secondary.confidence * 0.4 -
      disagreement * 0.1
    ).toFixed(3)
  );

  return {
    path: "deep",
    primary,
    secondary,
    disagreement,
    mergedConfidence: Math.max(0.1, mergedConfidence),
  };
}