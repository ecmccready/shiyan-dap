import Link from "next/link";

export default function LoopPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Tight loop · no fake $1
      </p>
      <h1 className="text-2xl font-semibold">Loop</h1>
      <p className="text-sm text-zinc-400">
        Create → Prove → Learn → Act. z is computed from the ledger.
        A click is not settlement. An independent B dollar is still
        the next real trial.
      </p>

      <ol className="space-y-3 text-sm">
        <li className="border border-zinc-800 rounded-lg p-3">
          <span className="text-emerald-400">1 Create</span>
          <p className="text-zinc-400 mt-1">
            Name the work.{" "}
            <Link className="underline" href="/upload">
              /upload
            </Link>
          </p>
        </li>
        <li className="border border-zinc-800 rounded-lg p-3">
          <span className="text-emerald-400">2 Prove</span>
          <p className="text-zinc-400 mt-1">
            Offer the $1 object. Observe via webhook, not the query
            string.{" "}
            <Link className="underline" href="/offer">
              /offer
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/proof">
              /proof
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/nfts">
              /nfts
            </Link>
          </p>
        </li>
        <li className="border border-zinc-800 rounded-lg p-3">
          <span className="text-emerald-400">3 Learn</span>
          <p className="text-zinc-400 mt-1">
            Measure what happened.{" "}
            <Link className="underline" href="/measurements">
              /measurements
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/validation">
              /validation
            </Link>
          </p>
        </li>
        <li className="border border-zinc-800 rounded-lg p-3">
          <span className="text-emerald-400">4 Act</span>
          <p className="text-zinc-400 mt-1">
            z names the next move.{" "}
            <Link className="underline" href="/bot">
              /bot
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/workspace">
              /workspace
            </Link>
          </p>
        </li>
      </ol>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`OFFER → TRANSACTION (Stripe, external)
      → EXTERNAL EVENT (webhook observed 1)
      → MEASUREMENT
      → z

not claimed: Level 3, independent B, Dashboard destination`}
      </pre>
    </main>
  );
}