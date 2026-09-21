import Link from "next/link";

const SAMPLE = `{
  "proposal": "B",
  "workspaceId": "WS-founder",
  "channelId": "CH-b",
  "predicted": { "scale": 0.72, "time": 0.81, "speed": 0.64 },
  "weight": 0.71,
  "external_event": { "price": 1.00, "source": "stripe", "authoritative": true },
  "observed": { "settled_in_shiyan": false },
  "z": "provisional — measurement pending independent B",
  "next_action": "WAIT_EXTERNAL"
}`;

export default function WorkspacePage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-8">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace · $10 container · $1 is the instrument
      </p>
      <h1 className="text-2xl font-semibold">Workspace</h1>
      <p className="text-sm text-zinc-400">
        This is the environment a team would pay $10 / month to keep:
        predicted transition versus observed transition, written to a
        ledger, computed into z, which names the next action. The $1
        Buy as B is not the product. It is the external calibration
        point for B.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-emerald-400">Pays for the room</p>
          <p className="text-lg">$10 / month</p>
          <p className="text-xs text-zinc-500 mt-2">
            Endogenous loop. Channels, ledger, z. Not billed in this
            commit.
          </p>
        </div>
        <div className="border border-emerald-800 rounded-lg p-4">
          <p className="text-xs text-emerald-400">Calibrates B</p>
          <p className="text-lg">Buy as B · $1</p>
          <p className="text-xs text-zinc-500 mt-2">
            Exogenous observation. Authoritative when an independent
            payer exists. Founder in this browser is still A.
          </p>
          <Link
            href="/offer"
            className="inline-block mt-3 text-sm underline"
          >
            Open offer
          </Link>
        </div>
      </section>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`WORKSPACE
  State / Ledger     A → action → B
  predict B          B_pred = f(S, T, V, C)
  Buy as B = $1      external event (if present)
  observe            success / failure / time
  measure            E_B = B_observed - B_pred
  z                  next action

if externalB.exists
  B = externalB.observed   // authoritative
  z = measure(predictedB, B)
else
  B = endogenousB          // continuous, provisional
  z = provisionalMeasure(B)`}
      </pre>

      <section className="space-y-2">
        <h2 className="text-sm text-emerald-400">Ledger row (named)</h2>
        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
          {SAMPLE}
        </pre>
        <p className="text-xs text-zinc-500">
          settled_in_shiyan stays false until webhook observed=1 from
          an independent B. Query string is not that row.
        </p>
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/offer">
          Offer $1
        </Link>
        <Link className="underline" href="/proof">
          Proof
        </Link>
        <Link className="underline" href="/loop">
          Loop
        </Link>
        <Link className="underline" href="/validation">
          Validate
        </Link>
        <Link className="underline" href="/nfts">
          /nfts rail
        </Link>
      </nav>
    </main>
  );
}