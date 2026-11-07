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
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Drift review</div>
        <div className="text-sm text-zinc-400">
          When Φ does not converge, the telemetry response includes review_flag: "DRIFT_EXCEEDED". Flag the runtime for human review.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Automated proof</div>
        <div className="text-sm text-zinc-400">
          POST /api/v1/proof hashes the telemetry result and stores it as an experience record. The proof is content-hashed and available for inspection.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Five evidence conditions</div>
        <div className="text-sm text-zinc-400">
          Non-synthetic source observations. Reproducible improvement against a declared baseline. Independent review. Measured customer outcome. Owner authorization.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Platform contract</div>
        <div className="text-sm text-zinc-400">
          Aethel Node Extension Architecture v1.1. A third-party Workbench produces ExperienceRecord, VerificationResult, MetamorphicResult, and NextActionProposal without modifying the core engine.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Recursive improvement</div>
        <div className="text-sm text-zinc-400">
          Shiyan DAP → Aethel executes → Verifies → Hugging Face remembers → ROE improves next action. Run 1 must influence Run 2.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Commercial offer</div>
        <div className="text-sm text-zinc-400">
          Prove the outcome. Then decide. The offer page directs visitors into the proof journey first.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Acquisition gate</div>
        <div className="text-sm text-zinc-400">
          Acquisition remains locked until the five evidence conditions are met. The agent prepares an opportunity and requests approval before contacting anyone.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Proof journey</div>
        <div className="text-sm text-zinc-400">
          /workbench/journey is the front door. One guided experience: objective, paired experiment, measurement, verification, disposition, acquisition readiness.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Domains</div>
        <div className="text-sm text-zinc-400">
          The Do group in the Domains dropdown links to Live telemetry, Drift review, Live middleware, Auto proof, Stream harness, and Automated proof.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Hugging Face memory</div>
        <div className="text-sm text-zinc-400">
          Append-only founder experience archive. Level 4 is authoritative. Hugging Face stores versioned records. ROE retrieves and qualifies.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">ROE next-action</div>
        <div className="text-sm text-zinc-400">
          ROE retrieves prior eligible experiences, excludes failed or synthetic runs, and proposes the next action. Run 1 must influence Run 2.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Metamorphic verification</div>
        <div className="text-sm text-zinc-400">
          Same seed and inputs reproduce the verdict. Controlled transformations test whether expected behavior survives. Deterministic replay.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Founder flywheel</div>
        <div className="text-sm text-zinc-400">
          Founder Reference Flywheel v1.1. Real memory. Real verification. Real recursive improvement. Live, inspectable presentation of the cycle.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Extension architecture</div>
        <div className="text-sm text-zinc-400">
          Aethel Node Core: Execution, Verification, Memory, ROE. Workbench SDK for external extensions. Independent builders produce records without modifying the core engine.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Neocloud connector</div>
        <div className="text-sm text-zinc-400">
          Live middleware for hyper-scale AI workloads. Telemetry ingestion, realtime Φ drift evaluation, automated cryptographic proof publishing, and force-dynamic rendering.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Audit vault</div>
        <div className="text-sm text-zinc-400">
          Automated cryptographic proof publisher. Telemetry results are hashed and stored as experience records. Content-hashed and available for inspection.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Force-dynamic</div>
        <div className="text-sm text-zinc-400">
          /api/v1/telemetry and /api/v1/proof export dynamic = "force-dynamic". Workbench layout wraps children in Suspense. Vercel build is stable.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Stream test</div>
        <div className="text-sm text-zinc-400">
          scripts/stream-test-telemetry.ts posts two frames. Frame 1 converges. Frame 2 returns review_flag: "DRIFT_EXCEEDED". Both can include auto_proof.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Level 4 boundary</div>
        <div className="text-sm text-zinc-400">
          Level 4 remains the authoritative execution and verification plant. The live middleware connector is additive and does not modify it.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Commercial loop</div>
        <div className="text-sm text-zinc-400">
          Eight-step commercial loop: acquisition, objective, execution, verification, measurement, evidence, disposition, offer. Prove the outcome. Then decide.
        </div>
      </div>
      <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Recursive dynamics</div>
        <div className="text-sm text-zinc-400">
          Aethel Node ↔ Shiyan DAP. The repository is the living reference implementation, the accumulated memory, the proof of capability, and the first commercial case.
        </div>
      </div>
    </main>
  );
}
