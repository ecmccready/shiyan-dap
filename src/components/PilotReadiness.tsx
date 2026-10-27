"use client";

import { useEffect, useState } from "react";
import { loadExperienceServer, latestVerified, fmtE, type ExperienceEntry } from "@/lib/level4/experience-client";
import { useBenefit } from "@/lib/benefit-record";

type Load = { loaded: boolean; entry: ExperienceEntry | null; ledgerLine: boolean | null };

/**
 * "Ready for paid pilot?" status. Informational only: it approves nothing and charges nothing.
 * Required: an eligible Level 4 run exists, its evidence pack can be exported (the run has a measured e and its eligible ledger line loads),
 * and Φ is strictly greater than 0 (an error win; a tie or regression is not ready).
 * Optional: a self-reported benefit saved in this browser for that run.
 */
export default function PilotReadiness() {
  const [s, setS] = useState<Load>({ loaded: false, entry: null, ledgerLine: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadExperienceServer();
      let active = "";
      try { active = window.sessionStorage.getItem("aethel-active-run-id") ?? ""; } catch {}
      const mine = active ? list.filter((e) => e.run_id === active) : [];
      const entry = latestVerified(mine.length ? mine : list);
      let ledgerLine: boolean | null = null;
      if (entry?.eligible) {
        try {
          const r = await fetch(`/api/level4/experience?format=ledger&run_id=${encodeURIComponent(entry.run_id)}`, { cache: "no-store" });
          const j = r.ok ? ((await r.json()) as { ledger?: unknown }) : null;
          const lines = Array.isArray(j?.ledger) ? (j!.ledger as unknown[]) : [];
          ledgerLine = lines.some((l) => typeof l === "string" && / STATUS=ELIGIBLE_EXPERIENCE( |$)/.test(" " + l));
        } catch { ledgerLine = false; }
      }
      if (alive) setS({ loaded: true, entry, ledgerLine });
    })();
    return () => { alive = false; };
  }, []);
  const benefit = useBenefit(s.entry?.run_id);
  if (!s.loaded) return null;
  const eligible = Boolean(s.entry?.eligible);
  const exportable = eligible && typeof s.entry?.e === "number" && s.ledgerLine === true;
  const phi = typeof s.entry?.phi === "number" ? s.entry.phi : null;
  const phiPositive = phi !== null && phi > 0;
  const ready = eligible && exportable && phiPositive;
  const reason = !eligible
    ? "No eligible Level 4 run: the goal threshold has not been met."
    : !exportable
      ? "The evidence pack cannot be exported yet for this run."
      : phi === null
        ? "Φ is not recorded for this run, so no error win can be claimed."
        : "No error win: Φ ≤ 0 (a tie or regression, no charge).";
  const hasBenefit = Boolean(benefit && (benefit.amount || benefit.note));
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  return (
    <section data-pilot-readiness aria-labelledby="pilot-ready-heading" className="rounded border p-4 text-sm space-y-2">
      <h2 id="pilot-ready-heading" className="font-medium">Ready for paid pilot?</h2>
      <p data-pilot-ready-status={ready ? "ready" : "not-ready"} className="font-medium">
        {ready ? "Ready to start a paid-pilot conversation." : "Not ready yet."}
      </p>
      {!ready && <p data-pilot-not-ready-reason className="text-xs">{reason}</p>}
      <ul className="space-y-1 text-xs">
        <li>{mark(eligible)} An eligible Level 4 run exists{s.entry ? <> (<span className="font-mono break-all">{s.entry.run_id}</span>, e {fmtE(s.entry.e)}{typeof s.entry.phi === "number" ? `, Φ ${fmtE(s.entry.phi)}` : ""})</> : ""}.</li>
        <li>{mark(exportable)} The evidence pack can be exported: the run has a measured e and its eligible ledger line loads.{" "}
          {s.entry && <a className="underline" href={`/workbench/result?run_id=${encodeURIComponent(s.entry.run_id)}`}>Open the result page</a>}</li>
        <li>{mark(phiPositive)} Φ &gt; 0 (strict improvement){phi !== null ? `: Φ ${fmtE(phi)}` : ": not recorded"}.</li>
        <li>{hasBenefit ? "✓" : "–"} Optional: a self-reported economic benefit is saved in this browser for this run{hasBenefit ? "" : " (not required)"}. It is not verified.</li>
      </ul>
      <p className="text-xs text-neutral-500">
        This is a checklist, not an approval. Nothing is charged or approved here; pricing is agreed per pilot with a person, and settlement follows the terms above (no charge on ties or regressions). Φ is read from the recorded run; re-check it with the verify link.
      </p>
    </section>
  );
}
