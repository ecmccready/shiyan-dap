"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceListings from "@/components/MarketplaceListings";
import { buildPeerRegistry, PEERS_REGISTRY_NOTE } from "@/lib/marketplace/peers";

const PEERS = buildPeerRegistry(null).peers;

const LISTINGS = [
  {
    id: "safety-sealed",
    title: "Safety evidence gate",
    sequence: "mark_boundary → complete_field → request_independent_check → seal_pack",
    phi: "0.014 / 0.065 / 0.065",
    status: "verified on plant · not settled",
  },
  {
    id: "shiyan-pipeline",
    title: "Shiyan pipeline reliability",
    sequence: "mark_boundary → complete_field → request_independent_check → seal_pack",
    phi: "0.51 / 0.45 / 0.38",
    status: "reference plant · not settled",
  },
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Marketplace
        </p>
        <h1 className="text-3xl font-bold mb-3">Verified reusable workflows</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Aethel Node proves that the next action is no longer a misdiagnosis. Later paid access to sequences that have already lowered final e on a reference.
          A listing is not a settled sale. An unsettled receipt is not revenue.
        </p>

        <MarketplaceListings />

        <h2 className="text-xl font-semibold text-white mb-3">Reference listings (static)</h2>
        {LISTINGS.map((item) => (
          <section key={item.id} className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
            <h2 className="text-lg font-semibold text-white mb-2">{item.title}</h2>
            <p className="mb-1"><span className="text-white">Sequence:</span> {item.sequence}</p>
            <p className="mb-1"><span className="text-white">Φ:</span> {item.phi}</p>
            <p className="text-zinc-500 text-xs">{item.status}</p>
          </section>
        ))}

        <h2 className="text-xl font-semibold text-white mb-3">Known peers</h2>
        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300" aria-label="Known peers">
          <p className="text-zinc-400 text-xs mb-3">{PEERS_REGISTRY_NOTE}</p>
          <ul className="space-y-3">
            {PEERS.map((peer) => (
              <li key={peer.id} className="border border-zinc-800 rounded-xl p-3">
                <p className="text-white">
                  {peer.name}{" "}
                  <span className="text-xs text-zinc-500">
                    · {peer.status === "this_node" ? "this node" : "placeholder — not a live node"}
                  </span>
                </p>
                {peer.index_url ? (
                  <p className="text-xs mt-1">
                    <Link className="underline" href={peer.index_url}>Marketplace index</Link>
                    {peer.listings_url ? (
                      <>
                        {" · "}
                        <a className="underline" href={peer.listings_url}>Listings JSON</a>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-1">{peer.note}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500 mt-3">
            The same list is available as JSON at <a className="underline" href="/api/marketplace/peers">/api/marketplace/peers</a>.
          </p>
        </section>

        <p className="text-sm text-zinc-300 mb-8">
          Same sealed sequence as the Safety and Shiyan plants. Φ stays inside the plant that produced it.
          Not a diagnosis. No PHI. Not revenue.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/shiyan">Shiyan pipeline</Link>
          <Link className="underline" href="/workbench/history">History</Link>
        </nav>
      </main>
    </div>
  );
}