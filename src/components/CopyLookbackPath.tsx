"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";

/** Copies one look-back path row (precomputed JSON) to the local clipboard. */
export default function CopyLookbackPath({ json, runId, kind = "path" }: { json: string; runId: string; kind?: "path" | "steps" }) {
  const copy = useCopy(3000, undefined, "look-back path");
  return (
    <button type="button" {...(kind === "steps" ? { "data-copy-roe-lookback-steps": runId } : { "data-copy-roe-lookback-path": runId })} disabled={!json} onClick={() => void copy.copy(json)} title={`Copy ${kind} JSON for ${runId}`}
      className={`rounded border border-zinc-600 px-1.5 text-[10px] text-zinc-300 hover:border-zinc-400${copiedRing(copy.status)}`}>
      {copy.status === "copied" ? "✓" : copy.status === "failed" ? "!" : kind === "steps" ? "Copy steps JSON" : "Copy"}
    </button>
  );
}
