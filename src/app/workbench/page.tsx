import Link from "next/link";

export default function WorkbenchPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workbench B · y under Workspace A
      </p>
      <h1 className="text-2xl font-semibold">Workbench B</h1>
      <p className="text-sm text-zinc-400">
        B is the workbench. Agents run y here. B is not a potential
        customer. Music is the launch vehicle. Misdiagnosis is the
        longer problem. Diagnostics valuation is context only.
      </p>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-sm">
        <p className="text-emerald-400 text-xs">Problem</p>
        <p>Misdiagnosis — measurement that cannot be faked by a label.</p>
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs text-zinc-400">
        <p className="text-emerald-400">Acquisition context · not owned</p>
        <p>
          Quest Diagnostics (NYSE: DGX) — market cap about $25.91B,
          enterprise value about $32.79B. Trailing P/E 26.00x,
          forward P/E 20.41x, P/S 2.38x, EV/Revenue 2.84x,
          EV/EBITDA 14.55x. Map, not a claim.
        </p>
      </section>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`x     = available state / context / resource
y     = action or transformation
(y,x) = action conditioned on state
z     = measurable state
Self()= uses z to name next y

Workbench executes y.
Workspace A owns Self() and the ledger.`}
      </pre>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace A
        </Link>
        <Link className="underline" href="/self">
          Self()
        </Link>
        <Link className="underline" href="/nfts">
          Music $1 rail
        </Link>
      </nav>
    </main>
  );
}