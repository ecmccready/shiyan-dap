export default function StatusPage() {
  const items = [
    { surface: "/roadmap", status: "live", note: "durability + acquisition priorities" },
    { surface: "/workbench/start", status: "live", note: "guided first run" },
    { surface: "/workbench/spine", status: "live", note: "product spine view" },
    { surface: "/workbench/autonomous", status: "live", note: "checkpoint, idempotency, precheck, verified" },
    { surface: "/workbench/autonomous/proof", status: "live", note: "recovery + gate proof" },
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Level 4</p>
        <h1 className="text-2xl font-semibold">Durability status</h1>
        <p className="text-neutral-700">
          Current surfaces from this exploratory slice. Client-side persistence only; server record is the next plant.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.surface} className="rounded border p-4">
            <a href={item.surface} className="font-medium underline">
              {item.surface}
            </a>
            <p className="text-sm text-neutral-600">{item.note}</p>
          </li>
        ))}
      </ul>

      <p className="text-sm text-neutral-500">
        Next: server-side run record, measured acquisition, external client with predeclared outcome.
      </p>
    </main>
  );
}
