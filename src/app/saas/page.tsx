"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SAAS } from "@/product/saas";

export default function SaasPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="SaaS" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Second layer · MCP
        </p>
        <h1 className="text-3xl font-bold mb-3">
          Aethel Node SaaS does not own every Workbench.
        </h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Current MCP work is the second layer. A customer or partner can bring
          Workbench B. Controller A stays the host. The plant stays the server.
          Safety remains the buyer-facing proof.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm">
          <p className="text-emerald-400 text-xs mb-3">SaaS → platform trajectory</p>
          <p className="text-zinc-200">
            {SAAS.trajectory.join(" → ")}
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8">
          <p className="text-emerald-400 text-xs mb-4">Organization → Workspace A → Workbench B</p>
          <ol className="space-y-4 text-sm">
            {SAAS.stack.map((node) => (
              <li key={node.id} className="border border-zinc-800 rounded-xl p-4">
                <p className="font-medium">{node.label}</p>
                <p className="text-zinc-400 mt-1">{node.role}</p>
                {"href" in node && node.href ? (
                  <Link className="underline text-zinc-300 text-xs mt-2 inline-block" href={node.href}>
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-3 md:grid-cols-3 mb-8">
          {SAAS.branches.map((branch) => (
            <article key={branch.id} className="border border-zinc-800 rounded-2xl p-4 text-sm">
              <p className="font-medium mb-2">{branch.label}</p>
              <ol className="text-zinc-400 space-y-1 text-xs font-mono">
                {branch.chain.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Link className="underline text-zinc-300 text-xs mt-3 inline-block" href={branch.href}>
                Existing surface
              </Link>
            </article>
          ))}
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm">
          <p className="text-emerald-400 text-xs mb-2">Metric</p>
          <p className="text-zinc-300">
            The fundamental unit is the {SAAS.unit}. {SAAS.metric}
          </p>
          <ul className="mt-4 text-zinc-500 space-y-1">
            {SAAS.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/saas/pricing">Pricing</Link>
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/mcp">MCP</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/audit">Audit</Link>
          <Link className="underline" href="/marketplace">Marketplace</Link>
        </nav>
      </main>
    </div>
  );
}