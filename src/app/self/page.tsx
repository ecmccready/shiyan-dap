import Link from "next/link";

export default function SelfPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Self() · T from external clocks
      </p>
      <h1 className="text-2xl font-semibold">Self()</h1>
      <p className="text-sm text-zinc-400">
        Self() is the state-transition mechanism. It is not an AI
        employee. T is time of an external measurement. Stripe
        “$1.86 is on the way” (estimated 21 Sep 2026) is one clock.
        That payout is not settlement in Shiyan and not customer B.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`SHIYAN WORKSPACE
    Self(state)
 Predict B          Act y
        \\          /
         Observe
         B observed
         error / ΔB
         z
    Self(z → next)

B_pred = f(S, T, V, C)
E_B    = B_observed - B_pred
external workbench observation overrides endogenous B
otherwise B stays provisional

(y,x) + (y,x) → z
when Self() makes every action measurable.`}
      </pre>

      <p className="text-xs text-zinc-500">
        No ledger, no learning; no learning, no trust; no trust, no
        marketplace. The record is where z is computed. Claims are
        checked against it.
      </p>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace A
        </Link>
        <Link className="underline" href="/workbench">
          Workbench B
        </Link>
        <Link className="underline" href="/ledger">
          Ledger
        </Link>
      </nav>
    </main>
  );
}