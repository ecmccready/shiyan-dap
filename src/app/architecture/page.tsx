import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Spec" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">
          One loop
        </p>
        <h1 className="text-3xl font-bold">A acts, B transitions, z is measured</h1>
        <p className="text-zinc-400">
          Collapse A, B, and z. They are roles in one closed loop, not three
          products. Grok / Hy4 / Grok Bot are drop-in namers of y inside A.
        </p>
        <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">{`z_t --Self() in A--> y_t --W(B,y)--> B'_{t+1}
         measure z_{t+1}, e_t --M--> z-next`}</pre>
        <ul className="space-y-3 text-zinc-300 text-sm">
          <li>
            <b>A — controller.</b> Task, Policy, Evaluator, Memory, Self().
            Names y.
          </li>
          <li>
            <b>B — environment.</b> Safety reference pack (misdiagnosis
            cases as experience). Not a customer, not a clinician.
          </li>
          <li>
            <b>z — measured |B′|</b> after the transition. Not an LLM
            opinion.
          </li>
          <li>
            <b>e — error vs reference label / second-order check.</b> This
            is what can list on the marketplace.
          </li>
        </ul>
        <p className="text-zinc-400 text-sm">
          That triad is the product. Models do not sit outside it.
          Intelligence is the measured reduction of e on B. Music rail
          remains /nfts. Domain = safety opens the safety plant.
        </p>
        <p className="text-zinc-500 text-sm">
          Not SIMA 2. Not AGI. Not unsupervised clinical diagnosis or
          treatment. Scaffold only. No production PHI.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/">
            Home
          </Link>
          <Link className="underline" href="/loop">
            Run it
          </Link>
          <Link className="underline" href="/workbench/safety">
            Safety pack
          </Link>
        </div>
      </main>
    </div>
  );
}
