import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Workload assessment | Shiyan DAP",
  description: "What to bring to a Shiyan DAP workload assessment. No form is submitted. No PHI.",
};

export default function AssessPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Discover" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">01 Discover</p>
          <h1 className="text-3xl font-bold">Run a workload assessment</h1>
          <p className="text-zinc-400">
            This page describes what to bring and what you get. There is no submission form and no billing.
            Do not send protected health information. Nothing here is a clinical claim.
          </p>
        </header>
        <section className="space-y-2 text-sm text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Bring</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>The workload: what is computed, and the input size.</li>
            <li>The current implementation, or a precise description of it.</li>
            <li>The number you care about: cycles, latency, area, or a correctness check.</li>
            <li>What must stay unchanged: interfaces, golden outputs, and seeds that are not for fitting.</li>
          </ul>
        </section>
        <section className="space-y-2 text-sm text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Get</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>A baseline, labeled as simulated, routed, or physically measured.</li>
            <li>4D-SCP candidates, including STOP results.</li>
            <li>An FPGA place-and-route record when a mapping is attempted.</li>
            <li>A proof package only for results that the ledger can cite.</li>
          </ul>
        </section>
        <p className="text-sm text-zinc-500">
          Physical board programming, real workload throughput, and power measurement are outstanding on the
          current reference implementation.{" "}
          <Link className="text-emerald-400 underline" href="/workbench/reference-ledger">Reference Data Ledger</Link>
          {" · "}
          <Link className="text-emerald-400 underline" href="/">Front door</Link>
        </p>
      </main>
    </div>
  );
}
