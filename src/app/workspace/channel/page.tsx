import Link from "next/link";

export default function ChannelPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Channel · P2P surface inside the $10 room
      </p>
      <h1 className="text-2xl font-semibold">Channels</h1>
      <p className="text-sm text-zinc-400">
        Workspace is the container. A channel is where A acts and B is
        either computed or observed. Buy as B does not replace this
        page. It becomes the authoritative row on CH-b when an
        independent payer exists.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-emerald-400">CH-a</p>
          <p className="text-lg">Endogenous B</p>
          <p className="text-xs text-zinc-500 mt-2">
            Continuous. Provisional z. Machine keeps moving.
          </p>
          <Link className="text-sm underline" href="/workspace">
            Compute in workspace
          </Link>
        </div>
        <div className="border border-emerald-800 rounded-lg p-4">
          <p className="text-xs text-emerald-400">CH-b</p>
          <p className="text-lg">External B · $1</p>
          <p className="text-xs text-zinc-500 mt-2">
            Authoritative when webhook observed=1. Founder here is
            still A.
          </p>
          <Link className="text-sm underline" href="/offer">
            Offer $1
          </Link>
        </div>
      </section>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`if (externalB.exists) {          // CH-b
  B = externalB.observed
  z = measure(predictedB, B)
} else {                         // CH-a
  B = endogenousB
  z = provisionalMeasure(B)
}

B_pred = f(S, T, V, C)
E_B    = B_observed - B_pred`}
      </pre>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace
        </Link>
        <Link className="underline" href="/loop">
          Loop
        </Link>
        <Link className="underline" href="/proof">
          Proof
        </Link>
        <Link className="underline" href="/nfts">
          /nfts rail
        </Link>
      </nav>
    </main>
  );
}