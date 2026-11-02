"use client";

import { useState } from "react";
import { runExperiment, evidencePack, verifyPack, type Experiment } from "@/lib/robotics/experiment-runner";

export default function RoboticsExperimentPage() {
  const [exp, setExp] = useState<Experiment | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [seedInput, setSeedInput] = useState("42,17,7");

  const run = () => {
    const seeds = seedInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    setExp(runExperiment(seeds.length ? seeds : undefined));
  };

  const download = () => {
    if (!exp) return;
    const blob = new Blob([evidencePack(exp)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aethel-robotics-experiment-${exp.pack_hash.slice(7)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!exp) return;
    await navigator.clipboard.writeText(evidencePack(exp));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const verify = () => setVerifyResult(verifyPack(verifyInput));

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Persistent-autonomy experiment runner</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Deterministic simulator. Repeated look-back vs greedy trials. Content-hashed evidence pack with ROE comparison. Real robot control remains outside the engine.
      </p>

      <div className="flex gap-2 mb-4 items-center">
        <input
          className="border rounded px-2 py-1 text-sm w-40"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="seeds, e.g. 42,17,7"
        />
        <button type="button" onClick={run} className="border rounded px-3 py-1 text-sm">Run experiment</button>
        {exp && (
          <>
            <button type="button" onClick={download} className="border rounded px-3 py-1 text-sm">Download pack</button>
            <button type="button" onClick={copy} className="border rounded px-3 py-1 text-sm">{copied ? "Copied" : "Copy pack"}</button>
          </>
        )}
      </div>

      {exp && (
        <>
          <div className="text-sm mb-4 border rounded p-3">
            <div>Robot: {exp.robot}</div>
            <div>Task: {exp.task}</div>
            <div>Environment: {exp.environment}</div>
            <div>Pack hash: {exp.pack_hash}</div>
            <div className="mt-2 font-medium">ROE comparison</div>
            <div>Look-back avg ΔΦ: {exp.comparison.lookback_avg_delta_phi}</div>
            <div>Greedy avg ΔΦ: {exp.comparison.greedy_avg_delta_phi}</div>
            <div>ΔΦ advantage: {exp.comparison.delta_phi_advantage}</div>
            <div>Intervention reduction: {exp.comparison.intervention_reduction}</div>
          </div>
          <div className="border rounded mb-4">
            {exp.trials.map((t) => (
              <div key={t.id} className="border-b last:border-b-0 p-3 text-sm">
                <div className="flex justify-between">
                  <span>{t.policy} · seed {t.seed}</span>
                  <span>ΔΦ {t.delta_phi.toFixed(3)} · interventions {t.interventions}</span>
                </div>
                <div className="text-neutral-500 text-xs mt-1">{t.hash}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <section className="border rounded p-3">
        <h2 className="font-medium text-sm mb-2">Verify a pack</h2>
        <textarea
          className="w-full border rounded p-2 text-xs font-mono mb-2"
          rows={6}
          placeholder="Paste an evidence pack JSON here"
          value={verifyInput}
          onChange={(e) => setVerifyInput(e.target.value)}
        />
        <button type="button" onClick={verify} className="border rounded px-3 py-1 text-sm">Verify</button>
        {verifyResult && (
          <div className={`mt-2 text-sm ${verifyResult.ok ? "text-emerald-600" : "text-red-600"}`}>
            {verifyResult.ok ? "Verified" : `Failed: ${verifyResult.reason}`}
          </div>
        )}
      </section>
    </main>
  );
}