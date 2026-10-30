"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { loadExperienceServer } from "@/lib/level4/experience-client";
import CopyLookbackPath from "@/components/CopyLookbackPath";
import { cycleRoleFilter, lookbackKey, moveLookbackFocus, toggleRoleFilter, lookbackSummaryJson, lookbackSummary, pathStepsJson, pathStepsDetail, sparklinePoints, stepGains, lookbackComparePack, filterLookbackRows, type LookbackRoleFilter, lookbackRowRole, lookbackPathJson, sortLookbackRows, type LookbackSort, fmtDeltaPhi, lookbackRowEmphasis, lookbackVerdict, rankedLookbackRows, scoreSealedPaths, type LookbackCompare } from "@/lib/level4/roe-lookback";

/** Read-only ROE look-back note. GET /api/level4/experience only; nothing is written. */
export default function RoeLookbackNote() {
  const [c, setC] = useState<LookbackCompare | null>(null);
  const copy = useCopy(4000, undefined, "roe look-back");
  const copyCmp = useCopy(4000, undefined, "roe compare pack");
  const copySum = useCopy(3000, undefined, "roe look-back summary");
  const [sortBy, setSortBy] = useState<LookbackSort>("rank");
  const [open, setOpen] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<LookbackRoleFilter>("all");
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const visibleRef = useRef<string[]>([]);
  const focusRef = useRef<string | null>(null);
  const jsonRef = useRef<Record<string, string>>({});
  const stepsRef = useRef<Record<string, string>>({});
  const [keyCopied, setKeyCopied] = useState<string | null>(null);
  focusRef.current = focusRow;
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      const k = lookbackKey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, targetTag: el?.tagName, editable: el?.isContentEditable });
      if (k === "filter") { ev.preventDefault(); setRoleFilter(cycleRoleFilter); return; }
      if (!k || !visibleRef.current.length) return;
      if (k === "compare" || k === "summary") { const b = document.querySelector<HTMLButtonElement>(k === "summary" ? "[data-copy-roe-summary]" : "[data-copy-roe-compare]"); if (!b || b.disabled) return; ev.preventDefault(); b.scrollIntoView({ block: "nearest" }); b.click(); return; }
      if (k === "next" || k === "prev") {
        ev.preventDefault();
        const id = moveLookbackFocus(visibleRef.current, focusRef.current, k);
        setFocusRow(id);
        if (id) document.querySelector(`[data-roe-lookback-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (k === "toggle" && focusRef.current) { ev.preventDefault(); const id = focusRef.current; setOpen((o) => (o === id ? null : id)); }
      else if (k === "close") setOpen(null);
      else if ((k === "copy" || k === "steps") && focusRef.current) {
        const id = focusRef.current; const j = (k === "steps" ? stepsRef.current : jsonRef.current)[id]; if (!j) return;
        ev.preventDefault();
        if (k === "steps") setOpen(id);
        const label = k === "steps" ? `${id} steps` : id;
        void navigator.clipboard?.writeText(j).then(() => { setKeyCopied(label); window.setTimeout(() => setKeyCopied((x) => (x === label ? null : x)), 1600); }, () => {});
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
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
          <div className="flex items-center gap-2 text-xs" data-roe-lookback-sort={sortBy}>
            <span className="text-zinc-500">Sort:</span><span className="text-zinc-600">(click a row for its actions · keys j/k move, Enter expand, Esc close, c copy path JSON, s copy steps JSON, m copy ⚖ compare pack, g copy summary JSON, f cycle Show)</span>{keyCopied ? <span data-roe-lookback-key-copied className="text-emerald-300">Copied {keyCopied} ✓</span> : null}
            {(["rank", "dphi"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)}
                className={`rounded-full border px-2 py-0.5 ${sortBy === k ? "border-emerald-400 text-emerald-200" : "border-zinc-600 text-zinc-400"}`}>
                {k === "rank" ? "Look-back rank" : "ΔΦ vs greedy ↓"}
              </button>
            ))}
          </div>
          {(() => { const m = lookbackSummary(c); return (
            <div data-roe-lookback-summary-strip={m.tone} className={`sticky top-0 z-20 -mx-4 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs backdrop-blur border-y ${m.tone === "win" ? "bg-emerald-950/90 border-emerald-400 text-emerald-100" : m.tone === "agree" ? "bg-sky-950/90 border-sky-500 text-sky-100" : "bg-zinc-950/90 border-zinc-700 text-zinc-300"}`}>
              <span className={`rounded-full px-2 py-0.5 font-bold ${m.tone === "win" ? "bg-amber-400 text-black" : m.tone === "agree" ? "bg-sky-400 text-black" : "bg-zinc-700"}`}>{m.verdict}</span>
              <span>+Δe <b>{m.delta_e_gain}</b></span>
              <span>ΔΦ <b>{fmtDeltaPhi(m.delta_phi)}</b></span>
              <span className="inline-flex flex-wrap items-center gap-1">
                <button type="button" data-roe-summary-role="all" aria-pressed={roleFilter === "all"} onClick={() => setRoleFilter("all")} className={`rounded px-1 ${roleFilter === "all" ? "bg-white/20" : "hover:bg-white/10"}`}>{m.paths} paths</button>·
                {([["winners", `★ ${m.winners}`], ["beaten", `beaten ${m.beaten}`], ["agree", `= ${m.agree}`]] as const).map(([k, t]) => (
                  <button key={k} type="button" data-roe-summary-role={k} aria-pressed={roleFilter === k} title={`Show only ${k} (click again for all)`} onClick={() => setRoleFilter((f) => toggleRoleFilter(f, k))}
                    className={`rounded px-1 underline decoration-dotted ${roleFilter === k ? "bg-white/25 font-bold no-underline" : "hover:bg-white/10"}`}>{t}</button>
                ))}
                {m.excluded ? <span>· {m.excluded} domain excluded</span> : null}
              </span>
              {lookbackSummaryJson(c) && (
                <button type="button" data-copy-roe-summary onClick={() => void copySum.copy(lookbackSummaryJson(c))}
                  className={`ml-auto rounded-full border px-2 py-0.5 font-semibold ${m.tone === "win" ? "border-amber-300 text-amber-100" : "border-sky-300 text-sky-100"} hover:bg-white/10${copiedRing(copySum.status)}`}>
                  {copySum.status === "copied" ? "Copied ✓" : copySum.status === "failed" ? "Copy failed" : "Copy summary JSON"}
                </button>
              )}
            </div>
          ); })()}
          {(() => {
            const all = rankedLookbackRows(c);
            const label = { all: "All", winners: "★ Winners", beaten: "Beaten", agree: "= Agree" } as const;
            return (
              <div className="flex flex-wrap items-center gap-2 text-xs" data-roe-lookback-role-filter={roleFilter}>
                <span className="text-zinc-500">Show:</span>
                {(["all", "winners", "beaten", "agree"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={roleFilter === k} data-roe-lookback-filter-pill={k} onClick={() => setRoleFilter(k)}
                    className={`rounded-full border px-2 py-0.5 ${roleFilter === k ? (k === "winners" ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : k === "beaten" ? "border-amber-400 bg-amber-500/20 text-amber-100" : k === "agree" ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-white text-white") : "border-zinc-600 text-zinc-400"}`}>
                    {label[k]} ({filterLookbackRows(all, k, c.winner).length})
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table data-roe-lookback-table className="w-full text-xs font-mono text-zinc-300">
              <thead className="text-zinc-500"><tr><th className="text-left pr-2">#</th><th className="text-left pr-2">run_id</th><th className="text-left pr-2" title="e from e0 to e_final; bars = per-step gain I_t">e path</th><th className="text-right pr-2">steps</th><th className="text-right pr-2">best I_t</th><th className="text-right pr-2">Σ Δe</th><th className="text-right pr-2">Φ</th><th className="text-right pr-2" title="final Φ minus the greedy path's final Φ">ΔΦ vs greedy</th><th className="text-left">pick</th><th className="text-left">path</th></tr></thead>
              <tbody>
                {(() => { const vis = sortLookbackRows(filterLookbackRows(rankedLookbackRows(c), roleFilter, c.winner), sortBy); visibleRef.current = vis.map((x) => x.run_id); jsonRef.current = Object.fromEntries(vis.map((x) => [x.run_id, lookbackPathJson(x, c.winner)])); stepsRef.current = Object.fromEntries(vis.map((x) => [x.run_id, pathStepsJson(x)])); return vis; })().map((r) => (
                  <Fragment key={r.run_id}>
                  <tr onClick={() => { setFocusRow(r.run_id); setOpen((o) => (o === r.run_id ? null : r.run_id)); }} data-roe-lookback-focus={focusRow === r.run_id ? "true" : undefined} aria-expanded={open === r.run_id} title="Click to show the full action list" style={{ cursor: "pointer" }} data-roe-lookback-row={r.run_id} data-roe-lookback-emphasis={lookbackRowEmphasis(r.rank, c.winner)} data-roe-lookback-role={lookbackRowRole(r, c.winner)}
                    className={`${{ top_win: "bg-emerald-500/30 text-emerald-50 font-semibold outline outline-2 outline-amber-400", top_agree: "bg-emerald-500/10 text-emerald-200", plain: r.is_lookback ? "text-emerald-200" : "" }[lookbackRowEmphasis(r.rank, c.winner)]} ${{ winner_lookback: "border-l-4 border-emerald-400", agree_both: "border-l-4 border-sky-400", greedy_beaten: "border-l-4 border-amber-400 bg-amber-500/10", other: "" }[lookbackRowRole(r, c.winner)]} ${focusRow === r.run_id ? "ring-2 ring-sky-300 ring-inset" : ""}`}>
                    <td className="pr-2 whitespace-nowrap">{r.rank === 1 && <span data-roe-lookback-top className="mr-1 rounded bg-amber-400 text-black px-1.5 text-[10px] font-bold">TOP</span>}{r.rank}</td><td className="pr-2 break-all">{r.run_id}</td><td className="pr-2" data-roe-lookback-spark={r.run_id}>{(() => {
                      const pts = sparklinePoints(r.e_series, 64, 16);
                      const g = stepGains(r.e_series); const gmax = Math.max(...g, 1e-9);
                      return pts ? (
                        <svg width="64" height="24" viewBox="0 0 64 24" aria-label={`e path ${(r.e_series ?? []).join(" → ")}`} className="overflow-visible">
                          <polyline points={pts} fill="none" stroke={r.is_lookback ? "#34d399" : r.is_greedy ? "#fbbf24" : "#a1a1aa"} strokeWidth="1.5" />
                          {g.map((x, i) => { const bw = 64 / g.length; const bh = (x / gmax) * 6; return <rect key={i} x={i * bw + 1} y={24 - bh} width={Math.max(1, bw - 2)} height={bh} fill={x === r.max_step_i ? "#fbbf24" : "#52525b"} />; })}
                        </svg>
                      ) : <span className="text-zinc-600">—</span>;
                    })()}</td><td className="text-right pr-2">{r.steps}</td>
                    <td className="text-right pr-2">{r.max_step_i}</td><td className="text-right pr-2">{r.cumulative_delta_e}</td><td className="text-right pr-2">{r.final_phi ?? "n/a"}</td>
                    <td data-roe-lookback-dphi className={`text-right pr-2 ${(r.delta_phi_vs_greedy ?? 0) > 0 ? "text-emerald-300 font-semibold" : (r.delta_phi_vs_greedy ?? 0) < 0 ? "text-amber-300" : "text-zinc-500"}`}>{r.is_greedy ? "—" : fmtDeltaPhi(r.delta_phi_vs_greedy)}</td>
                    <td className="space-x-1 whitespace-nowrap">
                      {r.is_lookback && <span className="rounded bg-emerald-500 text-black px-1.5 text-[10px] font-semibold">look-back</span>}
                      {r.is_greedy && <span className="rounded bg-amber-400 text-black px-1.5 text-[10px] font-semibold">greedy</span>}
                      {lookbackRowRole(r, c.winner) === "winner_lookback" && <span data-roe-lookback-badge="winner" className="rounded bg-emerald-300 text-black px-1.5 text-[10px] font-bold">★ WINNER +Δe {c.delta_e_gain}</span>}
                      {lookbackRowRole(r, c.winner) === "agree_both" && <span data-roe-lookback-badge="agree" className="rounded border border-sky-400 text-sky-200 px-1.5 text-[10px] font-semibold">= both agree</span>}
                      {lookbackRowRole(r, c.winner) === "greedy_beaten" && <span data-roe-lookback-badge="beaten" className="rounded border border-amber-400 text-amber-200 px-1.5 text-[10px] font-semibold">beaten by look-back</span>}
                    </td>
                    <td><span onClick={(ev) => ev.stopPropagation()}><CopyLookbackPath runId={r.run_id} json={lookbackPathJson(r, c.winner)} /></span></td>
                  </tr>
                  {open === r.run_id && (
                    <tr data-roe-lookback-detail={r.run_id} className="bg-zinc-900/70">
                      <td colSpan={11} className="px-2 py-2">
                        <ol className="space-y-0.5 text-[11px]">
                          {pathStepsDetail(r).map((d) => (
                            <li key={d.step} className={d.best ? "text-amber-200 font-semibold" : "text-zinc-300"}>
                              {d.step}. <span className="text-white">{d.action}</span> · e {d.e_before ?? "?"} → {d.e_after ?? "?"} · I_t {d.gain ?? "n/a"}{d.best ? " ★ best step" : ""}
                            </li>
                          ))}
                        </ol>
                        <div className="mt-1" onClick={(ev) => ev.stopPropagation()}><CopyLookbackPath kind="steps" runId={r.run_id} json={pathStepsJson(r)} /></div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {c.excluded_domain_entries > 0 && <p className="text-xs text-zinc-500">{c.excluded_domain_entries} domain-labeled entries excluded.</p>}
        </>
      )}
      {c && lookbackComparePack(c) && (
        <button type="button" data-copy-roe-compare data-winner={c.winner} onClick={() => void copyCmp.copy(lookbackComparePack(c))}
          className={`mr-2 inline-flex h-9 items-center rounded-full px-4 text-xs font-bold ${c.winner === "lookback" ? "bg-emerald-400 text-black border-2 border-amber-300 shadow-lg shadow-emerald-500/30" : "border-2 border-sky-400 text-sky-100"}${copiedRing(copyCmp.status)}`}>
          {copyCmp.status === "copied" ? "Copied ✓" : copyCmp.status === "failed" ? "Copy failed" : c.winner === "lookback" ? `⚖ Copy compare pack · look-back +Δe ${c.delta_e_gain}` : "⚖ Copy compare pack · agree"}
        </button>
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
