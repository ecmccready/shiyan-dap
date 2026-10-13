export default function PilotPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Paid pilot</h1>
      <p className="text-sm">
        Available only after the workflow is reliable and a measurable business outcome has been demonstrated on matched cases.
      </p>
      <ul className="list-disc pl-5 text-sm space-y-1">
        <li>Price the measured Φ (error reduction) against a predeclared baseline.</li>
        <li>Settlement is verified only after the client exports and accepts the proof record.</li>
        <li>No charge on ties or regressions.</li>
      </ul>
      <p className="text-xs text-neutral-500">
        Current status: evidence collection. Pricing and settlement activate after one confirmed improved Run under safety constraints.
      </p>
    </main>
  );
}

