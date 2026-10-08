"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Namer, namerLabel } from "@/lib/closed-loop";
import { SAFETY_B, safetyFlywheel, type Arm } from "@/product/proof";
import { createRun, type OutcomeRun } from "@/product/run";

type Phase = "empty" | "setup" | "running" | "closed" | "error";

const CASES = [
  { id: "case-incomplete-evidence", title: "Incomplete evidence pack" },
  { id: "case-missing-measurements", title: "Missing measurements" },
  { id: "case-provenance-gap", title: "Provenance gap" },
] as const;

const LOOP = [
  ["Give A a task", "Objective and reference, not a prompt."],
  ["Let B execute", "Workbench B steps y. A only names y."],
  ["Measure", "z is observed. e is distance to the reference."],
  ["Improve", "Reuse only if final e falls. A tie is not a win."],
  ["Preserve", "The Run is the evidence. Export it."],
];

export default function WorkbenchPage() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [caseId, setCaseId] = useState<(typeof CASES)[number]["id"]>(CASES[2].id);
  const [objective, setObjective] = useState(
    "Close the provenance gap against the Safety reference gate.",
  );
  const [reference, setReference] = useState("Safety reference pack · gate must match");
  const [run, setRun] = useState<OutcomeRun | null>(null);
  const [shown, setShown] = useState(0);
  const [fault, setFault] = useState("");

  const wheel = useMemo(() => safetyFlywheel(namer), [namer]);
  const index = Math.max(0, CASES.findIndex((c) => c.id === caseId));
  const cold = wheel.cold[index];
  const reuse = wheel.reuse[index];
  const improved = Boolean(reuse && cold && reuse.e1 < cold.e1);
  const phi = cold && reuse ? Number((cold.e1 - reuse.e1).toFixed(3)) : 0;

  useEffect(() => {
    if (phase !== "running" || !reuse) return;
    if (shown >= reuse.steps.length) {
      setPhase("closed");
      return;
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), 420);
    return () => window.clearTimeout(t);
  }, [phase, shown, reuse]);

  function create() {
    setFault("");
    if (!objective.trim() || !reference.trim()) {
      setPhase("error");
      setFault("A Run needs an objective and a reference. Nothing was started.");
      return;
    }
    const next = createRun({
      org: "aethel",
      workspace: "A",
      workbench: "Safety",
      objective: objective.trim(),
      caseId,
    });
    setRun(next);
    setShown(0);
    setPhase("running");
  }

  function reset() {
    setRun(null);
    setShown(0);
    setFault("");
    setPhase("empty");
  }

  const liveE = phase === "closed" && reuse ? reuse.e1 : reuse?.steps[shown - 1]?.e_next ?? reuse?.e0;
  const delta = reuse && liveE != null ? Number((reuse.e0 - liveE).toFixed(3)) : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-emerald-400">Commercial center</p>
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">One Run. Measured. Kept.</h1>
            <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
              Give A a task. Let B execute it. Measure the result. Improve the next run. Preserve the evidence.
              Customers are not buying an AI or a state machine. They are buying that loop.
            </p>
          </div>
          <button
            onClick={() => setPhase("setup")}
            className="h-12 shrink-0 rounded-full bg-emerald-500 px-6 text-sm font-medium text-black"
          >
            Create Run
          </button>
        </div>

        <ol className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-zinc-800 p-4">
              <p className="text-xs text-emerald-400">0{i + 1}</p>
              <p className="mt-2 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p>
            </li>
          ))}
        </ol>

        <section className="mb-8 rounded-3xl border border-zinc-800 p-4 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Killer metric · Δe</p>
              <h2 className="mt-1 text-xl font-medium">Intelligence is reduction of error</h2>
            </div>
            <Link href="/workbench/repeat" className="text-sm text-zinc-400 underline">
              Repeat plant
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Meter k="Baseline" v="1.391" s="e before the sealed pass" />
            <Meter k="Run" v="0.235" s="e after the sealed pass" />
            <Meter k="Improvement" v="1.156" s="Δe · same drop twice" />
            <Meter k="Reusable experience" v="1.156" s="Φ on that repeat · not revenue" />
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-500">
            The same reduction printed twice on live B1, 1.391 to 0.235. A repeatable reduction is not a customer
            and not a settled payment. Listing Φ on the proof packs remains 0.014, 0.065, 0.065. Those are different records.
          </p>
        </section>

        {phase === "empty" && (
          <Empty onCreate={() => setPhase("setup")} />
        )}

        {phase === "error" && (
          <div className="mb-8 rounded-3xl border border-red-900 bg-red-950/40 p-6" role="alert">
            <p className="text-sm font-medium text-red-300">Run not started</p>
            <p className="mt-2 text-sm text-red-200/80">{fault}</p>
            <button onClick={() => setPhase("setup")} className="mt-4 text-sm underline">
              Fix the setup
            </button>
          </div>
        )}

        {(phase === "setup" || phase === "running" || phase === "closed") && (
          <section className="mb-8 grid gap-4 lg:grid-cols-12">
            <form
              className="rounded-3xl border border-zinc-800 p-5 lg:col-span-5"
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Input and reference</p>
              <label className="mt-4 block text-sm text-zinc-300">
                Objective
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="mt-2 h-24 w-full rounded-2xl border border-zinc-700 bg-black p-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="mt-4 block text-sm text-zinc-300">
                Reference
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-2 h-11 w-full rounded-full border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="mt-4 block text-sm text-zinc-300">
                Case
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value as (typeof CASES)[number]["id"])}
                  className="mt-2 h-11 w-full rounded-full border border-zinc-700 bg-black px-4 text-sm"
                >
                  {CASES.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["grok_fast", "hy4_deep", "grok_bot"] as Namer[]).map((id) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setNamer(id)}
                    className={`h-10 rounded-full border px-4 text-sm ${namer === id ? "border-emerald-500 bg-emerald-500 text-black" : "border-zinc-700"}`}
                  >
                    {namerLabel(id)}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                B = {SAFETY_B.id}. Accepts {SAFETY_B.accepts[0]}. {SAFETY_B.not}.
              </p>
              <button
                type="submit"
                disabled={phase === "running"}
                className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
              >
                {phase === "running" ? "B is executing" : "Start this Run"}
              </button>
            </form>

            <div className="rounded-3xl border border-zinc-800 p-5 lg:col-span-7">
              {phase === "setup" && <p className="text-sm text-zinc-500">Waiting for a Run. Nothing is measured yet.</p>}
              {phase === "running" && (
                <p className="mb-3 text-sm text-emerald-300" role="status">Live · replaying the sealed plant. Not a new measurement.</p>
              )}
              {reuse && phase !== "setup" && (
                <>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">{run?.id ?? reuse.artifact.run_id}</p>
                      <h2 className="text-2xl font-medium">{reuse.title}</h2>
                    </div>
                    <p className="text-right">
                      <span className="block text-3xl font-semibold tabular-nums">{liveE?.toFixed(3)}</span>
                      <span className="text-xs text-zinc-500">e now · Δe {delta.toFixed(3)}</span>
                    </p>
                  </div>
                  <ol className="space-y-2">
                    {reuse.steps.map((step, i) => (
                      <li key={`${step.y}-${i}`} className={`rounded-2xl border px-4 py-3 text-sm ${i < shown ? "border-zinc-700" : "border-zinc-900 text-zinc-600"}`}>
                        <span className="text-zinc-500">y = </span>{step.y}
                        <span className="float-right tabular-nums">e {i < shown ? step.e_next : "—"}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {phase === "closed" && reuse && cold && (
                <div className="mt-4 rounded-2xl border border-zinc-800 p-4 text-sm">
                  <p className={improved ? "text-emerald-300" : "text-amber-300"}>
                    {improved
                      ? `Accepted. Reuse final e ${reuse.e1} is below cold final e ${cold.e1}. Φ ${phi}.`
                      : "Rejected. Final e did not fall. Do not claim the flywheel."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link className="underline" href={`/workbench/run/${reuse.artifact.run_id}`}>Open the Run</Link>
                    <Link className="underline" href="/workbench/proof">Proof</Link>
                    <Link className="underline" href="/audit">Audit</Link>
                    <button className="underline" onClick={reset}>New Run</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Run history</h2>
            <Link href="/workbench/eval" className="text-sm text-zinc-400 underline">Reliability harness</Link>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-zinc-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Run</th>
                  <th className="px-4 py-3 font-medium">Cold e</th>
                  <th className="px-4 py-3 font-medium">Reuse e</th>
                  <th className="px-4 py-3 font-medium">Φ</th>
                  <th className="px-4 py-3 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {wheel.reuse.map((arm, i) => (
                  <HistoryRow key={arm.case_id} arm={arm} cold={wheel.cold[i]} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/workbench/repeat">Repeat</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
          <Link className="underline" href="/workbench/mcp">MCP</Link>
          <Link className="underline" href="/audit">Audit</Link>
          <Link className="underline" href="/marketplace">Experience</Link>
        </nav>
      </main>
    </div>
  );
}

function Meter({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{k}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{v}</p>
      <p className="mt-1 text-xs text-zinc-500">{s}</p>
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="mb-8 rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
      <p className="text-lg font-medium">No Run on the bench</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        A new operator starts here. Create a Run, set the reference, and watch B execute the sealed Safety plant.
      </p>
      <button onClick={onCreate} className="mt-5 h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black">
        Create Run
      </button>
    </section>
  );
}

function HistoryRow({ arm, cold }: { arm: Arm; cold: Arm }) {
  const phi = Number((cold.e1 - arm.e1).toFixed(3));
  const pass = arm.e1 < cold.e1;
  return (
    <tr className="border-t border-zinc-800">
      <td className="px-4 py-3">
        <Link href={`/workbench/run/${arm.artifact.run_id}`} className="underline">{arm.title}</Link>
      </td>
      <td className="px-4 py-3 tabular-nums">{cold.e1.toFixed(3)}</td>
      <td className="px-4 py-3 tabular-nums">{arm.e1.toFixed(3)}</td>
      <td className="px-4 py-3 tabular-nums">{phi.toFixed(3)}</td>
      <td className="px-4 py-3">{pass ? "Accepted" : "Refused"}</td>
    </tr>
  );
}
