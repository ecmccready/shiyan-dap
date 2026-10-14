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
            Optimized relative-scope algorithm · sealed abstraction
          </p>
          <h1 className="text-3xl font-bold mb-4">
            Workspace A · Optimus / Workbench B · Outcome z · Self()
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            An autonomous agent navigates relative scope by repeatedly measuring its state against a target, taking actions that change that relationship, and using observed outcomes to select subsequent actions. The common abstraction is a state transition evaluated against a target.
          </p>
        </header>

        {/* 1. Optimized algorithm */}
        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">1. Optimized algorithm</h2>
          <div className="space-y-3 text-sm text-zinc-300">
            <p><span className="text-white font-medium">Workspace A</span> — Observe state, target, and available scope.</p>
            <p className="font-mono">Relative-scope function: e_t = d(x_t, x*)</p>
            <p>Calculate the distance from current state to target.</p>
            <p><span className="text-white font-medium">Optimus / Workbench B</span> — Select and execute an action.</p>
            <p className="font-mono">x&#123;t+1&#125; = f(x_t, u_t)</p>
            <p><span className="text-white font-medium">Outcome z</span> — Measure whether the action improved the result.</p>
            <p className="font-mono">Δe_t = e&#123;t+1&#125; − e_t</p>
            <p><span className="text-white font-medium">Self()</span> — Updates the next decision from recorded evidence. (Level 3 — not yet reading prior Runs.)</p>
          </div>
          <p className="text-xs text-zinc-500">
            Here, d is a distance or error function, x* is the target, and u_t is the chosen action. This formulation works across many kinds of tasks, provided their states and targets can be represented meaningfully. Φ only when final e falls.
          </p>
        </section>

        {/* 2. What this optimizes */}
        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">2. What this optimizes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-2 pr-4 text-white font-medium">Function</th>
                  <th className="py-2 pr-4 text-zinc-400">Before</th>
                  <th className="py-2 text-zinc-300">With relative-scope navigation</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Measurement</td>
                  <td className="py-2 pr-4 text-zinc-400">Records an outcome</td>
                  <td className="py-2">Measures progress toward a target</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Action</td>
                  <td className="py-2 pr-4 text-zinc-400">Executes a step</td>
                  <td className="py-2">Selects a step based on current error</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Feedback</td>
                  <td className="py-2 pr-4 text-zinc-400">Stores a Run</td>
                  <td className="py-2">Evaluates whether the Run improved the state</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2 pr-4 text-white">Self()</td>
                  <td className="py-2 pr-4 text-zinc-400">Intended autonomy</td>
                  <td className="py-2">Can use prior transitions to select actions</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-white">Product value</td>
                  <td className="py-2 pr-4 text-zinc-400">General AI/workbench proposition</td>
                  <td className="py-2">Measurable improvement in a customer’s workflow</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-sm text-zinc-300 space-y-2 pt-2">
            <p>The key addition is a decision rule. For example, a controller could prefer actions that reduce error while accounting for cost:</p>
            <p className="font-mono">u_t* = argmin_&#123;u∈U&#125; [e&#123;t+1&#125;(u) + λC(u)]</p>
            <p>Here, C(u) is the cost of an action and λ determines how strongly the system prioritizes efficiency. Safety constraints must also limit which actions are eligible.</p>
          </div>
        </section>

        {/* 3. Does it optimize the commercial product? */}
        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">3. Does it optimize the commercial product?</h2>
          <p>Potentially, yes. It provides a common algorithmic core for different applications instead of requiring a new conceptual model for every vertical.</p>
          <ul className="space-y-1">
            <li>• <span className="text-white">Optimus</span>: a reference environment for testing state transitions and corrective actions.</li>
            <li>• <span className="text-white">Workspace A</span>: the controller that chooses and evaluates actions.</li>
            <li>• <span className="text-white">Workbench B</span>: the environment or workflow where changes occur.</li>
            <li>• <span className="text-white">Run history</span>: the evidence used to improve later decisions.</li>
            <li>• <span className="text-white">Commercial product</span>: an execution system that demonstrates measurable improvements in cost, time, quality, or reliability.</li>
          </ul>
          <p className="text-xs text-zinc-500">
            Same sealed sequence across Safety, Optimus, and Client. Φ only when final e falls. Self() does not yet read prior Runs. Not a cross-plant win. Not revenue. Developmental stack is the product.
          </p>
        </section>

        {/* Prior abstraction kept */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Optimus as relative movement</h2>
          <div className="space-y-3">
            <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950">
              <p className="font-semibold">A — Reference frame</p>
              <p className="text-sm text-zinc-400">Current state · target state · available scope</p>
            </div>
            <div className="text-center text-zinc-500">↓</div>
            <div className="border border-zinc-800 rounded-2xl p-5">
              <p className="font-semibold">Optimus — Movement</p>
              <p className="text-sm text-zinc-400">Choose an action that changes the current state relative to the target</p>
            </div>
            <div className="text-center text-zinc-500">↓</div>
            <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950">
              <p className="font-semibold">z — Relative displacement</p>
              <p className="text-sm text-zinc-400">Measure progress, deviation, cost and remaining distance</p>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/optimus" className="text-emerald-400 hover:underline">← Optimus plant</Link>
          <Link href="/workbench" className="text-emerald-400 hover:underline">Workbench B</Link>
          <Link href="/workbench/history" className="text-emerald-400 hover:underline">History</Link>
          <Link href="/workbench/marketplace" className="text-emerald-400 hover:underline">Marketplace</Link>
        </footer>
      </main>
    </div>
  );
}