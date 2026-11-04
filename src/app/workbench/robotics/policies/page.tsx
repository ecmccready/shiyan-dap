"use client";

export default function PoliciesPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics policies</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Synthetic fixture. Look-back versus greedy under identical conditions. Real robot control remains outside the engine.
      </p>

      <section className="border rounded p-3 text-sm mb-4">
        <h2 className="font-medium mb-2">Look-back policy</h2>
        <div>Scores the next action by retrospective error reduction.</div>
        <div>Uses prior experience to rank candidates that previously reduced ΔΦ.</div>
        <div>Records predicted state, observed state, and intervention events.</div>
      </section>

      <section className="border rounded p-3 text-sm mb-4">
        <h2 className="font-medium mb-2">Greedy policy</h2>
        <div>Scores the next action by immediate progress only.</div>
        <div>No retrospective ranking. No prior experience reuse.</div>
        <div>Records the same predicted and observed state for comparison.</div>
      </section>

      <section className="border rounded p-3 text-sm">
        <h2 className="font-medium mb-2">Comparison</h2>
        <div>Both policies run under identical start conditions and seeds.</div>
        <div>ΔΦ advantage and intervention reduction are computed after the run.</div>
        <div>Evidence pack is exportable and verifiable by hash.</div>
      </section>
    </main>
  );
}