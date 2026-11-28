import type { Metadata } from "next";
import RecursiveLoop from "@/components/RecursiveLoop";
import SemiconductorDoor from "@/components/SemiconductorDoor";
import SiteHeader from "@/components/SiteHeader";
import { SCOPE } from "@/lib/domains/pipelines";
import { ADVANTAGE, ADVANTAGE_LIMIT } from "@/lib/semiconductor/loop";

export const metadata: Metadata = {
  title: "Shiyan DAP — Compute / Silicon",
  description:
    "Layer One leads Shiyan DAP / Aethel Node: the 4D-SCP hybrid, from software model to virtual chip to an FPGA bitstream awaiting a physical board. The moat is software, virtualware, and hardware.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Compute / Silicon" />
      <main className="mx-auto max-w-5xl min-w-0 space-y-16 px-6 py-8">
        <SemiconductorDoor />

        <div className="max-w-3xl space-y-3">
          <p className="text-zinc-300">{ADVANTAGE}</p>
          <p className="text-sm text-zinc-500">{ADVANTAGE_LIMIT}</p>
          <p className="text-zinc-400">
            Aethel Node is built to bridge the gap between silicon performance and real-world physical autonomy.
            Layers Two and Three carry that bridge in the loop below. They are not headline peers on this page.
          </p>
        </div>

        <RecursiveLoop />

        <p className="max-w-3xl text-sm text-zinc-400">
          <span className="text-zinc-300">Domain selector.</span> Layer Two — Physical AI / Robotics and Layer Three — Telemetry / Governance are reached from the header selector, then Medicare intelligence. Global Misdiagnosis, the ACA reference market, and AI pipelines stay in that selector. They are not the headline of this page.
        </p>

        <p className="text-sm text-zinc-400">{SCOPE}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Boundaries</h2>
          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
            <p><span className="text-zinc-200">Core boundary.</span> Semiconductor computation and verification is the measured core of this stack.</p>
            <p><span className="text-zinc-200">Computational boundary.</span> 4D-SCP owns representations and operations. Aethel Node orchestrates. Shiyan DAP records and evaluates. 4D-SCP stays unwired from production routes.</p>
            <p><span className="text-zinc-200">Domain boundary.</span> Global Misdiagnosis, the ACA reference market, and AI pipelines stay in the domain selector. They do not redefine the semiconductor core.</p>
            <p><span className="text-zinc-200">Evidence boundary.</span> A result is not promoted to a verified reference until it includes a physical measurement on the ECP5 Versa. No PHI. No clinical claims. The Level 4 plant is linked, not modified.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
