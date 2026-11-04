"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { evidencePack, runExperiment, verifyPack, type Experiment } from "@/lib/robotics/experiment-runner";

const KEY = "aethel.customer-proof-journey.v1";
type Review = { decision: "accept" | "reject" | "defer"; rationale: string; reviewed_at: string; pack_hash: string };
type Saved = { pack: Experiment; review?: Review };
type CoreExperience = { run_id: string; iteration: number; e: number | null; phi?: number | null; eligible: boolean; state?: string; verified_at: string };

export default function CustomerProofJourneyPage() {
  const [seeds, setSeeds] = useState("42,17,7");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [decision, setDecision] = useState<Review["decision"]>("defer");
  const [rationale, setRationale] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [coreRecords, setCoreRecords] = useState<CoreExperience[] | null>(null);
  const [coreError, setCoreError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw) as Saved);
    } catch {
      setError("Could not restore this browser's locally saved journey.");
    }
    fetch("/api/level4/experience", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 503 ? "Experience store is not configured." : `Experience store returned ${response.status}.`);
        return response.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error("Experience store returned an unexpected response.");
        setCoreRecords(data as CoreExperience[]);
      })
      .catch((cause) => setCoreError(cause instanceof Error ? cause.message : "Could not read engine experience."));
  }, []);

  const latestCore = useMemo(() => {
    const byRun = new Map<string, CoreExperience>();
    for (const row of coreRecords ?? []) byRun.set(row.run_id, row);
    return Array.from(byRun.values()).reverse().slice(0, 8);
  }, [coreRecords]);

  const verification = useMemo(() => saved ? verifyPack(evidencePack(saved.pack)) : null, [saved]);

  const run = () => {
    try {
      const parsed = seeds.split(",").map((value) => value.trim()).filter(Boolean).map(Number);
      const pack = runExperiment(parsed);
      const next = { pack };
      window.localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(next);
      setDecision("defer");
      setRationale("");
      setError("");
      setMessage("New experiment recorded locally. No external system was contacted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Experiment failed.");
    }
  };

  const review = () => {
    if (!saved || !verification?.ok) return;
    if (rationale.trim().length < 8) {
      setError("Enter a reviewer rationale of at least 8 characters.");
      return;
    }
    const next = {
      ...saved,
      review: { decision, rationale: rationale.trim(), reviewed_at: new Date().toISOString(), pack_hash: saved.pack.pack_hash },
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(next);
    setError("");
    setMessage("Human disposition saved locally against this exact evidence hash.");
  };

  const download = () => {
    if (!saved) return;
    const blob = new Blob([evidencePack(saved.pack)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aethel-evidence-${saved.pack.pack_hash.slice(7, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const outcome = verification?.outcome === "look-back-better" ? "Look-back performed better in this fixture"
    : verification?.outcome === "greedy-better" ? "Greedy performed better in this fixture"
    : verification?.outcome === "tie" ? "The policies tied in this fixture" : "Not evaluated";

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="End-to-end proof journey" />
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <header className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-widest text-emerald-400">Aethel Node · customer experience</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Trust is earned by the loop.</h1>
          <p className="text-zinc-300">Declare an objective. Run comparable actions. Measure the outcome. Verify the evidence. Record a human decision. Reuse only what survives the checks.</p>
          <p className="text-sm text-zinc-500">This first end-to-end journey uses a deterministic synthetic robotics fixture. It demonstrates the product workflow, not physical robot performance, independent validation or customer value.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-widest text-emerald-400">Live engine · endogenous evidence</p>
          <h2 className="mt-1 text-xl font-semibold">Your existing Level 4 experience store</h2>
          <p className="mt-2 text-sm text-zinc-400">This reads the actual durable experience API used by the Workbench. It is separate from the synthetic robotics demonstration below. A hash detects changes to a pack; it does not identify its author or provide an independent signature or attestation.</p>
          {coreRecords === null ? (
            <p className="mt-4 text-sm text-zinc-500">{coreError || "Reading recorded experience…"}</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-zinc-900 p-3"><p className="text-xs text-zinc-500">Recorded steps</p><p className="mt-1 text-2xl font-semibold">{coreRecords.length}</p></div>
                <div className="rounded-lg bg-zinc-900 p-3"><p className="text-xs text-zinc-500">Latest eligible runs</p><p className="mt-1 text-2xl font-semibold">{latestCore.filter((row) => row.eligible).length}</p></div>
                <div className="rounded-lg bg-zinc-900 p-3"><p className="text-xs text-zinc-500">Latest rejected / ineligible</p><p className="mt-1 text-2xl font-semibold">{latestCore.filter((row) => !row.eligible).length}</p></div>
              </div>
              {latestCore.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-zinc-500"><tr><th className="py-2 pr-3">Run</th><th className="pr-3">Iteration</th><th className="pr-3">Error e</th><th className="pr-3">Φ</th><th className="pr-3">Eligibility</th><th>Replay</th></tr></thead>
                    <tbody>{latestCore.map((row) => (
                      <tr key={row.run_id} className="border-t border-zinc-800">
                        <td className="py-2 pr-3 font-mono">{row.run_id}</td><td className="pr-3">{row.iteration}</td>
                        <td className="pr-3">{typeof row.e === "number" ? row.e.toFixed(3) : "n/a"}</td>
                        <td className="pr-3">{typeof row.phi === "number" ? row.phi.toFixed(3) : "n/a"}</td>
                        <td className={row.eligible ? "pr-3 text-emerald-300" : "pr-3 text-amber-300"}>{row.eligible ? "Eligible" : "Not eligible"}</td>
                        <td><a className="underline" href={`/api/level4/verify?run_id=${encodeURIComponent(row.run_id)}`} target="_blank" rel="noreferrer">Verify ↗</a></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="mt-4 text-sm text-zinc-500">No durable experience records are currently available.</p>}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/workbench/status" className="underline">Open Level 4 status</Link>
            <Link href="/workbench/global" className="underline">Open global misdiagnosis view</Link>
          </div>
          {coreError && <p className="mt-3 text-xs text-amber-300">{coreError}</p>}
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["01 · KNOW", "Declare", "Task, baseline, seeds and success measures."],
            ["02 · KNOW HOW", "Execute", "Paired policies under identical conditions."],
            ["03 · SHOW", "Verify", "Trial, reproducibility and evidence-pack integrity."],
            ["04 · DO", "Disposition", "Human review tied to the exact evidence hash."],
          ].map(([number, title, detail]) => (
            <div key={number} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-emerald-400">{number}</p>
              <h2 className="mt-2 font-semibold">{title}</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-800 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-widest text-emerald-400">01 · Know</p>
          <h2 className="mt-1 text-xl font-semibold">Declare the experiment</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-zinc-500">Task:</span> Long-horizon loco-manipulation</p>
            <p><span className="text-zinc-500">Environment:</span> Simulated warehouse aisle 3</p>
            <p><span className="text-zinc-500">Baseline:</span> Greedy policy</p>
            <p><span className="text-zinc-500">Candidate:</span> Look-back policy</p>
          </div>
          <label className="mt-5 block text-sm">Trial seeds (comma-separated)
            <input value={seeds} onChange={(event) => setSeeds(event.target.value)} className="mt-2 block w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <button type="button" onClick={run} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black hover:bg-emerald-300">Run the proof loop</button>
        </section>

        {saved && (
          <>
            <section className="rounded-2xl border border-zinc-800 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-widest text-emerald-400">02 · Know How</p>
              <h2 className="mt-1 text-xl font-semibold">Observed result, not a promise</h2>
              <p className="mt-2 text-sm text-zinc-400">Results are computed from paired synthetic trials. A negative result or tie remains visible; no outcome is silently discarded.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-zinc-900 p-4"><p className="text-xs text-zinc-500">ΔΦ advantage</p><p className="mt-1 text-2xl font-semibold tabular-nums">{saved.pack.comparison.delta_phi_advantage.toFixed(3)}</p></div>
                <div className="rounded-lg bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Interventions reduced</p><p className="mt-1 text-2xl font-semibold tabular-nums">{saved.pack.comparison.intervention_reduction.toFixed(2)}</p></div>
                <div className="rounded-lg bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Paired trials</p><p className="mt-1 text-2xl font-semibold tabular-nums">{saved.pack.seeds.length}</p></div>
              </div>
              <p className="mt-4 text-sm">{outcome}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-500"><tr><th className="py-2 pr-3">Policy</th><th className="pr-3">Seed</th><th className="pr-3">ΔΦ</th><th className="pr-3">Interventions</th><th>Trial hash</th></tr></thead>
                  <tbody>{saved.pack.trials.map((trial) => <tr key={trial.id} className="border-t border-zinc-800"><td className="py-2 pr-3">{trial.policy}</td><td className="pr-3">{trial.seed}</td><td className="pr-3">{trial.delta_phi.toFixed(3)}</td><td className="pr-3">{trial.interventions}</td><td className="font-mono text-zinc-500">{trial.hash.slice(0, 19)}…</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-widest text-emerald-400">03 · Show</p>
              <h2 className="mt-1 text-xl font-semibold">Verify the evidence</h2>
              <div className="mt-4 rounded-lg bg-zinc-900 p-4 text-sm">
                <p className={verification?.ok ? "text-emerald-300" : "text-rose-300"}>{verification?.ok ? "Integrity checks passed" : `Verification failed: ${verification?.reason ?? "unknown"}`}</p>
                <p className="mt-2 break-all font-mono text-xs text-zinc-400">Pack: {saved.pack.pack_hash}</p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">Reproducibility: {saved.pack.reproducibility_hash}</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                <li>✓ Individual trial hashes recomputed</li>
                <li>✓ Paired seeds and trial counts checked</li>
                <li>✓ Aggregate measurements recomputed from trial rows</li>
                <li>✓ Reproducibility fingerprint and complete pack hash checked</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={download} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm">Download evidence pack</button>
                <Link href="/workbench/robotics/experiment" className="rounded-lg border border-zinc-600 px-4 py-2 text-sm">Open experiment lab ↗</Link>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-widest text-emerald-400">04 · Do</p>
              <h2 className="mt-1 text-xl font-semibold">Human disposition</h2>
              <p className="mt-2 text-sm text-zinc-400">Hash verification proves integrity, not truth of synthetic observations. Record whether this bounded evidence is accepted, rejected or deferred. This review is local to this browser.</p>
              <label className="mt-4 block text-sm">Decision
                <select value={decision} onChange={(event) => setDecision(event.target.value as Review["decision"])} className="mt-2 block w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                  <option value="defer">Defer — needs more evidence</option><option value="accept">Accept this bounded demonstration</option><option value="reject">Reject this evidence</option>
                </select>
              </label>
              <label className="mt-4 block text-sm">Reviewer rationale
                <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} placeholder="What does this evidence justify, and what does it not justify?" className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" />
              </label>
              <button type="button" disabled={!verification?.ok} onClick={review} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Record human disposition</button>
              {saved.review && <div className="mt-4 rounded-lg border border-zinc-700 p-3 text-sm"><p className="font-medium">Latest disposition: {saved.review.decision}</p><p className="mt-1 text-zinc-400">{saved.review.rationale}</p><p className="mt-2 break-all font-mono text-xs text-zinc-500">Bound to {saved.review.pack_hash} · {saved.review.reviewed_at}</p></div>}
            </section>
          </>
        )}

        <section className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-widest text-amber-300">Acquisition gate</p>
          <h2 className="mt-1 text-xl font-semibold">The bot waits until the product can prove its claim.</h2>
          <p className="mt-2 text-sm text-zinc-300">Acquisition remains locked for this synthetic demonstration. A verified demo pack alone cannot authorize outreach or establish customer value.</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            <li>○ Non-synthetic, customer-relevant source observations</li><li>○ Reproducible results against a predeclared baseline</li><li>○ Independent reviewer disposition and limitations</li><li>○ Measured customer outcome and approved case study</li><li>○ Explicit owner approval before external contact</li>
          </ul>
          <p className="mt-4 text-xs text-amber-200">Current state: Locked · evidence development</p>
          <Link href="/workbench/acquisition" className="mt-4 inline-block text-sm underline">View Acquisition Intelligence →</Link>
        </section>

        <nav className="flex flex-wrap gap-5 border-t border-zinc-800 pt-5 text-sm text-zinc-400">
          <Link href="/workbench/status" className="underline">Level 4 status</Link><Link href="/workbench/global" className="underline">Global misdiagnosis</Link><Link href="/workbench/medicare" className="underline">Medicare intelligence</Link><Link href="/workbench/robotics/benchmark" className="underline">Robotics benchmark</Link><Link href="/workbench/offer" className="underline">Commercial offer</Link>
        </nav>
        {(error || message) && <p role="status" className={error ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>{error || message}</p>}
        <p className="text-xs text-zinc-600">Prototype state is stored in this browser only. No backend persistence, customer data, PHI, external messages or acquisition actions are used.</p>
      </main>
    </div>
  );
}
