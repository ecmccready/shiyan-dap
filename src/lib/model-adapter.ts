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

const NARRATIVE_CLEANING_PROMPT =
  "You are a precise cleaning and structuring assistant for the Shiyan Yishu Generative Transform Protocol. Clean and lightly normalize the user's narrative. Keep the original meaning. Return only the cleaned text.";

export function normalizeNarrativeText(raw?: string | null): string {
  if (typeof raw !== "string") return "";

  return raw
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\[hy4-stub\]\s*/i, "")
    .trim();
}

function finalizeResponse(
  provider: ModelProvider,
  input: string,
  cleaned: string,
  confidence: number
): ModelResponse {
  return {
    cleanedText: normalizeNarrativeText(cleaned || input),
    confidence,
    provider,
  };
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
  const safeInput = normalizeNarrativeText(input);

  // ----- MOCK -----
  if (config.provider === "mock") {
    return finalizeResponse("mock", safeInput, safeInput, 0.92);
  }

  // ----- GROK (xAI) -----
  if (config.provider === "grok") {
    if (!process.env.XAI_API_KEY) {
      console.warn("XAI_API_KEY missing → falling back to mock");
      return finalizeResponse("mock", safeInput, safeInput, 0.5);
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
            content: NARRATIVE_CLEANING_PROMPT,
          },
          {
            role: "user",
            content: safeInput,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const cleaned = completion.choices[0]?.message?.content ?? safeInput;
      return finalizeResponse("grok", safeInput, cleaned, 0.96);
    } catch (error) {
      console.error("Grok call failed, falling back to mock:", error);
      return finalizeResponse("mock", safeInput, safeInput, 0.5);
    }
  }

  // ----- OPENAI -----
  if (config.provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      return finalizeResponse("mock", safeInput, safeInput, 0.5);
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
            content: NARRATIVE_CLEANING_PROMPT,
          },
          {
            role: "user",
            content: safeInput,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const cleaned = completion.choices[0]?.message?.content ?? safeInput;
      return finalizeResponse("openai", safeInput, cleaned, 0.95);
    } catch (error) {
      console.error("OpenAI call failed, falling back to mock:", error);
      return finalizeResponse("mock", safeInput, safeInput, 0.5);
    }
  }

  // ----- HY4 (stubbed / portable local-open-source path) -----
  if (config.provider === "hy4") {
    if (!process.env.HY4_API_URL) {
      return finalizeResponse("hy4", safeInput, `[hy4-stub] ${safeInput}`, 0.84);
    }

    try {
      const res = await fetch(process.env.HY4_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.modelName || "hy4",
          input: safeInput,
        }),
      });
      const data = await res.json();
      return finalizeResponse(
        "hy4",
        safeInput,
        data.text || data.cleanedText || safeInput,
        data.confidence || 0.9
      );
    } catch (error) {
      console.error("Hy4 call failed, using stub:", error);
      return finalizeResponse("hy4", safeInput, `[hy4-stub] ${safeInput}`, 0.7);
    }
  }

  // Fallback
  return finalizeResponse("mock", safeInput, safeInput, 0.5);
}