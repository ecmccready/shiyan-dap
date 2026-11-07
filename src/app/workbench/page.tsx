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
    </main>
  );
}
