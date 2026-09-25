import Link from "next/link";

export default function WorkbenchPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        P2P State Machine B · experience generator
      </p>
      <h1 className="text-2xl font-semibold">Workbench B</h1>
      <p className="text-sm text-zinc-400">
        B is the environment. W(B,y) is the world transition. This
        is not a customer and not a separate task-setter. Tasks,
        policy, evaluator, and memory live in A. B generates
        experience for A.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`Workspace A
  Task · Policy · Evaluator · Memory · Self()
        ↓
P2P Workbench B
        ↓
   Experience
        → A

Create safety workbench from here when Domain = safety.
Music rail remains /nfts.`}
      </pre>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          A
        </Link>
        <Link className="underline" href="/workbench/safety">
          Diagnostic Safety
        </Link>
        <Link className="underline" href="/nfts">
          Music rail
        </Link>
        <Link className="underline" href="/marketplace">
          Marketplace
        </Link>
      </nav>
    </main>
  );
}