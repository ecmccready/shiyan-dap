export const dynamic = "force-dynamic";

export default function ComputeProofPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Computational Improvement Proof</h1>
        <p className="text-zinc-400 mt-2">
          Customer workload → measured baseline → alternatives tested → verified improvement.
          Synthetic fixture only. Level 4 plant untouched. 4D-SCP not invoked.
        </p>
      </header>

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
          Figures are wall time in µs, rounded from committed cycles / median Fmax in{' '}
          <span className="font-mono">fixtures/scp/v0130-heldout.json</span>.
        </p>
        <p className="text-sm text-zinc-400">
          Values filled by the existing closed-loop run. Hashes and commands below allow independent regeneration.
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

      <section className="border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-5">
        <h2 className="text-xl font-semibold text-emerald-300">Commercial outcome</h2>
        <p className="mt-2">
          Customer pays for measurable computational value.
          Payment follows proof. The report above is the inspectable artifact.
        </p>
      </section>

      <footer className="text-xs text-zinc-500">
        Boundaries: synthetic/fixture data · Level 4 plant authoritative and unmodified ·
        4D-SCP complementary and not called · no silicon or board-power claims.
      </footer>
    </main>
  );
}
