"use client";

import { useEffect, useState } from "react";
import { loadExperienceServer } from "@/lib/level4/experience-client";
import { lookbackVerdict, scoreSealedPaths, type LookbackCompare } from "@/lib/level4/roe-lookback";

/** Read-only ROE look-back note. GET /api/level4/experience only; nothing is written. */
export default function RoeLookbackNote() {
  const [c, setC] = useState<LookbackCompare | null>(null);
  useEffect(() => { let on = true; void loadExperienceServer().then((rows) => { if (on) setC(scoreSealedPaths(rows)); }); return () => { on = false; }; }, []);
  return (
    <section data-roe-lookback className="rounded-xl border border-zinc-800 p-4 text-sm space-y-1">
      <p className="text-xs uppercase tracking-widest text-zinc-500">ROE look-back (aethel.roe.lookback.v1)</p>
      {!c ? <p className="text-zinc-500">Reading sealed paths…</p> : c.paths_considered === 0 ? <p className="text-zinc-400">No sealed paths yet.</p> : (
        <>
          <p className="text-zinc-300" data-roe-lookback-summary>
            {c.paths_considered} sealed paths · greedy (best single step I_t {c.greedy?.max_step_i}) {c.greedy?.run_id}: Δe {c.greedy?.cumulative_delta_e} ·
            look-back (best cumulative Δe) {c.lookback?.run_id}: Δe {c.lookback?.cumulative_delta_e}, Φ {c.lookback?.final_phi ?? "n/a"} ·
            {" "}{c.winner === "agree" ? "both pick the same path" : `look-back gains Δe ${c.delta_e_gain}`}
          </p>
          {(() => { const v = lookbackVerdict(c); return v.tone === "win" ? (
            <div role="status" data-roe-lookback-verdict="win" className="rounded-lg border-2 border-amber-400 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              <span className="mr-2 rounded-full bg-amber-400 text-black px-2 py-0.5 text-xs font-bold">{v.label}</span>{v.detail}
            </div>
          ) : v.tone === "agree" ? (
            <p data-roe-lookback-verdict="agree" className="text-xs text-zinc-400"><span className="mr-2 rounded-full border border-zinc-600 px-2 py-0.5">{v.label}</span>{v.detail}</p>
          ) : null; })()}
          {c.excluded_domain_entries > 0 && <p className="text-xs text-zinc-500">{c.excluded_domain_entries} domain-labeled entries excluded.</p>}
        </>
      )}
      <p className="text-xs text-zinc-500">{c?.note ?? "Inspect-only."}</p>
    </section>
  );
}
