"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SAFETY_PACK, namerLabel, Namer } from "@/lib/closed-loop";
import {
  OutcomeRun,
  closeRun,
  createRun,
  listExperience,
  readActiveRun,
  readRuns,
  stepRun,
} from "@/product/run";

export default function WorkbenchPage() {
  const [run, setRun] = useState<OutcomeRun | null>(null);
  const [history, setHistory] = useState<OutcomeRun[]>([]);
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [note, setNote] = useState(
    "Workbench B is the environment. A Run is how a customer operates it."
  );

  useEffect(() => {
    setRun(readActiveRun());
    setHistory(readRuns());
  }, []);

  function start(caseId?: string) {
    const next = createRun({
      workbench: "Node",
      caseId,
      objective:
        "Reduce e against the reference gate. Evidence only. No diagnosis.",
    });
    setRun(next);
    setHistory(readRuns());
    setNote(`Started ${next.id} on Workbench B. Δe begins at 0.`);
  }

  function step() {
    if (!run) return;
    const next = stepRun(run, { namer });
    setRun(next);
    setHistory(readRuns());
    const last = next.steps[0];
    setNote(
      `${namerLabel(namer)} named y=${last.y}. e ${last.e} → ${last.e_next}. Δe=${next.delta_e}`
    );
  }

  function close() {
    if (!run) return;
    const next = closeRun(run);
    setRun(next);
    setHistory(readRuns());
    setNote(`Closed ${next.id}. Δe=${next.delta_e}. Experience can list.`);
  }

  function list() {
    if (!run) return;
    const item = listExperience(run);
    setNote(`Listed experience ${item.id} · e=${item.e}`);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Workspace B · commercial plant
        </p>
        <h1 className="text-3xl font-bold mb-3">Workbench B · Outcome Engine</h1>
        <p className="text-zinc-400 max-w-2xl mb-4">
          Home is Workspace A. Workbench B is the SaaS surface: one environment,
          many domains. The customer does not buy an AI. They buy a system that
          takes an action, measures error against a reference, and uses that
          experience to choose the next action.
        </p>
        <p className="text-zinc-500 text-sm max-w-2xl mb-6">
          Diagnostic validation and the audit desk live on this workbench, not
          as separate products. Music remains the first vertical. Intelligence
          is Δe, not model prose.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <span className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Run
          </span>
          <Link
              href="/workbench/proof"
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
            >
              Proof
            </Link>
          <Link
            href="/workbench/safety"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Diagnostic
          </Link>
          <Link
            href="/audit"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Audit
          </Link>
          <Link
            href="/marketplace"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Experience
          </Link>
        </div>

        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-8 overflow-auto leading-6 text-emerald-300">
{`HOME A          Goal / Task / namer of y
   │
   ▼
WORKBENCH B     Environment · SaaS plant
   Run | Diagnostic | Audit | Experience
   │
   ▼
measured z → error e → Self() next move → repeat

Organization → Workspace A → Workbench B → Run → Experience → Marketplace
Metric: Δe per Run`}
        </pre>

        <div className="grid gap-4 md:grid-cols-2 mb-8 text-sm text-zinc-400">
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">A Run records</p>
            <p>
              organization, workspace, workbench, objective, actions,
              measurements, error reduction, experience, outcomes, permissions,
              usage/billing.
            </p>
          </section>
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">Hard rule</p>
            <p>
              Core loop = protected. Commercialization = additive. Do not
              commercialize the AI. Commercialize the closed-loop outcome.
              Build the intelligence once; change the environment.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {SAFETY_PACK.map((c) => (
            <button
              key={c.id}
              onClick={() => start(c.id)}
              className="h-10 px-4 rounded-full border border-zinc-700 text-sm"
            >
              {c.title}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {(["grok_fast", "hy4_deep", "grok_bot"] as Namer[]).map((id) => (
            <button
              key={id}
              onClick={() => setNamer(id)}
              className={`h-10 px-4 rounded-full text-sm border ${
                namer === id
                  ? "bg-emerald-600 border-emerald-600"
                  : "border-zinc-700"
              }`}
            >
              {namerLabel(id)}
            </button>
          ))}
          <button
            onClick={step}
            disabled={!run}
            className="h-10 px-5 rounded-full bg-white text-black text-sm"
          >
            Step Run
          </button>
          <button
            onClick={close}
            disabled={!run}
            className="h-10 px-5 rounded-full border border-zinc-700 text-sm"
          >
            Close Run
          </button>
          <button
            onClick={list}
            disabled={!run}
            className="h-10 px-5 rounded-full bg-emerald-600 text-sm"
          >
            List experience
          </button>
        </div>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-sm text-zinc-300 mb-3">{note}</p>
          {run ? (
            <p className="text-xs text-zinc-500 font-mono">
              {run.id} · {run.workbench} · e0={run.e0} · e={run.e_now} ·
              Δe={run.delta_e} · steps={run.steps.length} · {run.status}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              No Run yet. Pick a pack above.
            </p>
          )}
        </section>

        {run && run.steps.length > 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left py-2">t</th>
                  <th className="text-left py-2">y</th>
                  <th className="text-left py-2">e→</th>
                  <th className="text-left py-2">Δe</th>
                  <th className="text-left py-2">z</th>
                </tr>
              </thead>
              <tbody>
                {run.steps.map((s) => (
                  <tr key={s.t} className="border-t border-zinc-800">
                    <td className="py-2">{s.t}</td>
                    <td className="py-2">{s.y}</td>
                    <td className="py-2">
                      {s.e}→{s.e_next}
                    </td>
                    <td className="py-2">{s.reduced}</td>
                    <td className="py-2 font-mono text-xs">{s.z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {history.length > 0 ? (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
            <p className="text-emerald-400 text-xs mb-3">Recent runs</p>
            <ul className="text-sm text-zinc-400 space-y-2">
              {history.slice(0, 6).map((r) => (
                <li key={r.id} className="font-mono text-xs">
                  {r.id} · Δe={r.delta_e} · {r.status}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <article className="text-sm text-zinc-400 space-y-4 mb-10">
          <p>
            Product: Aethel Node Outcome Engine. First Workbench: Node.
            Safety stays an evidence-gate demonstration, not a diagnosis.
            Marketplace is an Experience Marketplace: validated Δe becomes a
            reusable asset.
          </p>
          <p>
            Acceptance: Home A and Workbench B still work. A user can start
            one Run. The Run records y → z → e. Self() names the next action.
            Diagnostic and Audit open from this plant. No PHI. No unsupervised
            clinical decision.
          </p>
        </article>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/">
            Home A
          </Link>
          <Link className="underline" href="/workbench/safety">
            Diagnostic
          </Link>
          <Link className="underline" href="/audit">
            Audit
          </Link>
          <Link className="underline" href="/marketplace">
            Experience marketplace
          </Link>
        </nav>
      </main>
    </div>
  );
}