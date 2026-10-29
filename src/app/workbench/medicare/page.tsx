import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { FIXTURE_PROVENANCE, FIXTURE_DQ, MEDICARE_FIXTURE } from "@/lib/medicare/fixture";

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

        <section aria-label="Four-stage graph" className="grid gap-4 sm:grid-cols-2">
          {STAGES.map((s) => (
            <div key={s.id} data-medicare-stage={s.id} className="border border-zinc-800 rounded-2xl p-5 text-sm">
              <p className="text-emerald-400 text-xs uppercase tracking-widest">{s.group}</p>
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                {s.lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
              <p className="text-xs text-zinc-600 mt-2">Not built yet.</p>
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
      </main>
    </div>
  );
}
