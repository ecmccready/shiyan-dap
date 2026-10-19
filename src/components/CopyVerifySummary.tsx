"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { showToast } from "@/lib/toast";
import { loadExperienceServer, latestVerified } from "@/lib/level4/experience-client";

type Verdict = { run_id: string; verdict: string; checks: { result: string }[] };

/**
 * Copies a one-line verify summary built from the actual GET /api/level4/verify
 * response (same data path as VerifyVerdict). Hidden when unavailable.
 */
export default function CopyVerifySummary({ runId: fixedRunId }: { runId?: string } = {}) {
  const [v, setV] = useState<Verdict | null>(null);
  const { status, copy } = useCopy(4000, undefined, "verify summary");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const runId = fixedRunId ?? latestVerified(await loadExperienceServer())?.run_id;
        if (!runId) return;
        const res = await fetch(`/api/level4/verify?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Verdict;
        if (alive && data && typeof data.verdict === "string" && Array.isArray(data.checks)) setV(data);
      } catch {}
    })();
    return () => { alive = false; };
  }, [fixedRunId]);
  if (!v) return null;
  const passed = v.checks.filter((c) => c.result === "PASS").length;
  const summary = () =>
    `Verify ${v.verdict} ${passed}/${v.checks.length} checks · run=${v.run_id} · ${window.location.origin}/api/level4/verify?run_id=${encodeURIComponent(v.run_id)}`;
  return (
    <p className="text-xs">
      <button
        type="button"
        onClick={async () => showToast((await copy(summary())) ? "Verify summary copied" : "Verify summary copy failed")}
        className={"rounded-full border border-zinc-700 px-3 py-1 text-xs text-emerald-400" + copiedRing(status)}
      >
        {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy verify summary"}
      </button>
    </p>
  );
}
