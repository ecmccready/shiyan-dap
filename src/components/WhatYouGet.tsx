import Link from "next/link";

/** "What you get" pilot blurb. Built only from surfaces and wording already on the site. */
export default function WhatYouGet({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const muted = tone === "light" ? "text-neutral-600" : "text-zinc-400";
  const border = tone === "light" ? "" : "border-zinc-800";
  return (
    <section className={`rounded-lg border ${border} p-4 text-sm space-y-2`}>
      <p className="font-medium">What you get</p>
      <ul className={`list-disc pl-5 space-y-1 ${muted}`}>
        <li>
          <span className="text-emerald-500">Live:</span> a verified run on your repeated workflow, exported as an
          inspectable Run (<Link className="underline" href="/workbench/client">client pipeline</Link>).
        </li>
        <li>
          <span className="text-emerald-500">Live:</span> the per-step ledger (e, Δe, Φ, status) for that run, downloadable
          from <Link className="underline" href="/workbench/status">status</Link> and{" "}
          <Link className="underline" href="/workbench/result">result</Link>.
        </li>
        <li>
          <span className="text-emerald-500">Live:</span> independent read-only checks: GET /api/level4/verify and GET
          /api/level4/anchor for the run.
        </li>
        <li>
          <span className="text-amber-500">Directional:</span> on-chain anchoring. The anchor endpoint returns a
          commitment root today; nothing is written on-chain.
        </li>
        <li>Pricing: set per pilot against the measured Φ; no charge on ties or regressions.</li>
      </ul>
    </section>
  );
}
