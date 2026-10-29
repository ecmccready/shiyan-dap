import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CopyMedicareJson from "@/components/CopyMedicareJson";
import MedicareReviewProgress from "@/components/MedicareReviewProgress";
import { reviewProgress } from "@/lib/medicare/investigation";
import MedicareDispositionStub from "@/components/MedicareDispositionStub";
import { MEDICARE_CASE, formatInvestigationCaseBrief, buildWinSummary, medicareAnchorId } from "@/lib/medicare/case-brief";

/** Top-ranked payment_vs_charge candidate on the synthetic fixture (row index and evidence item id), for anchors. */
const TOP_ROW: number | null = FIXTURE_BASELINES.rules[0]?.candidates[0]?.row_index ?? null;
const TOP_ITEM = TOP_ROW === null ? "" : `rule:${FIXTURE_BASELINES.rules[0].rule_id}:${TOP_ROW}`;
import { FIXTURE_PROVENANCE, FIXTURE_DQ, FIXTURE_BASELINES, FIXTURE_EVIDENCE, FIXTURE_INVESTIGATION, MEDICARE_FIXTURE } from "@/lib/medicare/fixture";

/**
 * Medicare · Public Data Intelligence (skeleton). First named vertical under Global · misdiagnosis.
 * Static, read-only page (the Know panel is computed at build time from the committed synthetic fixture): no CMS fetch, no ingest, no store access, no writes, and no change to the Level 4 loop,
 * ROE, MCP or the Safety plant. Reuse the engine, isolate the domain rules.
 */

const GUARDRAIL =
  "Detected pattern ≠ verified conclusion. This surface does not claim clinical misdiagnosis, fraud, or misconduct. Findings are investigation inputs for human review.";

const STAGES = [
  {
    id: "know",
    group: "Know",
    title: "Recognize",
    status: "Partly built: provenance and one data-quality check (synthetic fixture).",
    lines: [
      "Ingest an explicitly selected CMS public dataset (claims PUFs, provider utilization).",
      "Validate the schema and preserve provenance: source, release, retrieval time, content hash.",
      "Detect missing and inconsistent values before any analysis.",
    ],
  },
  {
    id: "know-how",
    group: "Know How",
    title: "Relate and assimilate",
    status: "Partly built: one documented rule (payment_vs_charge.v1) with ranked candidates (synthetic fixture).",
    lines: [
      "Compare against documented rules and deterministic baselines.",
      "Relate each candidate to related evidence; rank potential anomalies.",
      "Runs on the shared closed loop and ROE; Medicare rules stay in their own domain module.",
    ],
  },
  {
    id: "show",
    group: "Show",
    title: "Distributed proof",
    status: "Partly built: evidence pack linking each item to the source hash, row hash and check (synthetic fixture).",
    lines: [
      "Link each finding to its source records, transformation version and calculation.",
      "State the uncertainty and the review status next to every finding.",
      "Start with reproducible records and content hashes; signatures only where a real trust need exists.",
    ],
  },
  {
    id: "do",
    group: "Do",
    title: "Authorized action",
    status: "Partly built: investigation report with a review disposition stub (synthetic fixture).",
    lines: [
      "Generate an investigation report from source-linked findings.",
      "Route it to a qualified human reviewer and record the disposition.",
      "Open a pilot (below) on one dataset and one anomaly class.",
    ],
  },
];

const PILOT_MEASURES = ["Review time per finding", "Precision", "False positives", "Reproducibility across runs"];

export default function MedicarePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Medicare · Public Data Intelligence" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Global · misdiagnosis · first vertical</p>
        <h1 className="text-3xl font-bold">Medicare · Public Data Intelligence</h1>
        <p className="text-zinc-400 max-w-2xl">
          The first named vertical under <Link className="underline" href="/workbench/global">Global · misdiagnosis</Link>: SI
          (Super Intelligence)-operated investigation of public Medicare data, where misdiagnosis means a wrong next action in the
          investigation. It reuses the shared engine and isolates the Medicare domain rules. This page is a skeleton: no data is
          ingested or fetched yet.
        </p>

        <section data-medicare-guardrail className="border border-amber-500/60 bg-zinc-950 rounded-2xl p-5">
          <p className="text-amber-300 text-xs uppercase tracking-widest mb-2">Guardrail</p>
          <p className="text-amber-200 text-base font-medium">{GUARDRAIL}</p>
        </section>

        {(() => {
          const w = buildWinSummary(FIXTURE_INVESTIGATION, FIXTURE_EVIDENCE, FIXTURE_BASELINES.rules[0]?.candidates[0]);
          return (
            <section id="medicare-win" data-medicare-win-strip className="scroll-mt-24 border-2 border-emerald-500/70 bg-emerald-950/30 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {w.hand_off_ready && <span data-medicare-handoff-badge className="rounded-full bg-emerald-500 text-black text-xs font-semibold px-3 py-1">Reviewer hand-off ready</span>}
                <span className="text-xs text-zinc-400">medicare · synthetic fixture</span>
              </div>
              <p className="text-white text-lg font-semibold" data-medicare-win-line>{w.line}</p>
              <MedicareReviewProgress initial={reviewProgress(FIXTURE_INVESTIGATION)} />
              {w.top && (
                <p className="text-sm text-zinc-200" data-medicare-top-candidate>
                  Top candidate <span className="font-mono">{w.top.provider_id}</span>: Medicare paid <span className="text-emerald-300 font-semibold">${w.top.payment}</span> against a submitted charge of <span className="font-semibold">${w.top.charge}</span> (+${w.top.excess}, ratio {w.top.ratio}). Rule payment_vs_charge.v1; a pattern for review, not a finding of wrongdoing.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <CopyMedicareJson kind="brief" label="Copy case brief" json={formatInvestigationCaseBrief(FIXTURE_INVESTIGATION, FIXTURE_EVIDENCE, FIXTURE_PROVENANCE)} />
                {w.top && TOP_ROW !== null && (
                  <span className="flex flex-wrap gap-3 text-xs">
                    <a data-medicare-jump-top href={`#${medicareAnchorId("candidate", TOP_ROW)}`} className="text-emerald-300 underline">Jump to top candidate ↓</a>
                    <a href={`#${medicareAnchorId("evidence", TOP_ITEM)}`} className="text-zinc-300 underline">Evidence item</a>
                    <a href={`#${medicareAnchorId("disposition", TOP_ITEM)}`} className="text-zinc-300 underline">Set disposition</a>
                  </span>
                )}
              </div>
            </section>
          );
        })()}

        <section data-medicare-know-panel className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          <p className="text-emerald-400 text-xs uppercase tracking-widest">Know · provenance and data quality (synthetic fixture)</p>
          <p className="text-xs text-amber-300">{MEDICARE_FIXTURE.note}</p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs font-mono text-zinc-300" data-medicare-provenance>
            <dt className="text-zinc-500">schema</dt><dd>{FIXTURE_PROVENANCE.schema_version}</dd>
            <dt className="text-zinc-500">source</dt><dd>{FIXTURE_PROVENANCE.source_name} ({FIXTURE_PROVENANCE.source_id})</dd>
            <dt className="text-zinc-500">release</dt><dd>{FIXTURE_PROVENANCE.release_id}</dd>
            <dt className="text-zinc-500">retrieved</dt><dd>{FIXTURE_PROVENANCE.retrieved_at}</dd>
            <dt className="text-zinc-500">content sha256</dt><dd className="break-all">{FIXTURE_PROVENANCE.content_hash}</dd>
            <dt className="text-zinc-500">domain</dt><dd>{FIXTURE_PROVENANCE.domain_label}</dd>
          </dl>
          <div data-medicare-dq>
            <p className="text-zinc-300">
              Data-quality check <code>{FIXTURE_DQ.check_id}</code>: {FIXTURE_DQ.rows_checked} rows checked, {FIXTURE_DQ.rows_with_issues} with issues.
            </p>
            <ul className="text-xs text-zinc-400 list-disc pl-5 font-mono">
              {FIXTURE_DQ.findings.map((f) => (
                <li key={`${f.row_index}-${f.field}`}>row {f.row_index} · {f.field ?? "row"} · {f.issue}</li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500 mt-1">Data-quality patterns for human review, not findings of fraud or misconduct. Hash is sha256 of the canonical JSON of the rows.</p>
          </div>
        </section>

        <section data-medicare-knowhow-panel className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          <p className="text-emerald-400 text-xs uppercase tracking-widest">Know How · documented rules (synthetic fixture)</p>
          <p className="text-xs font-mono text-zinc-500">{FIXTURE_BASELINES.schema_version} · domain {FIXTURE_BASELINES.domain_label}</p>
          {FIXTURE_BASELINES.rules.map((r) => (
            <div key={r.rule_id} data-medicare-rule={r.rule_id}>
              <p className="text-zinc-300">
                Rule <code>{r.rule_id}</code>: {r.description}. {r.rows_evaluated} rows evaluated, {r.rows_skipped} skipped (missing or
                invalid amounts, already reported by the data-quality check), {r.candidates.length} candidate{r.candidates.length === 1 ? "" : "s"}.
              </p>
              <ul className="text-xs text-zinc-400 list-disc pl-5 font-mono">
                {r.candidates.map((c) => (
                  <li key={c.row_index} id={medicareAnchorId("candidate", c.row_index)} data-medicare-candidate-row={c.row_index}
                    className={c.row_index === TOP_ROW ? "scroll-mt-24 -mx-2 px-2 py-1 rounded bg-emerald-500/15 border-l-4 border-emerald-400 text-emerald-100" : "scroll-mt-24"}>
                    {c.row_index === TOP_ROW && <span className="mr-2 rounded bg-emerald-500 text-black px-1.5 text-[10px] font-semibold">TOP</span>}row {c.row_index} · {c.provider_id ?? "—"} · payment {c.payment} &gt; charge {c.charge} · ratio {c.ratio ?? "—"}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-zinc-500">Ranked by payment / charge, highest first. A candidate is a pattern for human review, not a finding of fraud or misconduct.</p>
        </section>

        <section data-medicare-show-panel className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          <p className="text-emerald-400 text-xs uppercase tracking-widest">Show · evidence pack (synthetic fixture)</p>
          <p className="text-xs font-mono text-zinc-500">
            {FIXTURE_EVIDENCE.schema_version} · domain {FIXTURE_EVIDENCE.domain_label} · {FIXTURE_EVIDENCE.counts.items} items
            ({FIXTURE_EVIDENCE.counts.data_quality} data quality, {FIXTURE_EVIDENCE.counts.rule_candidates} rule) · {FIXTURE_EVIDENCE.counts.unreviewed} unreviewed
          </p>
          <p className="text-xs font-mono text-zinc-400 break-all" data-medicare-pack-hash>pack sha256 {FIXTURE_EVIDENCE.pack_hash}</p>
          <p className="text-xs font-mono text-zinc-500">transformations: {FIXTURE_EVIDENCE.transformations.map((t) => `${t.id} (${t.schema})`).join(", ")}</p>
          <ul className="space-y-2">
            {FIXTURE_EVIDENCE.items.map((it) => (
              <li key={it.item_id} id={medicareAnchorId("evidence", it.item_id)} className={`scroll-mt-24 border rounded-xl p-3 text-xs ${it.item_id === TOP_ITEM ? "border-emerald-400 bg-emerald-500/10" : "border-zinc-800"}`} data-medicare-evidence-item={it.item_id}>
                <p className="text-zinc-200 font-mono">{it.item_id}</p>
                <p className="text-zinc-400">{it.provider_id ?? "—"} · {it.detail} · {it.review_status}</p>
                <p className="text-zinc-500 font-mono break-all">row sha256 {it.row_hash ?? "—"}</p>
                <p className="text-zinc-500">{it.uncertainty}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">{FIXTURE_EVIDENCE.uncertainty_note} Each item links to dataset hash {FIXTURE_EVIDENCE.source.content_hash.slice(0, 16)}…; patterns for review, not conclusions.</p>
        </section>

        <section data-medicare-case-brief className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          <h2 className="text-white font-semibold">Case brief · {MEDICARE_CASE.case_id}</h2>
          <p className="text-zinc-300"><span className="text-zinc-500">Dataset:</span> {MEDICARE_CASE.dataset}</p>
          <p className="text-xs text-zinc-500">{MEDICARE_CASE.dataset_note}</p>
          <p className="text-zinc-300"><span className="text-zinc-500">Anomaly class:</span> {MEDICARE_CASE.anomaly_class}</p>
          <div><p className="text-zinc-500 text-xs">Why this case</p><ul className="list-disc pl-5 text-zinc-300">{MEDICARE_CASE.why.map((w) => <li key={w}>{w}</li>)}</ul></div>
          <div><p className="text-zinc-500 text-xs">Human-in-the-loop flow</p><ol className="list-decimal pl-5 text-zinc-300">{MEDICARE_CASE.hitl.map((w) => <li key={w}>{w}</li>)}</ol></div>
          <div data-medicare-pilot-metrics><p className="text-zinc-500 text-xs">Pilot metrics ({MEDICARE_CASE.metrics_note})</p><ul className="list-disc pl-5 text-zinc-300">{MEDICARE_CASE.metrics.map((w) => <li key={w}>{w}</li>)}</ul></div>
          <p className="text-xs text-amber-300">{MEDICARE_CASE.guardrail}</p>
        </section>

        <section data-medicare-do-panel className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          <h2 className="text-white font-semibold">Do · investigation report (synthetic fixture)</h2>
          <p className="text-zinc-400">
            {FIXTURE_INVESTIGATION.schema_version} · domain {FIXTURE_INVESTIGATION.domain_label} · {FIXTURE_INVESTIGATION.counts.items} items ·
            {" "}{FIXTURE_INVESTIGATION.counts.unreviewed} unreviewed, {FIXTURE_INVESTIGATION.counts.needs_human_review} needs_human_review, {FIXTURE_INVESTIGATION.counts.cleared_pattern_only} cleared_pattern_only
          </p>
          <p className="text-xs font-mono text-zinc-400 break-all" data-medicare-report-hash>
            evidence pack {FIXTURE_INVESTIGATION.evidence.pack_hash?.slice(0, 16)}… ({FIXTURE_INVESTIGATION.evidence.pack_verified ? "verified" : "not verified"}) · report sha256 {FIXTURE_INVESTIGATION.report_hash}
          </p>
          <p className="text-xs font-mono text-zinc-500">allowed statuses: {FIXTURE_INVESTIGATION.allowed_statuses.join(" | ")}</p>
          <ul className="space-y-1 text-xs font-mono text-zinc-300">
            {FIXTURE_INVESTIGATION.entries.map((e) => (
              <li key={e.item_id}>{e.item_id} · {e.status}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2" data-medicare-copy-row>
            <CopyMedicareJson kind="investigation" label="Copy investigation JSON" json={JSON.stringify(FIXTURE_INVESTIGATION, null, 2)} />
            <CopyMedicareJson kind="evidence" label="Copy evidence pack JSON" json={JSON.stringify(FIXTURE_EVIDENCE, null, 2)} />
            <CopyMedicareJson kind="brief" label="Copy case brief" json={formatInvestigationCaseBrief(FIXTURE_INVESTIGATION, FIXTURE_EVIDENCE, FIXTURE_PROVENANCE)} />
          </div>
          <MedicareDispositionStub pack={FIXTURE_EVIDENCE} highlight={TOP_ITEM} />
          <p className="text-xs text-zinc-500">{FIXTURE_INVESTIGATION.scope_note} No reviewer has filled this in; nothing is stored or sent.</p>
        </section>

        <section aria-label="Four-stage graph" className="grid gap-4 sm:grid-cols-2">
          {STAGES.map((s) => (
            <div key={s.id} data-medicare-stage={s.id} className="border border-zinc-800 rounded-2xl p-5 text-sm">
              <p className="text-emerald-400 text-xs uppercase tracking-widest">{s.group}</p>
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                {s.lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
              <p className="text-xs text-zinc-500 mt-2" data-medicare-stage-status>{s.status}</p>
            </div>
          ))}
        </section>

        <section data-medicare-pilot className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p className="text-emerald-400 text-xs">Pilot proposition (stub)</p>
          <p className="text-zinc-300">
            One CMS public dataset and one anomaly class. Baseline with deterministic checks, produce source-linked findings, and have a
            qualified reviewer dispose of each one. Then show whether subsequent runs are more effective.
          </p>
          <ul className="text-zinc-400 list-disc pl-5">
            {PILOT_MEASURES.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <p className="text-xs text-zinc-500">Display only: there is no metrics backend and nothing is measured yet.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400">
          <p className="text-emerald-400 text-xs mb-2">Experience isolation</p>
          <p>
            Experience reuse will stay domain-gated: a Medicare run may only reuse experience eligible for the Medicare context, and
            Medicare work must not contaminate Safety plant experience or change the Safety plant&apos;s behavior.
          </p>
        </section>

        <section data-medicare-related className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p className="text-emerald-400 text-xs">Related surfaces (read-only links)</p>
          <ul className="text-zinc-300 list-disc pl-5 space-y-1">
            <li><Link className="underline" href="/workbench/global">Global · misdiagnosis</Link>: the macro view this vertical sits under.</li>
            <li><Link className="underline" href="/workbench/diagnostic">Diagnostics</Link>: the diagnostic plant.</li>
            <li><Link className="underline" href="/workbench/safety">Safety</Link>: the Safety proof plant (unchanged by this vertical).</li>
            <li><Link className="underline" href="/workbench/pilot">Pilot</Link>: the paid-pilot gate.</li>
            <li><Link className="underline" href="/workbench/offer">Offer</Link>: the workbench offer.</li>
          </ul>
        </section>
        {FIXTURE_INVESTIGATION.evidence.pack_verified && FIXTURE_EVIDENCE.counts.items > 0 && (
          <a href="#medicare-win" data-medicare-handoff-chip className="fixed bottom-4 right-4 z-40 rounded-full bg-emerald-500 text-black text-xs font-semibold px-4 py-2 shadow-lg hover:bg-emerald-400">
            Hand-off ready · {FIXTURE_EVIDENCE.counts.items} items ↑
          </a>
        )}
      </main>
    </div>
  );
}
