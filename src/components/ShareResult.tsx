"use client";

import { useState } from "react";

/**
 * Copies a stable public URL for a run (/workbench/result?run_id=<id>) to the
 * clipboard. Falls back to an open-link when the Clipboard API is unavailable.
 */
export default function ShareResult({ runId }: { runId: string | null | undefined }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  if (!runId) return null;
  const path = `/workbench/result?run_id=${encodeURIComponent(runId)}`;

  async function copy() {
    try {
      const url = new URL(path, window.location.origin).toString();
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <p className="text-sm space-x-3">
      <button onClick={copy} className="rounded-full border border-emerald-700 px-3 py-1 text-emerald-400">
        Share this result
      </button>
      <a href={path} className="underline text-emerald-400">Open public link →</a>
      {status === "copied" && <span className="text-xs text-zinc-400">Link copied</span>}
      {status === "failed" && <span className="text-xs text-zinc-400">Copy unavailable; use the link</span>}
    </p>
  );
}
