export const dynamic = 'force-dynamic';

export default function WorkbenchDashboardPage() {
  return (
    <main className="max-w-3xl mx-auto p-8 text-zinc-300">
      <h1 className="text-xl text-white mb-4">Aethel Node // Workbench</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Live middleware: POST /api/v1/telemetry with predicted and observed. Non-converged runs return review_flag: "DRIFT_EXCEEDED". Optional auto_proof stores the result.
      </p>
      <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-950 text-sm">
        Routes are force-dynamic. Suspense boundary is in the workbench layout.
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Stream harness</div>
        <div className="text-sm text-zinc-400">
          scripts/stream-test-telemetry.ts posts two frames to /api/v1/telemetry. Start the dev server, then run npx tsx scripts/stream-test-telemetry.ts.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Auto proof</div>
        <div className="text-sm text-zinc-400">
          Include auto_proof: true in the telemetry POST. The route hashes and stores the result as an experience record and returns experience_id and hash.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Live middleware</div>
        <div className="text-sm text-zinc-400">
          /api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag: "DRIFT_EXCEEDED". /api/v1/proof hashes and stores the result as an experience record.
        </div>
      </div>
    </main>
  );
}
