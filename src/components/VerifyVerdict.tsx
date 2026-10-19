"use client";

import { useEffect, useState } from "react";
import { loadExperienceServer, latestVerified } from "@/lib/level4/experience-client";

type Check = { iter: number | null; check: string; result: string };
type Verdict = { run_id: string; verdict: string; checks: Check[] };

/**
 * Inline verdict from GET /api/level4/verify?run_id=<latest eligible run>.
 * Fails soft: renders nothing when there is no run data or the call fails.
 */
export default function VerifyVerdict({ runId: fixedRunId }: { runId?: string } = {}) {
  const [state, setState] = useState<"loading" | "none" | "ok">("loading");
  const [v, setV] = useState<Verdict | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const runId = fixedRunId ?? latestVerified(await loadExperienceServer())?.run_id;
        if (!runId) return setState("none");
        const res = await fetch(`/api/level4/verify?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" });
        if (!res.ok) return setState("none");
        const data = (await res.json()) as Verdict;
        if (!data || typeof data.verdict !== "string" || !Array.isArray(data.checks)) return setState("none");
        setV(data);
        setState("ok");
      } catch {
        setState("none");
      }
    })();
  }, [fixedRunId]);

  if (state === "none") return null;
  if (state === "loading" || !v) {
    return (
      <section className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-500" aria-busy="true">
        Independent check: running GET /api/level4/verify…
      </section>
    );
  }
  const passed = v.checks.filter((c) => c.result === "PASS").length;
  const failing = v.checks.filter((c) => c.result !== "PASS");
  const pass = v.verdict === "PASS";
  return (
    <section className={`rounded-xl border p-4 text-sm space-y-1 ${pass ? "border-emerald-800" : "border-red-800"}`}>
      <p className="font-medium">
        Independent check:{" "}
        <span className={pass ? "text-emerald-400" : "text-red-400"}>{v.verdict}</span>
        <span className="text-zinc-400"> · {passed}/{v.checks.length} checks passed</span>
      </p>
      {!pass && failing.length > 0 && (
        <ul className="list-disc pl-5 text-xs font-mono text-red-300">
          {failing.map((c, i) => (
            <li key={i}>{c.iter === null ? "" : `iter ${c.iter} · `}{c.check}: {c.result}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">
        Recomputed server-side for <span className="font-mono">{v.run_id}</span>.{" "}
        <a href={`/api/level4/verify?run_id=${encodeURIComponent(v.run_id)}`} className="underline">Raw JSON</a>
      </p>
    </section>
  );
}
