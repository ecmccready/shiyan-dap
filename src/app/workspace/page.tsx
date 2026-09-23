"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Rec = {
  t: number;
  y: string;
  hatDelta: number;
  delta: number;
  e: number;
  V: number;
  V_decreased: boolean | null;
  z: string;
};

export default function WorkspacePage() {
  const [rec, setRec] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);

  async function tick() {
    setBusy(true);
    const res = await fetch("/api/workspace/step", { method: "POST" });
    const data = await res.json();
    setRec(data.rec);
    setBusy(false);
  }

  useEffect(() => {
    fetch("/api/workspace/step")
      .then((r) => r.json())
      .then((d) => {
        if (d.M?.z?.[0]) {
          setRec({
            t: d.B?.t ?? 0,
            y: "-",
            hatDelta: 0,
            delta: 0,
            e: 0,
            V: d.lastV ?? 0,
            V_decreased: null,
            z: d.M.z[0],
          });
        }
      });
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace · A = .self(M, B) · B = workbench
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        A is the controller. B is the environment A acts on. z is the
        compressed consequence. M is experience. .self() is the
        operator, not “call the model again.” Convergence is watched
        as V = e². It is not proven global.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={tick}
        className="text-sm underline disabled:opacity-50"
      >
        Step .self()
      </button>

      {rec && (
        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
          {`t=${rec.t}  y=${rec.y}
hatΔB=${rec.hatDelta}  ΔB=${rec.delta}  e=${rec.e}
V=e²=${rec.V}  V_decreased=${String(rec.V_decreased)}
${rec.z}
claimed_global_convergence=false`}
        </pre>
      )}

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A_t = .self(M_t, B_t)
hatΔB_t = P(A_t, M_t, B_t)
y_t = π(A_t, hatΔB_t)
B_{t+1} = W(B_t, y_t)
e_t = ΔB_t - hatΔB_t
z_t = Φ(...)
M_{t+1} = M_t ⊕ z_t
A_{t+1} = .self(M_{t+1}, B_{t+1})`}
      </pre>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          Workbench B
        </Link>
        <Link className="underline" href="/self">
          .self()
        </Link>
        <Link className="underline" href="/agents">
          A1 A2 A3
        </Link>
        <Link className="underline" href="/nfts">
          Music rail
        </Link>
      </nav>
    </main>
  );
}