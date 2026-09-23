import Link from "next/link";

export default function WorkbenchPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        B_t = workbench state
      </p>
      <h1 className="text-2xl font-semibold">Workbench B</h1>
      <p className="text-sm text-zinc-400">
        B is the environment. W(B, y) advances it. B is not a
        counterparty and not a customer. Music is the first surface
        W can touch (`/nfts`). Misdiagnosis is a later domain for
        the same operator.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`B_{t+1} = W(B_t, y_t)
ΔB_t = B_{t+1} - B_t
e_t = ΔB_t - P(A_t, M_t, B_t)

SIMA-shaped cycle (named, not cloned):
task → action y → observe ΔB → z → M → .self()`}
      </pre>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          A
        </Link>
        <Link className="underline" href="/self">
          .self()
        </Link>
        <Link className="underline" href="/nfts">
          Music rail
        </Link>
      </nav>
    </main>
  );
}