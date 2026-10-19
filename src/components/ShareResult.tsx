"use client";

import { showToast } from "@/lib/toast";
import { useCopy, copiedRing } from "@/lib/use-copy";
import ClearCopied from "@/components/ClearCopied";

/**
 * Copies a stable public URL for a run (/workbench/result?run_id=<id>) to the
 * clipboard via useCopy (Clipboard API → execCommand fallback); the open-link
 * stays as the fallback either way.
 */
export default function ShareResult({ runId }: { runId: string | null | undefined }) {
  const share = useCopy();
  const full = useCopy();
  if (!runId) return null;
  const path = `/workbench/result?run_id=${encodeURIComponent(runId)}`;
  const status = share.status;

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    const ok = await share.copy(url);
    showToast(ok ? "Public link copied" : "Copy failed — use the link");
  }

  return (
    <p className="text-sm space-x-3">
      <button type="button" onClick={copy} className={"rounded-full border border-emerald-700 px-3 py-1 text-emerald-400" + copiedRing(status)}>
        {status === "copied" ? "Copied ✓" : "Share this result"}
      </button>
      <a href={path} className="underline text-emerald-400">Open public link →</a>
      <button
        type="button"
        onClick={async () => showToast((await full.copy(window.location.origin + path)) ? "Public link copied" : "Copy failed — use the link")}
        className={"rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400" + copiedRing(full.status)}
        title="Copy the full public URL"
      >
        {full.status === "copied" ? "Copied ✓" : full.status === "failed" ? "Copy failed" : "Copy full public link"}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-zinc-400">
        {status === "copied" ? "Link copied" : status === "failed" ? "Copy failed — use the link" : ""}
      </span>
      <ClearCopied />
    </p>
  );
}
