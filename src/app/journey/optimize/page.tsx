import type { Metadata } from "next";
import Link from "next/link";
import JourneyNav from "@/components/JourneyNav";
import LoopStrip from "@/components/LoopStrip";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "03 Optimize | Shiyan DAP",
  description: "Stage 03 of the semiconductor engineering journey. 4D-SCP candidates, including STOP results.",
};

export default function OptimizePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="03 Optimize" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Stage 03 Optimize</p>
        <h1 className="text-3xl font-bold">Run 4D-SCP exploration</h1>
        <LoopStrip here="silicon" note="Stage 03 Optimize is inside Layer One." />
        <p className="text-zinc-300">
          4D-SCP owns the representations and operations. Candidates are frozen only after a pre-registered procedure. STOP results stay in the ledger. This stage does not promise an optimized chip.
        </p>
        <p className="text-sm text-zinc-400">
          Kept negatives include v0.1.28 and v0.1.29. v0.1.30 is PASS on wall time and is still not a physically verified reference.
        </p>
        <p className="text-sm text-zinc-400">
          <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>
        </p>
        <JourneyNav href="/journey/optimize" />
      </main>
    </div>
  );
}
