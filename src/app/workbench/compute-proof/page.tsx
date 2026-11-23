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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-zinc-400">Baseline</div>
            <div className="text-lg font-mono">—</div>
          </div>
          <div>
            <div className="text-zinc-400">With retained experience</div>
            <div className="text-lg font-mono">—</div>
          </div>
        </div>
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