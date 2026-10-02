import type { Namer, PlantB, YAction } from "./closed-loop";
import { Y_ACTIONS } from "./closed-loop";

export type NamerProposal = {
  namer: Namer;
  y: YAction;
  linguisticPlan: string[];
  selfReflection: string;
  /** Model confidence. Never written as e or z. */
  confidence: number;
};

const NAMER_URL: Record<Exclude<Namer, "operator">, string | undefined> = {
  grok_fast: process.env.GROK_FAST_URL,
  hy4_deep: process.env.HY4_DEEP_URL,
  grok_bot: process.env.GROK_BOT_URL,
};

export async function proposeY(input: {
  namer: Namer;
  B: PlantB;
  referenceGate: string;
  missing: string[];
  contradictions: string[];
  /** Outside-loop hint. Not read by Self(). */
  priorWinningY: YAction | null;
}): Promise<NamerProposal> {
  if (input.namer === "operator") {
    return {
      namer: input.namer,
      y: input.missing.length ? "fill_missing" : "observe",
      linguisticPlan: ["operator default"],
      selfReflection: "no model call",
      confidence: 0,
    };
  }

  const prompt = [
    "Name exactly one y for the Shiyan evidence plant.",
    "y must be one of: " + Y_ACTIONS.join(", "),
    "Do not diagnose. Do not emit a gate. The plant measures z and e.",
    "Prefer the action that closes the largest hole in the pack:",
    "missing field, unresolved overlap, or absent independent check.",
    input.priorWinningY
      ? `Outside policy hint from a prior error-win, not from Self(): try ${input.priorWinningY} first if the hole is the same.`
      : "No prior error-win.",
    JSON.stringify({
      B: input.B,
      referenceGate: input.referenceGate,
      missing: input.missing,
      contradictions: input.contradictions,
    }),
    'Reply JSON only: {"y":"...","linguisticPlan":["..."],"selfReflection":"...","confidence":0.0}',
  ].join("\n");

  const raw = await callNamer(input.namer, prompt);
  const parsed = JSON.parse(raw) as Partial<NamerProposal>;
  const y = Y_ACTIONS.includes(parsed.y as YAction)
    ? (parsed.y as YAction)
    : "observe";

  return {
    namer: input.namer,
    y,
    linguisticPlan: Array.isArray(parsed.linguisticPlan) ? parsed.linguisticPlan : [],
    selfReflection: parsed.selfReflection ?? "",
    confidence: Number(parsed.confidence ?? 0),
  };
}

async function callNamer(namer: Exclude<Namer, "operator">, prompt: string) {
  const url = NAMER_URL[namer];
  if (!url) throw new Error(`namer ${namer} has no URL`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PORTABLE_LLM_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`namer ${namer} ${response.status}`);
  const json = await response.json();
  return json.choices[0].message.content as string;
}
src/lib/flywheel.ts

ts
import type { StepRec, YAction } from "./closed-loop";

export type TrajectoryScore = {
  caseId: string;
  steps: number;
  escalateCount: number;
  e0: number;
  eFinal: number;
  deltaE: number;
  ySequence: YAction[];
  pathWin: boolean;
  errorWin: boolean;
  listable: boolean;
};
