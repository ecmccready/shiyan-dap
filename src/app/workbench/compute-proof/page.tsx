import Link from "next/link";

export const dynamic = "force-dynamic";

const linkClass =
  "text-emerald-400 hover:text-emerald-300 underline underline-offset-2";

const MEASURES = [
  "Potential annual premium savings",
  "Estimated annual out-of-pocket exposure",
  "Coverage suitability",
  "Accuracy of the comparison",
  "Time saved navigating coverage choices",
] as const;

const CAPABILITIES: readonly { capability: string; value: string }[] = [
  { capability: "Workload intake & isolation", value: "Customer trust" },
  { capability: "Reproducible baseline", value: "Credibility" },
  { capability: "Automated candidate testing", value: "Engineering efficiency" },
  { capability: "Correctness verification", value: "Risk reduction" },
  { capability: "Performance & resource measurement", value: "Quantifiable value" },
  { capability: "Evidence ledger", value: "Auditability" },
  { capability: "Customer report & export", value: "Deliverable" },
  { capability: "Billing after agreed proof criteria", value: "Commercial conversion" },
];

export default function ComputeProofPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Computational Improvement Proof</h1>
        <p className="text-zinc-400 mt-2">
          Customer workload → measured baseline → alternatives tested → verified improvement.
          Synthetic fixture only. Level 4 plant untouched. 4D-SCP not invoked.
        </p>
        <p className="text-sm text-zinc-400 mt-3">
          The customer journey leads with the ACA as the US first reference market, then
          connects to the Medicare workbench and the Global Misdiagnosis vertical. AI agents
          present verifiable opportunities; the customer pays after agreed proof criteria.
          Evidence-only. No PHI. No clinical claims. Power needs real board.
        </p>
      </header>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold">Customer journey · ACA reference market</h2>
        <p className="text-xs uppercase tracking-widest text-emerald-400">
          US first reference market
        </p>
        <p className="text-sm text-zinc-200">
          Can a person or family identify a more affordable suitable health coverage option, with transparent evidence of the financial trade-offs?
        </p>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Measures</h3>
          <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-300 space-y-1">
            {MEASURES.map((measure) => (
              <li key={measure}>{measure}</li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-zinc-500">
          These are the declared comparison measures for the ACA reference market. This page
          does not claim live ACA plan feeds, live quotes, or a completed customer coverage
          comparison. No <span className="font-mono">/workbench/aca</span> route exists on{" "}
          <span className="font-mono">main</span>; the reference-market question and measures
          are published here.
        </p>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Progression path</h3>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
              <p className="text-xs uppercase tracking-widest text-emerald-400">1 · Lead</p>
              <p className="text-sm font-medium text-zinc-100">
                ACA (US first reference market)
              </p>
              <p className="text-xs text-zinc-500">
                Published on this page. Offer intake is at{" "}
                <Link href="/workbench/offer" className={linkClass}>
                  /workbench/offer
                </Link>
                .
              </p>
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
              <p className="text-xs uppercase tracking-widest text-emerald-400">2 · Next</p>
              <p className="text-sm font-medium text-zinc-100">
                <Link href="/workbench/medicare" className={linkClass}>
                  Medicare workbench
                </Link>
              </p>
              <p className="text-xs text-zinc-500">
                Synthetic public-data fixture. No live CMS. No PHI.
              </p>
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
              <p className="text-xs uppercase tracking-widest text-emerald-400">3 · Vertical</p>
              <p className="text-sm font-medium text-zinc-100">
                <Link href="/workbench/global" className={linkClass}>
                  Global Misdiagnosis vertical
                </Link>
              </p>
              <p className="text-xs text-zinc-500">
                Domain-neutral run status. Not a clinical finding.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold">Global framing</h2>
        <p className="text-sm text-zinc-300">
          A common engine, with separate country-specific adapters for policy, data, language,
          currency, and regulatory context. ACA is the first reference market; the customer
          problem—understanding, accessing, and affording healthcare—is global.
        </p>
        <p className="text-sm text-zinc-400">
          The virtual measurement path on this page and a future physical board are two
          execution paths through the same proof gate. Country adapters are the intended
          extension model; they are not claimed as shipped live feeds.
        </p>
        <p className="text-sm text-zinc-300">
          Continue to{" "}
          <Link href="/workbench/medicare" className={linkClass}>
            Medicare · Public Data Intelligence
          </Link>{" "}
          and{" "}
          <Link href="/workbench/global" className={linkClass}>
            Global · misdiagnosis
          </Link>
          .
        </p>
      </section>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold">Declared workload</h2>
        <p className="text-sm text-zinc-300">
          Fixture: synthetic computational task (cycles / error metric already used by the plant).
          Same bounded run path as existing proof surfaces.
        </p>
        <pre className="bg-zinc-900 p-3 rounded text-xs overflow-x-auto">
{`workload_id: compute-proof-fixture-v1
metric: cycles_or_error
acceptance: retain only if measured improvement and correctness preserved`}
        </pre>
      </section>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold">Measured result</h2>
        <p className="text-sm text-zinc-300">
          v0.1.30 <span className="font-mono">scp4d_hybrid_ff</span> (first-frame-from-own-churn).
          Verdict PASS (PR #28). Bit-exact on both held-out workloads; uses both engines.
          Five-seed 45F median Fmax 39.474205017089844 MHz. Wall time is cycles / Fmax.
          Power needs real board.
        </p>
        <p className="text-sm text-zinc-300">
          v0.1.31 Versa image of the same hybrid, reduced to ADDR_W 8 and cfg_D 256.
          Not the 35,438-COMB loop. Five LFE5UM-45F seeds all routed. Median Fmax{" "}
          <span className="font-mono">53.61930465698242</span> MHz (seed 2), above the
          pre-registered 35–40 MHz window; no delay was added. TRELLIS_COMB 2447/43848.
          Median critical path 18.649999879300594 ns. Seed 9 prefix: 6 tokens, 2 records.
          Seed 13 prefix: 282 tokens, 135 records. Both bit-exact in Icarus. Status:
          bitstream ready, awaiting physical board. Power needs real board. No PHI.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pr-3 py-2 font-medium">Workload</th>
                <th className="pr-3 py-2 font-medium">ADDR_W</th>
                <th className="pr-3 py-2 font-medium">Hybrid (µs)</th>
                <th className="pr-3 py-2 font-medium">Pipelined K1 (µs)</th>
                <th className="py-2 font-medium">N=4 full scan (µs)</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-zinc-200">
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">Original (seed 9)</td>
                <td className="pr-3 py-2">8</td>
                <td className="pr-3 py-2">301.79</td>
                <td className="pr-3 py-2">428.41</td>
                <td className="py-2">359.98</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">Original (seed 9)</td>
                <td className="pr-3 py-2">10</td>
                <td className="pr-3 py-2">1194.20</td>
                <td className="pr-3 py-2">1702.96</td>
                <td className="py-2">1427.30</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">Original (seed 9)</td>
                <td className="pr-3 py-2">12</td>
                <td className="pr-3 py-2">2398.43</td>
                <td className="pr-3 py-2">3428.57</td>
                <td className="py-2">2869.36</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">High-churn (seed 13)</td>
                <td className="pr-3 py-2">8</td>
                <td className="pr-3 py-2">608.42</td>
                <td className="pr-3 py-2">1056.85</td>
                <td className="py-2">614.95</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">High-churn (seed 13)</td>
                <td className="pr-3 py-2">10</td>
                <td className="pr-3 py-2">2410.05</td>
                <td className="pr-3 py-2">4212.29</td>
                <td className="py-2">2437.94</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="pr-3 py-2 font-sans text-zinc-300">High-churn (seed 13)</td>
                <td className="pr-3 py-2">12</td>
                <td className="pr-3 py-2">4817.60</td>
                <td className="pr-3 py-2">8426.09</td>
                <td className="py-2">4876.66</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Original: 31 full-scan frames, 33 K1 frames, 1 switch. High-churn: 44 full-scan frames, 4 K1 frames, 7 switches.
          Figures are wall time in µs, rounded from committed cycles / median Fmax in{" "}
          <span className="font-mono">fixtures/scp/v0130-heldout.json</span>.
        </p>
        <p className="text-sm text-zinc-400">
          Values filled by the existing closed-loop run. Hashes and commands below allow independent regeneration.
        </p>
        <p className="text-sm text-zinc-300">
          Bitstream ready, awaiting physical board: an optional scp4d codec (default off) beside the M3 reader,
          the Versa UART image checked in Icarus, and a signed receipt route at
          /api/v1/hw/receipts. Migration 007 is unapplied. The bitstream has not been loaded.
          Power needs real board. No PHI.
        </p>
      </section>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-3">
        <h2 className="text-xl font-semibold">Evidence pack</h2>
        <ul className="text-sm space-y-1 text-zinc-300">
          <li>Baseline performance recorded</li>
          <li>Alternative strategies tested under the same acceptance rule</li>
          <li>Verified improvement retained only when measured and correct</li>
          <li>Reproducible hashes + exact commands</li>
        </ul>
        <pre className="bg-zinc-900 p-3 rounded text-xs overflow-x-auto mt-3">
{`# regenerate
npx tsx scripts/check-scp-all.ts   # hardware track (unwired)
# plant proof path (existing)
# POST /api/level4/verify  or  existing proof export`}
        </pre>
      </section>

      <section className="border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold text-emerald-300">Commercial pipeline</h2>
        <p className="text-sm text-zinc-300">
          Customer pays for measurable computational value. Payment follows proof. The
          report above is the inspectable artifact. AI agents do the work: they seek out
          clients, present verifiable opportunities, and conversion happens only after
          agreed proof criteria are met.
        </p>
        <ol className="list-decimal pl-5 text-sm text-zinc-300 space-y-2">
          <li>
            AI agents seek out clients and present verifiable opportunities, starting with
            ACA coverage navigation and hardware or compute-proof engagements. See{" "}
            <Link href="/workbench/opportunity" className={linkClass}>
              Customer opportunity
            </Link>{" "}
            and{" "}
            <Link href="/workbench/acquisition" className={linkClass}>
              Acquisition agent
            </Link>
            .
          </li>
          <li>
            Every engagement gets a customer-specific experiment record. Each result is
            traceable to workload, code version, configuration, hardware target, and
            measurement conditions. The v0.1.30 table above is one such record: held-out
            seeds 9 and 13, <span className="font-mono">scp4d_hybrid_ff</span>, five-seed
            45F median Fmax, cycles over Fmax, fixture{" "}
            <span className="font-mono">fixtures/scp/v0130-heldout.json</span>.
          </li>
          <li>
            Independent evidence verification against pre-registered acceptance criteria.
            Improvement is retained only when it is measured and correctness is preserved.
          </li>
          <li>
            The customer pays after agreed proof criteria (billing after verified
            improvement). The existing offer surface is{" "}
            <Link href="/workbench/offer" className={linkClass}>
              /workbench/offer
            </Link>
            , with the proof-to-payment front door at{" "}
            <Link href="/workbench/journey" className={linkClass}>
              /workbench/journey
            </Link>
            . This page does not add a checkout form or process payments; no live customer
            billing is claimed here.
          </li>
        </ol>
      </section>

      <section className="border border-zinc-700 rounded-lg p-5 space-y-4">
        <h2 className="text-xl font-semibold">Capabilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pr-3 py-2 font-medium">Capability</th>
                <th className="py-2 font-medium">Commercial value / purpose</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {CAPABILITIES.map((row) => (
                <tr key={row.capability} className="border-t border-zinc-800">
                  <td className="pr-3 py-2 text-zinc-200">{row.capability}</td>
                  <td className="py-2">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-zinc-500">
        Boundaries: synthetic/fixture data · Level 4 plant authoritative and unmodified ·
        4D-SCP complementary and not called · no silicon or board-power claims · no PHI ·
        no clinical claims · no live ACA plan feeds · no live customer billing on this page.
      </footer>
    </main>
  );
}
