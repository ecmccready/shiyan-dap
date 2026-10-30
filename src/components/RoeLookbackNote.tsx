"use client";

import { useEffect, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { loadExperienceServer } from "@/lib/level4/experience-client";
import { fmtDeltaPhi, lookbackRowEmphasis, lookbackVerdict, rankedLookbackRows, scoreSealedPaths, type LookbackCompare } from "@/lib/level4/roe-lookback";

/** Read-only ROE look-back note. GET /api/level4/experience only; nothing is written. */
export default function RoeLookbackNote() {
  const [c, setC] = useState<LookbackCompare | null>(null);
  const copy = useCopy(4000, undefined, "roe look-back");
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
          <div className="overflow-x-auto">
            <table data-roe-lookback-table className="w-full text-xs font-mono text-zinc-300">
              <thead className="text-zinc-500"><tr><th className="text-left pr-2">#</th><th className="text-left pr-2">run_id</th><th className="text-right pr-2">steps</th><th className="text-right pr-2">best I_t</th><th className="text-right pr-2">Σ Δe</th><th className="text-right pr-2">Φ</th><th className="text-right pr-2" title="final Φ minus the greedy path's final Φ">ΔΦ vs greedy</th><th className="text-left">pick</th></tr></thead>
              <tbody>
                {rankedLookbackRows(c).map((r) => (
                  <tr key={r.run_id} data-roe-lookback-row={r.run_id} data-roe-lookback-emphasis={lookbackRowEmphasis(r.rank, c.winner)}
                    className={{ top_win: "bg-emerald-500/30 text-emerald-50 font-semibold outline outline-2 outline-amber-400", top_agree: "bg-emerald-500/10 text-emerald-200", plain: r.is_lookback ? "text-emerald-200" : "" }[lookbackRowEmphasis(r.rank, c.winner)]}>
                    <td className="pr-2 whitespace-nowrap">{r.rank === 1 && <span data-roe-lookback-top className="mr-1 rounded bg-amber-400 text-black px-1.5 text-[10px] font-bold">TOP</span>}{r.rank}</td><td className="pr-2 break-all">{r.run_id}</td><td className="text-right pr-2">{r.steps}</td>
                    <td className="text-right pr-2">{r.max_step_i}</td><td className="text-right pr-2">{r.cumulative_delta_e}</td><td className="text-right pr-2">{r.final_phi ?? "n/a"}</td>
                    <td data-roe-lookback-dphi className={`text-right pr-2 ${(r.delta_phi_vs_greedy ?? 0) > 0 ? "text-emerald-300 font-semibold" : (r.delta_phi_vs_greedy ?? 0) < 0 ? "text-amber-300" : "text-zinc-500"}`}>{r.is_greedy ? "—" : fmtDeltaPhi(r.delta_phi_vs_greedy)}</td>
                    <td className="space-x-1 whitespace-nowrap">
                      {r.is_lookback && <span className="rounded bg-emerald-500 text-black px-1.5 text-[10px] font-semibold">look-back</span>}
                      {r.is_greedy && <span className="rounded bg-amber-400 text-black px-1.5 text-[10px] font-semibold">greedy</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.excluded_domain_entries > 0 && <p className="text-xs text-zinc-500">{c.excluded_domain_entries} domain-labeled entries excluded.</p>}
        </>
      )}
      {c && (
        <button type="button" data-copy-roe-lookback onClick={() => void copy.copy(JSON.stringify(c, null, 2))}
          className={`inline-flex h-8 items-center rounded-full border border-zinc-600 px-3 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}>
          {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : "Copy look-back JSON"}
        </button>
      )}
      <p className="text-xs text-zinc-500">{c?.note ?? "Inspect-only."}</p>
    </section>
  );
}
