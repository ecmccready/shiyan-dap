import WhatYouGet from "@/components/WhatYouGet";
import Link from "next/link";
import JourneyNote from "@/components/JourneyNote";

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
        <p className="mt-2 text-xs text-neutral-500">
          One line on price: set per pilot against the measured Φ, no charge on ties or regressions. The only fixed
          price today is the music vertical&apos;s $1 single on{" "}
          <Link href="/offer" className="underline">/offer</Link>. Evidence first:{" "}
          <Link href="/workbench/status" className="underline">/workbench/status</Link>.
        </p>
      </section>

      <p className="text-sm font-medium">
        Success metric: the run reaches the goal threshold e &lt; 0.16 with a positive Φ vs cold Self(); no charge
        on ties or regressions.
      </p>

      <p className="text-sm">
        Evidence you can share: a public proof URL (/workbench/result?run_id=…), a downloadable ledger, and read-only
        verify and anchor endpoints (/api/level4/verify, /api/level4/anchor); the anchor root is a prepared Merkle root,
        not on-chain.
      </p>

      <p className="text-sm">
        Proof you can send: the run&apos;s public URL (/workbench/result?run_id=…), which anyone can check against
        /api/level4/verify, plus the copied metrics string (run, e, Δe, Φ) or the latest eligible ledger line.
      </p>

      <p className="text-sm">
        Get the proof: open the public proof URL (<Link href="/workbench/result" className="underline">/workbench/result</Link>),
        check it against <a href="/api/level4/verify" className="underline">/api/level4/verify</a>, then{" "}
        <Link href="/workbench/client" className="underline">Request a pilot →</Link>
      </p>

      <p className="text-xs text-neutral-500">
        {"Boundary density: the dynamic limit keeps per-element tolerance constant (ε = 0.16·√(N/4)), so tensor size alone does not trigger a misdiagnosis."}{" "}
        <Link href="/workbench/autonomous/proof" className="underline">proof page</Link>
      </p>

      <p className="text-xs text-neutral-500">
        Enterprise surfaces (read-only, off-chain micro-ledger): an asset map and an audit summary with counts by domain,
        signature status and settlement rail, plus the current Merkle root, which is not anchored on-chain. Audit results
        come from a heuristic mock scan, not a third-party attestation. Not settled, not revenue.{" "}
        <Link href="/workbench/workspace" className="underline">Workspace</Link>
        {" · "}
        <a href="/api/v1/ledger/assets" className="underline">Asset map (JSON)</a>
        {" · "}
        <a href="/api/v1/audit/summary" className="underline">Audit summary (JSON)</a>
      </p>

      <JourneyNote className="text-neutral-500" />

      <p className="text-xs text-neutral-500">
        Proof-to-pilot journey and the two agent roles (acquisition and evidence, both human-approved):{" "}
        <a href="https://github.com/ecmccready/shiyan-dap/blob/main/docs/agent-roles.md" className="underline">docs/agent-roles.md</a>
      </p>

      <WhatYouGet tone="light" />

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