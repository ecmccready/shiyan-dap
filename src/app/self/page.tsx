import Link from "next/link";

export default function SelfPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Glossary · SIMA-like loop · not SIMA 2
      </p>
      <h1 className="text-2xl font-semibold">Self() and names</h1>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`Workspace A     autonomous controller
P2P State B     environment / workbench A acts in
Ledger          persistent experience memory
z               compressed state / next-action
Self()          policy revision
P()             prediction
W()             world / state transition
e               prediction error
V               progress / value
Task generator  what A should learn next

A → Task → Action → B' → Measure → E → A'

A contains: Task, Policy, Evaluator, Memory, Self()
B executes W(B,y)
Experience returns to A

claimed_self_improving_ai = false
claimed_weight_training = false`}
      </pre>
      <p className="text-sm text-zinc-400">
        Ledger is reusable skill memory when next task = weakest
        capability (highest mean |e|). It is not foundation-model
        retraining.
      </p>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace A
        </Link>
        <Link className="underline" href="/workbench">
          P2P B
        </Link>
        <Link className="underline" href="/api/workspace/experience">
          Experience JSON
        </Link>
      </nav>
    </main>
  );
}