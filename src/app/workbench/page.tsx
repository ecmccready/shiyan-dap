import Link from "next/link";

export default function WorkbenchPage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        B · workbench · opened from Workspace A
      </p>
      <h1 className="text-2xl font-semibold">Workbench B</h1>
      <p className="text-sm text-zinc-400">
        This is the environment A acts on. Create a Diagnostic
        Safety Workbench here. That instance holds evidence state.
        It does not output y = diagnosis. Noise nav lives here.
      </p>

      <section className="border border-emerald-800 rounded-lg p-4 space-y-2">
        <p className="text-xs text-emerald-400">Create</p>
        <p className="text-lg">Diagnostic Safety Workbench</p>
        <p className="text-xs text-zinc-500">
          Evidence · agents · validation. Conflict stays unresolved.
          Escalation, not a silent result.
        </p>
        <Link className="text-sm underline" href="/workbench/safety">
          Create / open safety workbench
        </Link>
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">
          Workspace A
        </Link>
        <Link className="underline" href="/marketplace">
          Marketplace
        </Link>
        <Link className="underline" href="/trade">
          Trade
        </Link>
        <Link className="underline" href="/ping">
          Ping
        </Link>
        <Link className="underline" href="/protocol">
          Protocol
        </Link>
        <Link className="underline" href="/playlist">
          Playlist
        </Link>
      </nav>
    </main>
  );
}