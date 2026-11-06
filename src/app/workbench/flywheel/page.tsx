"use client";

import React, { useEffect, useState } from "react";

type Experience = {
  experience_id: string;
  goal: string;
  action: string;
  reuse_eligibility: boolean;
  z_next_action: string;
  revision: number;
};

export default function FlywheelPage() {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  useEffect(() => {
    // Fixture that matches the ExperienceRecord shape written by the flywheel.
    setExperience({
      experience_id: "exp_20261106_metamorphic",
      goal: "Reduce next-action error against baseline",
      action: "Look-back vs greedy with metamorphic perturbation",
      reuse_eligibility: true,
      z_next_action: "Re-run with look-back policy informed by prior Φ stability",
      revision: 1,
    });
    setNextAction("Re-run with look-back policy informed by prior Φ stability");
  }, []);

  if (!experience) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Founder Reference Flywheel
        </p>

        <h1 className="text-4xl font-semibold mb-6">Append-only verified memory</h1>

        <p className="text-zinc-300 mb-10">
          One complete cycle: Shiyan DAP → Aethel executes → Verifies → Hugging Face remembers → ROE improves next action.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 space-y-4 mb-8">
          <div>
            <div className="text-sm text-zinc-400">Experience</div>
            <div className="font-mono">{experience.experience_id}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Goal</div>
            <div>{experience.goal}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Action taken</div>
            <div>{experience.action}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Reuse eligibility</div>
            <div className={experience.reuse_eligibility ? "text-emerald-400" : "text-zinc-400"}>
              {experience.reuse_eligibility ? "Eligible" : "Not eligible"}
            </div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Revision</div>
            <div>{experience.revision}</div>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
          <div className="text-sm text-zinc-400 mb-1">ROE recommended next action</div>
          <div className="font-semibold">{nextAction}</div>
          <div className="text-xs text-zinc-500 mt-2">
            Informed by experience {experience.experience_id}
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}