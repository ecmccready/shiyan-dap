"use client";

import { useCopy } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";

/** Copies a run id; shares the page-wide Copied state and the toast. */
export default function CopyRunId({ runId }: { runId: string }) {
  const { status, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={async () => showToast((await copy(runId)) ? "Run id copied" : "Run id copy failed")}
      className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400 font-sans"
      title="Copy the run id"
    >
      {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy run id"}
    </button>
  );
}
