"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import StripePayment from "@/components/StripePayment";
import { clusterToNFTMetadata } from "@/lib/nft";
import { FIRST_SINGLE_URL, mergeInventory, mergePlaylists, proofInventory, proofPlaylists } from "@/lib/proof-catalog";

export default function MarketplacePage() {
  const [inventory, setInventory] = useState<any[]>(proofInventory);
  const [bundles, setBundles] = useState<any[]>(proofPlaylists);
  const [updating, setUpdating] = useState<string | null>(null);
  const [mintedNFT, setMintedNFT] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketplace").then((res) => res.json()).then((data) => setInventory(mergeInventory(data.inventory))).catch(() => setInventory(proofInventory));
    fetch("/api/playlist").then((res) => res.json()).then((data) => setBundles(mergePlaylists(data.playlists))).catch(() => setBundles(proofPlaylists));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/marketplace/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const data = await res.json();
      if (data.payment?.clientSecret) setClientSecret(data.payment.clientSecret);
      const fresh = await fetch("/api/marketplace").then((r) => r.json());
      setInventory(mergeInventory(fresh.inventory));
    } finally {
      setUpdating(null);
    }
  };

  const handleMint = async (cluster: any) => {
    const metadata = clusterToNFTMetadata(cluster);
    try {
      const res = await fetch("/api/nft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metadata, owner: cluster.owner, clusterId: cluster.id }) });
      const data = await res.json();
      setMintedNFT(data.success ? data.nft.metadata : metadata);
    } catch {
      setMintedNFT(metadata);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="B2B Marketplace" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Missing Middle Marketplace</h1>
        <p className="text-zinc-400 max-w-3xl mb-6">Proof first. First Single is already on the shelf.</p>
        <div className="flex flex-wrap gap-3 mb-10">
          <a href={FIRST_SINGLE_URL} target="_blank" rel="noreferrer" className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-medium inline-flex items-center">Shiyan Yishu</a>
          <Link href="/playlist" className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-medium inline-flex items-center">Playlist</Link>
          <Link href="/home" className="h-9 px-4 rounded-full bg-zinc-800 text-white text-xs font-medium inline-flex items-center">C2C Home</Link>
        </div>
        {bundles.map((bundle) => (
          <div key={bundle.id} className="mb-8 bg-zinc-900/60 border border-amber-800/40 rounded-2xl p-6">
            <p className="text-sm text-amber-400 mb-2">B2B bundle</p>
            <p className="text-lg font-semibold">{bundle.name}</p>
          </div>
        ))}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {inventory.map((cluster) => (
            <div key={cluster.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold">{cluster.name}</h2>
              <p className="text-sm text-zinc-400 mt-1">{cluster.domain} · {cluster.owner}</p>
              {cluster.assetUrl && <a href={cluster.assetUrl} target="_blank" rel="noreferrer" className="block text-sm text-emerald-400 mt-3">Open master</a>}
              <div className="flex flex-wrap gap-2 mt-5">
                <button onClick={() => handleMint(cluster)} className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs">Prove / mint</button>
                <button onClick={() => updateStatus(cluster.id, "reserved")} disabled={updating === cluster.id} className="h-9 px-4 rounded-full bg-zinc-800 text-white text-xs">Reserve</button>
                <Link href="/bot" className="h-9 px-4 rounded-full border border-zinc-700 text-zinc-300 text-xs inline-flex items-center">Grok Bot</Link>
              </div>
            </div>
          ))}
        </div>
        {mintedNFT && <p className="mt-6 text-sm text-emerald-400">Minted {mintedNFT.name || "record"}</p>}
        {clientSecret && <div className="mt-6"><StripePayment clientSecret={clientSecret} /></div>}
      </main>
    </div>
  );
}
