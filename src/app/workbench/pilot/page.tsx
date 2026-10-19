import Link from "next/link";

export default function PilotPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Paid pilot</h1>
      <p className="text-sm text-neutral-700">Aethel Node proves that the next action is no longer a misdiagnosis.</p>
      <p className="text-sm text-neutral-700">
        Available only after the workflow is reliable and a measurable business
        outcome has been demonstrated on matched cases.
      </p>

      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Price the measured Φ (error reduction) against a predeclared baseline.</li>
        <li>
          Settlement is verified only after the client exports and accepts the
          proof record.
        </li>
        <li>No charge on ties or regressions.</li>
      </ul>

      <div className="rounded border bg-neutral-50 p-4 text-sm">
        <p className="font-medium">Current status</p>
        <p className="mt-1 text-neutral-600">
          Evidence collection. Pricing and settlement activate after one
          confirmed improved Run under safety constraints.
        </p>
      </div>

      <section className="rounded border p-4 text-sm">
        <p className="font-medium">Request a pilot</p>
        <p className="mt-1 text-neutral-600">
          Aethel Node proves that the next action is no longer a misdiagnosis. Start a pilot request
          by running your repeated workflow and reference through the client pipeline and exporting
          the Run. Pricing is set per pilot against the measured Φ; no charge on ties or regressions.
        </p>
        <Link
          href="/workbench/client"
          className="mt-3 inline-block rounded bg-neutral-900 px-3 py-1.5 text-white"
        >
          Request a pilot →
        </Link>
      </section>

      <p className="text-xs text-neutral-500">
        Client handoff:{" "}
        <Link href="/workbench/client" className="underline">
          /workbench/client
        </Link>
        . Export the JSON from there before any commercial discussion.
      </p>
    </main>
  );
}