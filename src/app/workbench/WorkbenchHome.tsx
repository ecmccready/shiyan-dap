"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { newRunId, recordStartServer } from "@/lib/level4/acquisition";
import { useCopy, copiedRing } from "@/lib/use-copy";

/** Plain-text summary of what an outside party can verify today. Keep in sync with the block below and the README. */
function verificationSummary(origin: string): string {
  return [
    "Aethel Node: what an outside party can verify today",
    "",
    `- Safety-proof error wins (recomputed in your browser): Φ 0.014, 0.065 and 0.065. ${origin}/workbench/proof`,
    `- MCP commercial case: Φ +0.159 (sealed sequence 0.171 vs a greedy cold run at 0.33) on a starting plant we constructed, not customer data. On B1's default start the same comparison is Φ −0.051, not a win. ${origin}/workbench/compare`,
    `- Evidence pack export: ${origin}/workbench/result`,
    `- Recorded-run replay: ${origin}/api/level4/verify?run_id=run_mvmt18dm_dpbybz`,
    "",
    "Not yet confirmed: no paid pilot, no customer validation, no third-party attestation, and the anchor is a dry run.",
    `Full list: ${origin}/workbench/offer`,
  ].join("\n");
}

export default function WorkbenchHome() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const summaryCopy = useCopy(4000, undefined, "verification summary");

  async function beginGuidedRun() {
    setStarting(true);
    setStartError(null);
    try {
      const id = newRunId();
      await recordStartServer(id);
      window.sessionStorage.setItem("aethel-active-run-id", id);
      router.push(`/workbench/autonomous?run=${id}`);
    } catch {
      setStartError("Could not start the run. Please try again.");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Aethel Node</h1>
        <p className="text-zinc-300 max-w-2xl mb-2">
          Aethel Node proves that the next action is no longer a misdiagnosis.
        </p>
        <p className="text-zinc-300 max-w-2xl mb-8">
          Persistent self-monitoring autonomous system that can accumulate verified experience, use that experience to
          improve future decisions, and retain its operational identity across runs.
        </p>

        <section id="guided-run" className="scroll-mt-6 mt-8 rounded-2xl border border-emerald-900/70 p-5">
          <header className="mb-4 space-y-1">
            <h2 className="text-xl font-semibold">Start a durable run</h2>
            <p className="text-sm text-zinc-400">
              Set a measurable goal. Actions are safety-checked and recorded, and run progress can be resumed after interruption.
            </p>
          </header>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={beginGuidedRun}
              disabled={starting}
              className="inline-flex h-11 items-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Starting run…" : "Create run"}
            </button>
          </div>
          {startError && <p role="alert" className="mt-3 text-sm text-red-400">{startError}</p>}
        </section>

        <section
          data-home-verify
          aria-labelledby="home-verify-heading"
          className="mt-8 max-w-2xl rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-300"
        >
          <h2 id="home-verify-heading" className="text-base font-semibold">What an outside party can verify today</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs">
            <li>
              Three Safety-proof error wins (Φ 0.014, 0.065, 0.065), recomputed in your browser on{" "}
              <Link className="underline" href="/workbench/proof">/workbench/proof</Link>.
            </li>
            <li>
              The MCP commercial case, Φ +0.159 against a greedy cold run, on a starting plant we constructed (on B1&apos;s
              default start the same comparison is Φ −0.051, not a win):{" "}
              <Link className="underline" href="/workbench/compare">/workbench/compare</Link>.
            </li>
            <li>
              The evidence pack export on <Link className="underline" href="/workbench/result">/workbench/result</Link>, and
              recorded runs replayable at <a className="underline" href="/api/level4/verify?run_id=run_mvmt18dm_dpbybz">/api/level4/verify</a>.
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Not yet confirmed: no paid pilot, no customer validation, no third-party attestation, and the anchor is a dry run.
            Full list: <Link className="underline" href="/workbench/offer">/workbench/offer</Link>.
          </p>
          <button
            type="button"
            onClick={() => void summaryCopy.copy(verificationSummary(window.location.origin))}
            className={`mt-3 inline-flex h-9 items-center rounded-full border border-zinc-700 px-4 text-xs text-zinc-200 hover:border-zinc-500${copiedRing(summaryCopy.status)}`}
          >
            {summaryCopy.status === "copied"
              ? "Copied ✓"
              : summaryCopy.status === "failed"
                ? "Copy failed"
                : "Copy verification summary"}
          </button>
        </section>

        <p className="mt-8 max-w-2xl text-sm text-zinc-500">
          Everything else is in the Domains menu above: Know (what it is), Know How (how it works), Show (evidence and
          reference data) and Do (start, declare, pilot).
        </p>
      </main>
    </div>
  );
}
