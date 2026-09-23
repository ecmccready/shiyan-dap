import Link from "next/link";

export default function AgentsPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        A → A1 planner · A2 executor · A3 evaluator
      </p>
      <h1 className="text-2xl font-semibold">Agents</h1>
      <ul className="text-sm text-zinc-400 space-y-3">
        <li>
          <span className="text-emerald-400">A1 planner</span> — forms
          Ĝ and hatΔB from M and B.
        </li>
        <li>
          <span className="text-emerald-400">A2 executor</span> — emits
          y ∈ {"{EXPAND, HOLD, CONTRACT}"} into W.
        </li>
        <li>
          <span className="text-emerald-400">A3 evaluator</span> —
          computes e, V, z. Does not settle money.
        </li>
      </ul>
      <p className="text-xs text-zinc-500">
        Sub-agents are capabilities of A, not separate buyers.
      </p>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace
        </Link>
        <Link className="underline" href="/workbench">
          Workbench
        </Link>
      </nav>
    </main>
  );
}