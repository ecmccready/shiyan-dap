import Link from "next/link";

export default function SelfPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        .self(B, M) → (B′, M′, A′)
      </p>
      <h1 className="text-2xl font-semibold">.self()</h1>
      <p className="text-sm text-zinc-400">
        Compact form: .self(B,M) = .self(W(B,A(M,B)), M ⊕ z).
        Observable Lyapunov stand-in: V = e². We record whether V
        fell. We do not claim V → V* on this repo.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A_{t+1} = .self( M ⊕ Φ[ ΔB - P(A,M,B) ], B' )
B' = W(B, A)

want  lim ||e_t|| = 0   as observation, not theorem
want  V(M',B') < V(M,B) when e ≠ 0`}
      </pre>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Step it
        </Link>
        <Link className="underline" href="/agents">
          Sub-agents
        </Link>
      </nav>
    </main>
  );
}