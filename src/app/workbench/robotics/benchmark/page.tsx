"use client";

const MEASURES = [
  { id: "coord", label: "Whole-body coordination", predicted: "0.82", observed: "0.76", unit: "score" },
  { id: "state", label: "Predicted vs observed state", predicted: "0.91", observed: "0.84", unit: "match" },
  { id: "drift", label: "Accumulated error / drift", predicted: "0.04", observed: "0.07", unit: "Δe" },
  { id: "recovery", label: "Failure detection & recovery", predicted: "1.2s", observed: "2.1s", unit: "time" },
  { id: "intervention", label: "Human intervention frequency", predicted: "0.08", observed: "0.14", unit: "rate" },
  { id: "uptime", label: "Task completion / uptime", predicted: "0.95", observed: "0.88", unit: "ratio" },
  { id: "lookback", label: "Look-back vs greedy ΔΦ", predicted: "0.023", observed: "0.019", unit: "ΔΦ" },
];

export default function RoboticsBenchmarkPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics · persistent-autonomy benchmark</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Synthetic protocol results. Aethel Node verifies the evidence pack and ranks the next policy. Real robot control remains outside the engine.
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Measures</h2>
        <div className="border rounded">
          {MEASURES.map((m) => (
            <div key={m.id} className="border-b last:border-b-0 p-3 flex justify-between text-sm">
              <span>{m.label}</span>
              <span>pred {m.predicted} · obs {m.observed} · {m.unit}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Protocol</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          <li>Define a long-horizon task with a clear terminal condition.</li>
          <li>Run the greedy baseline and the look-back policy under identical start conditions.</li>
          <li>Record predicted state, observed state, and intervention events at each step.</li>
          <li>Compute ΔΦ, recovery time, and intervention rate.</li>
          <li>Human reviewer signs the disposition. Evidence pack is exportable.</li>
        </ol>
      </section>

      <section>
        <h2 className="font-medium mb-2">Integration point</h2>
        <p className="text-sm">
          Workspace A oversees and ranks. Workbench B records the pack. Aethel Node is the verification layer above the policy, not a foundation model.
        </p>
      </section>
    </main>
  );
}