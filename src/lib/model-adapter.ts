export type ModelProvider = "mock" | "openai" | "anthropic" | "local" | "muse-glimmer";

export interface ModelAdapterConfig {
  provider: ModelProvider;
  modelName?: string;
}

export interface ModelResponse {
  cleanedText: string;
  embedding?: number[];
  confidence: number;
  provider: ModelProvider;
}

/**
 * Model Adapter – currently a stub.
 * This is the single place where we will later plug in
 * real LLM calls (OpenAI, Anthropic, local models, Muse Glimmer, etc.)
 */
export async function runModelAdapter(
  input: string,
  config: ModelAdapterConfig = { provider: "mock" }
): Promise<ModelResponse> {
  // --- MOCK implementation (safe for now) ---
  if (config.provider === "mock") {
    return {
      cleanedText: input.trim(),
      confidence: 0.92,
      provider: "mock",
    };
  }

  // Future real implementations will go here
  // Example:
  // if (config.provider === "openai") { ... }
  // if (config.provider === "muse-glimmer") { ... }

  // Fallback
  return {
    cleanedText: input.trim(),
    confidence: 0.5,
    provider: config.provider,
  };
}