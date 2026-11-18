import SiteHeader from "@/components/SiteHeader";
import MedicarePilotChip from "@/components/MedicarePilotChip";
import EvidencePacksChip from "@/components/EvidencePacksChip";
import MedicareStatusChips from "@/components/MedicareStatusChips";
import MedicareReviewProgress from "@/components/MedicareReviewProgress";
import MedicareReviewTimer from "@/components/MedicareReviewTimer";
import MedicareDispositionStub from "@/components/MedicareDispositionStub";
import CopyMedicareJson from "@/components/CopyMedicareJson";
import CopyLiveInvestigation from "@/components/CopyLiveInvestigation";
import { MEDICARE_FIXTURE, FIXTURE_PROVENANCE, FIXTURE_DQ, FIXTURE_BASELINES, FIXTURE_EVIDENCE, FIXTURE_INVESTIGATION } from "@/lib/medicare/fixture";
import { MEDICARE_CASE, buildWinSummary, formatInvestigationCaseBrief, medicareAnchorId } from "@/lib/medicare/case-brief";
import { reviewProgress } from "@/lib/medicare/investigation";

/**
 * /workbench/medicare — Know → Show → Do over the committed SYNTHETIC Medicare-style fixture (no live CMS, no PHI).
 * Server component: every pack below is computed deterministically from the fixture import; the interactive
 * review surfaces are client components that only use the local clipboard and tab-local events. Nothing is sent.
 */
const PACK = FIXTURE_EVIDENCE;
const REPORT = FIXTURE_INVESTIGATION;
const MEDICARE_REPORT_IDS: readonly string[] = REPORT.entries.map((e) => e.item_id);
const CANDIDATES = FIXTURE_BASELINES.rules.flatMap((r) => r.candidates);
const TOP = [...CANDIDATES].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0];
const WIN = buildWinSummary(REPORT, PACK, TOP);
const json = (v: unknown) => JSON.stringify(v, null, 2);

const card = "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3";
const h2 = "text-lg font-semibold text-white";

export default function MedicarePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Medicare · Public Data Intelligence" />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6" data-medicare-page>
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Medicare · Public Data Intelligence</h1>
          <p className="text-sm text-zinc-400">{MEDICARE_CASE.dataset}</p>
          <p className="text-sm text-amber-300" data-medicare-synthetic-banner>
            SYNTHETIC fixture ({MEDICARE_FIXTURE.source_name}, release {MEDICARE_FIXTURE.release_id}). {MEDICARE_CASE.dataset_note}
          </p>
          <p className="text-sm text-zinc-300">{MEDICARE_CASE.guardrail}</p>
          <div className="flex flex-wrap gap-2"><MedicarePilotChip /><EvidencePacksChip scope="medicare" /></div>
        </header>

        <section className={card} data-medicare-win-strip>
          <h2 className={h2}>Win strip</h2>
          <p className="text-sm text-zinc-200">{WIN.line}</p>
          {WIN.top && (
            <p className="text-xs font-mono text-zinc-400">
              top: {WIN.top.provider_id ?? "n/a"} · payment {WIN.top.payment} &gt; charge {WIN.top.charge} · excess {WIN.top.excess}
              {WIN.top.ratio !== null ? ` · ratio ${WIN.top.ratio}` : ""}
            </p>
          )}
          <MedicareStatusChips initial={REPORT} />
          <div className="flex flex-wrap items-center gap-3"><MedicareReviewTimer /></div>
          <MedicareReviewProgress initial={reviewProgress(REPORT)} />
        </section>

        <section className={card} data-medicare-case>
          <h2 className={h2}>Case · {MEDICARE_CASE.case_id}</h2>
          <p className="text-sm text-zinc-300">{MEDICARE_CASE.anomaly_class}</p>
          <ul className="list-disc pl-5 text-sm text-zinc-400">{MEDICARE_CASE.why.map((w) => <li key={w}>{w}</li>)}</ul>
          <h3 className="text-sm font-semibold text-zinc-200">Human in the loop</h3>
          <ol className="list-decimal pl-5 text-sm text-zinc-400">{MEDICARE_CASE.hitl.map((w) => <li key={w}>{w}</li>)}</ol>
          <h3 className="text-sm font-semibold text-zinc-200">Pilot metrics</h3>
          <ul className="list-disc pl-5 text-sm text-zinc-400">{MEDICARE_CASE.metrics.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="text-xs text-zinc-500">{MEDICARE_CASE.metrics_note}</p>
        </section>

        <section className={card} data-medicare-know>
          <h2 className={h2}>Know · provenance, data quality, baselines</h2>
          <p className="text-xs font-mono text-zinc-400 break-all">
            {FIXTURE_PROVENANCE.source_id} · {FIXTURE_PROVENANCE.release_id} · content sha256 {FIXTURE_PROVENANCE.content_hash}
          </p>
          <p className="text-sm text-zinc-300">
            {FIXTURE_DQ.check_id}: {FIXTURE_DQ.rows_with_issues} of {FIXTURE_DQ.rows_checked} rows with issues
            {FIXTURE_DQ.findings.length > 0 && ` (${FIXTURE_DQ.findings.map((f) => `row ${f.row_index} ${f.field ?? "row"} ${f.issue}`).join("; ")})`}
          </p>
          {FIXTURE_BASELINES.rules.map((r) => (
            <div key={r.rule_id} className="space-y-1">
              <p className="text-sm text-zinc-300">{r.rule_id}: {r.candidates.length} candidate{r.candidates.length === 1 ? "" : "s"} of {r.rows_evaluated} rows evaluated ({r.rows_skipped} skipped)</p>
              <ul className="text-xs font-mono text-zinc-400">
                {r.candidates.map((c) => (
                  <li key={c.row_index} id={medicareAnchorId("candidate", c.provider_id ?? c.row_index)}>
                    row {c.row_index} · {c.provider_id ?? "n/a"} · payment {c.payment} · charge {c.charge}{c.ratio !== null ? ` · ratio ${c.ratio}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <CopyMedicareJson json={json(FIXTURE_PROVENANCE)} label="Copy provenance JSON" kind="provenance" ids={MEDICARE_REPORT_IDS} />
            <CopyMedicareJson json={json(FIXTURE_DQ)} label="Copy DQ JSON" kind="dq" ids={MEDICARE_REPORT_IDS} />
            <CopyMedicareJson json={json(FIXTURE_BASELINES)} label="Copy baselines JSON" kind="baselines" ids={MEDICARE_REPORT_IDS} />
          </div>
        </section>

        <section className={card} data-medicare-show>
          <h2 className={h2}>Show · evidence pack</h2>
          <p className="text-xs font-mono text-zinc-400 break-all">
            {PACK.schema_version} · {PACK.counts.items} items ({PACK.counts.data_quality} data quality, {PACK.counts.rule_candidates} rule candidates) · pack sha256 {PACK.pack_hash}
          </p>
          <ul className="space-y-2 text-sm">
            {PACK.items.map((it) => (
              <li key={it.item_id} id={medicareAnchorId("evidence", it.item_id)} className="rounded-lg border border-zinc-800 p-3">
                <p className="font-mono text-xs text-zinc-400">{it.item_id} · {it.kind} · row {it.row_index}{it.field ? ` · ${it.field}` : ""}</p>
                <p className="text-zinc-200">{it.detail}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">{PACK.uncertainty_note}</p>
          <div className="flex flex-wrap gap-3">
            <CopyMedicareJson json={json(PACK)} label="Copy evidence JSON" kind="evidence" ids={MEDICARE_REPORT_IDS} />
          </div>
        </section>

        <section className={card} data-medicare-do>
          <h2 className={h2}>Do · reviewer dispositions</h2>
          <MedicareDispositionStub pack={PACK} />
          <div className="flex flex-wrap gap-3">
            <CopyMedicareJson json={json(REPORT)} label="Copy investigation JSON" kind="investigation" ids={MEDICARE_REPORT_IDS} />
            <CopyMedicareJson json={formatInvestigationCaseBrief(REPORT, PACK, FIXTURE_PROVENANCE)} label="Copy case brief" kind="brief" />
            <CopyLiveInvestigation initial={REPORT} brief={{ evidence: PACK, provenance: FIXTURE_PROVENANCE }} />
            <CopyLiveInvestigation initial={REPORT} brief={{ evidence: PACK, provenance: FIXTURE_PROVENANCE }} handoff />
          </div>
        </section>
      </main>
    </div>
  );
}
