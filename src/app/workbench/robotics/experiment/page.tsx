"use client";

const SCHEMA = [
  { field: "Robot", value: "sim-humanoid-v1" },
  { field: "Task", value: "long-horizon loco-manipulation" },
  { field: "Environment", value: "warehouse-aisle-3" },
  { field: "Controller", value: "look-back-roe" },
  { field: "Starting state", value: "seeded-pose-A" },
  { field: "Trial conditions", value: "identical for both policies" },
];

const TRIALS = [
  { id: "t1", policy: "look-back", seed: 42, delta_phi: 0.023, interventions: 2, hash: "sha256:abc123" },
  { id: "t2", policy: "greedy", seed: 42, delta_phi: 0.011, interventions: 5, hash: "sha256:def456" },
  { id: "t3", policy: "look-back", seed: 17, delta_phi: 0.021, interventions: 1, hash: "sha256:ghi789" },
];

export default function RoboticsExperimentPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Persistent-autonomy experiment runner</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Deterministic fixture. Aethel Node verifies the evidence pack. Real robot control remains outside the engine until a hardware adapter is added.
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-2">1. Experiment schema</h2>
        <div className="border rounded">
          {SCHEMA.map((s) => (
            <div key={s.field} className="border-b last:border-b-0 p-3 flex justify-between text-sm">
              <span>{s.field}</span>
              <span className="text-neutral-600">{s.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-2">2–4. Policy runner · repeatability · measurement</h2>
        <div className="border rounded">
          {TRIALS.map((t) => (
            <div key={t.id} className="border-b last:border-b-0 p-3 text-sm">
              <div className="flex justify-between">
                <span>{t.policy} · seed {t.seed}</span>
                <span>ΔΦ {t.delta_phi.toFixed(3)} · interventions {t.interventions}</span>
              </div>
              <div className="text-neutral-500 text-xs mt-1">{t.hash}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-2">5. Aethel Node verification</h2>
        <p className="text-sm">
          Timestamped evidence, immutable run identifiers, content hashes, and ROE comparison of look-back versus greedy. Workspace A oversees; Workbench B records the pack.
        </p>
      </section>

      <section>
        <h2 className="font-medium mb-2">6. Evidence export</h2>
        <p className="text-sm">
          A customer or researcher can copy the pack. Synthetic fixture only. No paid pilot. No independent attestation yet.
        </p>
      </section>
    </main>
  );
}
