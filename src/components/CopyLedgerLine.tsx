"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";

/**
 * Fetches the ledger for a run and copies the line for the given eligible
 * iteration (ITER=<n> and STATUS=ELIGIBLE_EXPERIENCE). Hidden when unavailable.
 */
export default function CopyLedgerLine({ runId, iteration }: { runId?: string | null; iteration?: number | null }) {
  const [line, setLine] = useState<string | null>(null);
  const { status, copy } = useCopy();
  useEffect(() => {
    setLine(null);
    if (!runId || typeof iteration !== "number") return;
    let alive = true;
    fetch(`/api/level4/experience?format=ledger&run_id=${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ledger?: unknown } | null) => {
        const lines = Array.isArray(j?.ledger) ? (j!.ledger as unknown[]).filter((l): l is string => typeof l === "string") : [];
        const match = lines.find(
          (l) => / STATUS=ELIGIBLE_EXPERIENCE( |$)/.test(" " + l) && new RegExp(`(^| )ITER=${iteration}( |$)`).test(l),
        );
        if (alive) setLine(match ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [runId, iteration]);
  if (!line) return null;
  return (
    <section className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2">
      <p className="font-medium">Ledger line (latest eligible step)</p>
      <p className="font-mono text-xs text-zinc-300 truncate" title={line}>{line}</p>
      <button
        type="button"
        onClick={async () => showToast((await copy(line)) ? "Ledger line copied" : "Ledger line copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(status)}
      >
        {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy ledger line"}
      </button>
    </section>
  );
}
