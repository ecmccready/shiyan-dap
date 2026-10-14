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
            Optimus as relative movement · sealed abstraction
          </p>
          <h1 className="text-3xl font-bold mb-4">
            Autonomous agent navigates relative scope
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            An autonomous agent navigates relative scope by repeatedly measuring its state against a target, taking actions that change that relationship, and using observed outcomes to select subsequent actions. This generalizes beyond physical movement. The common abstraction is a state transition evaluated against a target.
          </p>
        </header>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">A · B · z · Self()</h2>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li><span className="text-white font-medium">A — Workspace:</span> chooses the destination and strategy.</li>
            <li><span className="text-white font-medium">B — Optimus / Workbench:</span> navigates the available actions and states.</li>
            <li><span className="text-white font-medium">z — Outcome:</span> measures whether the destination was reached and at what cost.</li>
            <li><span className="text-white font-medium">Self():</span> uses previous navigation results to improve the next route. (Level 3 — not yet reading prior Runs.)</li>
          </ul>
          <p className="text-xs text-zinc-500">
            Same split already live: Home A controller · Workbench B commercial plant · Run · measure z → e → Δe / Φ.
          </p>
        </section>

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

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm text-zinc-300">
          <h2 className="text-xl font-semibold text-white">Generalizes beyond physical movement</h2>
          <ul className="space-y-2">
            <li>• In a software workflow, movement is a transition between execution states.</li>
            <li>• In a marketplace, movement is a change in the state of an asset or transaction.</li>
            <li>• In an optimization task, movement is a reduction in objective error.</li>
            <li>• In physical robotics, movement is a change in position relative to a reference frame.</li>
          </ul>
          <p className="text-zinc-500 text-xs">The common abstraction is a state transition evaluated against a target. Same sealed sequence across Safety, Optimus, Client.</p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-6 space-y-4 font-mono text-sm">
          <h2 className="text-xl font-semibold font-sans">Formal relative error</h2>
          <p className="text-zinc-400 font-sans text-sm">Let the current state be x_t, the target be x*, and the action be u_t.</p>
          <p>x&#123;t+1&#125; = f(x_t, u_t)</p>
          <p className="text-zinc-400 font-sans text-sm">Define relative error as:</p>
          <p>e_t = x* - x_t</p>
          <p className="text-zinc-400 font-sans text-sm">Then the movement achieved is:</p>
          <p>Δx_t = x&#123;t+1&#125; - x_t</p>
          <p className="text-zinc-400 font-sans text-sm">The controller evaluates whether that movement reduces the error:</p>
          <p>Δe_t = e&#123;t+1&#125; - e_t</p>
          <p className="text-xs text-zinc-500 font-sans">
            Φ only when final e falls. Reuse refused on tie or increase. Same rule as Safety (0.014 / 0.065 / 0.065) and Optimus packs. Self() does not yet read prior Runs.
          </p>
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