import type { Metadata } from "next";
import Link from "next/link";
import SemiconductorDoor from "@/components/SemiconductorDoor";
import SiteHeader from "@/components/SiteHeader";
import { SCOPE } from "@/lib/domains/pipelines";

export const metadata: Metadata = {
  title: "Shiyan DAP — Physical AI",
  description:
    "Shiyan DAP / Aethel Node is built to bridge the gap between silicon performance and real-world physical autonomy. Compute and silicon, physical AI and robotics, and telemetry and governance.",
};

const card = "rounded-xl border border-zinc-800 p-4 hover:border-emerald-800";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Physical AI" />
      <main className="mx-auto max-w-5xl space-y-16 px-6 py-12">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Shiyan DAP · Aethel Node</p>
          <h1 className="text-4xl font-bold tracking-tight">Physical AI</h1>
          <p className="text-lg text-zinc-200">
            Aethel Node is built to bridge the gap between silicon performance and real-world physical autonomy.
          </p>
          <p className="max-w-3xl text-zinc-400">
            Semiconductors and robotics sit on one evidence path. Silicon is measured. Robotics on this door is a synthetic fixture. Governance keeps the ledger, the plant, and the step that follows a measured proof.
          </p>
        </header>

        <nav aria-label="Layers" className="grid gap-3 sm:grid-cols-3">
          <a href="#compute-silicon" className={card}>
            <p className="font-mono text-xs text-emerald-400">Layer one</p>
            <p className="mt-1 font-semibold">Compute / Silicon</p>
            <p className="mt-2 text-xs text-zinc-400">FPGA verification, 4D-SCP, the ECP5 bitstream, measured Fmax, and bit-exact proofs.</p>
          </a>
          <a href="#physical-ai" className={card}>
            <p className="font-mono text-xs text-emerald-400">Layer two</p>
            <p className="mt-1 font-semibold">Physical AI / Robotics</p>
            <p className="mt-2 text-xs text-zinc-400">Long-horizon policies on synthetic fixtures. No field metric on this door.</p>
          </a>
          <a href="#telemetry" className={card}>
            <p className="font-mono text-xs text-emerald-400">Layer three</p>
            <p className="mt-1 font-semibold">Telemetry / Governance</p>
            <p className="mt-2 text-xs text-zinc-400">Ledger, proof, the Level 4 plant, and conversion after measured proof.</p>
          </a>
        </nav>

        <SemiconductorDoor />

        <section id="physical-ai" data-front-door-layer="physical-ai-robotics" className="scroll-mt-8 space-y-4">
          <p className="font-mono text-xs text-emerald-400">Layer two</p>
          <h2 className="text-2xl font-semibold">Physical AI / Robotics</h2>
          <p className="max-w-3xl text-sm text-zinc-400">
            Long-horizon policies, a benchmark protocol, a value summary, a deterministic experiment, and the policies under comparison.
            These routes exist in this repository. They run on synthetic fixtures. Real robot control remains outside the engine.
            This layer shows no field metric.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/workbench/robotics" className={card}>
              <h3 className="font-semibold">Long-horizon robotics policies</h3>
              <p className="mt-2 text-sm text-zinc-400">Synthetic fixture on the four-stage graph. Not field evidence.</p>
            </Link>
            <Link href="/workbench/robotics/benchmark" className={card}>
              <h3 className="font-semibold">Robotics benchmark</h3>
              <p className="mt-2 text-sm text-zinc-400">Protocol for persistent autonomy. Synthetic fixture today.</p>
            </Link>
            <Link href="/workbench/robotics/value" className={card}>
              <h3 className="font-semibold">Robotics value</h3>
              <p className="mt-2 text-sm text-zinc-400">What the verification layer is for. Demonstrated physical performance is not established.</p>
            </Link>
            <Link href="/workbench/robotics/experiment" className={card}>
              <h3 className="font-semibold">Robotics experiment</h3>
              <p className="mt-2 text-sm text-zinc-400">Deterministic simulator for look-back versus greedy. Real robot control stays outside the engine.</p>
            </Link>
            <Link href="/workbench/robotics/policies" className={card}>
              <h3 className="font-semibold">Robotics policies</h3>
              <p className="mt-2 text-sm text-zinc-400">Look-back and greedy under identical conditions. Synthetic fixture.</p>
            </Link>
          </div>
          <p className="text-sm text-zinc-500">
            Labeled synthetic. Physical execution on a robot is not established. Field robotics remains in development.
          </p>
        </section>

        <section id="telemetry" data-front-door-layer="telemetry-governance" className="scroll-mt-8 space-y-4">
          <p className="font-mono text-xs text-emerald-400">Layer three</p>
          <h2 className="text-2xl font-semibold">Telemetry / Governance</h2>
          <p className="max-w-3xl text-sm text-zinc-400">
            Evidence, the plant, and the commercial step after a measurement. A result stays attached to the record that produced it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/workbench/reference-ledger" className={card}>
              <h3 className="font-semibold">Reference Data Ledger</h3>
              <p className="mt-2 text-sm text-zinc-400">The semiconductor evidence record. Promotion to verified waits on a physical measurement.</p>
            </Link>
            <Link href="/workbench/compute-proof" className={card}>
              <h3 className="font-semibold">Computational Improvement Proof</h3>
              <p className="mt-2 text-sm text-zinc-400">Measured silicon result and the bitstream status.</p>
            </Link>
            <Link href="/workbench/proof" className={card}>
              <h3 className="font-semibold">Proof</h3>
              <p className="mt-2 text-sm text-zinc-400">Proof pack surface.</p>
            </Link>
            <Link href="/workbench/evidence" className={card}>
              <h3 className="font-semibold">Authoritative evidence</h3>
              <p className="mt-2 text-sm text-zinc-400">Evidence held for review.</p>
            </Link>
            <Link href="/workbench/autonomous" className={card}>
              <h3 className="font-semibold">Level 4 plant</h3>
              <p className="mt-2 text-sm text-zinc-400">Authoritative execution path. This page links to it and does not modify it.</p>
            </Link>
            <Link href="/workbench/status" className={card}>
              <h3 className="font-semibold">Level 4 status</h3>
              <p className="mt-2 text-sm text-zinc-400">Plant status. Linked only.</p>
            </Link>
            <Link href="/workbench/offer" className={card}>
              <h3 className="font-semibold">Offer</h3>
              <p className="mt-2 text-sm text-zinc-400">Commercial conversion after measured proof.</p>
            </Link>
            <Link href="/workbench/pilot" className={card}>
              <h3 className="font-semibold">Pilot</h3>
              <p className="mt-2 text-sm text-zinc-400">Proof-to-pilot after measured proof.</p>
            </Link>
            <Link href="/workbench/medicare" className={card}>
              <h3 className="font-semibold">Medicare intelligence</h3>
              <p className="mt-2 text-sm text-zinc-400">Medicare · Public Data Intelligence. Committed public-data fixture. No PHI. Not a clinical claim.</p>
            </Link>
          </div>
        </section>

        <p className="text-sm text-zinc-500">
          <span className="text-zinc-300">Domain selector.</span> Global Misdiagnosis, the ACA reference market, and AI pipelines stay in the header selector. They are not the headline of this page.
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
