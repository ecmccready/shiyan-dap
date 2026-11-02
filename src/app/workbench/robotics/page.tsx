"use client";

import { useEffect, useState } from "react";

const POLICIES = [
  { id: "pol_a", label: "Look-back winner", steps: 12, delta_phi: 0.041, role: "winner" as const },
  { id: "pol_c", label: "Alternative", steps: 11, delta_phi: 0.027, role: "beaten" as const },
  { id: "pol_b", label: "Greedy baseline", steps: 9, delta_phi: 0.018, role: "greedy" as const },
];

export default function RoboticsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "winner" | "beaten" | "greedy">("all");
  const [focus, setFocus] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visible = POLICIES.filter((p) => show === "all" || p.role === show);
  const winner = POLICIES.find((p) => p.role === "winner");
  const greedy = POLICIES.find((p) => p.role === "greedy");
  const delta = winner && greedy ? (winner.delta_phi - greedy.delta_phi).toFixed(3) : "—";

  const summary = JSON.stringify({ winner: winner?.label, delta_phi_vs_greedy: delta, shown: visible.length, of: POLICIES.length }, null, 2);

  const copySummary = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setToast("Summary copied");
    if (!hasCopied) {
      setPulse(true);
      setHasCopied(true);
      setTimeout(() => setPulse(false), 1200);
    }
    setTimeout(() => setCopied(false), 1200);
    setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "j") setFocus((f) => Math.min(f + 1, visible.length - 1));
      if (e.key === "k") setFocus((f) => Math.max(f - 1, 0));
      if (e.key === "Enter") setExpanded(visible[focus]?.id ?? null);
      if (e.key === "f") {
        const order = ["all", "winner", "beaten", "greedy"] as const;
        setShow(order[(order.indexOf(show) + 1) % order.length]);
      }
      if (e.key === "g") copySummary();
      if (e.key === "?") alert("j/k move · Enter expand · f cycle Show · g copy summary");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, show, visible, summary, hasCopied]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics policies</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Know → Know How → Show → Do on the same engine. Synthetic fixture only. j/k · Enter · f · g · ?
      </p>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-neutral-900 text-white text-sm px-3 py-2 rounded">
          {toast}
        </div>
      )}

      <button
        type="button"
        onClick={copySummary}
        className={`sticky top-0 bg-white border rounded p-3 mb-4 text-sm flex gap-4 flex-wrap w-full text-left ${pulse ? "ring-2 ring-amber-400" : ""}`}
      >
        <span>Winner: {winner?.label}</span>
        <span>ΔΦ vs greedy: {delta}</span>
        <span>{visible.length} of {POLICIES.length} shown</span>
        <span className="ml-auto">{copied ? "Copied ✓" : "g / click to copy"}</span>
      </button>

      <div className="flex gap-2 mb-4 text-sm">
        {(["all", "winner", "beaten", "greedy"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setShow(s)} className={show === s ? "font-medium underline" : ""}>
            {s}
          </button>
        ))}
      </div>

      <div className="border rounded">
        {visible.map((p, i) => (
          <div key={p.id} className={`border-b last:border-b-0 ${i === focus ? "bg-amber-50" : ""}`}>
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




