"use client";

import ShareResult from "@/components/ShareResult";
import CopyEvidencePack from "@/components/CopyEvidencePack";
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Labeled Share section: public proof URL for a run plus share/copy controls.
 * Renders nothing without a run id.
 */
export default function ShareSection({
  runId,
  label = "Public proof URL for the latest eligible run:",
  entry,
}: {
  runId: string | null | undefined;
  label?: string;
  /** Optional: when given, the evidence pack buttons render prominently in this section. */
  entry?: ExperienceEntry | null;
}) {
  const origin = useHydrated() ? window.location.origin : "";
  if (!runId) return null;
  return (
    <section aria-labelledby="share-heading" className="rounded-xl border border-zinc-800 p-4 space-y-2">
      <h2 id="share-heading" className="text-lg font-semibold">Share</h2>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-xs break-all text-zinc-300">
        {origin + `/workbench/result?run_id=${encodeURIComponent(runId)}`}
      </p>
      {entry && entry.run_id === runId && <CopyEvidencePack entry={entry} />}
      <ShareResult runId={runId} />
    </section>
  );
}
