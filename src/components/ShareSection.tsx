"use client";

import { useEffect, useState } from "react";
import ShareResult from "@/components/ShareResult";

/**
 * Labeled Share section: public proof URL for a run plus share/copy controls.
 * Renders nothing without a run id.
 */
export default function ShareSection({
  runId,
  label = "Public proof URL for the latest eligible run:",
}: {
  runId: string | null | undefined;
  label?: string;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!runId) return null;
  return (
    <section aria-labelledby="share-heading" className="rounded-xl border border-zinc-800 p-4 space-y-2">
      <h2 id="share-heading" className="text-lg font-semibold">Share</h2>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-xs break-all text-zinc-300">
        {origin + `/workbench/result?run_id=${encodeURIComponent(runId)}`}
      </p>
      <ShareResult runId={runId} />
    </section>
  );
}
