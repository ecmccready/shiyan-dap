"use client";

import { useEffect } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";

/** Copies one look-back path row (precomputed JSON) to the local clipboard. */
export default function CopyLookbackPath({ json, runId, kind = "path", pulsing = false, onCopied }: { json: string; runId: string; kind?: "path" | "steps"; pulsing?: boolean; onCopied?: (runId: string) => void }) {
  const copy = useCopy(3000, undefined, "look-back path");
  useEffect(() => { if (copy.status === "copied") onCopied?.(runId); }, [copy.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" {...(kind === "steps" ? { "data-copy-roe-lookback-steps": runId } : { "data-copy-roe-lookback-path": runId })} disabled={!json} onClick={() => void copy.copy(json)} data-copy-pulsing={pulsing ? "1" : undefined} title={`Copy ${kind} JSON for ${runId}`}
      className={`rounded border border-zinc-600 px-1.5 text-[10px] text-zinc-300 hover:border-zinc-400${pulsing ? " ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.8)] motion-safe:animate-pulse" : ""}${copiedRing(copy.status)}`}>
      {copy.status === "copied" ? "✓" : copy.status === "failed" ? "!" : kind === "steps" ? "Copy steps JSON" : "Copy"}
    </button>
  );
}
