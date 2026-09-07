"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function ProvePage() {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/nft")
      .then((res) => res.json())
      .then((data) => {
        setNfts(data.nfts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading provenance…</p></div>;
  }
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="04 Prove" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 04</p>
        <h1 className="text-3xl font-bold mb-2">Prove it</h1>
        <p className="text-zinc-400 mb-10">Ownership, provenance, timestamp, rights record.</p>
        {nfts.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 mb-4">No provenance records minted yet.</p>
            <Link href="/marketplace" className="inline-block px-6 h-11 leading-[44px] rounded-full bg-emerald-600 text-white text-sm">Mint from Marketplace</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {nfts.map((nft) => (
              <div key={nft.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <p className="text-xs text-emerald-400 mb-2">Provenance record</p>
                <h2 className="text-lg font-semibold">{nft.metadata?.name || "Unnamed Cluster"}</h2>
                <p className="text-sm text-zinc-400 mt-2">Owner: {nft.owner}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
