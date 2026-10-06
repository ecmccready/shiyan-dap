import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  POINTS,
  SELF_DEFINITION,
  THESIS,
  X_AXIS,
  Y_AXIS,
} from "@/lib/capability-plane";

const LOOP = `                 Self()
                   │
              ┌────┴────┐
              │         │
             KNOW    KNOW-HOW
              │         │
              └────┬────┘
                   ↓
                 SHOW
                   ↓
                  DO
                   ↓
             measured result z
                   ↓
              error e / Δe
                   ↓
          verified experience Φ
                   │
                   └──────────→ Self()

Feedback is Φ. Self() does not read prior Runs.
A reused sequence is chosen outside Self(), and
only when its own final e is strictly lower.`;

const PEERS = `             A / Self()
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
      B₁        B₂        B₃
   Workbench  Workbench  Workbench
       │         │         │
       └─────────┼─────────┘
                 ▼
        verified experience

B is an open MCP contract.
Another peer can become B.`;

export default function PlanePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="P2P plane" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">
          Next abstraction · not a new vertical
        </p>
        <h1 className="text-3xl font-bold">
          Two axes of Self() becoming operational
        </h1>
        <p className="text-zinc-300">{SELF_DEFINITION}</p>
        <p className="text-zinc-400 text-sm">
          The four assets are not four sequential boxes. They are coordinates
          on a capability plane. X moves from what is known to what is done.
          Y moves from one peer to a reusable peer contract.
        </p>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">X · epistemic → operational</p>
            <p className="text-sm text-zinc-300">
              {X_AXIS.map((p) => p.label).join(" → ")}
            </p>
          </div>
          <div className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-emerald-400 text-xs mb-2">Y · individual → peer/reusable</p>
            <p className="text-sm text-zinc-300">
              {Y_AXIS.map((p) => p.label).join(" → ")}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          {POINTS.map((point) => (
            <Link
              key={point.id}
              href={point.href}
              className="block border border-zinc-800 rounded-2xl p-5 hover:border-emerald-700"
            >
              <p className="text-emerald-400 text-xs mb-1">
                {point.capability} · {point.x} × {point.y}
              </p>
              <p className="font-medium">{point.asset}</p>
              <p className="text-sm text-zinc-400 mt-1">{point.meaning}</p>
              <p className="text-xs text-zinc-500 mt-2">{point.surface}</p>
            </Link>
          ))}
        </section>

        <section>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            The loop is the product
          </p>
          <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">
            {LOOP}
          </pre>
        </section>

        <section>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            Where P2P enters
          </p>
          <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">
            {PEERS}
          </pre>
          <p className="text-zinc-300 mt-4">{THESIS}</p>
          <p className="text-sm text-zinc-500 mt-2">
            Not two AIs chatting. Φ = e_cold(final) − e_reuse(final). List only
            if Φ &gt; 0. A tie is not a win. An unsettled receipt is not revenue.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/architecture">Architecture</Link>
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/marketplace">Marketplace</Link>
          <Link className="underline" href="/api/plane">Plane JSON</Link>
        </nav>
      </main>
    </div>
  );
}