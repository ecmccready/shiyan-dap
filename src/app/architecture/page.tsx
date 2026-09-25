import Link from "next/link";

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Correspondence · not a clone
      </p>
      <h1 className="text-2xl font-semibold">SIMA-like map</h1>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`SIMA-like          Shiyan
Agent              Workspace A / Self()
Environment        Workbench B / P2P state
Task               next_task / y
State              B.s
Prediction         P from retrieved E
Actual             W(B,y)
Error              e = ΔB − hatΔB
Evaluation         U, V, z
Memory             E[]
Next task          weakest mean|e|
Safety             execute_task lock
Improvement        Self uses E for P and T

Task Setter + Reward Model are inside A.
claimed_sima2 = false`}
      </pre>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Run A
        </Link>
        <Link className="underline" href="/workbench">
          B
        </Link>
      </nav>
    </main>
  );
}