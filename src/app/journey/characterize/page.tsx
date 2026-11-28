import type { Metadata } from "next";
import Link from "next/link";
import JourneyNav from "@/components/JourneyNav";
import LoopStrip from "@/components/LoopStrip";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "02 Characterize | Shiyan DAP",
  description: "Stage 02 of the semiconductor engineering journey. Describe the workload before optimization.",
};

export default function CharacterizePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="02 Characterize" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Stage 02 Characterize</p>
        <h1 className="text-3xl font-bold">Characterize the workload</h1>
        <LoopStrip here="silicon" note="Stage 02 Characterize is inside Layer One." />
        <p className="text-zinc-300">
          Record what is computed, the input size, the current implementation, and the number that matters: cycles, latency, area, or a correctness check. This stage does not optimize and does not program a board.
        </p>
        <p className="text-sm text-zinc-400">
          The supported FPGA target is the ECP5 Versa (LFE5UM-45F) only. Arbitrary RTL upload is not accepted. Power: needs real board.
        </p>
        <p className="text-sm text-zinc-400">
          <Link className="text-emerald-400 underline" href="/assess">Stage 01 Discover</Link>
          {" · "}
          <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>
        </p>
        <JourneyNav href="/journey/characterize" />
      </main>
    </div>
  );
}
