"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function RelativeMovementPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B · Relative" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <header>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            Relative-scope mathematics · specification
          </p>
          <h1 className="text-3xl font-bold mb-4">
            State → relative error → action → measured improvement → next action
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Mathematical specification. Execution lives in the shared operator. Φ only when final e falls. Self() does not yet read prior Runs.
          </p>
          <Link href="/workbench/operator" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
            → Live operator (actual execution)
          </Link>
        </header>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Objective → Actual status</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-2 pr-4 text-white font-medium">Objective</th>
                  <th className="py-2 text-zinc-300">Actual status</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Relative movement mathematics</td>
                  <td className="py-2">Documented here (specification)</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">One-dimensional operator concept</td>
                  <td className="py-2">Not fully specified as an executable operator; this page uses general state/error mathematics</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Optimus as the reference environment</td>
                  <td className="py-2">Connected conceptually and through navigation</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Blockchain narrative</td>
                  <td className="py-2">Absent, as intended</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Autonomous learning from prior Runs</td>
                  <td className="py-2">Explicitly marked as not yet implemented in Self()</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-white">End-to-end optimized execution</td>
                  <td className="py-2">Reference pseudocode on this page. Live shared operator on /workbench/operator that calls the real closed-loop functions</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            The functions in the reference algorithm (predict, execute, etc.) are illustrative interfaces. The live operator imports and calls the real implementations from src/lib/closed-loop.ts. It does not duplicate the logic.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">1. The core mathematics</h2>
          <p className="text-sm text-zinc-400">Define the system state at time t as x_t, its target as x*, and the action chosen by the controller as u_t.</p>
          <div className="space-y-3 text-sm text-zinc-300">
            <p><span className="text-white font-medium">A. Relative position</span></p>
            <p className="font-mono">e_t = x* − x_t</p>
            <p>The error vector describes the difference between the current state and the target. For complex states, use a distance or loss function d(x_t, x*).</p>
            <p><span className="text-white font-medium">B. Movement through scope</span></p>
            <p className="font-mono">x&#123;t+1&#125; = f(x_t, u_t, w_t)</p>
            <p>The action changes the state. The term w_t represents disturbances or environmental changes.</p>
            <p><span className="text-white font-medium">C. Measured progress</span></p>
            <p className="font-mono">Δe_t = e&#123;t+1&#125; − e_t</p>
            <p className="font-mono">G_t = ∥e_t∥ − ∥e&#123;t+1&#125;∥</p>
            <p>Positive G_t means the measured distance to the target decreased; negative G_t means it increased.</p>
            <p><span className="text-white font-medium">D. Action optimization</span></p>
            <p className="font-mono">u_t* = argmin_&#123;u∈U_safe&#125; [d(f(x_t, u), x*) + λC(u)]</p>
            <p>Choose an eligible action that balances target progress against execution cost. U_safe is the set of permitted actions, and λ controls the cost trade-off.</p>
          </div>
          <p className="text-xs text-zinc-500">This is the mathematical core. Same refusal rule as Safety and Optimus packs.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">2. The Shiyan DAP algorithm (reference)</h2>
          <p className="text-sm text-zinc-400">Reference only. Not a claim that every function is already implemented. See the live operator for the actual call path.</p>
          <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-6 overflow-x-auto">{`def self_optimize(target, state, run_history, safe_actions):
    error = distance(state, target)
    candidates = []
    for action in safe_actions:
        predicted_state = predict(state, action, run_history)
        predicted_error = distance(predicted_state, target)
        cost = estimate_cost(action)
        score = predicted_error + LAMBDA * cost
        candidates.append((score, action))
    _, action = min(candidates, key=lambda item: item[0])
    result = execute(action)
    next_state = observe_state(result)
    next_error = distance(next_state, target)
    run = record_run(state=state, action=action, result=result, error_before=error, error_after=next_error)
    updated_history = append(run_history, run)
    return next_state, updated_history`}</pre>
          <p className="text-xs text-zinc-500">predict() and execute() are illustrative. The live operator uses the real Self / nameYFromExperience / W / measureE from closed-loop.ts. Self() does not yet read prior Runs.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">3–5. Relation, convergence, positioning</h2>
          <p>Unchanged from prior version. Relative error, convergence condition V(x&#123;t+1&#125;) &lt; V(x_t), and product roles (Workspace A controller, Optimus/Workbench B environment, Run history, Self() feedback) remain the specification.</p>
          <p className="text-xs text-zinc-500">Φ only when final e falls. Level 3 boundary unchanged. Not revenue. Developmental stack is the product.</p>
        </section>

        <footer className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/operator" className="text-emerald-400 hover:underline">Live operator →</Link>
          <Link href="/workbench/optimus" className="text-emerald-400 hover:underline">← Optimus plant</Link>
          <Link href="/workbench" className="text-emerald-400 hover:underline">Workbench B</Link>
          <Link href="/workbench/history" className="text-emerald-400 hover:underline">History</Link>
        </footer>
      </main>
    </div>
  );
}