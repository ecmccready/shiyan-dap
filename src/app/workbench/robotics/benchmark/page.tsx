"use client";

export default function RoboticsBenchmarkPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Long-horizon robotics · persistent-autonomy benchmark</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Protocol for comparing look-back and greedy policies on physical robots. Synthetic protocol only. No real robot control yet.
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Measures</h2>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Whole-body coordination across locomotion and manipulation</li>
          <li>Predicted versus observed state</li>
          <li>Accumulated error and drift</li>
          <li>Failure detection and recovery</li>
          <li>Human intervention frequency</li>
          <li>Long-run task completion, uptime, and resource consumption</li>
          <li>Look-back policy performance against a greedy baseline</li>
        </ul>
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
          Aethel Node verifies the evidence pack and ranks the next policy. Real robot control remains outside the engine until a hardware adapter is added.
        </p>
      </section>
    </main>
  );
}