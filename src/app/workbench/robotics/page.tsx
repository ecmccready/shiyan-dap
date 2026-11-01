"use client";

import { useState } from "react";

const POLICIES = [
  { id: "pol_a", label: "Look-back winner", steps: 12, delta_phi: 0.041, role: "winner" as const },
  { id: "pol_c", label: "Alternative", steps: 11, delta_phi: 0.027, role: "beaten" as const },
  { id: "pol_b", label: "Greedy baseline", steps: 9, delta_phi: 0.018, role: "greedy" as const },
];

export default function RoboticsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "winner" | "beaten" | "greedy">("all");

  const visible = POLICIES.filter((p) => show === "all" || p.role === show);
  const winner = POLICIES.find((p) => p.role === "winner");
  const greedy = POLICIES.find((p) => p.role === "greedy");
  const delta = winner && greedy ? (winner.delta_phi - greedy.delta_phi).toFixed(3) : "—";

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics policies</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Know → Know How → Show → Do on the same engine. Synthetic fixture only.
      </p>

      <div className="sticky top-0 bg-white border rounded p-3 mb-4 text-sm flex gap-4 flex-wrap">
        <span>Winner: {winner?.label}</span>
        <span>ΔΦ vs greedy: {delta}</span>
        <span>{visible.length} of {POLICIES.length} shown</span>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        {(["all", "winner", "beaten", "greedy"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setShow(s)} className={show === s ? "font-medium underline" : ""}>
            {s}
          </button>
        ))}
      </div>

      <div className="border rounded">
        {visible.map((p) => (
          <div key={p.id} className="border-b last:border-b-0">
            <button type="button" className="w-full text-left p-3 flex justify-between" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
              <span>{p.label}</span>
              <span>ΔΦ {p.delta_phi.toFixed(3)} · {p.steps} steps</span>
            </button>
            {expanded === p.id && (
              <div className="px-3 pb-3 text-sm text-neutral-600">
                Synthetic evidence: observation sequence → policy steps → predicted vs actual. Content hash preserved.
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}