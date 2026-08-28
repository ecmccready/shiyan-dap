import OpenAI from "openai";

export type ModelProvider =
  | "mock"
  | "openai"
  | "grok"
  | "anthropic"
  | "local"
  | "hy4";

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
 * Model Adapter
 * Supports: mock | grok | openai | hy4
 * Portable: Grok Bot can route to any registered provider.
 */
export async function runModelAdapter(
  input: string,
  config: ModelAdapterConfig = { provider: "mock" }
): Promise<ModelResponse> {
  // ----- MOCK -----
  if (config.provider === "mock") {
    return {
      cleanedText: input.trim(),
      confidence: 0.92,
      provider: "mock",
    };
  }

  // ----- GROK (xAI) -----
  if (config.provider === "grok") {
    if (!process.env.XAI_API_KEY) {
      console.warn("XAI_API_KEY missing → falling back to mock");
      return {
        cleanedText: input.trim(),
        confidence: 0.5,
        provider: "mock",
      };
    }

    try {
      const grok = new OpenAI({
        apiKey: process.env.XAI_API_KEY,
        baseURL: "https://api.x.ai/v1",
      });

      const completion = await grok.chat.completions.create({
        model: config.modelName || "grok-4.6",
        messages: [
          {
            role: "system",
            content:
              "You are a precise cleaning and structuring assistant for the Shiyan Yishu Generative Transform Protocol. Clean and lightly normalize the user's narrative. Keep the original meaning. Return only the cleaned text.",
          },
          {
            role: "user",
            content: input,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const cleaned =
        completion.choices[0]?.message?.content?.trim() || input;

      return {
        cleanedText: cleaned,
        confidence: 0.96,
        provider: "grok",
      };
    } catch (error) {
      console.error("Grok call failed, falling back to mock:", error);
      return {
        cleanedText: input.trim(),
        confidence: 0.5,
        provider: "mock",
      };
    }
  }

  // ----- OPENAI -----
  if (config.provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      return {
        cleanedText: input.trim(),
        confidence: 0.5,
        provider: "mock",
      };
    }

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: config.modelName || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a precise cleaning and structuring assistant for the Shiyan Yishu Generative Transform Protocol. Clean and lightly normalize the user's narrative. Keep the original meaning. Return only the cleaned text.",
          },
          {
            role: "user",
            content: input,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const cleaned =
        completion.choices[0]?.message?.content?.trim() || input;

      return {
        cleanedText: cleaned,
        confidence: 0.95,
        provider: "openai",
      };
    } catch (error) {
      console.error("OpenAI call failed, falling back to mock:", error);
      return {
        cleanedText: input.trim(),
        confidence: 0.5,
        provider: "mock",
      };
    }
  }

  // ----- HY4 (stubbed / portable local-open-source path) -----
  if (config.provider === "hy4") {
    if (!process.env.HY4_API_URL) {
      return {
        cleanedText: `[hy4-stub] ${input.trim()}`,
        confidence: 0.84,
        provider: "hy4",
      };
    }

    try {
      const res = await fetch(process.env.HY4_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.modelName || "hy4",
          input,
        }),
      });
      const data = await res.json();
      return {
        cleanedText: data.text || data.cleanedText || input.trim(),
        confidence: data.confidence || 0.9,
        provider: "hy4",
      };
    } catch (error) {
      console.error("Hy4 call failed, using stub:", error);
      return {
        cleanedText: `[hy4-stub] ${input.trim()}`,
        confidence: 0.7,
        provider: "hy4",
      };
    }
  }

  // Fallback
  return {
    cleanedText: input.trim(),
    confidence: 0.5,
    provider: "mock",
  };
}