"use client";

import EconomicBenefitForm from "@/components/EconomicBenefitForm";
import CopyEvidencePack from "@/components/CopyEvidencePack";
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { fmtE } from "@/lib/level4/experience-client";
import { packUrls } from "@/lib/evidence-pack";
import { useHydrated } from "@/lib/use-hydrated";
import { loadCold } from "@/lib/cold-record";

/**
 * Step 3 of the proof-to-pilot journey: one place for the evidence pack of a run.
 * Lists the measured e / Δe / Φ and the existing verify, anchor (dry run), ledger and summary links, and reuses the copy/share buttons.
 * Renders nothing without an entry.
 */
export default function EvidencePackSection({ entry }: { entry: ExperienceEntry | null }) {
  const origin = useHydrated() ? window.location.origin : "";
  if (!entry) return null;
  const cold = origin ? loadCold() : null;
  const u = packUrls(origin, entry.run_id);
  const rel = (abs: string) => abs.replace(origin, "");
  return (
    <section aria-labelledby="evidence-pack-heading" data-evidence-pack className="rounded-xl border border-zinc-800 p-4 space-y-3">
      <h2 id="evidence-pack-heading" className="text-lg font-semibold">Evidence pack</h2>
      <p className="text-xs text-zinc-500">
        Measured for run <span className="font-mono break-all">{entry.run_id}</span>: e {fmtE(entry.e)}
        {typeof entry.delta_e === "number" ? `, Δe ${fmtE(entry.delta_e)}` : ""}
        {typeof entry.phi === "number" ? `, Φ ${fmtE(entry.phi)}` : ""}
        {entry.eligible ? "" : ". This entry did not meet the goal threshold, so no Φ claim applies"}.
        The exported file also lists failed or missing values. The verify link, not the file, is the authority.
      </p>
      <CopyEvidencePack entry={entry} />
      <ul className="text-xs space-y-1">
        <li><a href={rel(u.verify)} className="underline text-emerald-400">Verify</a> · replays the checks for this run</li>
        <li><a href={rel(u.anchor)} className="underline text-emerald-400">Anchor (dry run)</a> · prepared payload, nothing submitted on-chain</li>
        <li><a href={rel(u.ledger)} className="underline text-emerald-400">Ledger</a> · this run&apos;s ledger lines</li>
        <li><a href={rel(u.assetMap)} className="underline text-emerald-400">Asset map</a> and <a href={rel(u.auditSummary)} className="underline text-emerald-400">audit summary</a> · off-chain micro-ledger views; the audit scan is a heuristic mock, not a third-party attestation</li>
      </ul>
      <p data-mcp-cold-note className="text-xs text-zinc-500">
        {cold
          ? <>MCP cold comparison (B1, run in this browser, separate from this run): cold {fmtE(cold.cold_final_e)} vs sealed {fmtE(cold.sealed_final_e)}, Φ {fmtE(cold.phi)}, {cold.error_win ? "an error win vs the greedy cold run" : "not an error win"}. It is included in the exported pack and is not part of the verify link.</>
          : <>MCP cold comparison: none run in this browser, so the exported pack says so. It is available on <a href="/workbench/peer" className="underline text-emerald-400">peer</a> and <a href="/workbench/compare" className="underline text-emerald-400">compare</a> (opt-in checkbox). On B1 the sealed sequence currently does not beat the cold run (0.235 vs 0.184), so it is not a win.</>}
      </p>
      <div className="border-t border-zinc-800 pt-3"><EconomicBenefitForm runId={entry.run_id} /></div>
    </section>
  );
}
