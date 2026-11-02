"use client";

import { useState } from "react";
import { runExperiment, evidencePack, type Experiment } from "@/lib/robotics/experiment-runner";

export default function RoboticsExperimentPage() {
  const [exp, setExp] = useState<Experiment | null>(null);
  const [copied, setCopied] = useState(false);

  const run = () => setExp(runExperiment());

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

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Persistent-autonomy experiment runner</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Deterministic simulator. Repeated look-back vs greedy trials. Content-hashed evidence pack. Real robot control remains outside the engine.
      </p>

      <div className="flex gap-2 mb-4">
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
          <div className="text-sm mb-4">
            <div>Robot: {exp.robot}</div>
            <div>Task: {exp.task}</div>
            <div>Environment: {exp.environment}</div>
            <div>Pack hash: {exp.pack_hash}</div>
          </div>
          <div className="border rounded">
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
    </main>
  );
}