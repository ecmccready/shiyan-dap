"use client";

const STEPS = [
  {
    id: "def",
    title: "1. Experiment definition",
    detail: "Robot, task, environment, controller, starting state, trial conditions.",
  },
  {
    id: "lb",
    title: "2. Look-back versus greedy",
    detail: "Both policies under identical conditions; repeated across seeds.",
  },
  {
    id: "wb",
    title: "3. Whole-body measurement",
    detail: "Locomotion, manipulation, balance, coordination, drift, recovery.",
  },
  {
    id: "ev",
    title: "4. Evidence verification",
    detail: "Raw observations, predictions, timestamps, intervention events, content hashes.",
  },
  {
    id: "roe",
    title: "5. ROE optimization",
    detail: "Which experience improves subsequent decisions.",
  },
  {
    id: "ind",
    title: "6. Independent validation",
    detail: "Exportable, reproducible results for external researchers and customers.",
  },
];

const TARGETS = [
  { name: "Tesla Optimus", focus: "Long-horizon task reliability, intervention reduction, persistent autonomy." },
  { name: "Figure AI", focus: "Independent evidence and verification of whole-body robotic performance." },
  { name: "Physical Intelligence", focus: "Policy evaluation, persistent experience, measurable improvement." },
  { name: "Fei-Fei Li / Stanford", focus: "Spatial intelligence and embodied AI research collaboration." },
];

export default function RoboticsBenchmarkPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Persistent Autonomy Benchmark v2</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Experimental engine underneath the protocol. Synthetic fixture today. Aethel Node is the verification and optimization layer above the policy.
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Engine steps</h2>
        <div className="border rounded">
          {STEPS.map((s) => (
            <div key={s.id} className="border-b last:border-b-0 p-3 text-sm">
              <div className="font-medium">{s.title}</div>
              <div className="text-neutral-600">{s.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Commercial targets</h2>
        <div className="border rounded">
          {TARGETS.map((t) => (
            <div key={t.name} className="border-b last:border-b-0 p-3 text-sm">
              <div className="font-medium">{t.name}</div>
              <div className="text-neutral-600">{t.focus}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Status</h2>
        <p className="text-sm">
          Protocol and measure table are live. Real sensor data, physical execution, and independent attestation are not yet established. No paid pilot.
        </p>
      </section>
    </main>
  );
}