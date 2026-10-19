"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";
import { fmtE, type ExperienceEntry } from "@/lib/level4/experience-client";

/**
 * Copies a short multi-line evidence pack for a run: run id, e, Δe, Φ, the
 * latest eligible ledger line (fetched like CopyLedgerLine), public proof URL
 * and verify URL. Hidden when there is no entry.
 */
export default function CopyEvidencePack({ entry }: { entry?: ExperienceEntry | null }) {
  const [line, setLine] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const { status, copy } = useCopy(4000, undefined, "evidence pack");
  const runId = entry?.run_id;
  const iteration = entry?.iteration;
  useEffect(() => { setOrigin(window.location.origin); }, []);
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
  if (!entry || !runId) return null;
  const q = encodeURIComponent(runId);
  const pack = [
    `run=${runId}`,
    `e=${fmtE(entry.e)}`,
    ...(typeof entry.delta_e === "number" ? [`Δe=${fmtE(entry.delta_e)}`] : []),
    ...(typeof entry.phi === "number" ? [`Φ=${fmtE(entry.phi)}`] : []),
    ...(line ? [`ledger: ${line}`] : []),
    `proof: ${origin}/workbench/result?run_id=${q}`,
    `verify: ${origin}/api/level4/verify?run_id=${q}`,
  ].join("\n");
  return (
    <p className="text-xs">
      <button
        type="button"
        onClick={async () => showToast((await copy(pack)) ? "Evidence pack copied" : "Evidence pack copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(status)}
        title="Run id, e, Δe, Φ, latest eligible ledger line, public proof URL and verify URL"
      >
        {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy full evidence pack"}
      </button>
    </p>
  );
}
