import Level4Shell from "@/components/Level4Shell";
export default function SpinePage() {
  const nodes = [
    { name: "Workspace", role: "Controller · names the goal" },
    { name: "Workbench", role: "Execution environment" },
    { name: "Runs", role: "Unit of operation · Δe" },
    { name: "Self()", role: "Uses approved experience" },
    { name: "Safety", role: "Pre-action gate + budget" },
    { name: "History", role: "Verified results + recovery" },
  ];

  return (
    <Level4Shell>
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Product spine</p>
        <h1 className="text-2xl font-semibold">One consistent system</h1>
        <p className="text-zinc-300">
          Workspace, Workbench, Runs, Self(), safety, and history operate together. Level 4 durability sits on this spine.
        </p>
      </header>

      <ol className="space-y-3">
        {nodes.map((n, i) => (
          <li key={n.name} className="flex gap-4 rounded-xl border border-zinc-800 p-4">
            <span className="text-sm font-medium text-zinc-500">{i + 1}</span>
            <div>
              <p className="font-medium">{n.name}</p>
              <p className="text-sm text-zinc-400">{n.role}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm">
        <a href="/workbench/start" className="underline text-emerald-400">Guided start</a>
        {" · "}
        <a href="/workbench/autonomous" className="underline text-emerald-400">Autonomous run</a>
        {" · "}
        <a href="/workbench/autonomous/proof" className="underline text-emerald-400">Recovery proof</a>
        {" · "}
        <a href="/workbench/status" className="underline text-emerald-400">Status</a>
        {" · "}
        <a href="/roadmap" className="underline text-emerald-400">Roadmap</a>
      </p>
    </main>
    </Level4Shell>
  );
}