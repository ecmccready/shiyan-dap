"use client";

import { useState } from "react";
import { runExperiment, evidencePack, verifyPack, type Experiment } from "@/lib/robotics/experiment-runner";

export default function ExperimentPage() {
  const [seedInput, setSeedInput] = useState("42,17,7");
  const [exp, setExp] = useState<Experiment | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const run = () => {
    const seeds = seedInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    const result = runExperiment(seeds.length ? seeds : undefined);
    setExp(result);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aethel.lastExperimentHash", result.pack_hash);
      sessionStorage.setItem("aethel.lastExperimentPack", evidencePack(result));
    }
  };

  const download = () => {
    if (!exp) return;
    const blob = new Blob([evidencePack(exp)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aethel-experiment-${exp.pack_hash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!exp) return;
    await navigator.clipboard.writeText(evidencePack(exp));
  };

  const verify = () => {
    const res = verifyPack(verifyInput);
    setVerifyResult(res.ok ? "Valid" : `Invalid: ${res.reason}`);
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Persistent-autonomy experiment runner</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Deterministic simulator. Repeated look-back vs greedy trials. Content-hashed evidence pack with ROE comparison. Real robot control remains outside the engine.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-40"
        />
        <button type="button" onClick={run} className="border rounded px-3 py-1 text-sm">
          Run experiment
        </button>
        {exp && (
          <>
            <button type="button" onClick={download} className="border rounded px-3 py-1 text-sm">
              Download pack
            </button>
            <button type="button" onClick={copy} className="border rounded px-3 py-1 text-sm">
              Copy pack
            </button>
          </>
        )}
      </div>

      {exp && (
        <div className="border rounded p-3 text-sm mb-4">
          <div>Robot: {exp.robot}</div>
          <div>Task: {exp.task}</div>
          <div>Environment: {exp.environment}</div>
          <div>Pack hash: {exp.pack_hash}</div>
          <div className="mt-2 font-medium">ROE comparison</div>
          <div>Look-back avg ΔΦ: {exp.comparison.lookback_avg_delta_phi.toFixed(3)}</div>
          <div>Greedy avg ΔΦ: {exp.comparison.greedy_avg_delta_phi.toFixed(3)}</div>
          <div>ΔΦ advantage: {exp.comparison.delta_phi_advantage.toFixed(3)}</div>
          <div>Intervention reduction: {exp.comparison.intervention_reduction.toFixed(2)}</div>
        </div>
      )}

      {exp && (
        <div className="border rounded">
          {exp.trials.map((t, i) => (
            <div key={i} className="border-b last:border-b-0 p-3 text-sm flex justify-between">
              <div>
                <div>
                  {t.policy} · seed {t.seed}
                </div>
                <div className="text-xs text-neutral-500">{t.hash}</div>
              </div>
              <div className="text-right">
                ΔΦ {t.delta_phi.toFixed(3)} · interventions {t.interventions}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="mt-6 border rounded p-3">
        <h2 className="font-medium mb-2">Verify a pack</h2>
        <textarea
          value={verifyInput}
          onChange={(e) => setVerifyInput(e.target.value)}
          placeholder="Paste an evidence pack JSON here"
          className="w-full border rounded p-2 text-xs h-24"
        />
        <button type="button" onClick={verify} className="mt-2 border rounded px-3 py-1 text-sm">
          Verify
        </button>
        {verifyResult && <div className="mt-2 text-sm">{verifyResult}</div>}
      </section>
    </main>
  );
}