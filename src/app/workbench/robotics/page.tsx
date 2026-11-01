"use client";

export default function RoboticsPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics policies</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Know → Know How → Show → Do on the same engine. Synthetic fixture only. No Level 4 change.
      </p>
      <section className="mb-6">
        <h2 className="font-medium mb-2">Know</h2>
        <p>Synthetic observation → action sequence fixture with preserved provenance.</p>
      </section>
      <section className="mb-6">
        <h2 className="font-medium mb-2">Know How</h2>
        <p>ROE look-back ranks candidate policies by retrospective ΔΦ vs greedy baseline.</p>
      </section>
      <section className="mb-6">
        <h2 className="font-medium mb-2">Show</h2>
        <p>Evidence graph: source tensors → policy steps → predicted vs actual, with content hashes.</p>
      </section>
      <section>
        <h2 className="font-medium mb-2">Do</h2>
        <p>Authorized (or simulated) execution gate. Human-in-the-loop disposition recorded.</p>
      </section>
    </main>
  );
}