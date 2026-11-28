import type { Metadata } from "next";
import Link from "next/link";
import JourneyNav from "@/components/JourneyNav";
import LoopStrip from "@/components/LoopStrip";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "04 Prove | Shiyan DAP",
  description: "Stage 04 of the semiconductor engineering journey. Bit-exact checks and place-and-route evidence.",
};

export default function ProvePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="04 Prove" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Stage 04 Prove</p>
        <h1 className="text-3xl font-bold">Generate implementation evidence</h1>
        <LoopStrip here="silicon" note="Stage 04 Prove is inside Layer One." />
        <p className="text-zinc-300">
          Bit-exact simulation and place-and-route are separate labels. A route is not a physical measurement. Power: needs real board.
        </p>
        <p className="text-sm text-zinc-400">
          The v0.1.31 reference card is on the{" "}
          <Link className="text-emerald-400 underline" href="/">front door</Link>.
          The measured table is on{" "}
          <Link className="text-emerald-400 underline" href="/workbench/compute-proof">Computational Improvement Proof</Link>.
          The audit trail is the{" "}
          <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>.
        </p>
        <JourneyNav href="/journey/prove" />
      </main>
    </div>
  );
}
