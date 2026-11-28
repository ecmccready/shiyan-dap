import type { Metadata } from "next";
import Link from "next/link";
import JourneyNav from "@/components/JourneyNav";
import LoopStrip from "@/components/LoopStrip";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "05 Deploy or hand off | Shiyan DAP",
  description: "Stage 05 of the semiconductor engineering journey. Proof package. Physical programming is outstanding.",
};

export default function DeployPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="05 Deploy or hand off" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Stage 05 Deploy or hand off</p>
        <h1 className="text-3xl font-bold">Deliver the proof package</h1>
        <LoopStrip here="silicon" note="Stage 05 Deploy or hand off is inside Layer One." />
        <p className="text-zinc-300">
          The package is the ledger record, the bitstream hashes, and the runbook. The v0.1.31 image has not been loaded. Not yet physically validated. Power: needs real board.
        </p>
        <p className="text-sm text-zinc-400">
          Human steps are in <span className="font-mono">docs/hw/versa-runbook.md</span>. Status: reference (routed + simulated), physical verification pending.
        </p>
        <p className="text-sm text-zinc-400">
          <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>
          {" · "}
          <Link className="text-emerald-400 underline" href="/">Reference card</Link>
          {" · "}
          <a className="text-emerald-400 underline" href="https://github.com/ecmccready/shiyan-dap/pull/31">PR #31</a>
        </p>
        <JourneyNav href="/journey/deploy" />
      </main>
    </div>
  );
}
