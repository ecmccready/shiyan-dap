"use client";

import { useCopy, copiedRing } from "@/lib/use-copy";

/** Copies one look-back path row (precomputed JSON) to the local clipboard. */
export default function CopyLookbackPath({ json, runId }: { json: string; runId: string }) {
  const copy = useCopy(3000, undefined, "look-back path");
  return (
    <button type="button" data-copy-roe-lookback-path={runId} disabled={!json} onClick={() => void copy.copy(json)} title={`Copy path JSON for ${runId}`}
      className={`rounded border border-zinc-600 px-1.5 text-[10px] text-zinc-300 hover:border-zinc-400${copiedRing(copy.status)}`}>
      {copy.status === "copied" ? "✓" : copy.status === "failed" ? "!" : "Copy"}
    </button>
  );
}
