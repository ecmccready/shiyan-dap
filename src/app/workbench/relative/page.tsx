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
            Relative-scope mathematics · reference algorithm
          </p>
          <h1 className="text-3xl font-bold mb-4">
            State → relative error → action → measured improvement → next action
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Common algorithmic core across Shiyan, Workspace A, Workbench B, and Run history. Φ only when final e falls. Self() can consume approved experience; baseline Self() remains memory-free for comparison.
          </p>
          <Link href="/workbench/self" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
            → Level 3 Self() comparison
          </Link>
        </header>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">1. The core mathematics</h2>
          <p className="text-sm text-zinc-400">
            Define the system state at time t as x_t, its target as x*, and the action chosen by the controller as u_t.
          </p>
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
          <p className="text-xs text-zinc-500">
            This is the mathematical core: state → relative error → action → state transition → measured improvement → next action. Same refusal rule as Safety and Shiyan packs.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">2. The Shiyan DAP algorithm (reference)</h2>
          <p className="text-sm text-zinc-400">
            The equations become a product algorithm when Workspace A uses each Run to choose its next action. This is a reference algorithm, not a claim that every function is already implemented in full.
          </p>
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
          <p className="text-xs text-zinc-500">
            predict() and execute() are illustrative. Live SelfFromApproved retrieves only approved, safety-passed Runs with Φ &gt; 0. Baseline Self() remains memory-free. Reuse refused on tie or increase.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">3. How this relates to earlier x, y, z mathematics</h2>
          <p>An earlier expression was (x, y) + (y, x) = z. That notation alone does not specify an optimization algorithm; the operations and variable meanings must be defined.</p>
          <p>A useful operational interpretation:</p>
          <ul className="space-y-1">
            <li>• x: the current state or position.</li>
            <li>• y: the reference, target, or contextual information.</li>
            <li>• z: the measured result of combining the state and reference.</li>
          </ul>
          <p className="font-mono">z_t = r(x_t, y_t) = y_t − x_t</p>
          <p>Then z_t is the relative error rather than the final outcome. After execution, a separate measurement function evaluates the resulting state. A reference calculation, a state transition, and an observed outcome are three different operations.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">4. The convergence condition</h2>
          <p>To establish that the system genuinely optimizes, define a nonnegative error function V(x_t), such as the distance to the target.</p>
          <p className="font-mono">V(x&#123;t+1&#125;) &lt; V(x_t)</p>
          <p>More generally, under uncertainty:</p>
          <p className="font-mono">E[V(x&#123;t+1&#125;) | x_t, u_t] &lt; V(x_t)</p>
          <p>These conditions express progress but do not by themselves prove global convergence. Assumptions about the environment, available actions, observability, and controller behavior are required. Some tasks have unreachable targets or unavoidable trade-offs.</p>
          <p>The system therefore distinguishes:</p>
          <ul className="space-y-1 text-xs">
            <li>• Convergence: the target error decreases under specified conditions.</li>
            <li>• Stability: the system avoids uncontrolled oscillation or divergence.</li>
            <li>• Learning: past experience changes future action selection.</li>
            <li>• Autonomy: the system can perform the decision-and-execution cycle within its permissions and constraints.</li>
          </ul>
          <p className="text-xs text-zinc-500">They are related, but none automatically implies the others. Φ only when final e falls.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">5. How the mathematics is positioned in the product</h2>
          <ul className="space-y-2">
            <li><span className="text-white">Workspace A — Controller</span>: Defines the target, evaluates relative state, and chooses the next action.</li>
            <li><span className="text-white">Shiyan / Workbench B — Execution reference</span>: Provides an environment in which actions, transitions, and constraints can be tested.</li>
            <li><span className="text-white">Run history — Experience</span>: Records what happened, what it cost, and whether the action improved the result.</li>
            <li><span className="text-white">Self() — Feedback policy</span>: Baseline version does not read memory. SelfFromApproved consumes approved experience (Φ &gt; 0 only). Live comparison at /workbench/self.</li>
          </ul>
          <p className="text-xs text-zinc-500">
            Common core across verticals. Same sealed sequence. Developmental stack is the product. Not a cross-plant win. Not revenue.
          </p>
        </section>

        <footer className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/self" className="text-emerald-400 hover:underline">Level 3 Self() →</Link>
          <Link href="/workbench/shiyan" className="text-emerald-400 hover:underline">← Shiyan plant</Link>
          <Link href="/workbench" className="text-emerald-400 hover:underline">Workbench B</Link>
          <Link href="/workbench/history" className="text-emerald-400 hover:underline">History</Link>
          <Link href="/workbench/marketplace" className="text-emerald-400 hover:underline">Marketplace</Link>
        </footer>
      </main>
    </div>
  );
}