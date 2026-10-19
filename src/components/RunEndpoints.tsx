"use client";

import { useEffect, useState } from "react";
import { loadExperienceServer, latestVerified } from "@/lib/level4/experience-client";

/**
 * Links to GET /api/level4/verify and /api/level4/anchor for the latest run
 * (latest eligible entry preferred). Hidden when no experience is recorded.
 * variant="section" renders a titled section; "inline" renders compact links.
 */
export default function RunEndpoints({ variant = "section" }: { variant?: "section" | "inline" }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadExperienceServer().then((list) => {
      setRunId(latestVerified(list)?.run_id ?? null);
      setLoaded(true);
    });
  }, []);

  if (!loaded || !runId) return null;
  const q = encodeURIComponent(runId);
  const verify = `/api/level4/verify?run_id=${q}`;
  const anchor = `/api/level4/anchor?run_id=${q}`;
  const ledger = `/api/level4/experience?format=ledger&run_id=${q}`;
  const exportJson = `/api/level4/experience?run_id=${q}`;

  if (variant === "inline") {
    return (
      <p className="text-sm space-x-4">
        <a href={verify} className="underline text-emerald-400">Verify this run →</a>
        <a href={anchor} className="underline text-emerald-400">Anchor this run →</a>
        <a href={ledger} download={`ledger-${runId}.json`} className="underline text-emerald-400">Download ledger ↓</a>
        <a href={exportJson} download={`evidence-${runId}.json`} className="underline text-emerald-400">Export evidence (JSON) ↓</a>
      </p>
    );
  }
  return (
    <section className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2">
      <p className="font-medium">Independent verification endpoints</p>
      <p className="text-zinc-400">
        Latest run <span className="font-mono text-xs break-all">{runId}</span>. Both are read-only GET endpoints.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><a href={verify} className="underline font-mono text-xs break-all">GET {verify}</a></li>
        <li><a href={anchor} className="underline font-mono text-xs break-all">GET {anchor}</a></li>
        <li><a href={ledger} download={`ledger-${runId}.json`} className="underline font-mono text-xs break-all">GET {ledger}</a> (download ledger)</li>
      </ul>
    </section>
  );
}
